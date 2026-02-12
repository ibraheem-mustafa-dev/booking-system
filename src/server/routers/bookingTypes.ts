import { z } from 'zod';
import { eq, and, count } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { router, orgProcedure } from '../trpc';
import { bookingTypes, bookings } from '@/lib/db/schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const customFieldSchema = z.object({
  id: z.string(),
  type: z.enum([
    'text',
    'textarea',
    'select',
    'checkbox',
    'radio',
    'file',
    'email',
    'phone',
    'number',
  ]),
  label: z.string().min(1, 'Field label is required'),
  placeholder: z.string().optional(),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
});

const bookingTypeInput = z.object({
  name: z.string().min(1, 'Name is required').max(256),
  description: z.string().max(5000).optional(),
  durationMins: z.number().int().min(5).max(480).default(30),
  bufferMins: z.number().int().min(0).max(120).default(15),
  locationType: z.enum(['online', 'in_person', 'phone']).default('online'),
  locationDetails: z.string().max(500).optional(),
  videoProvider: z
    .enum(['google_meet', 'zoom', 'microsoft_teams', 'none'])
    .default('google_meet'),
  colour: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex colour')
    .default('#1B6B6B'),
  isActive: z.boolean().default(true),
  maxAdvanceDays: z.number().int().min(1).max(365).default(60),
  minNoticeHours: z.number().int().min(0).max(168).default(2),
  customFields: z.object({ fields: z.array(customFieldSchema) }).default({ fields: [] }),
  priceAmount: z.string().optional(),
  priceCurrency: z.string().max(3).default('GBP'),
  requiresPayment: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const bookingTypesRouter = router({
  /** List all booking types for the current organisation */
  list: orgProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(bookingTypes)
      .where(eq(bookingTypes.orgId, ctx.orgId))
      .orderBy(bookingTypes.createdAt);
  }),

  /** Get a single booking type by ID (org-scoped) */
  getById: orgProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select()
        .from(bookingTypes)
        .where(
          and(
            eq(bookingTypes.id, input.id),
            eq(bookingTypes.orgId, ctx.orgId),
          ),
        )
        .limit(1);

      if (result.length === 0) {
        throw new Error('Booking type not found');
      }

      return result[0];
    }),

  /** Create a new booking type */
  create: orgProcedure
    .input(bookingTypeInput)
    .mutation(async ({ ctx, input }) => {
      // Generate a unique slug within this org
      const baseSlug = slugify(input.name);
      let slug = baseSlug;
      let suffix = 1;

      // Check for slug collisions within the org
      for (let attempt = 0; attempt < 10; attempt++) {
        const existing = await ctx.db
          .select({ id: bookingTypes.id })
          .from(bookingTypes)
          .where(
            and(
              eq(bookingTypes.orgId, ctx.orgId),
              eq(bookingTypes.slug, slug),
            ),
          )
          .limit(1);

        if (existing.length === 0) break;

        slug = `${baseSlug}-${suffix}`;
        suffix++;
      }

      const [created] = await ctx.db
        .insert(bookingTypes)
        .values({
          orgId: ctx.orgId,
          name: input.name,
          slug,
          description: input.description || null,
          durationMins: input.durationMins,
          bufferMins: input.bufferMins,
          locationType: input.locationType,
          locationDetails: input.locationDetails || null,
          videoProvider: input.videoProvider,
          colour: input.colour,
          isActive: input.isActive,
          maxAdvanceDays: input.maxAdvanceDays,
          minNoticeHours: input.minNoticeHours,
          customFields: input.customFields,
          priceAmount: input.priceAmount || null,
          priceCurrency: input.priceCurrency,
          requiresPayment: input.requiresPayment,
        })
        .returning();

      return created;
    }),

  /** Update an existing booking type */
  update: orgProcedure
    .input(
      z.object({
        id: z.string(),
        data: bookingTypeInput.partial(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the booking type belongs to this org
      const existing = await ctx.db
        .select({ id: bookingTypes.id, slug: bookingTypes.slug })
        .from(bookingTypes)
        .where(
          and(
            eq(bookingTypes.id, input.id),
            eq(bookingTypes.orgId, ctx.orgId),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        throw new Error('Booking type not found');
      }

      // If name changed, regenerate slug
      let slug: string | undefined;
      if (input.data.name) {
        const baseSlug = slugify(input.data.name);
        slug = baseSlug;
        let suffix = 1;

        for (let attempt = 0; attempt < 10; attempt++) {
          // Allow the same slug if it hasn't changed
          if (slug === existing[0].slug) break;

          const collision = await ctx.db
            .select({ id: bookingTypes.id })
            .from(bookingTypes)
            .where(
              and(
                eq(bookingTypes.orgId, ctx.orgId),
                eq(bookingTypes.slug, slug),
              ),
            )
            .limit(1);

          if (collision.length === 0) break;

          slug = `${baseSlug}-${suffix}`;
          suffix++;
        }
      }

      // Sanitise nullable fields — empty strings become null for DB columns
      const sanitised = {
        ...input.data,
        ...('description' in input.data ? { description: input.data.description || null } : {}),
        ...('locationDetails' in input.data ? { locationDetails: input.data.locationDetails || null } : {}),
        ...('priceAmount' in input.data ? { priceAmount: input.data.priceAmount || null } : {}),
      };

      const [updated] = await ctx.db
        .update(bookingTypes)
        .set({
          ...sanitised,
          ...(slug ? { slug } : {}),
          updatedAt: new Date(),
        })
        .where(eq(bookingTypes.id, input.id))
        .returning();

      return updated;
    }),

  /** Delete a booking type (fails if it has existing bookings) */
  delete: orgProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const existing = await ctx.db
        .select({ id: bookingTypes.id })
        .from(bookingTypes)
        .where(
          and(
            eq(bookingTypes.id, input.id),
            eq(bookingTypes.orgId, ctx.orgId),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        throw new Error('Booking type not found');
      }

      // Check for existing bookings (ON DELETE RESTRICT prevents deletion)
      const [bookingCount] = await ctx.db
        .select({ total: count() })
        .from(bookings)
        .where(eq(bookings.bookingTypeId, input.id));

      if (bookingCount.total > 0) {
        throw new Error(
          `Cannot delete this booking type — it has ${bookingCount.total} existing booking(s). Deactivate it instead.`,
        );
      }

      await ctx.db
        .delete(bookingTypes)
        .where(eq(bookingTypes.id, input.id));

      return { success: true };
    }),

  /** Toggle active/inactive status */
  toggleActive: orgProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select({ id: bookingTypes.id, isActive: bookingTypes.isActive })
        .from(bookingTypes)
        .where(
          and(
            eq(bookingTypes.id, input.id),
            eq(bookingTypes.orgId, ctx.orgId),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        throw new Error('Booking type not found');
      }

      const [updated] = await ctx.db
        .update(bookingTypes)
        .set({
          isActive: !existing[0].isActive,
          updatedAt: new Date(),
        })
        .where(eq(bookingTypes.id, input.id))
        .returning();

      return updated;
    }),
});
