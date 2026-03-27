# Booking System — Session Handoff

**Generated:** 2026-03-15
**Previous handoff:** 2026-02-22 (Session 15)
**Project:** SGS Booking System (standalone Next.js SaaS)
**Path:** `C:\Users\Bean\Projects\booking-system`
**Git:** `main` branch, clean working tree

---

## What Changed This Session (2026-03-14/15)

1. **Suspense boundary fix** — `useSearchParams()` on `/book/cancel` and `/book/reschedule` wasn't wrapped in `<Suspense>`, causing the production build to fail. Fixed and pushed.
2. **Design system established** — "Dark Confidence" aesthetic defined in CLAUDE.md. Orange-led (`#F87A1F`) dark premium dashboard, warm cream (`#FAF8F5`) public pages. ADHD-friendly UX principles (focus isolation, spring animations, high-contrast states). Full Design Context section added per `/teach-impeccable`.
3. **Phase 2 plan updated** — Added design system reference section so all future sprints follow the aesthetic.
4. **Product vision documented** — Future phases (onboarding wizards, AI chatbot with N8N+RAG, freemium model) captured in CLAUDE.md for context.
5. **SGS booking plugin updated** — Design Context added to `small-giants-wp/plugins/sgs-booking/CLAUDE.md` and `small-giants-wp/specs/03-SGS-BOOKING.md` to align the WordPress extension with the design system.

---

## Current State

### Phase 1 MVP — 90% complete

| Step | Status | Notes |
|------|--------|-------|
| 1-6 | Done | Scaffold, DB, auth, booking types, availability, Google Calendar |
| 7 | Deferred | Microsoft Outlook OAuth (not blocking MVP) |
| 8-13 | Done | Availability engine (23 tests), public booking, email, ICS, invoices, AI transcription |
| 14 | TODO | Testing + Lighthouse + accessibility audit |
| 15 | TODO | Deploy to VPS (Docker Compose on Hostinger KVM 2) — blocked by Turbopack issue from previous session |

**Tests:** 41 vitest tests pass. Production build passes (26 routes).
**Feature branch:** `feature/ai-transcription` still on remote but fully merged to main — can be deleted.

### Phase 2 — Planned, not started

Full plan at `docs/plans/2026-03-10-phase-2-plan.md`. 7 sprints. Now includes design system constraints section.

---

## Design System — "Dark Confidence"

Full spec in `CLAUDE.md` under "Design Context" and "Design System" sections. Summary:

| Surface | Background | Primary CTA | Secondary |
|---------|-----------|-------------|-----------|
| Dashboard | `#0C0C0F` (near-black) | `#F87A1F` (orange) | `#0F7E80` (teal) |
| Public booking | `#FAF8F5` (warm cream) | `#F87A1F` (orange) | `#0F7E80` (teal) |

**Typography:** Inter 700 headings, JetBrains Mono for data/numbers, Inter body. Both via `next/font/google`.

**ADHD-Friendly UX:** Focus isolation (hovered element brightens, siblings dim to ~60%), spring animations (`cubic-bezier(0.34, 1.56, 0.64, 1)`), pulsing orange dot loading, bento grid stats.

**Anti-patterns:** No serif headings, no spinning circles, no grey-on-white cards, no `ease-in-out`, no uniform grids.

**Product vision:**
- Phase A: Visual redesign (design system defined, applied during Phase 2)
- Phase B: Onboarding (wizards, tutorials, tooltips)
- Phase C: AI chatbot (N8N + RAG, natural language recipe matching, booking automation)
- Phase D: Freemium model (paid extras: chatbot, analytics)
- Phase E: SGS WordPress booking block (thin API client, spec at `small-giants-wp/specs/03-SGS-BOOKING.md`)

---

## Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Project DNA — design context, design system, coding standards, product vision |
| `docs/plans/2026-03-10-phase-2-plan.md` | Phase 2 implementation plan (7 sprints, design system section added) |
| `src/app/globals.css` | CSS tokens, brand variables, WCAG touch targets — needs design system overhaul |
| `src/app/(dashboard)/dashboard/page.tsx` | Dashboard — needs bento grid, dark theme, orange stats |
| `src/app/(dashboard)/sidebar.tsx` | Sidebar — needs dark theme, gradient header |
| `src/app/book/[slug]/[typeSlug]/booking-flow.tsx` | Public booking flow (793 lines) — needs cream/pill/floating label redesign |
| `src/app/(auth)/login/page.tsx` | Login — needs dark split layout |
| `src/app/layout.tsx` | Root layout — needs JetBrains Mono font loader |

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16, React 19 |
| Language | TypeScript (strict, zero `any`) |
| Styling | Tailwind CSS v4, shadcn/ui |
| Database | Supabase (PostgreSQL), Drizzle ORM |
| API | tRPC v11 (dashboard), REST (public booking) |
| Auth | Supabase Auth (magic link) |
| Email | Resend + React Email, BullMQ worker |
| Payments | Stripe (Payment Intents, planned) |
| AI | Deepgram Nova-3 (transcription), Gemini 2.5 Flash (summaries) |
| Calendar | Google Calendar OAuth |
| Deployment | Docker Compose on Hostinger KVM 2 VPS |

---

## Skills to Invoke

Always start with `/superpowers:using-superpowers`.

### Process Skills (invoke first)
| Skill | When |
|-------|------|
| `/superpowers:brainstorming` | Before any new feature or visual work |
| `/superpowers:writing-plans` | Before multi-step implementations |
| `/superpowers:systematic-debugging` | Any bug, test failure, or unexpected behaviour |
| `/superpowers:verification-before-completion` | Before claiming anything is done |
| `/superpowers:test-driven-development` | Before writing implementation code |
| `/superpowers:executing-plans` | When executing a written plan with checkpoints |
| `/superpowers:dispatching-parallel-agents` | When 2+ independent tasks can run in parallel |
| `/superpowers:finishing-a-development-branch` | When ready to merge — guides merge/PR/cleanup |

### Domain Skills (invoke at point of use)
| Skill | When |
|-------|------|
| `/frontend-design` | Building new UI components — avoids generic AI aesthetics |
| `/ui-ux-pro-max` | Choosing styles, palettes, font pairings (50 styles, 21 palettes) |
| `/tailwind-design-system` | Design tokens, Tailwind v4 component patterns |
| `/vercel-react-best-practices` | React/Next.js performance optimisation |
| `/software-architecture` | Architectural decisions, Clean Architecture, SOLID |
| `/animate` | Micro-interactions, spring animations, motion design |
| `/bolder` | If design feels too safe/boring — amplify visual impact |
| `/colorize` | If sections feel too monochromatic |
| `/polish` | Final quality pass — alignment, spacing, consistency |
| `/adapt` | Responsive design across breakpoints |
| `/interaction-design` | Hover/focus/loading states, transitions |
| `/teach-impeccable` | If design context needs updating |
| `/claude-api` | When working with Anthropic SDK imports |
| `/deploy-nextjs` | Pre-deployment checklist |

### Review Skills (invoke after implementation)
| Skill | When |
|-------|------|
| `/superpowers:requesting-code-review` | After completing a feature |
| `/superpowers:receiving-code-review` | When getting feedback — verify before implementing |
| `/review` | General code review for best practices |
| `/simplify` | Review changed code for reuse and efficiency |

---

## Agents to Use

| Agent | When | What it does |
|-------|------|-------------|
| `test-and-explain` | After any feature or fix | Runs tests, explains results in plain English |
| `design-reviewer` | After visual changes | Checks WCAG 2.2 AA, design system consistency, responsive behaviour, compares against mockups |
| `performance-auditor` | After visual changes or before deploy | Lighthouse, Core Web Vitals, bundle size |
| `code-simplifier` | After completing a feature | Refines code for clarity and maintainability |
| `feature-dev:code-architect` | For complex features | Designs architecture, maps component hierarchy |
| `feature-dev:code-explorer` | For understanding existing patterns | Traces execution paths, maps dependencies |
| `feature-dev:code-reviewer` | For high-priority code review | Confidence-based filtering, only reports real issues |

---

## MCP Servers & Tools

| Server | Use for |
|--------|---------|
| `firecrawl` | **All web research** — replaces WebFetch/WebSearch. Design inspiration, competitor analysis, library docs, best practices |
| `context7` | Up-to-date docs for Next.js, React 19, Tailwind v4, shadcn/ui, Drizzle, tRPC, Supabase |
| `github` | PRs, issues, code search, branch management, release creation |
| `playwright` | Visual testing — screenshots at 375/768/1440px breakpoints, accessibility audits with axe-core, console error checks, form testing |
| `supabase` | Database operations if MCP connected |
| `ICD-10 Codes` | Not relevant to this project |

### CLI Tools
| Tool | Use for |
|------|---------|
| `gh` | GitHub CLI — PRs, issues, run checks, API queries |
| `npx vitest run` | Run test suite (41 tests) |
| `npm run build` | Production build verification |
| `npx tsc --noEmit` | TypeScript type checking |

---

## Research Approach for Design Work

1. **Search competitors:** `firecrawl search "dark SaaS dashboard design 2026"`, `"booking UI criticism reddit"`
2. **Fetch library docs:** Context7 for shadcn/ui APIs, Tailwind v4 theme config, next/font
3. **Scan codebase:** `Grep` for `--brand-`, `bg-`, `oklch`, `text-muted` to find all colour/style usage
4. **Test at breakpoints:** Playwright screenshots at 375px (mobile), 768px (tablet), 1440px (desktop)
5. **Check accessibility:** Playwright axe-core audit, WCAG 2.2 AA contrast checks on orange (#F87A1F) — borderline 4.5:1 on white, safe for large text and buttons only

---

## Known Issues / Risks

1. **Docker build blocker** — Turbopack page data collection fails with `supabaseKey is required`. Env vars confirmed present but Turbopack's worker doesn't see them. See previous handoff for attempted fixes.
2. **Google Calendar tokens lost** — `gog auth add` needs re-running before calendar integration works
3. **Stripe webhook secret not set** — needs configuring on VPS after Sprint 6
4. **RESEND_API_KEY empty** — email sending won't work until added to `.env.production` on VPS
5. **ioredis warning** — build shows "Package ioredis can't be external" (non-blocking)
6. **Feature branch cleanup** — `feature/ai-transcription` on remote, fully merged — safe to delete
7. **Orange contrast** — `#F87A1F` on white is exactly 4.5:1 AA. Safe for buttons/large text, not for body text.

---

## What to Work on Next

**Priority order:**
1. **Step 14:** Testing + Lighthouse + accessibility audit → `test-and-explain` agent
2. **Step 15:** Fix Docker build blocker, deploy to VPS → `/superpowers:systematic-debugging`, `/deploy-nextjs`
3. **Phase 2 Sprint 1:** Domain + infrastructure (DNS, SSL, nginx)
4. **Design system application:** Apply "Dark Confidence" during Phase 2 UI sprints — don't redesign before deploying

**Do NOT:**
- Redesign before deploying — get the current version live first, iterate visually during Phase 2
- Build the SGS booking WordPress plugin until missing API endpoints exist
- Use serif heading fonts, spinning circles, grey-on-white cards, or `ease-in-out` transitions

---

## Next Session Prompt

```
/superpowers:using-superpowers

Continue work on the SGS Booking System at C:\Users\Bean\Projects\booking-system

Read CONVERSATION-HANDOFF.md and CLAUDE.md for full context — they contain the design system ("Dark Confidence"), product vision, known issues, and priority order.

Current state: Phase 1 MVP at 90%. 41 tests pass, build passes. Steps 14 (testing audit) and 15 (deploy to VPS) remain.

Key skills to invoke at the right moments:
- /superpowers:systematic-debugging — for the Docker build blocker (Turbopack env var issue)
- /superpowers:verification-before-completion — before claiming deploy works
- /deploy-nextjs — pre-deployment checklist
- /frontend-design + /ui-ux-pro-max — when applying the design system in Phase 2
- /animate + /interaction-design — for spring animations and focus isolation states
- /tailwind-design-system — for design token implementation in globals.css

Key agents:
- test-and-explain — after Step 14
- design-reviewer — after any visual changes
- performance-auditor — before/after deploy

MCP tools:
- firecrawl — all web research (replaces WebFetch/WebSearch)
- context7 — library docs (Next.js 16, Tailwind v4, shadcn/ui, Drizzle, tRPC)
- playwright — visual testing at breakpoints, accessibility audits
- github — PR management

VPS: ssh vps (72.62.212.169). Docker Compose at /opt/booking-system. Nginx config ready. SSL pending DNS.
```
