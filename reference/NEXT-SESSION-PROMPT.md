# Next Session Prompt

Copy everything below the line and paste it as your first message in the next Claude Code session.

---

Read the CLAUDE.md and CONVERSATION-HANDOFF.md first. Then read `reference/base-claude-plan.md` for the full implementation plan.

Before we continue building, I need you to critically grade this entire plan and project. Put on your cap as an expert in UI/UX design AND software/app development architecture.

Use subagents to split this into specialised parallel workstreams. Here's what I need:

## 1. Architecture & Technical Review (software dev expert)
- Grade the tech stack choices (Next.js 16, Drizzle, tRPC, Supabase, BullMQ) — are these the right tools for this specific use case in 2026?
- Grade the database schema design — normalisation, indexing, the JSONB columns (are they appropriate or should they be separate tables?), the multi-tenant approach
- Grade the tRPC procedure structure (public/protected/org) — is this sufficient for the booking system's access patterns?
- Grade the availability engine design — will the formula (working hours ± overrides ± calendar busy ± bookings ± buffer) perform at scale? Edge cases?
- Grade the phased build order — is the sequencing right? Are there dependencies that should be reordered?
- Score: X/10 with specific weaknesses

## 2. UI/UX Expert Review
Use /ui-ux-pro-max and /brainstorming skills. Review the planned UI from `reference/base-claude-plan.md`:
- Grade the booking flow design (select type → pick date → pick time → enter details → confirm) — is this optimal? What do the best booking UIs do differently?
- Grade the theming system (6 presets, CSS custom properties, per-org branding) — is this flexible enough for real white-label use?
- Grade the admin dashboard design plan — sidebar nav, calendar grid, form builder, live preview
- Grade the embed widget approach (Lit Web Component, ~5KB) — is Lit still the best choice in 2026?
- Identify UX patterns we're missing that competitors do well
- Score: X/10 with specific weaknesses

## 3. Competitor Analysis (2026 market)
Use web search to research the CURRENT state of these competitors (not 2025 data — things change fast):
- **Calendly** — latest features, pricing changes, embed performance
- **Cal.com** — latest release, self-hosting improvements, licence changes
- **Amelia** — still active? WordPress ecosystem changes
- **SavvyCal** — current positioning and unique features
- **TidyCal** — still AppSumo? Feature growth
- **Trafft** — white-label capabilities
- **Any new entrants** in the booking/scheduling space since mid-2025
- For each: what features have they added that our plan doesn't cover?

## 4. Market Gap Validation
Based on the competitor analysis:
- Is the market gap identified in our research (fast embeds + WordPress-native + schema markup + granular calendar control + flat-rate pricing) still valid in 2026?
- Are there NEW gaps that have opened up?
- What's the strongest competitive positioning for this product?
- Are there features in our plan that are actually table stakes now (not differentiators)?
- What's the one feature that would make someone switch from Calendly to this?

## 5. Risk Assessment
- What are the top 3 technical risks in this plan?
- What are the top 3 business/market risks?
- What's most likely to go wrong during implementation?
- What's the MVP definition too broad? Should anything be cut or added?

## Deliverable
Give me a single consolidated report with:
1. Overall grade (X/10) with breakdown per area
2. Top 5 strengths of the plan
3. Top 5 weaknesses or blind spots
4. Specific recommendations (numbered, actionable)
5. Any features to add, cut, or reprioritise
6. Updated competitor landscape summary

Be brutally honest. I'd rather know the weaknesses now than discover them after building.
