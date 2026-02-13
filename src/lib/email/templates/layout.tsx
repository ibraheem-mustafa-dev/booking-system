import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Font,
} from '@react-email/components';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Shared email layout — wraps every transactional email
// ---------------------------------------------------------------------------

export interface EmailLayoutProps {
  /** Text shown in email client preview pane (before opening) */
  previewText: string;
  /** Organisation name displayed in header and footer */
  orgName: string;
  /** Optional organisation logo URL (rendered at 48px height) */
  orgLogoUrl?: string;
  /** Brand primary colour for header text and accents */
  primaryColour: string;
  /** Email body content */
  children: ReactNode;
  /** Optional custom footer text (e.g. address, legal notice) */
  footerText?: string;
}

export function EmailLayout({
  previewText,
  orgName,
  orgLogoUrl,
  primaryColour,
  children,
  footerText,
}: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head>
        <Font
          fontFamily="Inter"
          fallbackFontFamily="Helvetica"
          webFont={{
            url: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiA.woff2',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
        <Font
          fontFamily="Inter"
          fallbackFontFamily="Helvetica"
          webFont={{
            url: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYAZ9hiA.woff2',
            format: 'woff2',
          }}
          fontWeight={600}
          fontStyle="normal"
        />
        <Font
          fontFamily="Inter"
          fallbackFontFamily="Helvetica"
          webFont={{
            url: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hiA.woff2',
            format: 'woff2',
          }}
          fontWeight={700}
          fontStyle="normal"
        />
      </Head>

      <Preview>{previewText}</Preview>

      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* Header */}
          <Section style={headerStyle}>
            {orgLogoUrl ? (
              <Img
                src={orgLogoUrl}
                alt={orgName}
                height={48}
                style={logoStyle}
              />
            ) : (
              <Text
                style={{
                  ...orgNameStyle,
                  color: primaryColour,
                }}
              >
                {orgName}
              </Text>
            )}
          </Section>

          {/* Content card */}
          <Section style={contentCardStyle}>
            {children}
          </Section>

          {/* Footer */}
          <Section style={footerSectionStyle}>
            <Hr style={footerHrStyle} />
            {footerText && (
              <Text style={footerTextStyle}>{footerText}</Text>
            )}
            <Text style={poweredByStyle}>Powered by {orgName}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const bodyStyle: React.CSSProperties = {
  backgroundColor: '#f4f4f5',
  fontFamily: '"Inter", Helvetica, Arial, sans-serif',
  margin: 0,
  padding: 0,
};

const containerStyle: React.CSSProperties = {
  maxWidth: '600px',
  margin: '0 auto',
  padding: '40px 20px',
};

const headerStyle: React.CSSProperties = {
  textAlign: 'center' as const,
  padding: '0 0 24px 0',
};

const logoStyle: React.CSSProperties = {
  margin: '0 auto',
  display: 'block',
};

const orgNameStyle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  margin: 0,
  textAlign: 'center' as const,
};

const contentCardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  padding: '32px',
  border: '1px solid #e4e4e7',
};

const footerSectionStyle: React.CSSProperties = {
  padding: '0 16px',
};

const footerHrStyle: React.CSSProperties = {
  borderColor: '#e4e4e7',
  margin: '24px 0 16px 0',
};

const footerTextStyle: React.CSSProperties = {
  fontSize: '12px',
  lineHeight: '18px',
  color: '#71717a',
  textAlign: 'center' as const,
  margin: '0 0 8px 0',
};

const poweredByStyle: React.CSSProperties = {
  fontSize: '11px',
  lineHeight: '16px',
  color: '#a1a1aa',
  textAlign: 'center' as const,
  margin: 0,
};
