import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/routers/_app';
import { createContext } from '@/server/trpc';

// Prevent Next.js from collecting page data for this route —
// tRPC is always dynamic (depends on cookies, query params)
export const dynamic = 'force-dynamic';

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext,
  });
}

export { handler as GET, handler as POST };
