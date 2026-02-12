import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUrl } from '@/lib/calendar/google';

/**
 * GET /api/auth/google/connect
 *
 * Initiates the Google Calendar OAuth flow.
 * Redirects the user to Google's consent screen.
 * The user's ID is passed as the `state` parameter for CSRF protection.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'You must be logged in to connect a calendar.' },
      { status: 401 },
    );
  }

  const authUrl = getAuthUrl(user.id);
  return NextResponse.redirect(authUrl);
}
