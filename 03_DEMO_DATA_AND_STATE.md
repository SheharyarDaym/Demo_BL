# Demo fixtures, state, and simulation rules

## Fixture policy
All competitor names, rankings, traffic, reviews, course prices, dates, and AI responses in this file are fictional presentation data. Use the Lifeguard-Pro brand context without representing fictional operational data as current business facts.

Use a deterministic clock: initial sample observation is `2026-10-16T14:00:00-04:00`, with Boston and Miami course times in `America/New_York`. Show `Demo dataset: October 2026` in the UI. Keep the baseline fixed for repeatable presentations. Actions can log the browser's current time but must keep sample measurement dates visibly distinct. Never describe a 2026 fixture as live current availability when presenting later.

## Seed entities
Cities: Boston and Miami.
Courses: Lifeguard certification and Lifeguard recertification.
Fictional competitors: Harbor Aquatic Training, Metro Swim Academy, Coastal Safety School. URLs use `.example`, and all competitor previews are local UI representations.

| Session ID | City | Course | Sample price | Sample date | Sample venue | Available/capacity |
| --- | --- | --- | --- | --- | --- | --- |
| BOS-CERT-01 | Boston | Lifeguard certification | $249 | Oct 24–25, 2026 | Demo Boston Training Pool | 8/20 |
| BOS-RECERT-01 | Boston | Lifeguard recertification | $149 | Oct 31, 2026 | Demo Boston Training Pool | 5/12 |
| MIA-CERT-01 | Miami | Lifeguard certification | $259 | Nov 7–8, 2026 | Demo Miami Training Pool | 12/24 |
| MIA-RECERT-01 | Miami | Lifeguard recertification | $159 | Nov 14, 2026 | Demo Miami Training Pool | 0/12 |

Seed a conflict: Odoo's demo source says $249 for BOS-CERT-01; an older website snapshot says $229. Do not assume a winner until the presenter confirms the authoritative source. Resolving it invalidates drafts based on the other value.

## Search observations
Seed eight tracked queries, four per city: lifeguard certification in city, low cost lifeguard course in city, lifeguard course in city this month, lifeguard recertification in city. Each has a stable ID and explicit course mapping.

| Query example | Channel | Lifeguard-Pro | Harbor | Metro | Coastal |
| --- | --- | --- | --- | --- | --- |
| low cost lifeguard course in Boston | Organic | 36 | 3 | 7 | 12 |
| lifeguard course in Boston this month | Organic | 24 | 2 | 5 | 11 |
| lifeguard certification in Boston | Maps | 8 | 2 | 4 | Not observed |
| lifeguard certification in Miami | Organic | 18 | Not observed | 9 | 3 |

Complete the other deterministic fixtures without using random values on render. Include observation time, exact query, sample location, device, and result URL. Maps records use a specified sample point in the selected city; do not imply a city-wide universal rank. Paid ads are not counted as organic ranks.

Seed at least 90 daily data points per city for Results filters. Each series has a stable value progression with occasional declines. Metric cards and charts must use the same underlying arrays. Rank trends use lower-is-better semantics and correctly labeled axes.

## Recommendation fixtures
| ID | Issue | Destination | Initial state | Priority |
| --- | --- | --- | --- | --- |
| REC-001 | Boston page lacks October dates and availability | Website city/course page | Awaiting approval | High |
| REC-002 | Boston price differs between sources | Website pricing section | Blocked: source conflict | High |
| REC-003 | Prerequisites and renewal FAQs need clearer answers | Website FAQ | Draft | Medium |
| REC-004 | Upcoming Boston course announcement | Google post demo | Approved | Medium |
| REC-005 | One sample review needs a response | Google review reply demo | Awaiting approval | Medium |
| REC-006 | Course structured data differs from visible text | Website structured data preview | Awaiting approval | Medium |
| REC-007 | Instructor/trust section needs verified credentials | Website trust content | Blocked: missing facts | Medium |
| REC-008 | Miami schedule needs a clearer registration link | Website course page | Published | Low |

REC-001 proposal can include the sample date, availability, venue, and registration link; avoid its conflicted price until REC-002 is resolved. REC-003 should use safe sample answers about finding course-specific prerequisites rather than inventing certification requirements. REC-007 must remain blocked until the presenter supplies explicit sample verification; AI must not manufacture credentials.

Initial Overview counts should be derived: 8 tracked queries; 7 unresolved opportunities; 3 awaiting approval; 1 published update. Define unresolved as Draft, Awaiting approval, Blocked, Approved, or Failed, excluding Published, Rejected, and Deferred. Use one selector for this rule across the app.

## Evidence and AI fixtures
Every finding links to at least one evidence record or internal data discrepancy. Evidence records have ID, source title, sample URL, capture time, excerpt, and observation. Label relationship to rankings as a hypothesis rather than proven causation.

Seed at least two prompts for each AI platform and city; include one response that mentions Lifeguard-Pro, one that mentions competitors only, and one with a factual inconsistency. Each response is labeled simulated. Store distinct booleans for mention, recommendation, citation, and correct facts. Calculate rates from these records, e.g. mentions / total eligible sample responses, not a hand-entered percentage. A brand mention without a citation remains uncited.

## Core state shape
Use typed records with stable IDs:
- BusinessProfile: field values, source IDs, verification metadata, media, version.
- Course and CourseSession: courseId, cityId, price, dates, timezone, capacity, availability, status, version.
- Destination: channel, resource ID, preview content, current version, history.
- Observation and Evidence: context, timestamps, sources, sample results.
- Recommendation: issue key, proposed content, status, priority, destinationId, evidenceIds, sourceVersions, revision, approvedRevision, approvedBy, publishedVersion.
- AnalysisRun: selections, stage, status, startedAt, completedAt, findingIds.
- PublishJob: unique ID, recommendationId, revision, status, attempt count, error.
- ActivityEvent: action, related IDs, actor, timestamp, before/after summaries.
- Settings: connections, freshness policy, automation paused, failure toggle, selected snapshot.

Local state is the single source of truth. Do not maintain separate hard-coded counts in components. Store only safe serializable data. Handle storage quota failures visibly and preserve the current in-memory session.

## Recommendation transitions
Draft → Awaiting approval → Approved → Publishing → Published.
Blocked → Draft or Awaiting approval only after required source facts are resolved.
Awaiting approval → Rejected or Deferred.
Rejected/Deferred → Draft through an explicit Reopen action.
Publishing → Failed on simulated error; Failed → Publishing on Retry if the same approved revision and source versions remain valid.
Editing approved content or changing its source facts → Awaiting approval and cleared approval metadata.

Preserve each published revision as immutable history. A new improvement creates a new revision; it must not overwrite the record of what was approved before.

## Publishing logic
1. Require approvedRevision === current revision, valid source versions, and connected demo destination.
2. Confirm target and demo-only effect.
3. Disable duplicate clicks while pending.
4. On simulated failure, consume the fail-next toggle and leave destination unchanged.
5. On success, save the old destination version, apply proposed content, store one successful publish event, and mark Published.
6. Verify the updated local preview and show the result.

Use an idempotency key derived from recommendation ID and revision so a retry or double click cannot publish twice. If the browser reloads during a pending operation, recover it as interrupted/retryable rather than leaving it stuck forever.

## Freshness simulation
Map each course session to dependent website schedule, pricing, FAQ references if any, and structured-data preview. Google posts are historical messages; do not silently rewrite every past announcement when a course changes.

When a sample course changes:
- Validate the new values.
- Increment its version and identify affected destinations.
- Require review by default; create or update a recommendation with the exact before/after change.
- If the user explicitly enabled automatic sync for factual fields, update only preapproved schedule/availability/price components using deterministic templates. Log each action and retain versions.
- If automation is paused or a destination disconnected, queue the action with an understandable reason.
- Never automatically generate new claims, credentials, marketing text, or review responses through this rule.
- Cancelled and sold-out sessions must not show available registration calls to action in affected previews.

## Persistence and reset
Persist on meaningful mutations rather than every keystroke. Reset confirms first, then restores fixtures, filters, simulated connections, and fixed baseline. Clear only this application's storage key. Reset must restore the original presentation walkthrough every time.

## Exports
CSV exports use actual filtered arrays, correct quoting, and safe treatment of text cells that could be interpreted as spreadsheet formulas. Include dataset type and observation dates. Reports identify all metrics as simulated and never imply that demo outcomes resulted from real changes to Google or AI systems.
