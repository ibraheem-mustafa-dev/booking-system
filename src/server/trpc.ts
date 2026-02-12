import { initTRPC, TRPCError } from '@trpc/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { users, orgMembers, organisations } from '@/lib/db/schema';
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
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
