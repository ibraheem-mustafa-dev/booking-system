import {
  Button,
  Column,
  Heading,
  Hr,
  Link,
  Row,
  Section,
  Text,
} from '@react-email/components';
import { EmailLayout } from './layout';

// ---------------------------------------------------------------------------
// Booking Reminder — shared template for 24h and 1h reminders (sent to CLIENT)
// ---------------------------------------------------------------------------

export interface ReminderEmailProps {
  /** Which reminder this is — determines heading and preview text */
  reminderType: '24h' | '1h';
  /** Client's first/display name */
  clientName: string;
  /** Name of the booking type */
  bookingTypeName: string;
  /** Human-readable date (e.g. "Monday, 15 March 2026") */
  dateFormatted: string;
  /** Human-readable time (e.g. "10:00 AM") */
  timeFormatted: string;
  /** IANA timezone label */
  timezone: string;
  /** Duration in minutes */
  durationMins: number;
  /** Physical location (if in-person) */
  location?: string;
  /** Video call link (if online) */
  videoLink?: string;
  /** Host's display name */
  hostName: string;
  /** Google Calendar "add event" URL */
  addToCalendarUrl: string;
  /** URL to download .ics file */
  icsDownloadUrl: string;
  /** URL for rescheduling (token-based) */
  rescheduleUrl?: string;
  /** URL for cancellation (token-based) */
  cancelUrl?: string;
  /** Organisation name for the layout */
  orgName: string;
  /** Organisation logo URL for the layout */
  orgLogoUrl?: string;
  /** Brand primary colour */
  primaryColour: string;
  /** Optional footer text */
  footerText?: string;
}

export function ReminderEmail({
  reminderType,
  clientName,
  bookingTypeName,
  dateFormatted,
  timeFormatted,
  timezone,
  durationMins,
  location,
  videoLink,
  hostName,
  addToCalendarUrl,
  icsDownloadUrl,
  rescheduleUrl,
  cancelUrl,
  orgName,
  orgLogoUrl,
  primaryColour,
  footerText,
}: ReminderEmailProps) {
  const timingLabel = reminderType === '24h' ? 'tomorrow' : 'in 1 hour';

  return (
    <EmailLayout
      previewText={`Reminder: ${bookingTypeName} ${timingLabel}`}
      orgName={orgName}
      orgLogoUrl={orgLogoUrl}
      primaryColour={primaryColour}
      footerText={footerText}
    >
      {/* Heading */}
      <Heading style={headingStyle}>
        Reminder: Your Booking is {timingLabel}
      </Heading>

      {/* Greeting */}
      <Text style={greetingStyle}>
        Hi {clientName}, just a reminder about your upcoming booking.
      </Text>

      {/* Details card */}
      <Section style={detailsCardStyle}>
        <Text style={bookingTypeStyle}>{bookingTypeName}</Text>
        <Text style={detailLineStyle}>
          <strong>Date:</strong> {dateFormatted}
        </Text>
        <Text style={detailLineStyle}>
          <strong>Time:</strong> {timeFormatted} ({timezone})
        </Text>
        <Text style={detailLineStyle}>
          <strong>Duration:</strong> {durationMins} minutes
        </Text>
        <Text style={detailLineStyle}>
          <strong>Host:</strong> {hostName}
        </Text>
        {videoLink && (
          <Text style={detailLineStyle}>
            <strong>Video call:</strong>{' '}
            <Link href={videoLink} style={linkStyle}>
              Join meeting
            </Link>
          </Text>
        )}
        {location && (
          <Text style={detailLineStyle}>
            <strong>Location:</strong> {location}
          </Text>
        )}
      </Section>

      {/* Calendar buttons */}
      <Section style={buttonSectionStyle}>
        <Row>
          <Column align="right" style={buttonColumnStyle}>
            <Button
              href={addToCalendarUrl}
              style={{
                ...solidButtonStyle,
                backgroundColor: primaryColour,
              }}
            >
              Add to Calendar
            </Button>
          </Column>
          <Column align="left" style={buttonColumnStyle}>
            <Button
              href={icsDownloadUrl}
              style={{
                ...outlineButtonStyle,
                color: primaryColour,
                borderColor: primaryColour,
              }}
            >
              Download .ics
            </Button>
          </Column>
        </Row>
      </Section>

      {/* Reschedule / Cancel links */}
      {(rescheduleUrl || cancelUrl) && (
        <>
          <Hr style={dividerStyle} />
          <Text style={changeLinksStyle}>
            Need to make changes?{' '}
            {rescheduleUrl && (
              <Link href={rescheduleUrl} style={{ color: primaryColour }}>
                Reschedule
              </Link>
            )}
            {rescheduleUrl && cancelUrl && ' \u00B7 '}
            {cancelUrl && (
              <Link href={cancelUrl} style={{ color: '#dc2626' }}>
                Cancel
              </Link>
            )}
          </Text>
        </>
      )}
    </EmailLayout>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const headingStyle: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: 700,
  color: '#18181b',
  margin: '0 0 12px 0',
};

const greetingStyle: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: '24px',
  color: '#3f3f46',
  margin: '0 0 24px 0',
};

const detailsCardStyle: React.CSSProperties = {
  backgroundColor: '#fafafa',
  borderRadius: '6px',
  padding: '20px',
  margin: '0 0 24px 0',
};

const bookingTypeStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 700,
  color: '#18181b',
  margin: '0 0 12px 0',
};

const detailLineStyle: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '22px',
  color: '#3f3f46',
  margin: '0 0 4px 0',
};

const linkStyle: React.CSSProperties = {
  color: '#2563eb',
  textDecoration: 'underline',
};

const buttonSectionStyle: React.CSSProperties = {
  margin: '0 0 8px 0',
};

const buttonColumnStyle: React.CSSProperties = {
  padding: '0 6px',
};

const solidButtonStyle: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 600,
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
  borderRadius: '6px',
};

const outlineButtonStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontSize: '14px',
  fontWeight: 600,
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
  borderRadius: '6px',
  border: '1px solid',
};

const dividerStyle: React.CSSProperties = {
  borderColor: '#e4e4e7',
  margin: '24px 0 16px 0',
};

const changeLinksStyle: React.CSSProperties = {
  fontSize: '13px',
  lineHeight: '20px',
  color: '#71717a',
  textAlign: 'center' as const,
  margin: 0,
};
