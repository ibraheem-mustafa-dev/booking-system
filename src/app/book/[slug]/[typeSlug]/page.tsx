import { permanentRedirect } from 'next/navigation';

interface LegacyBookingPageProps {
  params: Promise<{ typeSlug: string }>;
}

/**
 * Legacy route — permanently redirects to the short URL.
 * /book/org-slug/consultation → /consultation
 */
export default async function LegacyBookingPage({ params }: LegacyBookingPageProps) {
  const { typeSlug } = await params;
  permanentRedirect(`/${typeSlug}`);
}
