import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, organisations, orgMembers } from '@/lib/db/schema';
import { generateUniqueSlug } from '@/lib/auth/utils';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  // Use the configured app URL — request.nextUrl.origin returns the Docker
  // internal URL (0.0.0.0:3000) behind the Nginx reverse proxy.
  const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const code = searchParams.get('code');
  const redirectTo = searchParams.get('redirect') || '/dashboard';
  const errorParam = searchParams.get('error');

  // Handle error from Supabase (e.g. expired link)
  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorParam)}`, origin),
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', origin));
  }

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
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    },
  );

  // Exchange the code for a session
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error('Auth code exchange failed:', exchangeError.message);
    return NextResponse.redirect(new URL('/login?error=auth_failed', origin));
  }

  // Get the authenticated user
  const {
    data: { user: supabaseUser },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !supabaseUser) {
    console.error('Failed to get user after code exchange:', userError?.message);
    return NextResponse.redirect(new URL('/login?error=auth_failed', origin));
  }

  // ------------------------------------------------------------------
  // User sync: ensure the Supabase user has a row in our users table
  // ------------------------------------------------------------------
  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, supabaseUser.id))
    .limit(1);

  const displayName =
    supabaseUser.user_metadata?.full_name ||
    supabaseUser.user_metadata?.name ||
    supabaseUser.email?.split('@')[0] ||
    'User';

  if (existingUser.length === 0) {
    // First login — create user record
    await db.insert(users).values({
      id: supabaseUser.id,
      email: supabaseUser.email!,
      name: displayName,
      timezone: 'Europe/London',
    });
  } else {
    // Returning user — update email in case it changed
    await db
      .update(users)
      .set({
        email: supabaseUser.email!,
        updatedAt: new Date(),
      })
      .where(eq(users.id, supabaseUser.id));
  }

  // ------------------------------------------------------------------
  // Organisation auto-creation: every user needs at least one org
  // ------------------------------------------------------------------
  const membership = await db
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .where(eq(orgMembers.userId, supabaseUser.id))
    .limit(1);

  if (membership.length === 0) {
    // No organisation — create one automatically
    const orgName = `${displayName}'s Organisation`;
    const slug = await generateUniqueSlug(orgName, db);
    const orgId = crypto.randomUUID();

    await db.insert(organisations).values({
      id: orgId,
      name: orgName,
      slug,
      ownerId: supabaseUser.id,
    });

    await db.insert(orgMembers).values({
      orgId,
      userId: supabaseUser.id,
      role: 'owner',
    });
  }

  // Redirect to the intended destination
  return NextResponse.redirect(new URL(redirectTo, origin));
}
