CREATE TYPE "public"."booking_status" AS ENUM('confirmed', 'cancelled', 'completed', 'no_show', 'pending');--> statement-breakpoint
CREATE TYPE "public"."location_type" AS ENUM('online', 'in_person', 'phone');--> statement-breakpoint
CREATE TYPE "public"."org_member_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."override_type" AS ENUM('available', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'paid', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."recorded_via" AS ENUM('online', 'phone_upload', 'browser_mic');--> statement-breakpoint
CREATE TYPE "public"."reminder_type" AS ENUM('24h', '1h', 'review_request', 'follow_up', 'custom');--> statement-breakpoint
CREATE TYPE "public"."video_provider" AS ENUM('google_meet', 'zoom', 'microsoft_teams', 'none');--> statement-breakpoint
CREATE TABLE "availability_overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"type" "override_type" NOT NULL,
	"reason" text,
	"timezone" varchar(64) DEFAULT 'Europe/London' NOT NULL,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"recurrence_rule" varchar(256),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_reminders" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"type" "reminder_type" NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"job_id" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_types" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" varchar(256) NOT NULL,
	"slug" varchar(128) NOT NULL,
	"description" text,
	"duration_mins" integer DEFAULT 30 NOT NULL,
	"buffer_mins" integer DEFAULT 15 NOT NULL,
	"location_type" "location_type" DEFAULT 'online' NOT NULL,
	"location_details" text,
	"video_provider" "video_provider" DEFAULT 'google_meet' NOT NULL,
	"colour" varchar(7) DEFAULT '#1B6B6B' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"max_advance_days" integer DEFAULT 60 NOT NULL,
	"min_notice_hours" integer DEFAULT 2 NOT NULL,
	"custom_fields" jsonb DEFAULT '{"fields":[]}'::jsonb NOT NULL,
	"price_amount" numeric(10, 2),
	"price_currency" varchar(3) DEFAULT 'GBP',
	"requires_payment" boolean DEFAULT false NOT NULL,
	"email_settings" jsonb DEFAULT '{"reviewRequest":{"enabled":false,"delayMinutes":120,"subject":"How was your {{bookingType}}?","body":"Hi {{clientName}},\n\nWe hope you enjoyed your {{bookingType}} on {{bookingDate}}.\n\nWe would love to hear your feedback!"},"followUpReminder":{"enabled":false,"delayDays":30,"subject":"Time to book your next {{bookingType}}","body":"Hi {{clientName}},\n\nIt has been a while since your last {{bookingType}}. Ready to book another session?"}}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"booking_type_id" text NOT NULL,
	"organiser_id" text NOT NULL,
	"client_name" varchar(256) NOT NULL,
	"client_email" varchar(320) NOT NULL,
	"client_phone" varchar(32),
	"client_timezone" varchar(64) NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"status" "booking_status" DEFAULT 'confirmed' NOT NULL,
	"video_link" text,
	"location" text,
	"notes" text,
	"custom_field_responses" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"qr_code_token" varchar(64),
	"checked_in_at" timestamp with time zone,
	"cancellation_token" varchar(64),
	"reschedule_token" varchar(64),
	"cancellation_reason" text,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" varchar(32) NOT NULL,
	"provider_account_id" varchar(256),
	"email" varchar(320),
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text,
	"token_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"calendar_account_id" text NOT NULL,
	"external_id" varchar(512) NOT NULL,
	"name" varchar(256) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_selected" boolean DEFAULT true NOT NULL,
	"colour" varchar(7),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text,
	"org_id" text NOT NULL,
	"invoice_number" varchar(32) NOT NULL,
	"client_name" varchar(256) NOT NULL,
	"client_email" varchar(320) NOT NULL,
	"line_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"vat_rate" numeric(5, 2) DEFAULT '0',
	"vat_amount" numeric(10, 2) DEFAULT '0',
	"total" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'GBP' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"payment_method" varchar(64),
	"paid_at" timestamp with time zone,
	"pdf_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_recordings" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"transcript_text" text,
	"summary_text" text,
	"summary_shared" boolean DEFAULT false NOT NULL,
	"recording_url" text,
	"recorded_via" "recorded_via" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_members" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "org_member_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organisations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"slug" varchar(128) NOT NULL,
	"owner_id" text NOT NULL,
	"branding" jsonb DEFAULT '{"primaryColour":"#1B6B6B","accentColour":"#E8B931","textColour":"#1a1a1a","backgroundColour":"#ffffff","fontFamily":"Inter","borderRadius":"md","buttonStyle":"solid"}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"name" varchar(256),
	"timezone" varchar(64) DEFAULT 'Europe/London' NOT NULL,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "working_hours" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"timezone" varchar(64) DEFAULT 'Europe/London' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "availability_overrides" ADD CONSTRAINT "availability_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_reminders" ADD CONSTRAINT "booking_reminders_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_types" ADD CONSTRAINT "booking_types_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_booking_type_id_booking_types_id_fk" FOREIGN KEY ("booking_type_id") REFERENCES "public"."booking_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_organiser_id_users_id_fk" FOREIGN KEY ("organiser_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_accounts" ADD CONSTRAINT "calendar_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_calendar_account_id_calendar_accounts_id_fk" FOREIGN KEY ("calendar_account_id") REFERENCES "public"."calendar_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_recordings" ADD CONSTRAINT "meeting_recordings_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisations" ADD CONSTRAINT "organisations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "working_hours" ADD CONSTRAINT "working_hours_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "availability_overrides_user_idx" ON "availability_overrides" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "availability_overrides_date_idx" ON "availability_overrides" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "booking_reminders_booking_idx" ON "booking_reminders" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_types_org_slug_idx" ON "booking_types" USING btree ("org_id","slug");--> statement-breakpoint
CREATE INDEX "booking_types_org_idx" ON "booking_types" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "bookings_org_idx" ON "bookings" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "bookings_organiser_idx" ON "bookings" USING btree ("organiser_id");--> statement-breakpoint
CREATE INDEX "bookings_type_idx" ON "bookings" USING btree ("booking_type_id");--> statement-breakpoint
CREATE INDEX "bookings_start_idx" ON "bookings" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bookings_organiser_time_idx" ON "bookings" USING btree ("organiser_id","start_at","end_at","status");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_qr_token_idx" ON "bookings" USING btree ("qr_code_token");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_cancel_token_idx" ON "bookings" USING btree ("cancellation_token");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_reschedule_token_idx" ON "bookings" USING btree ("reschedule_token");--> statement-breakpoint
CREATE INDEX "calendar_accounts_user_idx" ON "calendar_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_connections_account_external_idx" ON "calendar_connections" USING btree ("calendar_account_id","external_id");--> statement-breakpoint
CREATE INDEX "calendar_connections_selected_idx" ON "calendar_connections" USING btree ("calendar_account_id","is_selected");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_org_idx" ON "invoices" USING btree ("org_id","invoice_number");--> statement-breakpoint
CREATE INDEX "invoices_org_idx" ON "invoices" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "invoices_booking_idx" ON "invoices" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "meeting_recordings_booking_idx" ON "meeting_recordings" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_members_unique_idx" ON "org_members" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organisations_slug_idx" ON "organisations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "working_hours_user_idx" ON "working_hours" USING btree ("user_id");