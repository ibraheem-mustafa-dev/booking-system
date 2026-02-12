import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';
import { workingHours, availabilityOverrides } from '@/lib/db/schema';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const timeSlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6), // 0 = Sunday, 6 = Saturday
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format'),
});

const overrideInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format').optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format'),
  type: z.enum(['available', 'blocked']),
  reason: z.string().max(500).optional(),
  isRecurring: z.boolean().default(false),
  recurrenceRule: z.string().max(256).optional(),
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const availabilityRouter = router({
  // =========================================================================
  // Working Hours
  // =========================================================================

  /** Get all working hour slots for the current user */
  getWorkingHours: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(workingHours)
      .where(eq(workingHours.userId, ctx.user.id))
      .orderBy(workingHours.dayOfWeek, workingHours.startTime);
  }),

  /**
   * Bulk save working hours — deletes all existing and inserts the new set.
   * This is simpler than trying to diff individual rows since the user edits
   * the entire week at once.
   */
  saveWorkingHours: protectedProcedure
    .input(
      z.object({
        timezone: z.string().min(1).max(64),
        slots: z.array(timeSlotSchema),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Validate that endTime is after startTime for each slot
      for (const slot of input.slots) {
        if (slot.endTime <= slot.startTime) {
          throw new Error(
            `End time (${slot.endTime}) must be after start time (${slot.startTime})`,
          );
        }
      }

      // Delete all existing working hours for this user, then insert new ones
      await ctx.db.transaction(async (tx) => {
        await tx
          .delete(workingHours)
          .where(eq(workingHours.userId, ctx.user.id));

        if (input.slots.length > 0) {
          await tx.insert(workingHours).values(
            input.slots.map((slot) => ({
              userId: ctx.user.id,
              dayOfWeek: slot.dayOfWeek,
              startTime: slot.startTime,
              endTime: slot.endTime,
              timezone: input.timezone,
            })),
          );
        }
      });

      return { success: true };
    }),

  // =========================================================================
  // Availability Overrides
  // =========================================================================

  /** List all overrides for the current user */
  listOverrides: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(availabilityOverrides)
      .where(eq(availabilityOverrides.userId, ctx.user.id))
      .orderBy(availabilityOverrides.date, availabilityOverrides.startTime);
  }),

  /** Create a new override */
  createOverride: protectedProcedure
    .input(overrideInput)
    .mutation(async ({ ctx, input }) => {
      if (input.endTime <= input.startTime) {
        throw new Error(
          `End time (${input.endTime}) must be after start time (${input.startTime})`,
        );
      }

      // Recurring overrides must have a recurrence rule and no specific date
      if (input.isRecurring && !input.recurrenceRule) {
        throw new Error('Recurring overrides require a recurrence rule');
      }
      if (input.isRecurring && input.date) {
        throw new Error('Recurring overrides should not have a specific date');
      }
      if (!input.isRecurring && !input.date) {
        throw new Error('Non-recurring overrides require a specific date');
      }

      const [created] = await ctx.db
        .insert(availabilityOverrides)
        .values({
          userId: ctx.user.id,
          date: input.date || null,
          startTime: input.startTime,
          endTime: input.endTime,
          type: input.type,
          reason: input.reason || null,
          isRecurring: input.isRecurring,
          recurrenceRule: input.recurrenceRule || null,
        })
        .returning();

      return created;
    }),

  /** Update an existing override */
  updateOverride: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: overrideInput.partial(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const existing = await ctx.db
        .select({ id: availabilityOverrides.id })
        .from(availabilityOverrides)
        .where(
          and(
            eq(availabilityOverrides.id, input.id),
            eq(availabilityOverrides.userId, ctx.user.id),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        throw new Error('Override not found');
      }

      // Validate time order if both times are provided
      if (input.data.startTime && input.data.endTime) {
        if (input.data.endTime <= input.data.startTime) {
          throw new Error(
            `End time (${input.data.endTime}) must be after start time (${input.data.startTime})`,
          );
        }
      }

      // Sanitise nullable fields
      const sanitised = {
        ...input.data,
        ...('date' in input.data ? { date: input.data.date || null } : {}),
        ...('reason' in input.data ? { reason: input.data.reason || null } : {}),
        ...('recurrenceRule' in input.data
          ? { recurrenceRule: input.data.recurrenceRule || null }
          : {}),
      };

      const [updated] = await ctx.db
        .update(availabilityOverrides)
        .set(sanitised)
        .where(eq(availabilityOverrides.id, input.id))
        .returning();

      return updated;
    }),

  /** Delete an override */
  deleteOverride: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const existing = await ctx.db
        .select({ id: availabilityOverrides.id })
        .from(availabilityOverrides)
        .where(
          and(
            eq(availabilityOverrides.id, input.id),
            eq(availabilityOverrides.userId, ctx.user.id),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        throw new Error('Override not found');
      }

      await ctx.db
        .delete(availabilityOverrides)
        .where(eq(availabilityOverrides.id, input.id));

      return { success: true };
    }),
});
