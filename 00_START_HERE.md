# Lifeguard-Pro Visibility Dashboard — Codex build instructions

## Task
Build a polished, fully interactive FRONTEND-ONLY demo for a client presentation. The product is an Automated Google + AI Visibility Optimization System for Lifeguard-Pro. Deliver the working demo application, not merely a plan or a collection of static screens.

Read these files in order:
1. `00_START_HERE.md`
2. `01_PRODUCT_AND_INTERACTIONS.md`
3. `02_VISUAL_DESIGN.md`
4. `03_DEMO_DATA_AND_STATE.md`
5. `04_ACCEPTANCE_AND_WALKTHROUGH.md`

Also inspect the supplied reference screenshot, originally named `Screenshot 2026-10-17 at 12.27.11 am.png` (the original filename may contain a narrow Unicode space). The screenshot is a separate attachment, not embedded in these Markdown files. Ask for it only if exact visual comparison is needed and it is unavailable; continue using the detailed design specification in the meantime. Never claim to have inspected a missing attachment.

## What the client should understand
The system gathers business facts, checks competitor visibility, identifies missing or outdated information, drafts improvements, asks a human to approve, simulates publishing, and tracks simulated results. It keeps course facts fresh and helps improve visibility across Google Search, Google Maps, and AI search experiences.

The core experience must be immediately understandable. Keep technical machinery behind the interface. Do not build an overwhelming enterprise dashboard.

## Non-negotiable scope
- Frontend only: no backend, database server, live scraping, external AI requests, real authentication, API keys, real OAuth, or live publishing.
- All records, competitor observations, scores, charts, platform connections, and publishing results are simulated.
- Display a persistent, tasteful `Demo mode • Sample data` indicator. Publish buttons say `Publish demo`. Make it clear that nothing is sent to Google or any other external service.
- Every displayed interactive control must do something meaningful. No dead buttons, empty routes, endless spinners, or “coming soon” destinations.
- Use one shared browser state so edits, approvals, publishing history, counters, previews, and reports remain consistent.
- Persist demo state locally and provide a confirmed Reset demo action.
- Match the reference's navy/red branding, light background, rounded banner, and pastel status cards. Do not replace it with a dark futuristic design.
- Do not copy unrelated project-management features from the screenshot.
- Do not claim that sample prices, ratings, accreditations, addresses, availability, competitors, or metrics are verified Lifeguard-Pro facts.
- No real secrets or client/customer records are needed.

## Implementation direction
If an existing frontend repository is provided, inspect its instructions and reuse its stack. Otherwise use React + TypeScript + Vite, CSS variables, and lightweight accessible components. React Router is optional; route navigation should support browser back and forward. Use existing dependencies when available. Charts can be implemented with a small chart library or native SVG; avoid remote chart services.

Use reusable UI components and typed domain objects. Keep fixtures separate from state transitions and presentation components. All service-like operations should go through a small mock service layer that supports deterministic success, failure, and retry scenarios.

Use localStorage with a versioned key such as `lgp-visibility-demo:v1`. Validate restored state and recover safely to fixtures if stored JSON is invalid. Do not silently erase valid demo changes during ordinary refreshes.

## Deliverables from the implementing Codex
1. Runnable frontend source and package scripts.
2. Bundled demo assets and fixtures, with no dependency on remotely hosted sample images.
3. README with install/run/build instructions and the client walkthrough.
4. A short statement of what was verified and any remaining limitations.

Run the production build and exercise the core workflow before delivery. Do not deploy publicly unless separately requested. Default to reasonable design decisions instead of repeatedly asking for clarification.

## Definition of done
A presenter can open the dashboard, run an analysis, inspect evidence, edit and approve a recommendation, simulate publishing, see the changed page preview and history, view sample performance, edit a course to demonstrate freshness, reload without losing changes, and reset to the initial demo.
