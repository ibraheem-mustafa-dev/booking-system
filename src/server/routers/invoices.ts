import { z } from 'zod';
import { eq, and, desc, count, sql } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { createElement } from 'react';
import { format, parseISO } from 'date-fns';
import { TRPCError } from '@trpc/server';
import { router, orgProcedure } from '../trpc';
import {
  invoices,
  bookings,
  bookingTypes,
  organisations,
  users,
} from '@/lib/db/schema';
import type { Database } from '@/lib/db';
import {
  parseInvoiceNumber,
  formatInvoiceNumber,
} from '@/lib/invoice/number';
import { generateInvoicePdf } from '@/lib/invoice/generate';
import type { InvoicePdfProps } from '@/lib/invoice/template';
import { sendEmail } from '@/lib/email/resend';
import { InvoiceEmail } from '@/lib/email/templates/invoice-email';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: '\u00a3',
  EUR: '\u20ac',
  USD: '$',
};

function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency.toUpperCase()] ?? currency + ' ';
}

function formatCurrencyValue(amount: number, currency: string): string {
  return `${currencySymbol(currency)}${amount.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Branding type (matches the JSONB shape on organisations.branding)
// ---------------------------------------------------------------------------

interface OrgBranding {
  logoUrl?: string;
  faviconUrl?: string;
  primaryColour: string;
  accentColour: string;
  textColour: string;
  backgroundColour: string;
  fontFamily: string;
  borderRadius: string;
  buttonStyle: string;
  darkMode?: {
    primaryColour?: string;
    accentColour?: string;
    textColour?: string;
    backgroundColour?: string;
  };
  companyName?: string;
  companyAddress?: string;
  vatNumber?: string;
  companyRegistrationNumber?: string;
  terms?: string;
  customCss?: string;
}

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const lineItemInput = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().min(0.01, 'Quantity must be greater than zero'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calculate line item totals, subtotal, VAT, and grand total.
 */
function calculateTotals(
  items: { description: string; quantity: number; unitPrice: number }[],
  vatRate: number,
) {
  const lineItems = items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: Math.round(item.quantity * item.unitPrice * 100) / 100,
  }));

  const subtotal =
    Math.round(lineItems.reduce((sum, item) => sum + item.total, 0) * 100) /
    100;
  const vatAmount = Math.round(subtotal * (vatRate / 100) * 100) / 100;
  const total = Math.round((subtotal + vatAmount) * 100) / 100;

  return { lineItems, subtotal, vatRate, vatAmount, total };
}

/**
 * Format a date string (YYYY-MM-DD or ISO) as DD/MM/YYYY.
 */
function formatDateDDMMYYYY(dateStr: string): string {
  // date columns come as "YYYY-MM-DD" from Drizzle
  const parsed = parseISO(dateStr);
  return format(parsed, 'dd/MM/yyyy');
}

/**
 * Format a date for human-readable email display (e.g. "13 February 2026").
 */
function formatDateHuman(dateStr: string): string {
  const parsed = parseISO(dateStr);
  return format(parsed, 'd MMMM yyyy');
}

/**
 * Generate the next invoice number for an organisation.
 */
async function getNextInvoiceNumber(
  db: Database,
  orgId: string,
): Promise<string> {
  const result = await db
    .select({ maxNum: sql<string | null>`max(${invoices.invoiceNumber})` })
    .from(invoices)
    .where(eq(invoices.orgId, orgId));

  const currentMax = result[0]?.maxNum ?? null;
  const nextSeq = parseInvoiceNumber(currentMax) + 1;
  return formatInvoiceNumber(nextSeq);
}

/**
 * Build InvoicePdfProps from an invoice record + org + owner email.
 */
function buildPdfProps(
  invoice: typeof invoices.$inferSelect,
  org: typeof organisations.$inferSelect,
  ownerEmail: string,
  bookingReference?: string,
  supplyDate?: string,
): InvoicePdfProps {
  const branding = org.branding as OrgBranding;

  // Line items from JSONB already have the correct shape
  const lineItems = (invoice.lineItems ?? []) as {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];

  return {
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: formatDateDDMMYYYY(invoice.createdAt.toISOString().slice(0, 10)),
    dueDate: formatDateDDMMYYYY(invoice.dueDate),
    supplyDate: supplyDate || undefined,

    orgName: org.name,
    companyName: branding.companyName,
    companyAddress: branding.companyAddress,
    vatNumber: branding.vatNumber,
    companyRegistrationNumber: branding.companyRegistrationNumber,
    contactEmail: ownerEmail,
    logoUrl: branding.logoUrl,
    primaryColour: branding.primaryColour,
    accentColour: branding.accentColour,

    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,

    lineItems,
    subtotal: parseFloat(invoice.subtotal),
    vatRate: parseFloat(invoice.vatRate ?? '0'),
    vatAmount: parseFloat(invoice.vatAmount ?? '0'),
    total: parseFloat(invoice.total),
    currency: invoice.currency,
    paymentStatus: invoice.paymentStatus,

    notes: invoice.notes || undefined,
    terms: branding.terms,
    bookingReference,
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const invoicesRouter = router({
  /** List invoices for the current organisation (paginated) */
  list: orgProcedure
    .input(
      z
        .object({
          page: z.number().int().min(1).default(1),
          limit: z.number().int().min(1).max(100).default(20),
        })
        .default({ page: 1, limit: 20 }),
    )
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.limit;

      const [invoiceRows, totalResult] = await Promise.all([
        ctx.db
          .select()
          .from(invoices)
          .where(eq(invoices.orgId, ctx.orgId))
          .orderBy(desc(invoices.createdAt))
          .limit(input.limit)
          .offset(offset),
        ctx.db
          .select({ total: count() })
          .from(invoices)
          .where(eq(invoices.orgId, ctx.orgId)),
      ]);

      const total = totalResult[0].total;
      const totalPages = Math.ceil(total / input.limit);

      return {
        invoices: invoiceRows,
        total,
        page: input.page,
        totalPages,
      };
    }),

  /** Get a single invoice by ID (org-scoped) */
  getById: orgProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.id, input.id),
            eq(invoices.orgId, ctx.orgId),
          ),
        )
        .limit(1);

      if (result.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invoice not found.',
        });
      }

      const invoice = result[0];

      // Optionally load the linked booking and its booking type
      let bookingReference: string | undefined;
      if (invoice.bookingId) {
        const bookingResult = await ctx.db
          .select({
            bookingId: bookings.id,
            clientName: bookings.clientName,
            startAt: bookings.startAt,
            bookingTypeName: bookingTypes.name,
          })
          .from(bookings)
          .leftJoin(bookingTypes, eq(bookings.bookingTypeId, bookingTypes.id))
          .where(eq(bookings.id, invoice.bookingId))
          .limit(1);

        if (bookingResult.length > 0) {
          const booking = bookingResult[0];
          bookingReference = `${booking.bookingTypeName ?? 'Booking'} — ${format(booking.startAt, 'dd/MM/yyyy HH:mm')}`;
        }
      }

      return {
        ...invoice,
        bookingReference,
      };
    }),

  /** Create a new invoice */
  create: orgProcedure
    .input(
      z.object({
        bookingId: z.string().optional(),
        clientName: z.string().min(1, 'Client name is required').max(256),
        clientEmail: z.string().email('Valid email is required').max(320),
        lineItems: z.array(lineItemInput).min(1, 'At least one line item is required'),
        vatRate: z.number().min(0).max(100).optional(),
        notes: z.string().optional(),
        dueDate: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // If bookingId provided, validate it belongs to this org
      if (input.bookingId) {
        const bookingCheck = await ctx.db
          .select({ id: bookings.id })
          .from(bookings)
          .where(
            and(
              eq(bookings.id, input.bookingId),
              eq(bookings.orgId, ctx.orgId),
            ),
          )
          .limit(1);

        if (bookingCheck.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Booking not found or does not belong to this organisation.',
          });
        }
      }

      // Calculate totals
      const vatRate = input.vatRate ?? 0;
      const { lineItems, subtotal, vatAmount, total } = calculateTotals(
        input.lineItems,
        vatRate,
      );

      // Generate next invoice number
      const invoiceNumber = await getNextInvoiceNumber(ctx.db, ctx.orgId);

      // Generate download token
      const downloadToken = randomBytes(32).toString('hex');

      // Default due date to today if not provided
      const dueDate = input.dueDate || format(new Date(), 'yyyy-MM-dd');

      const [created] = await ctx.db
        .insert(invoices)
        .values({
          orgId: ctx.orgId,
          bookingId: input.bookingId || null,
          invoiceNumber,
          clientName: input.clientName,
          clientEmail: input.clientEmail,
          lineItems,
          subtotal: subtotal.toFixed(2),
          vatRate: vatRate.toFixed(2),
          vatAmount: vatAmount.toFixed(2),
          total: total.toFixed(2),
          dueDate,
          downloadToken,
          notes: input.notes || null,
        })
        .returning();

      return created;
    }),

  /** Update an existing invoice (only if still pending) */
  update: orgProcedure
    .input(
      z.object({
        id: z.string(),
        clientName: z.string().min(1).max(256).optional(),
        clientEmail: z.string().email().max(320).optional(),
        lineItems: z.array(lineItemInput).min(1).optional(),
        vatRate: z.number().min(0).max(100).optional(),
        notes: z.string().optional(),
        dueDate: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Load invoice and verify org ownership
      const existing = await ctx.db
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.id, input.id),
            eq(invoices.orgId, ctx.orgId),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invoice not found.',
        });
      }

      const invoice = existing[0];

      if (invoice.paymentStatus !== 'pending') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `Cannot edit an invoice with status "${invoice.paymentStatus}". Only pending invoices can be edited.`,
        });
      }

      // Build the update payload
      const updates: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.clientName !== undefined) {
        updates.clientName = input.clientName;
      }
      if (input.clientEmail !== undefined) {
        updates.clientEmail = input.clientEmail;
      }
      if (input.notes !== undefined) {
        updates.notes = input.notes || null;
      }
      if (input.dueDate !== undefined) {
        updates.dueDate = input.dueDate;
      }

      // Recalculate totals if lineItems or vatRate changed
      const needsRecalc =
        input.lineItems !== undefined || input.vatRate !== undefined;

      if (needsRecalc) {
        // Use new values or fall back to existing
        const itemsForCalc = input.lineItems ?? (invoice.lineItems as {
          description: string;
          quantity: number;
          unitPrice: number;
          total: number;
        }[]).map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }));

        const vatRateForCalc =
          input.vatRate ?? parseFloat(invoice.vatRate ?? '0');

        const { lineItems, subtotal, vatAmount, total } = calculateTotals(
          itemsForCalc,
          vatRateForCalc,
        );

        updates.lineItems = lineItems;
        updates.subtotal = subtotal.toFixed(2);
        updates.vatRate = vatRateForCalc.toFixed(2);
        updates.vatAmount = vatAmount.toFixed(2);
        updates.total = total.toFixed(2);
      }

      const [updated] = await ctx.db
        .update(invoices)
        .set(updates)
        .where(eq(invoices.id, input.id))
        .returning();

      return updated;
    }),

  /** Mark an invoice as paid */
  markPaid: orgProcedure
    .input(
      z.object({
        id: z.string(),
        paymentMethod: z.string().max(64).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select({ id: invoices.id })
        .from(invoices)
        .where(
          and(
            eq(invoices.id, input.id),
            eq(invoices.orgId, ctx.orgId),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invoice not found.',
        });
      }

      const [updated] = await ctx.db
        .update(invoices)
        .set({
          paymentStatus: 'paid',
          paidAt: new Date(),
          paymentMethod: input.paymentMethod || null,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, input.id))
        .returning();

      return updated;
    }),

  /** Mark an invoice as refunded */
  markRefunded: orgProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select({ id: invoices.id })
        .from(invoices)
        .where(
          and(
            eq(invoices.id, input.id),
            eq(invoices.orgId, ctx.orgId),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invoice not found.',
        });
      }

      const [updated] = await ctx.db
        .update(invoices)
        .set({
          paymentStatus: 'refunded',
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, input.id))
        .returning();

      return updated;
    }),

  /** Generate and return a PDF for the invoice as base64 */
  downloadPdf: orgProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      // Load the invoice
      const invoiceResult = await ctx.db
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.id, input.id),
            eq(invoices.orgId, ctx.orgId),
          ),
        )
        .limit(1);

      if (invoiceResult.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invoice not found.',
        });
      }

      const invoice = invoiceResult[0];

      // Load the organisation (with branding)
      const orgResult = await ctx.db
        .select()
        .from(organisations)
        .where(eq(organisations.id, ctx.orgId))
        .limit(1);

      if (orgResult.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Organisation not found.',
        });
      }

      const org = orgResult[0];

      // Load the org owner for contact email
      const ownerResult = await ctx.db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, org.ownerId))
        .limit(1);

      const ownerEmail = ownerResult[0]?.email ?? '';

      // Build booking reference and supply date if linked
      let bookingReference: string | undefined;
      let supplyDate: string | undefined;

      if (invoice.bookingId) {
        const bookingResult = await ctx.db
          .select({
            startAt: bookings.startAt,
            bookingTypeName: bookingTypes.name,
          })
          .from(bookings)
          .leftJoin(bookingTypes, eq(bookings.bookingTypeId, bookingTypes.id))
          .where(eq(bookings.id, invoice.bookingId))
          .limit(1);

        if (bookingResult.length > 0) {
          const booking = bookingResult[0];
          bookingReference = `${booking.bookingTypeName ?? 'Booking'} — ${format(booking.startAt, 'dd/MM/yyyy HH:mm')}`;
          supplyDate = format(booking.startAt, 'dd/MM/yyyy');
        }
      }

      const pdfProps = buildPdfProps(
        invoice,
        org,
        ownerEmail,
        bookingReference,
        supplyDate,
      );

      const pdfBuffer = await generateInvoicePdf(pdfProps);

      return {
        base64: pdfBuffer.toString('base64'),
        filename: `${invoice.invoiceNumber}.pdf`,
      };
    }),

  /** Resend the invoice email to the client */
  resendEmail: orgProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Load the invoice
      const invoiceResult = await ctx.db
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.id, input.id),
            eq(invoices.orgId, ctx.orgId),
          ),
        )
        .limit(1);

      if (invoiceResult.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invoice not found.',
        });
      }

      const invoice = invoiceResult[0];

      // Load the organisation
      const orgResult = await ctx.db
        .select()
        .from(organisations)
        .where(eq(organisations.id, ctx.orgId))
        .limit(1);

      if (orgResult.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Organisation not found.',
        });
      }

      const org = orgResult[0];
      const branding = org.branding as OrgBranding;

      // Load the org owner for contact email
      const ownerResult = await ctx.db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, org.ownerId))
        .limit(1);

      const ownerEmail = ownerResult[0]?.email ?? '';

      // Build booking reference and supply date if linked
      let bookingReference: string | undefined;
      let supplyDate: string | undefined;
      let bookingTypeName: string | undefined;
      let bookingDateFormatted: string | undefined;

      if (invoice.bookingId) {
        const bookingResult = await ctx.db
          .select({
            startAt: bookings.startAt,
            bookingTypeName: bookingTypes.name,
          })
          .from(bookings)
          .leftJoin(bookingTypes, eq(bookings.bookingTypeId, bookingTypes.id))
          .where(eq(bookings.id, invoice.bookingId))
          .limit(1);

        if (bookingResult.length > 0) {
          const booking = bookingResult[0];
          bookingReference = `${booking.bookingTypeName ?? 'Booking'} — ${format(booking.startAt, 'dd/MM/yyyy HH:mm')}`;
          supplyDate = format(booking.startAt, 'dd/MM/yyyy');
          bookingTypeName = booking.bookingTypeName ?? undefined;
          bookingDateFormatted = format(booking.startAt, 'd MMMM yyyy');
        }
      }

      // Generate the PDF
      const pdfProps = buildPdfProps(
        invoice,
        org,
        ownerEmail,
        bookingReference,
        supplyDate,
      );
      const pdfBuffer = await generateInvoicePdf(pdfProps);

      // Build download URL
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'http://localhost:3000';
      const downloadUrl = `${appUrl}/api/v1/invoices/${invoice.id}/pdf?token=${invoice.downloadToken}`;

      // Send the email
      const totalFormatted = formatCurrencyValue(
        parseFloat(invoice.total),
        invoice.currency,
      );

      await sendEmail({
        to: invoice.clientEmail,
        subject: `Invoice ${invoice.invoiceNumber} from ${org.name}`,
        react: createElement(InvoiceEmail, {
          clientName: invoice.clientName,
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: formatDateHuman(invoice.createdAt.toISOString().slice(0, 10)),
          dueDate: formatDateHuman(invoice.dueDate),
          totalFormatted,
          paymentStatus: invoice.paymentStatus,
          downloadUrl,
          bookingTypeName,
          bookingDateFormatted,
          terms: branding.terms,
          contactEmail: ownerEmail,
          orgName: org.name,
          orgLogoUrl: branding.logoUrl,
          primaryColour: branding.primaryColour,
        }),
        attachments: [
          {
            filename: `${invoice.invoiceNumber}.pdf`,
            content: pdfBuffer,
          },
        ],
      });

      return { sent: true };
    }),
});
