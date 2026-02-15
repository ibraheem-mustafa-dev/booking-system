import { z } from 'zod';
import { router, orgProcedure } from '../trpc';
import { db } from '@/lib/db';
import { bookings, bookingTypes } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export const bookingsRouter = router({
  /**
   * List bookings for the current organisation
   */
  list: orgProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).optional().default(50),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;

      const results = await db
        .select({
          id: bookings.id,
          clientName: bookings.clientName,
          clientEmail: bookings.clientEmail,
          startTime: bookings.startAt,
          endTime: bookings.endAt,
          status: bookings.status,
          createdAt: bookings.createdAt,
        })
        .from(bookings)
        .where(eq(bookings.orgId, ctx.orgId))
        .orderBy(desc(bookings.startAt))
        .limit(limit);

      return results;
    }),

  /**
   * Create a booking from the dashboard
   */
  create: orgProcedure
    .input(
      z.object({
        bookingTypeId: z.string().uuid(),
        clientName: z.string().min(1).max(256),
        clientEmail: z.string().email().max(320),
        clientPhone: z.string().max(32).optional(),
        startAt: z.string().datetime(),
        endAt: z.string().datetime(),
        notes: z.string().optional(),
        location: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [booking] = await db
        .insert(bookings)
        .values({
          orgId: ctx.orgId,
          bookingTypeId: input.bookingTypeId,
          organiserId: ctx.user.id,
          clientName: input.clientName,
          clientEmail: input.clientEmail,
          clientPhone: input.clientPhone || null,
          clientTimezone: 'Europe/London',
          startAt: new Date(input.startAt),
          endAt: new Date(input.endAt),
          status: 'confirmed',
          notes: input.notes || null,
          location: input.location || null,
          customFieldResponses: {},
          cancellationToken: crypto.randomUUID(),
          rescheduleToken: crypto.randomUUID(),
        })
        .returning();

      return booking;
    }),
});
