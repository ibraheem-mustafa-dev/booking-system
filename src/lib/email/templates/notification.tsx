import {
  Button,
  Heading,
  Link,
  Section,
  Text,
} from '@react-email/components';
import { EmailLayout } from './layout';

// ---------------------------------------------------------------------------
// Host Notification — sent to the HOST when a client books
// ---------------------------------------------------------------------------

export interface NotificationEmailProps {
  /** Host's display name */
  hostName: string;
  /** Client's display name */
  clientName: string;
  /** Client's email address */
  clientEmail: string;
  /** Client's phone number (optional) */
  clientPhone?: string;
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
  /** Notes from the client (free text) */
  notes?: string;
  /** Custom field responses from the booking form */
  customFields?: { label: string; value: string }[];
  /** URL to the booking detail page in the dashboard */
  dashboardUrl: string;
  /** Organisation name for the layout */
  orgName: string;
  /** Organisation logo URL for the layout */
  orgLogoUrl?: string;
  /** Brand primary colour */
  primaryColour: string;
  /** Optional footer text */
  footerText?: string;
}

export function NotificationEmail({
  hostName,
  clientName,
  clientEmail,
  clientPhone,
  bookingTypeName,
  dateFormatted,
  timeFormatted,
  timezone,
  durationMins,
  location,
  videoLink,
  notes,
  customFields,
  dashboardUrl,
  orgName,
  orgLogoUrl,
  primaryColour,
  footerText,
}: NotificationEmailProps) {
  return (
    <EmailLayout
      previewText={`New booking: ${clientName} booked ${bookingTypeName}`}
      orgName={orgName}
      orgLogoUrl={orgLogoUrl}
      primaryColour={primaryColour}
      footerText={footerText}
    >
      {/* Heading */}
      <Heading style={headingStyle}>New Booking</Heading>

      {/* Greeting */}
      <Text style={greetingStyle}>
        Hi {hostName}, you have a new booking.
      </Text>

      {/* Booking details card */}
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

      {/* Client details card */}
      <Section style={detailsCardStyle}>
        <Text style={sectionTitleStyle}>Client Details</Text>
        <Text style={detailLineStyle}>
          <strong>Name:</strong> {clientName}
        </Text>
        <Text style={detailLineStyle}>
          <strong>Email:</strong>{' '}
          <Link href={`mailto:${clientEmail}`} style={linkStyle}>
            {clientEmail}
          </Link>
        </Text>
        {clientPhone && (
          <Text style={detailLineStyle}>
            <strong>Phone:</strong>{' '}
            <Link href={`tel:${clientPhone}`} style={linkStyle}>
              {clientPhone}
            </Link>
          </Text>
        )}
        {notes && (
          <Text style={notesStyle}>
            <strong>Notes:</strong>{' '}
            <span style={{ fontStyle: 'italic' }}>{notes}</span>
          </Text>
        )}
        {customFields && customFields.length > 0 && (
          <>
            {customFields.map((field) => (
              <Text key={field.label} style={detailLineStyle}>
                <strong>{field.label}:</strong> {field.value}
              </Text>
            ))}
          </>
        )}
      </Section>

      {/* Dashboard button */}
      <Section style={buttonSectionStyle}>
        <Button
          href={dashboardUrl}
          style={{
            ...solidButtonStyle,
            backgroundColor: primaryColour,
          }}
        >
          View in Dashboard
        </Button>
      </Section>
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
  margin: '0 0 20px 0',
};

const bookingTypeStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 700,
  color: '#18181b',
  margin: '0 0 12px 0',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 600,
  color: '#18181b',
  margin: '0 0 12px 0',
};

const detailLineStyle: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '22px',
  color: '#3f3f46',
  margin: '0 0 4px 0',
};

const notesStyle: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '22px',
  color: '#3f3f46',
  margin: '8px 0 4px 0',
};

const linkStyle: React.CSSProperties = {
  color: '#2563eb',
  textDecoration: 'underline',
};

const buttonSectionStyle: React.CSSProperties = {
  textAlign: 'center' as const,
  margin: '4px 0 0 0',
};

const solidButtonStyle: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 600,
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 28px',
  borderRadius: '6px',
};
