# Visual direction — match the supplied reference

## Reference observations
The supplied image is a 2048 × 792 crop of a Lifeguard-Pro project-management dashboard. Its visible design has:
- A full-width dark navy top header, about 135 px tall at that image size, with a thin bright red line beneath it.
- A circular red Lifeguard-Pro emblem on the left, followed by a large white `Lifeguard-Pro.org` wordmark and a smaller spaced uppercase subtitle.
- Outlined utility buttons on the right.
- A pale blue-gray page background with a subtle blue tint toward the right.
- A broad rounded blue-gradient hero banner with a narrow red left edge and faint diagonal decoration.
- Strong white hero typography and a bright red call-to-action.
- A row of rounded status cards: navy, light blue, gray, lavender, cream, mint, and pink, each with a colored left edge, small line icon, large number, and supporting copy.
- Spacious layout, clean sans-serif typography, thin borders, and restrained shadows.

These are visual observations, not measured brand guidelines. The hex values below are close implementation targets, not claims of official brand colors.

## Color tokens
```css
:root {
  --navy: #052f63;
  --navy-deep: #032951;
  --banner-blue: #0a4c8a;
  --red: #f00808;
  --red-hover: #cf0606;
  --page-bg: #eaf0f7;
  --surface: #ffffff;
  --text: #143153;
  --muted: #516d8b;
  --border: #cddbeb;
  --blue-soft: #dce9fa;
  --gray-soft: #e6e8ed;
  --purple-soft: #eee3ff;
  --amber-soft: #fff2ca;
  --green-soft: #d9eee5;
  --pink-soft: #ffe0e6;
  --success: #1b624a;
  --warning: #805716;
  --danger: #a82d43;
}
```

Use red for primary actions and a small number of brand accents. Use dark navy for main typography and secondary buttons. Do not use bright red as the default body-text color. Validate text contrast, especially on tinted cards.

## Logo handling
Reuse an official logo asset supplied with the project or already present in its repository. The screenshot shows a red circular badge with a central cross and `PRO` detail; it is not an invitation to generate a different medical emblem.

The source logo file is NOT included in this Markdown handoff. When only the screenshot is available, use it to identify placement and proportions and, if appropriate, extract its existing logo as a temporary raster asset; do not redraw or invent small lettering. Keep its aspect ratio, avoid stretching, and inspect it against the navy background. If the screenshot crop is too low resolution, use a clean text `Lifeguard-Pro.org` wordmark temporarily and identify the missing original asset in the implementation README. Do not falsely claim an exact logo match.

The original screenshot should also be given to the implementing Codex as a reference attachment. Its local path in the authoring session is not portable to the next developer's machine.

## Header and page structure
At desktop width use a 90–110 px branded header, scaling the reference down appropriately. Left: logo about 64–72 px high, white brand wordmark, subtitle `VISIBILITY OPTIMIZATION`. Right: demo badge, Settings, and Reset demo. Header controls need actual handlers.

Use a 3 px red bottom border. Below the header place the navigation tabs, with a clear active navy indicator and subtle red accent. Avoid adding a bulky permanent sidebar: the reference's broad horizontal layout is preferable.

Main content uses 28–40 px desktop padding, maximum width around 1600 px, centered. Hero uses a navy-to-blue gradient, 16–20 px radius, 6 px red left accent, and low-contrast diagonal decoration. Hero heading around 34–42 px on large screens; supporting text around 16 px. Primary button: red, white label, 10 px radius, 44–48 px minimum height.

## Overview composition
1. Header and navigation.
2. Hero with Run analysis.
3. Four metric cards in one row on wide screens.
4. A compact workflow explanation.
5. Two-column content: recommendations wider on the left; sample trend and activity on the right.

Metric colors: Tracked searches in navy; Opportunities in lavender; Awaiting approval in cream; Published updates in mint. Use a colored left strip and a small icon. The first navy card can use the reference's red accent line. Do not use decorative progress bars unless they correspond to a real displayed denominator.

Cards are links/buttons only when they navigate, with visible hover and focus feedback. Do not add drag handles unless reordering and keyboard alternatives are implemented; reordering is not required for this demo.

## Other screens
- Business Profile: white panels with section title, short summary, completion/source badge, and Edit. Hide long field forms until expanded.
- Competitors: clean readable table with a bold Lifeguard-Pro row and a side-by-side comparison drawer.
- Recommendations: default to simple stacked cards, not a complex Kanban board. Detail view has clear before/after panels and prominent review actions.
- Results: prioritize a few legible charts and concrete metrics over tiny graphs and dense gauges.
- Activity: chronological list or compact table with readable timestamps and status badges.

## Typography and microcopy
Use Inter if already bundled, or a system sans-serif stack. Body size 15–16 px, labels 13–14 px, readable line-height. Small uppercase section labels can use modest tracking like the reference.

Prefer labels the client understands: `Review improvement`, `What competitors show`, `Current content`, `Proposed content`, `View demo result`. Avoid product-facing jargon such as orchestration, embeddings, crawlers, tokens, webhook payloads, or inference pipelines.

Use short descriptions to explain the product; do not embed the entire specification in the UI.

## Responsive and accessible behavior
- At 1280–1440 px retain four metric columns and a comfortable two-column body.
- At tablet widths use two metric columns and stack main content where necessary.
- At 375–430 px use one metric column, compact brand header, accessible navigation, full-screen drawers, and stacked comparisons.
- Tables can have contained horizontal scrolling with sticky identifying columns; the whole page must not overflow horizontally.
- Keep minimum 44 px touch targets, keyboard focus rings, labeled inputs, Escape-to-close dialogs, focus trapping, and focus restoration.
- Announce progress/status changes using an appropriate live region. Do not communicate status through color alone.
- Honor reduced-motion preferences. Short transitions around 150–220 ms are sufficient.

## Visual quality bar
No emoji substitutes for icons, no random gradients, no enormous blank spaces, no generic stock dashboard imagery, and no unrelated project-management labels. Match the screenshot's calm navy/red identity while making this product's purpose obvious.
