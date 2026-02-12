import { router } from '../trpc';

export const appRouter = router({
  // Routers will be added as we build each feature:
  // bookingTypes: bookingTypesRouter,
  // availability: availabilityRouter,
  // bookings: bookingsRouter,
  // calendar: calendarRouter,
  // invoices: invoicesRouter,
  // recordings: recordingsRouter,
  // settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
