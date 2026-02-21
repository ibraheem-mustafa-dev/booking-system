import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, orgProcedure } from '../trpc';
import { db } from '@/lib/db';
import { meetingRecordings, bookings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { transcribeAudio } from '@/lib/ai/deepgram';
import { generateMeetingSummary, formatSummary } from '@/lib/ai/gemini';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const recordingsRouter = router({
  /**
   * Upload and transcribe a meeting recording
   *
   * Flow:
   * 1. Validate booking exists and user has access
   * 2. Upload audio to Supabase Storage
   * 3. Transcribe with Deepgram (speaker diarization)
   * 4. Generate summary with Claude
   * 5. Store in database
   */
  create: orgProcedure
    .input(
      z.object({
        bookingId: z.string().uuid(),
        audioFile: z.object({
          name: z.string(),
          type: z.string(),
          size: z.number(),
          data: z.string(), // Base64-encoded audio data
        }),
        recordedVia: z.enum(['online', 'phone_upload', 'browser_mic']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify booking exists and user has access
      const booking = await db
        .select({
          id: bookings.id,
          orgId: bookings.orgId,
        })
        .from(bookings)
        .where(eq(bookings.id, input.bookingId))
        .limit(1);

      if (!booking[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Booking not found',
        });
      }

      // Verify user belongs to the organisation
      if (booking[0].orgId !== ctx.orgId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this booking',
        });
      }

      // Decode base64 audio data
      const audioBuffer = Buffer.from(input.audioFile.data, 'base64');

      // Upload to Supabase Storage
      const fileName = `${input.bookingId}/${Date.now()}-${input.audioFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('meeting-recordings')
        .upload(fileName, audioBuffer, {
          contentType: input.audioFile.type,
          upsert: false,
        });

      if (uploadError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to upload recording: ${uploadError.message}`,
        });
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('meeting-recordings')
        .getPublicUrl(uploadData.path);

      const recordingUrl = urlData.publicUrl;

      // Transcribe with Deepgram
      const transcription = await transcribeAudio(audioBuffer);

      // Generate summary with Claude
      const summaryData = await generateMeetingSummary(
        transcription.transcript,
        transcription.speakers
      );

      const summaryText = formatSummary(summaryData);

      // Store in database
      const [recording] = await db
        .insert(meetingRecordings)
        .values({
          bookingId: input.bookingId,
          transcriptText: transcription.transcript,
          summaryText,
          summaryShared: false,
          recordingUrl,
          recordedVia: input.recordedVia,
        })
        .returning();

      return {
        id: recording.id,
        transcriptPreview: transcription.transcript.slice(0, 200) + '...',
        summaryText,
        recordingUrl,
      };
    }),

  /**
   * Get all recordings for a booking
   */
  getByBooking: orgProcedure
    .input(z.object({ bookingId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify booking access
      const booking = await db
        .select({ orgId: bookings.orgId })
        .from(bookings)
        .where(eq(bookings.id, input.bookingId))
        .limit(1);

      if (!booking[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Booking not found',
        });
      }

      if (booking[0].orgId !== ctx.orgId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this booking',
        });
      }

      // Fetch recordings
      const recordings = await db
        .select()
        .from(meetingRecordings)
        .where(eq(meetingRecordings.bookingId, input.bookingId))
        .orderBy(meetingRecordings.createdAt);

      return recordings;
    }),

  /**
   * Get single recording with full transcript
   */
  getById: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const recording = await db
        .select({
          recording: meetingRecordings,
          booking: {
            id: bookings.id,
            orgId: bookings.orgId,
          },
        })
        .from(meetingRecordings)
        .innerJoin(bookings, eq(meetingRecordings.bookingId, bookings.id))
        .where(eq(meetingRecordings.id, input.id))
        .limit(1);

      if (!recording[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Recording not found',
        });
      }

      if (recording[0].booking.orgId !== ctx.orgId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this recording',
        });
      }

      return recording[0].recording;
    }),

  /**
   * Toggle whether summary is shared with client
   */
  toggleSummarySharing: orgProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        shared: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify access
      const recording = await db
        .select({
          recording: meetingRecordings,
          booking: {
            orgId: bookings.orgId,
          },
        })
        .from(meetingRecordings)
        .innerJoin(bookings, eq(meetingRecordings.bookingId, bookings.id))
        .where(eq(meetingRecordings.id, input.id))
        .limit(1);

      if (!recording[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Recording not found',
        });
      }

      if (recording[0].booking.orgId !== ctx.orgId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this recording',
        });
      }

      // Update
      await db
        .update(meetingRecordings)
        .set({ summaryShared: input.shared })
        .where(eq(meetingRecordings.id, input.id));

      return { success: true };
    }),

  /**
   * Delete a recording (and remove from storage)
   */
  delete: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify access
      const recording = await db
        .select({
          recording: meetingRecordings,
          booking: {
            orgId: bookings.orgId,
          },
        })
        .from(meetingRecordings)
        .innerJoin(bookings, eq(meetingRecordings.bookingId, bookings.id))
        .where(eq(meetingRecordings.id, input.id))
        .limit(1);

      if (!recording[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Recording not found',
        });
      }

      if (recording[0].booking.orgId !== ctx.orgId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this recording',
        });
      }

      // Extract file path from URL
      const recordingUrl = recording[0].recording.recordingUrl;
      if (recordingUrl) {
        const urlParts = recordingUrl.split('/meeting-recordings/');
        if (urlParts[1]) {
          await supabase.storage
            .from('meeting-recordings')
            .remove([urlParts[1]]);
        }
      }

      // Delete from database
      await db
        .delete(meetingRecordings)
        .where(eq(meetingRecordings.id, input.id));

      return { success: true };
    }),
});
