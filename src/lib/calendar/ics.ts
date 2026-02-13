// ---------------------------------------------------------------------------
// RFC 5545 iCalendar (.ics) file generator
// Hand-rolled — no external dependencies
// ---------------------------------------------------------------------------

export interface IcsEventParams {
  /** Event title / summary */
  summary: string;
  /** Optional event description */
  description?: string;
  /** Event start time (UTC) */
  startAt: Date;
  /** Event end time (UTC) */
  endAt: Date;
  /** Optional location (address or room name) */
  location?: string;
  /** Organiser's display name */
  organiserName: string;
  /** Organiser's email address */
  organiserEmail: string;
  /** Attendee's display name */
  attendeeName: string;
  /** Attendee's email address */
  attendeeEmail: string;
  /** Globally unique identifier for this event */
  uid: string;
}

/**
 * Escape text values per RFC 5545 section 3.3.11.
 * Backslash-escapes commas, semicolons, backslashes, and newlines.
 */
function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Format a Date as an iCalendar UTC datetime string: YYYYMMDDTHHMMSSZ
 */
function formatDateUtc(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Generate an RFC 5545 compliant iCalendar (.ics) file as a string.
 *
 * The output uses CRLF line endings as required by the spec.
 * Includes METHOD:REQUEST to indicate a meeting invitation.
 */
export function generateIcsFile(params: IcsEventParams): string {
  const {
    summary,
    description,
    startAt,
    endAt,
    location,
    organiserName,
    organiserEmail,
    attendeeName,
    attendeeEmail,
    uid,
  } = params;

  const now = new Date();
  const lines: string[] = [];

  // VCALENDAR wrapper
  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//Small Giants Studio//Booking System//EN');
  lines.push('CALSCALE:GREGORIAN');
  lines.push('METHOD:REQUEST');

  // VEVENT
  lines.push('BEGIN:VEVENT');
  lines.push(`UID:${escapeText(uid)}`);
  lines.push(`DTSTAMP:${formatDateUtc(now)}`);
  lines.push(`DTSTART:${formatDateUtc(startAt)}`);
  lines.push(`DTEND:${formatDateUtc(endAt)}`);
  lines.push(`SUMMARY:${escapeText(summary)}`);

  if (description) {
    lines.push(`DESCRIPTION:${escapeText(description)}`);
  }

  if (location) {
    lines.push(`LOCATION:${escapeText(location)}`);
  }

  lines.push(
    `ORGANIZER;CN=${escapeText(organiserName)}:mailto:${organiserEmail}`,
  );
  lines.push(
    `ATTENDEE;CN=${escapeText(attendeeName)};RSVP=TRUE:mailto:${attendeeEmail}`,
  );
  lines.push('STATUS:CONFIRMED');
  lines.push('END:VEVENT');

  lines.push('END:VCALENDAR');

  // RFC 5545 mandates CRLF line endings
  return lines.join('\r\n') + '\r\n';
}
