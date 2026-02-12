---
name: db-migrate
description: Run Drizzle ORM database migrations safely. Generates migration SQL from schema changes, runs migrations, and verifies the result.
disable-model-invocation: true
---

# Database Migration Workflow

Run this workflow whenever the Drizzle schema at `src/lib/db/schema.ts` has been modified.

## Steps

1. **Verify schema compiles** — run `npx tsc --noEmit` to catch type errors before generating SQL
2. **Generate migration** — run `npx drizzle-kit generate` to create migration SQL in `./supabase/migrations/`
3. **Review the generated SQL** — read the newest migration file and show it to the user for approval
4. **Run migration** — after user approval, run `npx drizzle-kit migrate`
5. **Verify** — run `npx drizzle-kit studio` info or a test query to confirm the migration applied

## Important

- Migrations output to `./supabase/migrations/` (configured in `drizzle.config.ts`)
- Requires `DATABASE_URL` in `.env.local`
- For dev-only quick iteration, `npx drizzle-kit push` skips migration files and pushes directly — but never use this in production
- Always show the generated SQL to the user before running the migration
- If a migration fails, do NOT delete the migration file. Investigate and fix the issue
