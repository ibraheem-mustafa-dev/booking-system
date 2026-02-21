ALTER TABLE "booking_types" ALTER COLUMN "colour" SET DEFAULT '#0F7E80';--> statement-breakpoint
ALTER TABLE "organisations" ALTER COLUMN "branding" SET DEFAULT '{"primaryColour":"#0F7E80","accentColour":"#F87A1F","textColour":"#1a1a1a","backgroundColour":"#ffffff","fontFamily":"Inter","borderRadius":"md","buttonStyle":"solid"}'::jsonb;--> statement-breakpoint
ALTER TABLE "meeting_recordings" ADD COLUMN "summary_json" jsonb;--> statement-breakpoint
ALTER TABLE "meeting_recordings" ADD COLUMN "speaker_labels" jsonb DEFAULT '{}'::jsonb;