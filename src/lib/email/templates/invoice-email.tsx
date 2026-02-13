import {
  Button,
  Heading,
  Hr,
  Link,
  Section,
  Text,
} from '@react-email/components';
import { EmailLayout } from './layout';

// ---------------------------------------------------------------------------
// Invoice Email — sent to the CLIENT with invoice summary and PDF download
// ---------------------------------------------------------------------------

export interface InvoiceEmailProps {
  /** Client's first/display name */
  clientName: string;
  /** Invoice reference number (e.g. "INV-0042") */
  invoiceNumber: string;
  /** Human-readable invoice date (e.g. "13 February 2026") */
  invoiceDate: string;
  /** Human-readable due date (e.g. "13 February 2026") */
  dueDate: string;
  /** Formatted total with currency symbol (e.g. "£60.00") */
  totalFormatted: string;
  /** Payment status: pending, paid, or refunded */
  paymentStatus: string;
  /** Public PDF download link with token */
  downloadUrl: string;
  /** Name of the booking type (if linked to a booking) */
  bookingTypeName?: string;
  /** Human-readable booking date (if linked to a booking) */
  bookingDateFormatted?: string;
  /** Payment instructions / BACS details */
  terms?: string;
  /** Organisation owner email for invoice queries */
  contactEmail: string;
  /** Organisation name for the layout */
  orgName: string;
  /** Organisation logo URL for the layout */
  orgLogoUrl?: string;
  /** Brand primary colour */
  primaryColour: string;
}

export function InvoiceEmail({
  clientName,
  invoiceNumber,
  invoiceDate,
  dueDate,
  totalFormatted,
  paymentStatus,
  downloadUrl,
  bookingTypeName,
  bookingDateFormatted,
  terms,
  contactEmail,
  orgName,
  orgLogoUrl,
  primaryColour,
}: InvoiceEmailProps) {
  const statusColour = getStatusColour(paymentStatus);

  return (
    <EmailLayout
      previewText={`Invoice ${invoiceNumber} from ${orgName}`}
      orgName={orgName}
      orgLogoUrl={orgLogoUrl}
      primaryColour={primaryColour}
    >
      {/* Heading */}
      <Heading style={headingStyle}>Invoice {invoiceNumber}</Heading>

      {/* Greeting */}
      <Text style={greetingStyle}>
        Hi {clientName},{' '}
        {bookingTypeName
          ? `here is your invoice for ${bookingTypeName}${bookingDateFormatted ? ` on ${bookingDateFormatted}` : ''}.`
          : 'here is your invoice.'}
      </Text>

      {/* Summary box */}
      <Section style={summaryBoxStyle}>
        <Text style={summaryLineStyle}>
          <strong>Invoice #:</strong> {invoiceNumber}
        </Text>
        <Text style={summaryLineStyle}>
          <strong>Date:</strong> {invoiceDate}
        </Text>
        <Text style={summaryLineStyle}>
          <strong>Due:</strong> {dueDate}
        </Text>
        <Text style={summaryAmountStyle}>
          <strong>Amount:</strong> {totalFormatted}
        </Text>
        <Text style={summaryLineStyle}>
          <strong>Status:</strong>{' '}
          <span style={{ color: statusColour, fontWeight: 600 }}>
            {paymentStatus.toUpperCase()}
          </span>
        </Text>
      </Section>

      {/* Download button */}
      <Section style={buttonSectionStyle}>
        <Button
          href={downloadUrl}
          style={{
            ...solidButtonStyle,
            backgroundColor: primaryColour,
          }}
        >
          Download Invoice
        </Button>
      </Section>

      {/* Payment terms */}
      {terms && (
        <>
          <Hr style={dividerStyle} />
          <Heading as="h3" style={termsSectionHeadingStyle}>
            Payment Information
          </Heading>
          <Text style={termsTextStyle}>{terms}</Text>
        </>
      )}

      {/* Contact note */}
      <Hr style={dividerStyle} />
      <Text style={contactNoteStyle}>
        Questions about this invoice? Contact us at{' '}
        <Link href={`mailto:${contactEmail}`} style={contactLinkStyle}>
          {contactEmail}
        </Link>
      </Text>
    </EmailLayout>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStatusColour(status: string): string {
  switch (status.toLowerCase()) {
    case 'paid':
      return '#16a34a'; // green-600
    case 'pending':
      return '#d97706'; // amber-600
    case 'refunded':
      return '#71717a'; // zinc-500
    default:
      return '#71717a';
  }
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

const summaryBoxStyle: React.CSSProperties = {
  backgroundColor: '#fafafa',
  borderRadius: '6px',
  padding: '20px',
  margin: '0 0 24px 0',
};

const summaryLineStyle: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '22px',
  color: '#3f3f46',
  margin: '0 0 4px 0',
};

const summaryAmountStyle: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '22px',
  color: '#18181b',
  fontWeight: 700,
  margin: '0 0 4px 0',
};

const buttonSectionStyle: React.CSSProperties = {
  textAlign: 'center' as const,
  margin: '0 0 8px 0',
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

const dividerStyle: React.CSSProperties = {
  borderColor: '#e4e4e7',
  margin: '24px 0 16px 0',
};

const termsSectionHeadingStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 600,
  color: '#18181b',
  margin: '0 0 8px 0',
};

const termsTextStyle: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '22px',
  color: '#3f3f46',
  margin: '0 0 16px 0',
  whiteSpace: 'pre-line',
};

const contactNoteStyle: React.CSSProperties = {
  fontSize: '13px',
  lineHeight: '20px',
  color: '#71717a',
  textAlign: 'center' as const,
  margin: 0,
};

const contactLinkStyle: React.CSSProperties = {
  color: '#2563eb',
  textDecoration: 'underline',
};
