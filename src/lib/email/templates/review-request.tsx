import { Markdown, Text } from '@react-email/components';
import { EmailLayout } from './layout';

// ---------------------------------------------------------------------------
// Review Request — sent to the CLIENT after their booking ends
// The host writes the body text with optional markdown formatting.
// ---------------------------------------------------------------------------

export interface ReviewRequestEmailProps {
  /** Client's display name */
  clientName: string;
  /** Host's custom body text (markdown supported) */
  bodyMarkdown: string;
  /** Organisation name for the layout */
  orgName: string;
  /** Organisation logo URL for the layout */
  orgLogoUrl?: string;
  /** Brand primary colour */
  primaryColour: string;
  /** Optional footer text */
  footerText?: string;
}

export function ReviewRequestEmail({
  clientName,
  bodyMarkdown,
  orgName,
  orgLogoUrl,
  primaryColour,
  footerText,
}: ReviewRequestEmailProps) {
  return (
    <EmailLayout
      previewText={`${orgName} would love your feedback`}
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
