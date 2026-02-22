import { initTRPC, TRPCError } from '@trpc/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { orgMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import superjson from 'superjson';

export interface Context {
  db: typeof db;
  user: {
    id: string;
    email: string;
  } | null;
  orgId: string | null;
}

export async function createContext(): Promise<Context> {
  // During next build, env vars may not be available. Return unauthenticated
  // context so page data collection doesn't crash.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { db, user: null, orgId: null };
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — read-only cookies
          }
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  let orgId: string | null = null;

  if (user) {
    // Get the user's primary organisation
    const membership = await db
      .select({ orgId: orgMembers.orgId })
      .from(orgMembers)
      .where(eq(orgMembers.userId, user.id))
      .limit(1);

    if (membership.length > 0) {
      orgId = membership[0].orgId;
    }
  }

  return {
    db,
    user: user ? { id: user.id, email: user.email! } : null,
    orgId,
  };
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const isDev = process.env.NODE_ENV === 'development';

    // Intentionally-thrown TRPCErrors have no cause — pass them through
    // (e.g. UNAUTHORIZED, FORBIDDEN, NOT_FOUND with safe messages we wrote)
    if (!error.cause) {
      return {
        ...shape,
        data: {
          ...shape.data,
          stack: isDev ? shape.data?.stack : undefined,
        },
      };
    }

    // Unexpected errors (Drizzle SQL, connection failures, etc.) have a cause.
    // In production, replace the message to prevent leaking internals.
    return {
      ...shape,
      message: isDev
        ? shape.message
        : 'An unexpected error occurred. Please try again.',
      data: {
        ...shape.data,
        stack: isDev ? shape.data?.stack : undefined,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to perform this action.',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const orgProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.orgId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You must belong to an organisation to perform this action.',
    });
  }

  return next({
    ctx: {
      ...ctx,
      orgId: ctx.orgId,
    },
  });
});
