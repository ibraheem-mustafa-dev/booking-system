import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Match all routes except:
    // - Static files and images
    // - tRPC API (has its own auth middleware)
    // - Public booking pages (/book/...)
    // - Public REST API (/api/v1/book/... and /api/v1/health)
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api/trpc|api/v1|book).*)',
  ],
};
