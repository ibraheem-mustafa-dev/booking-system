import { router } from '../trpc';
import { bookingTypesRouter } from './bookingTypes';
import { availabilityRouter } from './availability';
import { calendarRouter } from './calendar';
import { invoicesRouter } from './invoices';
import { recordingsRouter } from './recordings';
import { bookingsRouter } from './bookings';

export const appRouter = router({
  bookingTypes: bookingTypesRouter,
  availability: availabilityRouter,
  calendar: calendarRouter,
  invoices: invoicesRouter,
  recordings: recordingsRouter,
  bookings: bookingsRouter,
});

export type AppRouter = typeof appRouter;
