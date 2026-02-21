import {
  pgTable,
  pgEnum,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  date,
  time,
  jsonb,
  decimal,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// =============================================================================
// Enums
// =============================================================================

export const locationTypeEnum = pgEnum('location_type', [
  'online',
  'in_person',
  'phone',
]);

export const videoProviderEnum = pgEnum('video_provider', [
  'google_meet',
  'zoom',
  'microsoft_teams',
  'none',
]);

export const bookingStatusEnum = pgEnum('booking_status', [
  'confirmed',
  'cancelled',
  'completed',
  'no_show',
  'pending',
]);

export const overrideTypeEnum = pgEnum('override_type', [
  'available',
  'blocked',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'paid',
  'refunded',
  'cancelled',
]);

export const reminderTypeEnum = pgEnum('reminder_type', [
  '24h',
  '1h',
  'review_request',
  'follow_up',
  'custom',
]);

export const recordedViaEnum = pgEnum('recorded_via', [
  'online',
  'phone_upload',
  'browser_mic',
]);

export const orgMemberRoleEnum = pgEnum('org_member_role', [
  'owner',
  'admin',
  'member',
]);

// =============================================================================
// Users
// =============================================================================

export const users = pgTable('users', {
  id: text('id').primaryKey(), // Supabase Auth UUID
  email: varchar('email', { length: 320 }).notNull(),
  name: varchar('name', { length: 256 }),
  timezone: varchar('timezone', { length: 64 }).default('Europe/London').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('users_email_idx').on(table.email),
]);

// =============================================================================
// Organisations
// =============================================================================

export const organisations = pgTable('organisations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar('name', { length: 256 }).notNull(),
  slug: varchar('slug', { length: 128 }).notNull(),
  ownerId: text('owner_id').notNull().references(() => users.id),
  branding: jsonb('branding').$type<{
    logoUrl?: string;
    faviconUrl?: string;
    primaryColour: string;
    accentColour: string;
    textColour: string;
    backgroundColour: string;
    fontFamily: string;
    borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'full';
    buttonStyle: 'solid' | 'outline' | 'ghost' | 'gradient';
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
  }>().default({
    primaryColour: '#0F7E80',
    accentColour: '#F87A1F',
    textColour: '#1a1a1a',
    backgroundColour: '#ffffff',
    fontFamily: 'Inter',
    borderRadius: 'md',
    buttonStyle: 'solid',
  }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('organisations_slug_idx').on(table.slug),
]);

// =============================================================================
// Organisation Members
// =============================================================================

export const orgMembers = pgTable('org_members', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: text('org_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: orgMemberRoleEnum('role').default('member').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('org_members_unique_idx').on(table.orgId, table.userId),
]);

// =============================================================================
// Calendar Accounts
// =============================================================================

export const calendarAccounts = pgTable('calendar_accounts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 32 }).notNull(), // google, outlook, apple
  providerAccountId: varchar('provider_account_id', { length: 256 }),
  email: varchar('email', { length: 320 }),
  // Tokens stored encrypted via src/lib/crypto.ts — never read raw from DB
  accessTokenEncrypted: text('access_token_encrypted').notNull(),
  refreshTokenEncrypted: text('refresh_token_encrypted'),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('calendar_accounts_user_idx').on(table.userId),
]);

// =============================================================================
// Calendar Connections (split from JSONB for indexing + querying)
// =============================================================================

export const calendarConnections = pgTable('calendar_connections', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  calendarAccountId: text('calendar_account_id').notNull().references(() => calendarAccounts.id, { onDelete: 'cascade' }),
  externalId: varchar('external_id', { length: 512 }).notNull(), // provider's calendar ID
  name: varchar('name', { length: 256 }).notNull(),
  isPrimary: boolean('is_primary').default(false).notNull(),
  isSelected: boolean('is_selected').default(true).notNull(), // whether to check for busy times
  colour: varchar('colour', { length: 7 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('calendar_connections_account_external_idx').on(table.calendarAccountId, table.externalId),
  index('calendar_connections_selected_idx').on(table.calendarAccountId, table.isSelected),
]);

// =============================================================================
// Booking Types
// =============================================================================

export const bookingTypes = pgTable('booking_types', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: text('org_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 256 }).notNull(),
  slug: varchar('slug', { length: 128 }).notNull(),
  description: text('description'),
  durationMins: integer('duration_mins').default(30).notNull(),
  bufferMins: integer('buffer_mins').default(15).notNull(),
  locationType: locationTypeEnum('location_type').default('online').notNull(),
  locationDetails: text('location_details'), // address for in-person, or notes
  videoProvider: videoProviderEnum('video_provider').default('google_meet').notNull(),
  colour: varchar('colour', { length: 7 }).default('#0F7E80').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  maxAdvanceDays: integer('max_advance_days').default(60).notNull(),
  minNoticeHours: integer('min_notice_hours').default(2).notNull(),
  customFields: jsonb('custom_fields').$type<{
    fields: {
      id: string;
      type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'file' | 'email' | 'phone' | 'number';
      label: string;
      placeholder?: string;
      required: boolean;
      options?: string[]; // for select/radio
    }[];
  }>().default({ fields: [] }).notNull(),
  priceAmount: decimal('price_amount', { precision: 10, scale: 2 }),
  priceCurrency: varchar('price_currency', { length: 3 }).default('GBP'),
  requiresPayment: boolean('requires_payment').default(false).notNull(),
  emailSettings: jsonb('email_settings').$type<{
    reviewRequest: {
      enabled: boolean;
      delayMinutes: number;
      subject: string;
      body: string;
    };
    followUpReminder: {
      enabled: boolean;
      delayDays: number;
      subject: string;
      body: string;
    };
  }>().default({
    reviewRequest: {
      enabled: false,
      delayMinutes: 120,
      subject: 'How was your {{bookingType}}?',
      body: 'Hi {{clientName}},\n\nWe hope you enjoyed your {{bookingType}} on {{bookingDate}}.\n\nWe would love to hear your feedback!',
    },
    followUpReminder: {
      enabled: false,
      delayDays: 30,
      subject: 'Time to book your next {{bookingType}}',
      body: 'Hi {{clientName}},\n\nIt has been a while since your last {{bookingType}}. Ready to book another session?',
    },
  }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('booking_types_org_slug_idx').on(table.orgId, table.slug),
  index('booking_types_org_idx').on(table.orgId),
]);

// =============================================================================
// Working Hours
// =============================================================================

export const workingHours = pgTable('working_hours', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  dayOfWeek: integer('day_of_week').notNull(), // 0 = Sunday, 6 = Saturday
  startTime: time('start_time').notNull(), // e.g. "09:00"
  endTime: time('end_time').notNull(), // e.g. "17:00"
  timezone: varchar('timezone', { length: 64 }).default('Europe/London').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('working_hours_user_idx').on(table.userId),
]);

// =============================================================================
// Availability Overrides (Core Differentiator)
// =============================================================================

export const availabilityOverrides = pgTable('availability_overrides', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: date('date'), // null if recurring
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  type: overrideTypeEnum('type').notNull(),
  reason: text('reason'), // e.g. "mosque event but can take calls"
  timezone: varchar('timezone', { length: 64 }).default('Europe/London').notNull(),
  isRecurring: boolean('is_recurring').default(false).notNull(),
  recurrenceRule: varchar('recurrence_rule', { length: 256 }), // e.g. "FREQ=WEEKLY;BYDAY=FR" (iCal RRULE format)
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('availability_overrides_user_idx').on(table.userId),
  index('availability_overrides_date_idx').on(table.userId, table.date),
]);

// =============================================================================
// Bookings
// =============================================================================

export const bookings = pgTable('bookings', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: text('org_id').notNull().references(() => organisations.id),
  bookingTypeId: text('booking_type_id').notNull().references(() => bookingTypes.id, { onDelete: 'restrict' }),
  organiserId: text('organiser_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  clientName: varchar('client_name', { length: 256 }).notNull(),
  clientEmail: varchar('client_email', { length: 320 }).notNull(),
  clientPhone: varchar('client_phone', { length: 32 }),
  clientTimezone: varchar('client_timezone', { length: 64 }).notNull(),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }).notNull(),
  status: bookingStatusEnum('status').default('confirmed').notNull(),
  videoLink: text('video_link'),
  location: text('location'),
  notes: text('notes'),
  customFieldResponses: jsonb('custom_field_responses').$type<Record<string, string | boolean | string[]>>().default({}).notNull(),
  qrCodeToken: varchar('qr_code_token', { length: 64 }),
  checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
  // Cancel/reschedule tokens for email links (unique, unguessable)
  cancellationToken: varchar('cancellation_token', { length: 64 }),
  rescheduleToken: varchar('reschedule_token', { length: 64 }),
  cancellationReason: text('cancellation_reason'),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('bookings_org_idx').on(table.orgId),
  index('bookings_organiser_idx').on(table.organiserId),
  index('bookings_type_idx').on(table.bookingTypeId),
  index('bookings_start_idx').on(table.startAt),
  index('bookings_status_idx').on(table.status),
  // Composite index for availability engine: find active bookings in a time range for an organiser
  index('bookings_organiser_time_idx').on(table.organiserId, table.startAt, table.endAt, table.status),
  uniqueIndex('bookings_qr_token_idx').on(table.qrCodeToken),
  uniqueIndex('bookings_cancel_token_idx').on(table.cancellationToken),
  uniqueIndex('bookings_reschedule_token_idx').on(table.rescheduleToken),
]);

// =============================================================================
// Booking Reminders
// =============================================================================

export const bookingReminders = pgTable('booking_reminders', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  bookingId: text('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  type: reminderTypeEnum('type').notNull(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  jobId: varchar('job_id', { length: 128 }), // BullMQ job ID for cancellation
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('booking_reminders_booking_idx').on(table.bookingId),
]);

// =============================================================================
// Meeting Recordings
// =============================================================================

export const meetingRecordings = pgTable('meeting_recordings', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  bookingId: text('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  transcriptText: text('transcript_text'),
  summaryText: text('summary_text'),
  summaryJson: jsonb('summary_json').$type<{
    summary: string;
    keyPoints: { title: string; detail: string }[];
    actionItems: { text: string; owner?: string }[];
    decisions: string[];
    memorableFacts: {
      quotes: string[];
      stats: string[];
      names: string[];
      dates: string[];
    };
    mentionedUrls: { url: string; context: string }[];
  }>(),
  speakerLabels: jsonb('speaker_labels').$type<Record<string, string>>().default({}),
  summaryShared: boolean('summary_shared').default(false).notNull(),
  recordingUrl: text('recording_url'),
  recordedVia: recordedViaEnum('recorded_via').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('meeting_recordings_booking_idx').on(table.bookingId),
]);

// =============================================================================
// Invoices
// =============================================================================

export const invoices = pgTable('invoices', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  bookingId: text('booking_id').references(() => bookings.id),
  orgId: text('org_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
  invoiceNumber: varchar('invoice_number', { length: 32 }).notNull(),
  clientName: varchar('client_name', { length: 256 }).notNull(),
  clientEmail: varchar('client_email', { length: 320 }).notNull(),
  lineItems: jsonb('line_items').$type<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[]>().default([]).notNull(),
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
  vatRate: decimal('vat_rate', { precision: 5, scale: 2 }).default('0'),
  vatAmount: decimal('vat_amount', { precision: 10, scale: 2 }).default('0'),
  total: decimal('total', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('GBP').notNull(),
  paymentStatus: paymentStatusEnum('payment_status').default('pending').notNull(),
  paymentMethod: varchar('payment_method', { length: 64 }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  pdfUrl: text('pdf_url'),
  dueDate: date('due_date').notNull(),
  downloadToken: varchar('download_token', { length: 64 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('invoices_number_org_idx').on(table.orgId, table.invoiceNumber),
  uniqueIndex('invoices_download_token_idx').on(table.downloadToken),
  index('invoices_org_idx').on(table.orgId),
  index('invoices_booking_idx').on(table.bookingId),
]);

// =============================================================================
// Relations
// =============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  orgMembers: many(orgMembers),
  calendarAccounts: many(calendarAccounts),
  workingHours: many(workingHours),
  availabilityOverrides: many(availabilityOverrides),
  bookingsAsOrganiser: many(bookings),
}));

export const organisationsRelations = relations(organisations, ({ one, many }) => ({
  owner: one(users, { fields: [organisations.ownerId], references: [users.id] }),
  members: many(orgMembers),
  bookingTypes: many(bookingTypes),
  bookings: many(bookings),
  invoices: many(invoices),
}));

export const orgMembersRelations = relations(orgMembers, ({ one }) => ({
  organisation: one(organisations, { fields: [orgMembers.orgId], references: [organisations.id] }),
  user: one(users, { fields: [orgMembers.userId], references: [users.id] }),
}));

export const calendarAccountsRelations = relations(calendarAccounts, ({ one, many }) => ({
  user: one(users, { fields: [calendarAccounts.userId], references: [users.id] }),
  connections: many(calendarConnections),
}));

export const calendarConnectionsRelations = relations(calendarConnections, ({ one }) => ({
  account: one(calendarAccounts, { fields: [calendarConnections.calendarAccountId], references: [calendarAccounts.id] }),
}));

export const bookingTypesRelations = relations(bookingTypes, ({ one, many }) => ({
  organisation: one(organisations, { fields: [bookingTypes.orgId], references: [organisations.id] }),
  bookings: many(bookings),
}));

export const workingHoursRelations = relations(workingHours, ({ one }) => ({
  user: one(users, { fields: [workingHours.userId], references: [users.id] }),
}));

export const availabilityOverridesRelations = relations(availabilityOverrides, ({ one }) => ({
  user: one(users, { fields: [availabilityOverrides.userId], references: [users.id] }),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  organisation: one(organisations, { fields: [bookings.orgId], references: [organisations.id] }),
  bookingType: one(bookingTypes, { fields: [bookings.bookingTypeId], references: [bookingTypes.id] }),
  organiser: one(users, { fields: [bookings.organiserId], references: [users.id] }),
  reminders: many(bookingReminders),
  recordings: many(meetingRecordings),
  invoices: many(invoices),
}));

export const bookingRemindersRelations = relations(bookingReminders, ({ one }) => ({
  booking: one(bookings, { fields: [bookingReminders.bookingId], references: [bookings.id] }),
}));

export const meetingRecordingsRelations = relations(meetingRecordings, ({ one }) => ({
  booking: one(bookings, { fields: [meetingRecordings.bookingId], references: [bookings.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  booking: one(bookings, { fields: [invoices.bookingId], references: [bookings.id] }),
  organisation: one(organisations, { fields: [invoices.orgId], references: [organisations.id] }),
}));
