import { router } from '../trpc';
import { bookingTypesRouter } from './bookingTypes';
import { availabilityRouter } from './availability';
import { calendarRouter } from './calendar';

export const appRouter = router({
  bookingTypes: bookingTypesRouter,
  availability: availabilityRouter,
  calendar: calendarRouter,
});

export type AppRouter = typeof appRouter;
