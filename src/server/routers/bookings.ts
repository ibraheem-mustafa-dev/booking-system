import { z } from 'zod';
import { router, orgProcedure } from '../trpc';
import { db } from '@/lib/db';
import { bookings, bookingTypes, organisations, invoices } from '@/lib/db/schema';
import { eq, desc, and, gte, lte, count, sql, ne } from 'drizzle-orm';
import { sendBookingEmails } from '@/lib/email/send-booking-emails';
import { createBookingEvent } from '@/lib/calendar/google';

export const bookingsRouter = router({
  /**
   * Dashboard overview stats for the current organisation
   */
  getOverview: orgProcedure.query(async ({ ctx }) => {
    const now = new Date();

    // Next 7 days window
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // This month window
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [
      upcomingResult,
      thisMonthResult,
      recentBookingsResult,
      revenueResult,
      outstandingResult,
    ] = await Promise.all([
      // Upcoming confirmed bookings (next 7 days)
      ctx.db
        .select({ value: count() })
        .from(bookings)
        .where(
          and(
            eq(bookings.orgId, ctx.orgId),
            eq(bookings.status, 'confirmed'),
            gte(bookings.startAt, now),
            lte(bookings.startAt, sevenDaysFromNow),
          ),
        ),

      // This month booking count
      ctx.db
        .select({ value: count() })
        .from(bookings)
        .where(
          and(
            eq(bookings.orgId, ctx.orgId),
            ne(bookings.status, 'cancelled'),
            gte(bookings.startAt, monthStart),
            lte(bookings.startAt, monthEnd),
          ),
        ),

      // Last 5 bookings with booking type name
      ctx.db
        .select({
          id: bookings.id,
          clientName: bookings.clientName,
          clientEmail: bookings.clientEmail,
          startAt: bookings.startAt,
          status: bookings.status,
          bookingTypeName: bookingTypes.name,
        })
        .from(bookings)
        .leftJoin(bookingTypes, eq(bookings.bookingTypeId, bookingTypes.id))
        .where(eq(bookings.orgId, ctx.orgId))
        .orderBy(desc(bookings.createdAt))
        .limit(5),

      // This month revenue from paid invoices (in pence)
      ctx.db
        .select({
          total: sql<string>`COALESCE(SUM(${invoices.total}::numeric), 0)`,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.orgId, ctx.orgId),
            eq(invoices.paymentStatus, 'paid'),
            gte(invoices.paidAt, monthStart),
            lte(invoices.paidAt, monthEnd),
          ),
        ),

      // Outstanding invoices
      ctx.db
        .select({
          invoiceCount: count(),
          invoiceTotal: sql<string>`COALESCE(SUM(${invoices.total}::numeric), 0)`,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.orgId, ctx.orgId),
            eq(invoices.paymentStatus, 'pending'),
          ),
        ),
    ]);

    return {
      upcomingCount: upcomingResult[0]?.value ?? 0,
      thisMonthCount: thisMonthResult[0]?.value ?? 0,
      thisMonthRevenue: Math.round(parseFloat(revenueResult[0]?.total ?? '0') * 100),
      outstandingInvoicesCount: outstandingResult[0]?.invoiceCount ?? 0,
      outstandingInvoicesTotal: Math.round(parseFloat(outstandingResult[0]?.invoiceTotal ?? '0') * 100),
      recentBookings: recentBookingsResult.map((b) => ({
        id: b.id,
        clientName: b.clientName,
        clientEmail: b.clientEmail,
        startAt: b.startAt,
        status: b.status,
        bookingTypeName: b.bookingTypeName ?? 'Unknown',
      })),
    };
  }),

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
   * Get a single booking with full detail
   */
  getById: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [booking] = await db
        .select()
        .from(bookings)
        .where(eq(bookings.id, input.id))
        .limit(1);

      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.orgId !== ctx.orgId) {
        throw new Error('Access denied');
      }

      return booking;
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

      // Send confirmation + notification emails, schedule reminders
      // Fire-and-forget — email failures must not crash the booking flow
      void (async () => {
        try {
          const [org] = await db
            .select({ slug: organisations.slug })
            .from(organisations)
            .where(eq(organisations.id, ctx.orgId))
            .limit(1);

          const [type] = await db
            .select({ slug: bookingTypes.slug })
            .from(bookingTypes)
            .where(eq(bookingTypes.id, input.bookingTypeId))
            .limit(1);

          if (org && type) {
            await sendBookingEmails({
              bookingId: booking.id,
              orgSlug: org.slug,
              typeSlug: type.slug,
            });
          }
        } catch (err) {
          console.error('[bookings.create] Email sending failed:', err);
        }
      })();

      // Create Google Calendar event — fire-and-forget, never blocks booking
      void (async () => {
        try {
          const [type] = await db
            .select({ name: bookingTypes.name, locationDetails: bookingTypes.locationDetails })
            .from(bookingTypes)
            .where(eq(bookingTypes.id, input.bookingTypeId))
            .limit(1);

          if (!type) return;

          const eventId = await createBookingEvent({
            bookingTypeName: type.name,
            clientName: input.clientName,
            clientEmail: input.clientEmail,
            startAt: new Date(input.startAt),
            endAt: new Date(input.endAt),
            location: input.location ?? type.locationDetails,
            notes: input.notes,
          });

          if (eventId) {
            await db
              .update(bookings)
              .set({ googleCalendarEventId: eventId })
              .where(eq(bookings.id, booking.id));
          }
        } catch (err) {
          console.error('[bookings.create] Google Calendar event creation failed:', err);
        }
      })();

      return booking;
    }),
});
