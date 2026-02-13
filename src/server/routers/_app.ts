import { router } from '../trpc';
import { bookingTypesRouter } from './bookingTypes';
import { availabilityRouter } from './availability';
import { calendarRouter } from './calendar';
import { invoicesRouter } from './invoices';

export const appRouter = router({
  bookingTypes: bookingTypesRouter,
  availability: availabilityRouter,
  calendar: calendarRouter,
  invoices: invoicesRouter,
});

export type AppRouter = typeof appRouter;
