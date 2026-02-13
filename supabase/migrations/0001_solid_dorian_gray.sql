ALTER TABLE "invoices" ADD COLUMN "due_date" date NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "download_token" varchar(64);--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_download_token_idx" ON "invoices" USING btree ("download_token");