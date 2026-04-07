# Route Optimizer — Design Brainstorm

## Context
A professional logistics/field-operations tool for route planning. Users are drivers, dispatchers, or field reps who need to plan 5–30+ stops efficiently. The UI should feel like a capable operations dashboard — not a consumer app.

---

<response>
<text>

## Idea A: Industrial Dispatch Console
**Design Movement**: Industrial Modernism meets Logistics Software (think FedEx Ground ops panels)

**Core Principles**:
- High-information density without clutter
- Monochrome base with a single vivid accent (amber/orange) for action states
- Clear visual hierarchy: input → process → result
- Functional typography — no decorative flourishes

**Color Philosophy**: Near-black (#0f1117) background with slate-700 panels. Amber (#f59e0b) as the sole accent for CTAs, active states, and route highlights. White text for primary content, slate-400 for secondary. Communicates reliability and urgency.

**Layout Paradigm**: Two-column split — left panel (40%) for input/stop management, right panel (60%) for map and results. No centered hero. Persistent sidebar-style left column.

**Signature Elements**:
- Numbered stop badges (circle with sequence number) in amber
- Monospaced font for distances/durations (data feels precise)
- Thin amber line connecting stops in the results list (visual route trace)

**Interaction Philosophy**: Every action has immediate feedback. Removing a stop triggers a subtle list reflow animation. Optimise button pulses amber while processing.

**Animation**: List items slide in from left on load. Removed items collapse with height animation. Results panel slides up from bottom.

**Typography System**: `Space Grotesk` (headings, labels) + `JetBrains Mono` (data values, distances) + system sans for body text.

</text>
<probability>0.08</probability>
</response>

<response>
<text>

## Idea B: Clean Operational Dashboard (CHOSEN)
**Design Movement**: Swiss Grid Functionalism — precision, clarity, zero noise

**Core Principles**:
- White/light-gray background with strong typographic hierarchy
- Deep navy (#1e3a5f) as primary brand color; teal (#0d9488) as action accent
- Every element earns its place — no decorative chrome
- Data is the hero; UI is the frame

**Color Philosophy**: Off-white (#f8fafc) canvas. Navy for headers and primary actions. Teal for interactive states, success indicators, and route highlights. Slate-600 for secondary text. Communicates professionalism and trustworthiness — appropriate for a business tool.

**Layout Paradigm**: Full-height two-panel layout. Left sidebar (380px fixed) for stop management. Right area splits vertically: map on top (60%), results table below (40%). On mobile, stacks vertically with tab navigation.

**Signature Elements**:
- Color-coded stop pins: green (origin), red (destination), teal (waypoints)
- Drag handle on stop rows (future) — visible as subtle grip dots
- Progress stepper showing: Add Stops → Optimise → View Route

**Interaction Philosophy**: The flow is linear and guided. Users cannot proceed to optimise until origin and destination are set. Clear disabled states with tooltip explanations.

**Animation**: Framer Motion — stops animate in with a staggered fade+slide. Results appear with a smooth height expand. Map markers drop in sequentially.

**Typography System**: `DM Sans` (UI labels, body) + `DM Mono` (distances, coordinates, durations) — a matched pair from the same type family for visual coherence.

</text>
<probability>0.09</probability>
</response>

<response>
<text>

## Idea C: Field Operations Dark Mode
**Design Movement**: Dark UI Pragmatism — optimised for outdoor/vehicle use

**Core Principles**:
- Dark background reduces eye strain in bright outdoor conditions
- High contrast text and large tap targets for gloved/mobile use
- Green (#22c55e) accent for go/confirm actions; red for remove/stop
- Compact but readable — information density balanced with touch usability

**Color Philosophy**: Dark slate (#0f172a) base. Zinc-800 cards. Bright green for primary actions and confirmed stops. Red-400 for destructive actions. Communicates field-readiness and operational confidence.

**Layout Paradigm**: Single-column mobile-first layout with a sticky action bar at the bottom. On desktop, expands to a two-column view. The map is always visible as a floating card.

**Signature Elements**:
- Large numbered stop cards (easy to read at a glance)
- Swipe-to-remove gesture on mobile (visual hint with red background reveal)
- Battery/signal-style status indicators for API connectivity

**Interaction Philosophy**: Designed for one-handed use. Large buttons, swipe gestures, minimal typing required. CSV upload is the primary input method.

**Animation**: Minimal — respects reduced-motion preferences. Only essential transitions (card removal, result reveal).

**Typography System**: `IBM Plex Sans` (all UI) + `IBM Plex Mono` (data) — industrial, legible at small sizes, excellent on screens.

</text>
<probability>0.07</probability>
</response>

---

## Selected Design: **Idea B — Clean Operational Dashboard**

Rationale: Best balance of professionalism, usability across devices, and visual clarity for a business tool used by dispatchers and field reps. The navy/teal palette is distinctive without being aggressive. The two-panel layout maximises information density on desktop while remaining usable on mobile.
