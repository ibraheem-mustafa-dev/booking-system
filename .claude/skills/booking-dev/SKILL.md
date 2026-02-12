---
name: booking-dev
description: Guided feature development for the booking system. Use when building new features, adding tRPC routers, creating dashboard pages, or extending the database schema. Ensures consistency with project architecture and conventions.
---

# Booking System Feature Development

You are building a feature for a self-hosted booking/scheduling system. Follow these patterns exactly.

## Project Architecture

- **Path alias**: `@/*` maps to `./src/*`
- **Database**: Drizzle ORM with PostgreSQL via `postgres` driver
- **API**: tRPC v11 with superjson transformer
- **Auth**: Supabase SSR (`@supabase/ssr`)
- **UI**: shadcn/ui (new-york style) + Tailwind CSS v4 + Framer Motion
- **Validation**: Zod v4
- **Language**: UK English everywhere (colour, organisation, cancelled)

## When Adding a New tRPC Router

1. Create the router file at `src/server/routers/<name>.ts`
2. Import the appropriate procedure level:
   - `publicProcedure` — for public booking pages (no auth)
   - `protectedProcedure` — for authenticated users
   - `orgProcedure` — for org-scoped operations (most admin features)
3. Use Zod for input validation on every procedure
4. Register the router in `src/server/routers/_app.ts`

```typescript
// src/server/routers/example.ts
import { z } from 'zod';
import { router, orgProcedure } from '../trpc';
import { eq } from 'drizzle-orm';
import { tableName } from '@/lib/db/schema';

export const exampleRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.query.tableName.findMany({
      where: eq(tableName.orgId, ctx.orgId),
    });
  }),
  create: orgProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // implementation
    }),
});
```

Then in `_app.ts`:
```typescript
import { exampleRouter } from './example';
export const appRouter = router({
  example: exampleRouter,
});
```

## When Adding a Database Table

1. Add the table definition to `src/lib/db/schema.ts` (single schema file)
2. Add relations below the table definition
3. Use text UUIDs: `text('id').primaryKey().$defaultFn(() => crypto.randomUUID())`
4. Always include `createdAt` and `updatedAt` timestamps with `withTimezone: true`
5. Add appropriate indexes
6. Run `npx drizzle-kit generate` then `npx drizzle-kit migrate`

## When Adding a Dashboard Page

1. Create route at `src/app/(dashboard)/<feature>/page.tsx`
2. Use server components by default, `'use client'` only when needed
3. Import UI from `@/components/ui/<component>`
4. Use `trpc` hooks from `@/lib/trpc/client` for data fetching
5. Toast notifications via Sonner: `import { toast } from 'sonner'`
6. Loading states use `<Skeleton />` not spinners
7. All interactive elements must have 44px minimum touch targets

## When Adding a Public Booking Page

1. Routes under `src/app/book/[slug]/` are excluded from auth middleware
2. Use `publicProcedure` for data fetching
3. Apply brand CSS custom properties from the organisation's branding JSONB:
   - `--brand-primary`, `--brand-accent`, `--brand-text`, `--brand-background`, `--brand-font`, `--brand-radius`
4. Use `generateCssVariables()` from `@/lib/theme/config` to convert branding to CSS vars

## Conventions Checklist

Before completing any feature, verify:
- [ ] UK English in all text, comments, and variable names
- [ ] Zod validation on all tRPC inputs
- [ ] Org-scoped queries use `orgProcedure` and filter by `ctx.orgId`
- [ ] All timestamps use `withTimezone: true`
- [ ] No hardcoded colours — use CSS custom properties or Tailwind classes
- [ ] Mobile-first responsive design
- [ ] 44px minimum touch targets on interactive elements
- [ ] Toast notifications for user actions (not alert boxes)
- [ ] Skeleton loading states (not spinners)
