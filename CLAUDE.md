# Booking System — Custom SaaS Product

## Always Do First
- PRD-first: for any new feature, write a Product Requirements Document and get approval before implementation
- Check existing Supabase schema before adding tables or columns
- Run `pnpm typecheck` before committing

## Project Context
- **Stack:** Next.js 15, TypeScript, Supabase (free tier), Tailwind CSS
- **Auth:** Supabase Auth (email + magic link)
- **Deployment:** Vercel (planned)
- **Started:** 2026-02-28 (first commit)
- **Status:** Early stage — prioritise clean architecture over features

## Supabase Rules
- Row Level Security (RLS) REQUIRED on every table — no exceptions
- Write RLS policies before writing the table query
- Migrations only via `supabase/migrations/` directory — never edit tables directly in dashboard
- Foreign keys + indexes for all join columns
- Soft deletes (`deleted_at TIMESTAMPTZ`) — never hard delete user data

## TypeScript Standards
- No `any` types — use proper types or `unknown` with narrowing
- Zod validation on all API route inputs
- Server Components by default, Client Components only when needed (interactivity/hooks)
- `use server` actions for mutations — no client-side API routes

## PRD-First Workflow
Before building any new feature:
1. Write `docs/prd-[feature-name].md` with: goal, user stories, acceptance criteria, tech approach
2. Get explicit approval ("looks good" / "build it")
3. Then implement

## Hard Rules
- No hardcoded credentials or env vars in code
- All env vars documented in `.env.example`
- No placeholder UI ("Coming soon" buttons, etc.)
- Mobile-first responsive design
- UK English in all UI strings
