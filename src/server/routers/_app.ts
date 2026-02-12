import { router } from '../trpc';
import { bookingTypesRouter } from './bookingTypes';

export const appRouter = router({
  bookingTypes: bookingTypesRouter,
});

export type AppRouter = typeof appRouter;
