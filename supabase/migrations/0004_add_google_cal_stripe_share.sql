-- Sprint 5: Google Calendar event tracking on bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;

-- Sprint 6: Stripe checkout session tracking on invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;

-- Sprint 7: Share token and viewed tracking on meeting recordings
ALTER TABLE meeting_recordings ADD COLUMN IF NOT EXISTS share_token VARCHAR(64);
ALTER TABLE meeting_recordings ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS meeting_recordings_share_token_idx ON meeting_recordings (share_token);
