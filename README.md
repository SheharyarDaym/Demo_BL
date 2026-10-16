# Lifeguard-Pro — Google + AI Visibility (interactive demo)

A frontend-only, fully interactive demo of an automated Google + AI visibility optimization system for Lifeguard-Pro.
It shows the whole loop: gather business facts → compare competitors → find missing or outdated information →
draft improvements → a person approves → simulated publishing → simulated results.

> **Everything is simulated.** All competitors, rankings, AI answers, prices, dates, reviews, connections and results are
> fictional sample data (“Demo dataset: October 2026”). Nothing is sent to Google, the live website or any AI service.
> Only the brand name `Lifeguard-Pro` and `https://www.lifeguard-pro.org` are used, as identity context — the live
> site was not audited.

## Run it

Requires Node 18+.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build at http://localhost:4173
npm test           # state-transition checks (Vitest)
```

`dist/` is a static site using hash routing (`#/results`), so it works from any static host or a subfolder.
Browser back/forward moves between tabs and open recommendations.

## Navigation (simplified)

The everyday experience follows one sentence: **Check competitors → Review suggested improvements → Apply approved changes → See progress.**

| Main tab | What you do there | One click away |
|---|---|---|
| **Dashboard** | Pick a city and click **Check competitors**; see *To review / Ready to apply / Applied*; review the top suggestions | *View all improvements* (filters), *Compare with competitors*, *View recent changes*, *Search settings* |
| **Our Business** | Read and edit business details, courses & dates, trust & media, reviews & posts | *Check missing information*, *Where this information comes from*, page previews |
| **Progress** | One chart for Google Search, Google Maps or AI mentions, per city and period | *View all measurements*, *Change history*, *Enquiries & registrations*, *Export*, *Demo controls* |

**Settings** is a labelled header button (Connections · Automatic checks · Automatic updates · Demo controls, including Reset).
Reviewing a suggestion opens one side panel (full screen on mobile). It lives in the URL (`?review=REC-001`), so browser Back and Escape close it and the page underneath keeps its filters and scroll position. Only one overlay is ever open.

## One-minute client demonstration

Dashboard → **Check competitors** → **Review** *Add upcoming Boston class dates* → read the current vs. suggested page →
**Approve & apply demo** → check the confirmation (“This only updates the demo”) → **Confirm & apply** → the updated page preview appears → **Back to dashboard** → open **Progress**.
No Settings or technical details are needed. *Approve & apply demo* is a shortcut: approval is recorded only when **Confirm & apply** is pressed, and Cancel approves nothing. *Approve only* stays under *More actions*.

Optional extras for a longer demo:

- **Missing detail** — open *Show one correct Boston course price*: “We need one detail first” → **Resolve price** inside the panel.
- **Failed update** — Settings → Demo controls → *Make the next demo update fail*, then apply *Announce the next Boston class on Google* → **Retry**.
- **Freshness** — Our Business → Courses & dates → edit a class: the form says which pages the change affects. With *Ask me first* a suggested update appears; with *Update dates, seats and prices automatically* the page updates and Change history logs it. Cancelled or sold-out classes lose their Register button.
- **Competitors** — *Compare with competitors* shows a plain table first; *See rankings and evidence* reveals positions, sample points, devices and sample pages. *AI answers* shows ChatGPT, Gemini and Copilot separately with *View sample answer*.
- **Restore** — on an applied suggestion, **View history** → *Restore previous version* (website only, confirmed inline).

## How it is built

React 18 + TypeScript + Vite, CSS variables, native SVG charts, no runtime dependencies beyond React and React Router.

```
src/
  domain/types.ts         Typed domain objects (profile, sessions, destinations, recommendations, jobs, activity…)
  data/static.ts          Read-only fixtures: queries, observations, evidence, comparisons, AI responses
  data/series.ts          Deterministic 90-day (+21-day later snapshot) result series per city, seeded once
  data/fixtures.ts        Initial mutable state + recommendation templates + analysis catalog
  state/reducer.ts        All state transitions (pure; every action carries its own timestamp)
  state/selectors.ts      Single source for counts, the “unresolved” rule, publish eligibility, filters
  state/facts.ts          Deterministic templates that turn class facts into page content
  state/storage.ts        Versioned localStorage (`lgp-visibility-demo:v1`), validation, interrupted-publish recovery
  services/demoService.ts Mock service layer: analysis stages, publish (success/failure), connection tests
  features/review.ts      Review panel URL handling (?review=ID) and preview helper
  features/plain.ts       Customer-facing titles, reasons and “where it will change” labels
  features/ReviewPanel.tsx  The single review → confirm → result → history panel
  pages/                  Dashboard, Improvements, Compare, Business, Progress, Measurements, History
```

Key rules implemented:

- **Counts are derived**, never hard-coded. *Unresolved* = Draft, Awaiting approval, Blocked, Approved, Publishing or Failed.
- **Publishing** requires the approved revision to equal the current revision, unchanged source facts, and a connected demo destination. The idempotency key is `recommendationId:revision`, so double clicks and retries cannot publish twice. Editing approved content (or a source-fact change) revokes approval.
- **Freshness**: a class change bumps its version, refreshes dependent drafts, and then — depending on policy — creates/updates a pending recommendation or auto-syncs only existing factual components (schedule, seats, status, price). Paused automation or a disconnected destination queues the change. Google posts are never rewritten.
- **Price conflict**: no winner is assumed; schedule and structured-data drafts omit the price until a person chooses a source.
- **Persistence**: saved after each state change; invalid stored JSON falls back to the fixtures with a notice; storage-quota failures show a banner and keep the session in memory; uploaded images are validated (type, ≤ 5 MB) and downscaled before storing.

## What was verified

- `npm run build` (strict TypeScript + Vite) passes; `npm test` runs 22 state checks (including the new status groups, “Not now” on blocked items, and approval clearing on defer).
- A scripted headless-Chrome walkthrough of the production build (62 checks, run three times, all passing, no console errors) covers the brief’s verification list: three-item navigation and labelled Settings; Check competitors with progress, cancel and no duplicate findings; the one-minute journey (edit → Approve & apply → Cancel approves nothing → Confirm & apply → updated page → Back to dashboard); blocked price resolved inline; Apply demo for approved items; failure + Retry keeping approval; Approve only; edit-after-approval revocation; Not now → Later → Reopen; disconnected destination → Settings; website restore; class edit with “This change affects the Boston course page”; review-required and automatic updates with pause/resume; cancelled class preview; review reply applied through the same panel; completeness checklist; unsaved-changes guard; competitor table, rankings, inline sample pages and AI answers; Progress views, All measurements, keyword history, Change history, CSV/report downloads, later snapshot; old links redirecting; reload persistence; keyboard focus and Escape; confirmed reset; and never more than one overlay open.
- All screens at 390 × 844 render without page-wide horizontal overflow, and the three tabs fit at 360 px.
- Saved demo data uses the same storage key and format as before, so a demo saved with the previous interface opens unchanged. Old routes (`#/recommendations/REC-001`, `#/results`, `#/activity`, …) redirect to their new homes.

## Feature-preservation inventory (developer handoff)

| Earlier capability | New home |
|---|---|
| Overview metrics and opportunity counts | Dashboard cards (To review / Ready to apply / Applied, with counting rule in the ⓘ tooltip); full counts in Progress → View all measurements → *Suggestion summary* |
| Run analysis: city, course, platforms, stages, cancel, no duplicates | Dashboard *Check competitors* (inline progress, Cancel, “Your suggestions are ready”); *Search settings* for course, search phrase, places and cadence |
| Recommendation list, search, city/destination/priority/status filters, run filter | Dashboard → *View all improvements* (Show: To review / Ready / Applied / Later / All open / Everything; search; *More filters*) |
| Draft / edit / save / submit / approve / reject / defer / reopen | Review panel: *Edit suggestion*, *Approve & apply demo*, *Not now*; *More actions*: Save draft, Send for approval, Approve only, Reject (with reason), Reopen |
| Before/after content, destination confirmation, simulated-publish notice | Review panel (current vs. suggested) and its confirmation step |
| Evidence, excerpts, captured times, sample pages, competitor comparison, source facts, confidence, technical IDs and source versions | Review panel → *Why this was suggested* |
| Competitor rankings (organic and Maps separately), sample point/device/date, competitor selection, evidence, create recommendation (no duplicates) | Compare with competitors → table, *See rankings and evidence* |
| AI prompts, responses, brands, citations, mention/recommendation/citation/accuracy flags per platform | Compare → *AI answers* → *View sample answer*; AI trends in Progress |
| Business fields, courses, sessions, FAQs, media upload/replace/remove | Our Business: Business details, Courses & dates, Trust & media |
| Reviews, generated replies, reply approval/publication; Google posts | Our Business → Reviews & posts (inline reply → *Review & apply* in the review panel) |
| Source tags, verification, last updated, conflict resolution, completeness checklist | *Where this information comes from* per section; *Check missing information*; *Resolve price* inline where it blocks |
| Publish validation, idempotency, failure/retry, interrupted-publish recovery | Review panel confirmation, error state with Retry; Settings → Demo controls |
| Destination previews, version history, website restore | Review panel *View result* / *View history*; Our Business page previews; Change history → *View page and history* |
| Freshness policy, auto factual sync, dependency updates, cancellation/sold-out, pause/queue | Class edit outcome text; Settings → Automatic checks / Automatic updates (waiting list + resume); paused banner |
| All charts, filters, data tables, keyword history, annotations, later snapshot, conversions | Progress (one main chart) and *View all measurements*; *Enquiries & registrations*; *Demo controls* |
| CSV export, demo report, state JSON export | Progress → *Export*; Settings → Demo controls |
| Activity log, filters, actor/time, before/after, related recommendation | Progress → *Change history* |
| Connections (connect/disconnect/test), cadence, failure simulation, reset | Settings (four groups; reset confirmed inline) |
| Dismissible “interactive simulation” note | Replaced by the persistent *Demo • Sample data* badge plus notices at the relevant actions (confirmation, results, AI answers) |

## Known limitations

- **Logo**: the official logo file and the reference screenshot were not included in this handoff, so the header uses a clean text wordmark (`Lifeguard-Pro.org` / `GOOGLE + AI VISIBILITY`). Drop the official asset into `public/` and add it to `Layout.tsx` when available. The layout was built from the written visual specification, not a pixel comparison with the screenshot.
- Sample media are local SVG illustrations, clearly labelled. The video slot is metadata only (no Play control, no upload).
- Demo state lives in this browser’s localStorage only; it isn’t shared between browsers or people.
- Fixture dates are October–November 2026 and fixed for repeatable presentations; they are not live availability.
- Out of scope by design: real Odoo/Google/Search Console/AI integrations, scraping, live rank tracking, authentication, background jobs and Bing.
