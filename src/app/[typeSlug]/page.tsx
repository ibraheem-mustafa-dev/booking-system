import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { organisations, bookingTypes } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  generateCssVariables,
  type ThemeConfig,
} from '@/lib/theme/config';
import { BookingFlow } from '../book/[slug]/[typeSlug]/booking-flow';

interface ShortBookingPageProps {
  params: Promise<{ typeSlug: string }>;
}

// Paths that should never match the dynamic [typeSlug] route.
// Static app routes (dashboard, api, book, login) already take precedence
// via their own folders, but these catch files and internal paths.
const RESERVED_SLUGS = new Set([
  'book', 'dashboard', 'api', 'login', 'auth', 'callback',
  '_next', 'favicon.ico', 'robots.txt', 'sitemap.xml',
  'widget', 'monitoring',
]);

export default async function ShortBookingPage({ params }: ShortBookingPageProps) {
  const { typeSlug } = await params;

  if (RESERVED_SLUGS.has(typeSlug)) notFound();

  // Single-tenant: find the booking type by slug, joined with its org.
  // This avoids assuming which org row to use when multiple test orgs exist.
  const [row] = await db
    .select({
      // Booking type fields
      id: bookingTypes.id,
      name: bookingTypes.name,
      slug: bookingTypes.slug,
      description: bookingTypes.description,
      durationMins: bookingTypes.durationMins,
      locationType: bookingTypes.locationType,
      requiresPayment: bookingTypes.requiresPayment,
      priceAmount: bookingTypes.priceAmount,
      priceCurrency: bookingTypes.priceCurrency,
      customFields: bookingTypes.customFields,
      maxAdvanceDays: bookingTypes.maxAdvanceDays,
      // Org fields
      orgId: organisations.id,
      orgName: organisations.name,
      orgSlug: organisations.slug,
      orgBranding: organisations.branding,
    })
    .from(bookingTypes)
    .innerJoin(organisations, eq(organisations.id, bookingTypes.orgId))
    .where(
      and(
        eq(bookingTypes.slug, typeSlug),
        eq(bookingTypes.isActive, true),
      ),
    )
    .limit(1);

  if (!row) notFound();

  // Destructure for clarity
  const org = { id: row.orgId, name: row.orgName, slug: row.orgSlug, branding: row.orgBranding };
  const type = row;

  // Generate CSS custom properties from org branding
  const cssVars = generateCssVariables(org.branding as unknown as ThemeConfig);

  return (
    <div
      className="min-h-screen bg-noise"
      style={{
        ...cssVars,
        backgroundColor: 'var(--brand-background)',
        color: 'var(--brand-text)',
        fontFamily: 'var(--brand-font)',
      } as React.CSSProperties}
    >
      <div className="mx-auto max-w-lg px-4 py-10 sm:py-14">
        {/* Header */}
        <div className="mb-10 text-center">
          <p className="mb-1 text-xs font-medium uppercase tracking-widest opacity-50">
            {org.name}
          </p>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--brand-text)' }}>
            {type.name}
          </h1>
          {type.description && (
            <p className="mt-3 text-sm leading-relaxed opacity-60">{type.description}</p>
          )}
          <div className="mt-4 flex items-center justify-center gap-3">
            <span
              className="inline-flex items-center rounded-full border px-3 py-1 font-mono text-xs font-medium"
              style={{ borderColor: 'var(--brand-primary)', color: 'var(--brand-primary)' }}
            >
              {type.durationMins} min
            </span>
            {type.locationType === 'online' && (
              <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium opacity-60">
                Online meeting
              </span>
            )}
            {type.locationType === 'in_person' && (
              <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium opacity-60">
                In person
              </span>
            )}
            {type.locationType === 'phone' && (
              <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium opacity-60">
                Phone call
              </span>
            )}
            {type.requiresPayment && type.priceAmount && (
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: 'var(--brand-primary)', color: '#fff' }}
              >
                {type.priceCurrency} {type.priceAmount}
              </span>
            )}
          </div>
        </div>

        {/* Client-side booking flow */}
        <BookingFlow
          orgSlug={org.slug}
          typeSlug={type.slug}
          bookingType={{
            id: type.id,
            name: type.name,
            durationMins: type.durationMins,
            customFields: type.customFields as {
              fields: {
                id: string;
                type: string;
                label: string;
                placeholder?: string;
                required: boolean;
                options?: string[];
              }[];
            },
            maxAdvanceDays: type.maxAdvanceDays,
            requiresPayment: type.requiresPayment,
            priceAmount: type.priceAmount,
            priceCurrency: type.priceCurrency,
          }}
        />
      </div>
    </div>
  );
}
