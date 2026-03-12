-- =============================================================================
-- Migration: Enable Row Level Security on all tables
-- =============================================================================
-- All server-side app operations use the service_role key which bypasses RLS.
-- These policies protect against direct anon-key queries to Supabase.
-- =============================================================================

-- ============================================================
-- USERS — users can only read/write their own row
-- ============================================================
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "users_self" ON "users"
  FOR ALL
  USING (id = auth.uid()::text)
  WITH CHECK (id = auth.uid()::text);--> statement-breakpoint

-- ============================================================
-- ORGANISATIONS — public read (booking page), owner writes
-- ============================================================
ALTER TABLE "organisations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "organisations_public_read" ON "organisations"
  FOR SELECT
  USING (true);--> statement-breakpoint

CREATE POLICY "organisations_owner_write" ON "organisations"
  FOR ALL
  USING (owner_id = auth.uid()::text)
  WITH CHECK (owner_id = auth.uid()::text);--> statement-breakpoint

-- ============================================================
-- ORG_MEMBERS — members can read their org's membership list
-- ============================================================
ALTER TABLE "org_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "org_members_read" ON "org_members"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_members om2
      WHERE om2.org_id = org_members.org_id
        AND om2.user_id = auth.uid()::text
    )
  );--> statement-breakpoint

-- ============================================================
-- BOOKING_TYPES — public read (active only), members read/write all
-- ============================================================
ALTER TABLE "booking_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "booking_types_public_read" ON "booking_types"
  FOR SELECT
  USING (is_active = true);--> statement-breakpoint

CREATE POLICY "booking_types_member_read" ON "booking_types"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = booking_types.org_id
        AND user_id = auth.uid()::text
    )
  );--> statement-breakpoint

CREATE POLICY "booking_types_member_write" ON "booking_types"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = booking_types.org_id
        AND user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = booking_types.org_id
        AND user_id = auth.uid()::text
    )
  );--> statement-breakpoint

-- ============================================================
-- BOOKINGS — org members only
-- ============================================================
ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "bookings_member" ON "bookings"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = bookings.org_id
        AND user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = bookings.org_id
        AND user_id = auth.uid()::text
    )
  );--> statement-breakpoint

-- ============================================================
-- BOOKING_REMINDERS — scoped to booking's org
-- ============================================================
ALTER TABLE "booking_reminders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "booking_reminders_member" ON "booking_reminders"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN org_members om ON om.org_id = b.org_id
      WHERE b.id = booking_reminders.booking_id
        AND om.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN org_members om ON om.org_id = b.org_id
      WHERE b.id = booking_reminders.booking_id
        AND om.user_id = auth.uid()::text
    )
  );--> statement-breakpoint

-- ============================================================
-- INVOICES — org members only
-- ============================================================
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "invoices_member" ON "invoices"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = invoices.org_id
        AND user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = invoices.org_id
        AND user_id = auth.uid()::text
    )
  );--> statement-breakpoint

-- ============================================================
-- MEETING_RECORDINGS — scoped to booking's org
-- ============================================================
ALTER TABLE "meeting_recordings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "meeting_recordings_member" ON "meeting_recordings"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN org_members om ON om.org_id = b.org_id
      WHERE b.id = meeting_recordings.booking_id
        AND om.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN org_members om ON om.org_id = b.org_id
      WHERE b.id = meeting_recordings.booking_id
        AND om.user_id = auth.uid()::text
    )
  );--> statement-breakpoint

-- ============================================================
-- WORKING_HOURS — user's own rows only
-- ============================================================
ALTER TABLE "working_hours" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "working_hours_self" ON "working_hours"
  FOR ALL
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);--> statement-breakpoint

-- ============================================================
-- AVAILABILITY_OVERRIDES — user's own rows only
-- ============================================================
ALTER TABLE "availability_overrides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "availability_overrides_self" ON "availability_overrides"
  FOR ALL
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);--> statement-breakpoint

-- ============================================================
-- CALENDAR_ACCOUNTS — user's own rows only (contains encrypted tokens)
-- ============================================================
ALTER TABLE "calendar_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "calendar_accounts_self" ON "calendar_accounts"
  FOR ALL
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);--> statement-breakpoint

-- ============================================================
-- CALENDAR_CONNECTIONS — scoped to user's calendar accounts
-- ============================================================
ALTER TABLE "calendar_connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "calendar_connections_self" ON "calendar_connections"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM calendar_accounts
      WHERE id = calendar_connections.calendar_account_id
        AND user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM calendar_accounts
      WHERE id = calendar_connections.calendar_account_id
        AND user_id = auth.uid()::text
    )
  );
