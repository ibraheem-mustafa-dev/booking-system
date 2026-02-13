import { Resend } from 'resend';
import type { ReactElement } from 'react';

// ---------------------------------------------------------------------------
// Resend client — initialised from environment variable
// ---------------------------------------------------------------------------

const resend = new Resend(process.env.RESEND_API_KEY);

const EMAIL_FROM =
  process.env.EMAIL_FROM ||
  'Small Giants Studio <bookings@smallgiantsstudio.co.uk>';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SendEmailOptions {
  /** Recipient email address */
  to: string;
  /** Email subject line */
  subject: string;
  /** React Email component to render as the email body */
  react: ReactElement;
  /** Optional reply-to address */
  replyTo?: string;
  /** Optional file attachments */
  attachments?: {
    filename: string;
    /** File content as a string (will be converted to Buffer for Resend) */
    content: string;
  }[];
}

// ---------------------------------------------------------------------------
// Send email — never throws, returns email ID or null
// ---------------------------------------------------------------------------

/**
 * Send a transactional email via Resend.
 *
 * Returns the Resend email ID on success, or null on failure.
 * Errors are logged to console but never thrown — email failures
 * must not crash the application.
 */
export async function sendEmail(
  options: SendEmailOptions,
): Promise<string | null> {
  const { to, subject, react, replyTo, attachments } = options;

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      react,
      replyTo,
      attachments: attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: Buffer.from(attachment.content),
      })),
    });

    if (error) {
      console.error('Resend email error:', error);
      return null;
    }

    return data?.id ?? null;
  } catch (error) {
    console.error('Failed to send email:', error);
    return null;
  }
}
