import { Resend } from 'resend';
import type { ReactElement } from 'react';

// ---------------------------------------------------------------------------
// Resend client — lazy-initialised to avoid crashing at import time
// when RESEND_API_KEY is not set (e.g. during development without email)
// ---------------------------------------------------------------------------

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

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
    /** File content as a string or Buffer (strings are converted to Buffer for Resend) */
    content: string | Buffer;
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
    const { data, error } = await getResend().emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      react,
      replyTo,
      attachments: attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: typeof attachment.content === 'string'
          ? Buffer.from(attachment.content)
          : attachment.content,
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
