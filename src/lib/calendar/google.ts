import { google } from 'googleapis';
import { encrypt, decrypt } from '@/lib/crypto';
import { db } from '@/lib/db';
import { calendarAccounts, calendarConnections } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// OAuth2 Client
// ---------------------------------------------------------------------------

function getRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${base}/api/auth/google/callback`;
}

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getRedirectUri(),
  );
}

// ---------------------------------------------------------------------------
// OAuth Flow
// ---------------------------------------------------------------------------

/** Generate the Google OAuth consent screen URL */
export function getAuthUrl(state: string): string {
  const client = createOAuth2Client();

  return client.generateAuthUrl({
    access_type: 'offline', // Needed for refresh token
    prompt: 'consent', // Forces consent screen — ensures we get refresh token
    scope: ['https://www.googleapis.com/auth/calendar.readonly'],
    state, // CSRF protection — user ID or session token
  });
}

/** Exchange the authorization code for tokens */
export async function exchangeCodeForTokens(code: string) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);

  if (!tokens.access_token) {
    throw new Error('Google OAuth did not return an access token');
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || null,
    expiresAt: tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000), // Default 1 hour
  };
}

// ---------------------------------------------------------------------------
// Token Management
// ---------------------------------------------------------------------------

/**
 * Get an authenticated OAuth2 client for an existing calendar account.
 * Handles token decryption and automatic refresh if expired.
 */
export async function getAuthenticatedClient(accountId: string) {
  const [account] = await db
    .select()
    .from(calendarAccounts)
    .where(eq(calendarAccounts.id, accountId))
    .limit(1);

  if (!account) {
    throw new Error('Calendar account not found');
  }

  const client = createOAuth2Client();

  const accessToken = decrypt(account.accessTokenEncrypted);
  const refreshToken = account.refreshTokenEncrypted
    ? decrypt(account.refreshTokenEncrypted)
    : null;

  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: account.tokenExpiresAt?.getTime(),
  });

  // Listen for token refresh events and persist new tokens
  client.on('tokens', async (tokens) => {
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (tokens.access_token) {
      updates.accessTokenEncrypted = encrypt(tokens.access_token);
    }
    if (tokens.refresh_token) {
      updates.refreshTokenEncrypted = encrypt(tokens.refresh_token);
    }
    if (tokens.expiry_date) {
      updates.tokenExpiresAt = new Date(tokens.expiry_date);
    }

    await db
      .update(calendarAccounts)
      .set(updates)
      .where(eq(calendarAccounts.id, accountId));
  });

  return client;
}

// ---------------------------------------------------------------------------
// Calendar API Operations
// ---------------------------------------------------------------------------

/** Fetch the user's Google email from the OAuth token info */
export async function getGoogleEmail(
  client: ReturnType<typeof createOAuth2Client>,
): Promise<string | null> {
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data } = await oauth2.userinfo.get();
    return data.email || null;
  } catch {
    return null;
  }
}

/** Fetch all calendars from a connected Google account */
export async function fetchCalendarList(accountId: string) {
  const client = await getAuthenticatedClient(accountId);
  const calendar = google.calendar({ version: 'v3', auth: client });

  const response = await calendar.calendarList.list();
  return (response.data.items || []).map((cal) => ({
    externalId: cal.id!,
    name: cal.summary || 'Untitled',
    isPrimary: cal.primary === true,
    colour: cal.backgroundColor || null,
  }));
}

/**
 * Sync calendar list from Google into the calendar_connections table.
 * Adds new calendars, updates existing ones, leaves user preferences (isSelected) intact.
 */
export async function syncCalendarList(accountId: string) {
  const googleCalendars = await fetchCalendarList(accountId);

  for (const gcal of googleCalendars) {
    const [match] = await db
      .select({ id: calendarConnections.id })
      .from(calendarConnections)
      .where(
        and(
          eq(calendarConnections.calendarAccountId, accountId),
          eq(calendarConnections.externalId, gcal.externalId),
        ),
      )
      .limit(1);

    if (match) {
      // Update name and colour, preserve user preferences (isSelected)
      await db
        .update(calendarConnections)
        .set({
          name: gcal.name,
          colour: gcal.colour,
          isPrimary: gcal.isPrimary,
        })
        .where(eq(calendarConnections.id, match.id));
    } else {
      await db.insert(calendarConnections).values({
        calendarAccountId: accountId,
        externalId: gcal.externalId,
        name: gcal.name,
        isPrimary: gcal.isPrimary,
        isSelected: gcal.isPrimary, // Auto-select primary calendar
        colour: gcal.colour,
      });
    }
  }
}

/**
 * Fetch busy time slots from Google Calendar for specified calendars.
 * Used by the availability engine.
 */
export async function fetchBusyTimes(
  accountId: string,
  calendarIds: string[],
  timeMin: Date,
  timeMax: Date,
  timezone: string,
): Promise<{ calendarId: string; start: Date; end: Date }[]> {
  if (calendarIds.length === 0) return [];

  const client = await getAuthenticatedClient(accountId);
  const calendar = google.calendar({ version: 'v3', auth: client });

  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      timeZone: timezone,
      items: calendarIds.map((id) => ({ id })),
    },
  });

  const busySlots: { calendarId: string; start: Date; end: Date }[] = [];
  const calendars = response.data.calendars || {};

  for (const [calId, calData] of Object.entries(calendars)) {
    for (const busy of calData.busy || []) {
      if (busy.start && busy.end) {
        busySlots.push({
          calendarId: calId,
          start: new Date(busy.start),
          end: new Date(busy.end),
        });
      }
    }
  }

  return busySlots;
}
