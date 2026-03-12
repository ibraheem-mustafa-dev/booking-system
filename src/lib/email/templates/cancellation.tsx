import { Heading, Text, Section } from '@react-email/components';
import { EmailLayout } from './layout';

export interface CancellationEmailProps {
  clientName: string;
  bookingTypeName: string;
  dateFormatted: string;
  timeFormatted: string;
  timezone: string;
  hostName: string;
  orgName: string;
  orgLogoUrl?: string;
  primaryColour: string;
}

export function CancellationEmail({
  clientName,
  bookingTypeName,
  dateFormatted,
  timeFormatted,
  timezone,
  hostName,
  orgName,
  orgLogoUrl,
  primaryColour,
}: CancellationEmailProps) {
  return (
    <EmailLayout
      previewText={`Booking cancelled: ${bookingTypeName} on ${dateFormatted}`}
      orgName={orgName}
      orgLogoUrl={orgLogoUrl}
      primaryColour={primaryColour}
    >
      <Heading style={headingStyle}>Booking Cancelled</Heading>

      <Text style={greetingStyle}>
        Hi {clientName}, your booking has been cancelled.
      </Text>

      <Section style={detailsCardStyle}>
        <Text style={bookingTypeStyle}>{bookingTypeName}</Text>
        <Text style={detailLineStyle}>
          <strong>Date:</strong> {dateFormatted}
        </Text>
        <Text style={detailLineStyle}>
          <strong>Time:</strong> {timeFormatted} ({timezone})
        </Text>
        <Text style={detailLineStyle}>
          <strong>Host:</strong> {hostName}
        </Text>
      </Section>

      <Text style={infoStyle}>
        If you cancelled by mistake or would like to rebook, please visit our
        booking page to choose a new time.
      </Text>
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

const infoStyle: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '22px',
  color: '#71717a',
  margin: 0,
};
