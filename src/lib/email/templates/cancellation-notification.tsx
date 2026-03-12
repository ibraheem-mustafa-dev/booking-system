import { Button, Heading, Text, Section } from '@react-email/components';
import { EmailLayout } from './layout';

export interface CancellationNotificationEmailProps {
  hostName: string;
  clientName: string;
  clientEmail: string;
  bookingTypeName: string;
  dateFormatted: string;
  timeFormatted: string;
  timezone: string;
  orgName: string;
  orgLogoUrl?: string;
  primaryColour: string;
}

export function CancellationNotificationEmail({
  hostName,
  clientName,
  clientEmail,
  bookingTypeName,
  dateFormatted,
  timeFormatted,
  timezone,
  orgName,
  orgLogoUrl,
  primaryColour,
}: CancellationNotificationEmailProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return (
    <EmailLayout
      previewText={`${clientName} cancelled ${bookingTypeName} on ${dateFormatted}`}
      orgName={orgName}
      orgLogoUrl={orgLogoUrl}
      primaryColour={primaryColour}
    >
      <Heading style={headingStyle}>Booking Cancelled</Heading>

      <Text style={greetingStyle}>
        Hi {hostName}, a booking has been cancelled by the client.
      </Text>

      <Section style={detailsCardStyle}>
        <Text style={bookingTypeStyle}>{bookingTypeName}</Text>
        <Text style={detailLineStyle}>
          <strong>Client:</strong> {clientName} ({clientEmail})
        </Text>
        <Text style={detailLineStyle}>
          <strong>Date:</strong> {dateFormatted}
        </Text>
        <Text style={detailLineStyle}>
          <strong>Time:</strong> {timeFormatted} ({timezone})
        </Text>
      </Section>

      <Button
        href={`${appUrl}/dashboard/bookings`}
        style={{
          backgroundColor: primaryColour,
          color: '#ffffff',
          fontSize: '14px',
          fontWeight: 600,
          textDecoration: 'none',
          textAlign: 'center' as const,
          display: 'inline-block',
          padding: '12px 24px',
          borderRadius: '6px',
        }}
      >
        View Dashboard
      </Button>
    </EmailLayout>
  );
}

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
  backgroundColor: '#fef2f2',
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
