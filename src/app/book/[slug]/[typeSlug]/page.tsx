import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { organisations, bookingTypes } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  generateCssVariables,
  type ThemeConfig,
} from '@/lib/theme/config';
import { BookingFlow } from './booking-flow';

interface BookingPageProps {
  params: Promise<{ slug: string; typeSlug: string }>;
}

export default async function BookingPage({ params }: BookingPageProps) {
  const { slug, typeSlug } = await params;

  // Fetch org and booking type
  const [org] = await db
    .select({
      id: organisations.id,
      name: organisations.name,
      slug: organisations.slug,
      branding: organisations.branding,
    })
    .from(organisations)
    .where(eq(organisations.slug, slug))
    .limit(1);

  if (!org) notFound();

  const [type] = await db
    .select()
    .from(bookingTypes)
    .where(
      and(
        eq(bookingTypes.orgId, org.id),
        eq(bookingTypes.slug, typeSlug),
        eq(bookingTypes.isActive, true),
      ),
    )
    .limit(1);

  if (!type) notFound();

  // Generate CSS custom properties from org branding
  const cssVars = generateCssVariables(org.branding as unknown as ThemeConfig);

  return (
    <div
      className="min-h-screen"
      style={{
        ...cssVars,
        backgroundColor: 'var(--brand-background)',
        color: 'var(--brand-text)',
        fontFamily: 'var(--brand-font)',
      } as React.CSSProperties}
    >
      <div className="mx-auto max-w-lg px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--brand-text)' }}>
            {org.name}
          </h1>
          <h2
            className="mt-2 text-lg font-medium"
            style={{ color: 'var(--brand-primary)' }}
          >
            {type.name}
          </h2>
          {type.description && (
            <p className="mt-2 text-sm opacity-70">{type.description}</p>
          )}
          <div className="mt-3 flex items-center justify-center gap-4 text-sm opacity-60">
            <span>{type.durationMins} minutes</span>
            {type.locationType === 'online' && <span>Online meeting</span>}
            {type.locationType === 'in_person' && <span>In person</span>}
            {type.locationType === 'phone' && <span>Phone call</span>}
            {type.requiresPayment && type.priceAmount && (
              <span>
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
