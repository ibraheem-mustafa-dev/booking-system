import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import { calendarAccounts } from '@/lib/db/schema';
import { encrypt } from '@/lib/crypto';
import {
  exchangeCodeForTokens,
  createOAuth2Client,
  getGoogleEmail,
  syncCalendarList,
} from '@/lib/calendar/google';

/**
 * GET /api/auth/google/callback
 *
 * Handles the OAuth callback from Google.
 * Exchanges the authorization code for tokens, encrypts them,
 * stores the calendar account, and syncs the calendar list.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const dashboardUrl = `${baseUrl}/dashboard/availability`;

  // Handle user denial
  if (error) {
    return NextResponse.redirect(
      `${dashboardUrl}?error=google_denied`,
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${dashboardUrl}?error=missing_params`,
    );
  }

  // Verify the state matches the logged-in user (CSRF protection)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== state) {
    return NextResponse.redirect(
      `${dashboardUrl}?error=auth_mismatch`,
    );
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Get the Google account email
    const client = createOAuth2Client();
    client.setCredentials({ access_token: tokens.accessToken });
    const googleEmail = await getGoogleEmail(client);

    // Encrypt tokens before storing
    const accessTokenEncrypted = encrypt(tokens.accessToken);
    const refreshTokenEncrypted = tokens.refreshToken
      ? encrypt(tokens.refreshToken)
      : null;

    // Store the calendar account
    const [account] = await db
      .insert(calendarAccounts)
      .values({
        userId: user.id,
        provider: 'google',
        providerAccountId: googleEmail,
        email: googleEmail,
        accessTokenEncrypted,
        refreshTokenEncrypted,
        tokenExpiresAt: tokens.expiresAt,
      })
      .returning();

    // Sync calendar list from Google
    await syncCalendarList(account.id);

    return NextResponse.redirect(
      `${dashboardUrl}?success=google_connected`,
    );
  } catch (err) {
    console.error('Google Calendar OAuth callback error:', err);
    return NextResponse.redirect(
      `${dashboardUrl}?error=google_failed`,
    );
  }
}
