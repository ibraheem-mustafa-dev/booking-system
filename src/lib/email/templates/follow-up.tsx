import { Button, Markdown, Section, Text } from '@react-email/components';
import { EmailLayout } from './layout';

// ---------------------------------------------------------------------------
// Follow-Up — sent to the CLIENT days/weeks after their booking
// Includes a "Book Again" button linking back to the public booking page.
// ---------------------------------------------------------------------------

export interface FollowUpEmailProps {
  /** Client's display name */
  clientName: string;
  /** Host's custom body text (markdown supported) */
  bodyMarkdown: string;
  /** URL to the public booking page so the client can book again */
  bookingLink: string;
  /** Organisation name for the layout */
  orgName: string;
  /** Organisation logo URL for the layout */
  orgLogoUrl?: string;
  /** Brand primary colour */
  primaryColour: string;
  /** Optional footer text */
  footerText?: string;
}

export function FollowUpEmail({
  clientName,
  bodyMarkdown,
  bookingLink,
  orgName,
  orgLogoUrl,
  primaryColour,
  footerText,
}: FollowUpEmailProps) {
  return (
    <EmailLayout
      previewText={`A message from ${orgName}`}
      orgName={orgName}
      orgLogoUrl={orgLogoUrl}
      primaryColour={primaryColour}
      footerText={footerText}
    >
      <Text style={greetingStyle}>Hi {clientName},</Text>

      <Markdown
        markdownCustomStyles={{
          h1: {
            fontSize: '22px',
            fontWeight: 700,
            color: '#18181b',
            margin: '0 0 12px 0',
          },
          h2: {
            fontSize: '18px',
            fontWeight: 600,
            color: '#18181b',
            margin: '0 0 10px 0',
          },
          p: {
            fontSize: '15px',
            lineHeight: '24px',
            color: '#3f3f46',
            margin: '0 0 16px 0',
          },
          link: {
            color: primaryColour,
            textDecoration: 'underline',
          },
        }}
      >
        {bodyMarkdown}
      </Markdown>

      {/* Book Again button */}
      <Section style={buttonSectionStyle}>
        <Button
          href={bookingLink}
          style={{
            ...solidButtonStyle,
            backgroundColor: primaryColour,
          }}
        >
          Book Again
        </Button>
      </Section>
    </EmailLayout>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const greetingStyle: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: '24px',
  color: '#3f3f46',
  margin: '0 0 16px 0',
};

const buttonSectionStyle: React.CSSProperties = {
  textAlign: 'center' as const,
  margin: '8px 0 0 0',
};

const solidButtonStyle: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 600,
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 28px',
  borderRadius: '6px',
};
