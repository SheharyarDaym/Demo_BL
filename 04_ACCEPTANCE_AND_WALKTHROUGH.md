# Acceptance checks and client presentation

## Functional acceptance
The implementing Codex should verify these outcomes, fixing failures before delivery. Use focused automated checks for state transitions and a browser walkthrough for appearance and interactions; do not create an excessive test suite that merely repeats component code.

| Check | Expected result |
| --- | --- |
| First open | Branded Overview loads with explicit demo indicator and consistent counts |
| Navigate all tabs | Each destination contains meaningful content and active state is visible |
| Analyze Boston | Progress completes, scoped findings appear, and Activity records the run |
| Repeat analysis | Same issue is updated/opened; duplicate cards are not created |
| Cancel analysis | Progress stops cleanly with no late surprise findings |
| Filter competitors | City, course, query, and channel affect the observations |
| Open evidence | Local sample page/excerpt opens with source context |
| Open AI response | Platform, prompt, response, mentions, and citations are explicit |
| Edit business fields | Save persists; Cancel discards; invalid values show field errors |
| Resolve price conflict | Selected source becomes canonical and affected drafts are revalidated |
| Edit approved draft | Approval is revoked; publishing is disabled until reapproved |
| Publish draft | Blocked with an understandable explanation |
| Approve and publish | Preview changes, history is preserved, counters and Activity update |
| Double-click publish | Exactly one content revision and one successful event are created |
| Fail next publication | Error is visible, preview unchanged, Retry succeeds once |
| Disconnect destination | Relevant publishing is blocked and Settings is reachable |
| Restore website version | Prior preview is restored after confirmation, history retained |
| Edit course with review required | Pending change appears; destination is not silently updated |
| Enable factual synchronization | Allowed field changes update dependent previews and log activity |
| Pause synchronization | Changes queue until resumed |
| Cancel/sell out a class | Affected preview stops presenting it as available |
| Results filters | Charts, metrics, and tables derive from the same filtered dataset |
| Publish then view Results | No automatic fabricated ranking gain appears |
| Later sample snapshot | Clearly labeled later simulated observation appears |
| Export | CSV/report files download and match current filters |
| Reload | Saved demo changes survive; interrupted operations recover |
| Reset | Confirmation precedes restoration of the initial fixture state |
| Empty filter result | Friendly empty state and Clear filters action appear |

## Visual and accessibility acceptance
- Compare desktop presentation with the supplied screenshot: navy header, red separator, original logo treatment, pale blue background, rounded blue banner, and pastel cards.
- Confirm the product is visibility optimization, with no leftover project-management wording.
- Inspect at approximately 1440 × 900 and 390 × 844.
- Check no overlapping text, clipped buttons, page-wide horizontal overflow, or unreadable charts.
- Confirm complete keyboard access to navigation, forms, drawers, and confirmations.
- Check labels, focus management, visible error messages, status announcements, and reduced-motion behavior.
- Use readable text sizes and sufficient contrast; pastel status color alone is insufficient.
- Ensure all sample-data labels remain visible in screenshots/reports used for the client.
- No console errors or broken assets during the core walkthrough.

## Five-minute client walkthrough
1. **Overview:** “This dashboard continuously finds visibility opportunities and presents improvements for review.” Point out sample-data labeling and four summary cards.
2. **Business Profile:** Open a course and show that price, dates, location, and available seats come from a central source. Show listing-related sections and the ability to fill missing information.
3. **Competitors:** Select Boston and the current-month query. Open a competitor comparison showing that the sample competitor displays upcoming dates.
4. **Analysis:** Run a Boston analysis and open the finding for missing course dates. Explain that the system identifies an opportunity, not a guaranteed reason for ranking.
5. **Recommendation:** Show the evidence and before/after text. Edit the wording, save, and approve.
6. **Publishing:** Click Publish demo, confirm the destination, and open the local updated page preview. Point out the visible course date and seats.
7. **Freshness:** Change the course's available seats. Show the new pending update or explicitly enable factual synchronization and demonstrate its logged effect.
8. **Results:** Show separate Google, Maps, and AI sample measurements, plus enquiries and registrations. Explain that actual results would be measured after real deployment, not guaranteed.
9. **Activity:** Show who approved, what changed, and the publication history. Reset after the presentation if desired.

## Presenter-ready finish
Seed useful information on every main screen. The first action should work without configuration. Keep advanced options in Settings or drawers. Use concise copy and visible before/after results so the client understands the product without technical explanation.

## Scope exclusions
Do not implement real Odoo integration, Google or Bing API integration, scraping, live rank tracking, real AI calls, payments, team permissions, production authentication, backend cron jobs, or automatic public deployment. These are future production concerns, not missing demo features.

The demo includes the complete simulated user journey defined in this handoff. It does not imply that every external platform supports identical publishing or measurement capabilities. Do not add Bing as an extra integration unless the user expands the current Google + AI demo scope.
