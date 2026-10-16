# Product specification and interaction contract

## Navigation
Use a branded top header and six clear navigation tabs below it. On smaller screens, tabs can scroll horizontally or use a compact menu.

| Tab | Purpose |
| --- | --- |
| Overview | Explain the product, show priorities, and start analysis |
| Business Profile | Review business facts, listing fields, and courses |
| Competitors | See sample rankings, comparisons, and evidence |
| Recommendations | Review, edit, approve, reject, and simulate publishing |
| Results | Explore sample visibility and business outcomes |
| Activity | Inspect analysis runs, publishing events, and synchronization |

Settings is a header action opening a drawer, not a seventh main tab. The logo navigates to Overview. Include a clear `Run analysis` primary action. Do not display unrelated Security, Worker colors, or Sign out buttons from the reference.

## 1. Overview
Hero title: `Google + AI Visibility`.
Supporting copy: `Find opportunities. Review improvements. Keep Lifeguard-Pro information current.`

Show four summary cards: Tracked searches, Opportunities, Awaiting approval, Published updates. Derive counts from actual demo state. Clicking each card opens the relevant filtered view. Do not invent an overall SEO score or label a profile “100% optimized.”

Below the cards show:
- `How it works`: a compact six-stage display: Monitor → Compare → Recommend → Approve → Publish → Measure. Clicking a stage opens its relevant view or explanatory detail.
- `Needs your attention`: three prioritized recommendation cards with city, issue, proposed action, and Review button.
- A small visibility trend using seeded sample data.
- Latest activity with View all.
- A dismissible one-sentence note that this is an interactive simulation.

`Run analysis` opens a modal with city, course, and platforms. Submit starts visible stages: Checking business information, Comparing competitors, Reviewing AI mentions, Preparing recommendations. Use short delays totaling about 3–5 seconds. Provide Cancel. On completion, create an analysis-run record, upsert the matching recommendations, update relevant timestamps, and offer `Review findings`. Repeating a scan must not duplicate existing findings.

## 2. Business Profile
This is a combined business-information workspace, not a claim that every field is an editable Google Business Profile API field. Clearly identify Website, Google profile, or Internal source as the intended destination. Use expandable sections to avoid an enormous form.

| Section | Fields/content |
| --- | --- |
| Business details | Name, description/about, primary category, additional categories, opening date |
| Contact and location | Website, phone, address, service areas, registration link, social links |
| Hours and attributes | Regular hours, holiday/special hours, applicable attributes |
| Courses and pricing | Course name, description, prerequisites, sample price, duration, registration destination |
| Upcoming classes | City, venue, start/end date and time, timezone, deadline, capacity, available seats, scheduled/cancelled/sold-out status |
| Trust and FAQs | Why choose us, credentials, instructors, common questions and answers |
| Photos and videos | Logo, cover, exterior, interior, training, instructor/team media |
| Reviews and posts | Sample reviews, reply state, draft/published demo posts |

Use verified brand name `Lifeguard-Pro` and website `https://www.lifeguard-pro.org` as identity context only; do not claim to have audited the live site. Other populated business details must carry sample/unverified metadata. Unknown real addresses, phone numbers, opening dates, and credentials remain empty with friendly prompts or are explicitly sample placeholders. Never fabricate accreditation.

Every section has Edit, Save, and Cancel. Validate required titles, URL formats, nonnegative prices, dates, and available seats within capacity. Unsaved changes should trigger a discard confirmation on navigation.

Display source tags such as `Odoo — demo source`, `Website — demo source`, and `Manual entry`. A source-details popover shows last updated time and verification status. Demonstrate one conflicting price with `Resolve conflict`; the presenter chooses a source, sees both values, and confirms before the canonical value changes.

Media: support local image upload preview, replace, and remove. Validate type and size; compress or limit persisted previews so browser storage cannot fail silently. Seed video content may be a local illustration and metadata; if a Play control is shown, bundle a playable sample or omit Play. Clearly label sample media. Do not fetch random remote photos.

Course edits drive freshness behavior described in the state file. Include sold-out and cancelled preview states. Reviews open in a drawer: Generate demo reply, Edit, Save draft, Approve, Publish demo. Google posts use the same recommendation approval rules.

Show `Profile information: X of Y applicable fields filled` with a transparent field checklist. Explain that this measures demo information completeness, not a Google ranking score. Unknown fields count as missing; do not count generic placeholder text as verified information.

## 3. Competitors
Filters: city, course, search phrase, and channel. Channels are Google Search, Google Maps, and AI responses. Each channel has its own observations; never reuse one rank as all three.

Google tables show query, sampled location, our position, competitor position, observation date, and change. Keep organic and Maps observations separate. Mark absent results `Not observed`, never rank zero.

Comparison drawer: compare Lifeguard-Pro with one selected fictional competitor across visible pricing, current schedules, FAQs, reviews, page freshness, and structured-data observations. Missing source evidence means `Not assessed`, not `Missing`.

Evidence drawer includes sample page title, URL using the reserved `.example` domain, captured time, short excerpt, and factual observation. Provide a local `View sample page` preview, not a broken external visit link.

Use wording such as `Competitor displays current dates; our sample page does not`. Do not claim to know the cause of a ranking difference. `Create recommendation` creates or opens the related recommendation and navigates to it.

AI panel supports ChatGPT, Gemini, and Copilot as distinct sample platforms. Show prompt, sample response, mentioned brands, citation URLs, accuracy notes, and timestamp. Explicitly label responses `Simulated response`. A mention, recommendation, and citation are separate indicators.

## 4. Recommendations — the central workflow
List filters: city, destination, priority, and status. Search by issue title. Cards show issue, location, evidence summary, recommended action, and priority. Provide sensible empty states and Clear filters.

Opening a card shows a spacious drawer or detail page:
1. What was found and why it matters to a customer.
2. Evidence and its date, with sample source previews.
3. Current versus proposed content side by side, stacked on mobile.
4. Verified/sample source facts and intended destination.
5. Expected benefit expressed qualitatively; no promised ranking gain.
6. Editable proposed content.
7. Save draft, Approve, Reject with optional reason, or Defer.

Approved items expose `Publish demo`; draft/rejected/deferred items cannot publish. Publishing requires a preview and confirmation identifying the exact destination and stating that this is simulated. On success update the destination preview, preserve its previous version, add an Activity entry, update counters, and offer View demo result.

Provide a clearly labeled optional `Simulate publishing error` toggle in Settings. Failure leaves live-preview content unchanged and shows Retry. Retry must not produce duplicate posts or events. Editing approved content revokes approval and returns it for review.

Published website content supports `Restore previous version` with confirmation. Record restoration in Activity, update the preview, and keep the original publication record. This is a demo website restore feature, not a promise of platform-wide rollback APIs.

## 5. Results
City, channel, and 7/30/90-day controls must change the displayed data. At least two cities and multiple platforms must have distinct seeded datasets.

Show separate panels for:
- Organic rankings and website impressions/clicks.
- Maps positions and sample profile interactions.
- AI mention and citation frequency, with numerator and denominator.
- Sample enquiries, registrations, and revenue.

Charts have hover details and a readable table alternative. Clicking a keyword opens its history. Show change annotations from publishing activity but do not generate an immediate ranking jump after Publish. A `Load later demo snapshot` action may deliberately load a seeded later observation, labeled as a simulated future measurement rather than a prediction or proof of causation.

`Export CSV` downloads the currently filtered data with a filename and sample-data column. `Export demo report` downloads a concise local HTML or Markdown report of current filters, metrics, and changes. Exports must actually download files.

## 6. Activity and Settings
Activity displays time, event, destination, status, and View details. Filter by analysis, approval, publishing, synchronization, and errors. Details show who performed the demo action, before/after values, and related recommendation.

Settings includes:
- Platform/source cards for Odoo, Website, Google profile, Search Console, and AI monitoring, all labeled simulated.
- Connect demo / Disconnect / Test demo connection, with functioning status changes. No credentials or OAuth screens.
- Monitoring cadence selector: manual, daily, weekly. Say `Demo schedule only — no background jobs run after this page closes`.
- Freshness policy: require review or automatically sync approved factual fields.
- Pause demo automation; while paused, record detected changes as pending and block automatic synchronization until resumed.
- Simulate next publishing failure.
- Reset demo with confirmation, and optional export of current demo state as JSON.

When a relevant demo destination is disconnected, its publishing action explains the issue and links to Settings; it must not silently succeed.
