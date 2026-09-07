# Personal Kanban — Design System

Implementation contract. Every color, size, radius, duration, and state in `src/` must trace
to a token named here. No orphan hex. No magic px.

**Direction:** Linear-adapted — tight, sharp, dark-native. Elevation comes from *luminance
stepping*, not drop shadows. One chromatic accent, reserved for interaction. Dark is the
default surface; the light ramp is a first-class alternative, not an afterthought.

**Stack:** Vite 8 + React 18.3 + TS 5.9, Tailwind v4 (`@tailwindcss/vite`), shadcn primitives
on `@base-ui/react`, `lucide-react` icons, `sonner` toasts, `@dnd-kit` drag.

---

## 1. Color

All values are `oklch()` so the ramps are perceptually even — a lightness step of `0.04`
reads as the same step everywhere on the ramp. Do not add a color by picking a hex.

### 1.1 Neutral ramp (the whole chrome is built from this)

Cool-neutral, hue `265`, chroma held at or below `0.008`. Never mix a warm gray in.

| Token | Dark | Light | Job |
|---|---|---|---|
| `--surface-0` | `oklch(0.145 0.004 265)` | `oklch(0.975 0.002 265)` | App canvas |
| `--surface-1` | `oklch(0.185 0.005 265)` | `oklch(0.995 0.001 265)` | Panels, columns |
| `--surface-2` | `oklch(0.225 0.006 265)` | `oklch(0.965 0.003 265)` | Cards, dropdowns |
| `--surface-3` | `oklch(0.275 0.007 270)` | `oklch(0.935 0.004 265)` | Hover / raised |
| `--surface-4` | `oklch(0.325 0.008 270)` | `oklch(0.905 0.005 265)` | Pressed / selected |

**Dark elevation rule:** to raise an element, step *up* the surface ramp. Never add a
`box-shadow` to fake height on dark — that is the flagged generic-AI pattern.
**Light elevation rule:** `--surface-1` is *brighter* than the canvas (paper on a desk);
`--surface-2`/`3` step *down* into gray. The light direction is top-left everywhere.

### 1.2 Text ramp

Four stops. Never pure white on dark, never pure black on light.

| Token | Dark | Light | Job |
|---|---|---|---|
| `--text-1` | `oklch(0.97 0.002 265)` | `oklch(0.20 0.008 265)` | Headings, primary body |
| `--text-2` | `oklch(0.87 0.012 265)` | `oklch(0.36 0.010 265)` | Secondary body |
| `--text-3` | `oklch(0.65 0.012 265)` | `oklch(0.52 0.010 265)` | Labels, metadata, placeholders |
| `--text-4` | `oklch(0.51 0.010 265)` | `oklch(0.65 0.008 265)` | Disabled, decorative |

`--text-3` on `--surface-0` is the contrast floor: 4.6:1 dark / 4.7:1 light. Anything
dimmer than `--text-3` is non-essential decoration and must never carry meaning alone.

### 1.3 Accent — indigo/violet, the ONLY chromatic color in the chrome

| Token | Dark | Light | Job |
|---|---|---|---|
| `--accent` | `oklch(0.55 0.175 274)` | `oklch(0.52 0.180 274)` | Primary CTA fill, active state |
| `--accent-hover` | `oklch(0.64 0.165 276)` | `oklch(0.58 0.175 274)` | CTA hover |
| `--accent-fg` | `oklch(0.99 0.002 265)` | `oklch(0.99 0.002 265)` | Text on accent fill |
| `--accent-soft` | `oklch(0.55 0.175 274 / 0.14)` | `oklch(0.52 0.180 274 / 0.10)` | Tinted background, focus wash |
| `--accent-line` | `oklch(0.55 0.175 274 / 0.45)` | `oklch(0.52 0.180 274 / 0.40)` | Focus ring, active border |

**Accent is never decorative.** It marks exactly three things: the primary action, the
focused element, and the currently-active item. A gradient made of accent is forbidden —
that is the purple/blue "AI gradient" fingerprint.

### 1.4 Status

Status colors appear only in status affordances (toasts, validation, badges). Never in chrome.

| Token | Dark | Light |
|---|---|---|
| `--success` | `oklch(0.68 0.150 152)` | `oklch(0.56 0.145 152)` |
| `--danger` | `oklch(0.62 0.195 22)` | `oklch(0.55 0.205 25)` |
| `--danger-soft` | `oklch(0.62 0.195 22 / 0.14)` | `oklch(0.55 0.205 25 / 0.10)` |

### 1.5 Lines

Borders on dark are **translucent white**, never an opaque gray — an opaque border on a
dark surface reads as a seam.

| Token | Dark | Light |
|---|---|---|
| `--line-subtle` | `oklch(1 0 0 / 0.06)` | `oklch(0.20 0.008 265 / 0.07)` |
| `--line` | `oklch(1 0 0 / 0.10)` | `oklch(0.20 0.008 265 / 0.11)` |
| `--line-strong` | `oklch(1 0 0 / 0.16)` | `oklch(0.20 0.008 265 / 0.17)` |

### 1.6 shadcn bridge

The existing `@theme inline` block maps shadcn's variable names onto the ramp above so the
primitives keep working unchanged:

`--background`→`--surface-0`, `--card`/`--popover`→`--surface-2`, `--muted`/`--secondary`→
`--surface-3`, `--accent`(shadcn hover slot)→`--surface-3`, `--foreground`→`--text-1`,
`--muted-foreground`→`--text-3`, `--primary`→`--accent`, `--primary-foreground`→`--accent-fg`,
`--destructive`→`--danger`, `--border`/`--input`→`--line`, `--ring`→`--accent-line`.

---

## 2. Typography

**Sans:** `Geist Variable` (already installed via `@fontsource-variable/geist`). Deliberately
not Inter — "Inter everywhere" is the AI fingerprint, and Geist is the same grotesk genus
with a tighter, more mechanical skeleton.
**Mono:** `ui-monospace, "SF Mono", "Cascadia Mono", "Geist Mono", Menlo, monospace` — used
for IDs, counts, code blocks, and anything the eye scans as data.

### 2.1 Weights — three only

`400` read · `510` emphasize · `590` announce. **Never 700.** `510` is the signature weight:
it is the one that makes UI text look engineered rather than bolded.

### 2.2 Scale — size / line-height / tracking

Tracking goes *negative* as size grows and never positive. Below 16px tracking is `0`
except the two data sizes noted.

| Token | Size | Line | Tracking | Weight | Job |
|---|---|---|---|---|---|
| `--type-display` | 32px | 1.15 | `-0.022em` | 590 | Page title (login, empty-state hero) |
| `--type-title` | 24px | 1.2 | `-0.012em` | 590 | Section / route heading |
| `--type-heading` | 18px | 1.3 | `-0.009em` | 510 | Card title, dialog title |
| `--type-body` | 15px | 1.5 | `-0.011em` | 400 | Body, task titles |
| `--type-ui` | 14px | 1.4 | `-0.013em` | 510 | Buttons, inputs, column headers |
| `--type-label` | 13px | 1.4 | `-0.010em` | 510 | Field labels, metadata |
| `--type-micro` | 12px | 1.35 | `0` | 510 | Badges, counts, timestamps |

Prose (markdown task descriptions) is capped at `65ch`.
All headings use `text-wrap: balance`; body uses `text-wrap: pretty` — no orphans.
Every number that can change (counts, positions, dates) carries
`font-variant-numeric: tabular-nums` so it does not jitter on update.
Headings are **sentence case**. No all-caps subheaders, no Title Case.

---

## 3. Spacing, radius, layout

### 3.1 Spacing

4px base, 8px rhythm. Allowed steps: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`. Nothing else.
Vertical section padding is optically asymmetric: bottom gets one step more than top.

### 3.2 Radius — meaning, not decoration

Tighter inside, softer outside. A uniform radius everywhere is the flat look.

| Token | Value | Applies to |
|---|---|---|
| `--radius-xs` | 2px | Micro badges, count chips |
| `--radius-sm` | 4px | Inline tags, checkbox |
| `--radius-md` | 6px | Buttons, inputs, select |
| `--radius-lg` | 8px | Cards, dropdown menus |
| `--radius-xl` | 12px | Panels, list columns |
| `--radius-2xl` | 22px | Full-bleed feature panels |
| `--radius-full` | 9999px | Pills, avatars, icon buttons |

### 3.3 Layout

- App shell owns the scroll. `min-h-[100dvh]` on the shell — **never** `h-screen`, `h-svh`.
- Content max width `1200px`, centered, gutter `24px` desktop / `16px` mobile.
- Dialogs cap at `--container-dialog` (`24rem`) from `sm:` up, full width minus gutter below.
- The board is the one exception: its horizontal column rail scrolls edge to edge, and only
  the rail scrolls. The page itself never scrolls horizontally.
- Grids are CSS Grid, never flex percentage math.
- **No three equal columns.** The project list is an asymmetric grid: a wide lead card
  followed by a 2-column flow (`grid-cols-1 md:grid-cols-2 xl:grid-cols-3` with the first
  child spanning 2 at `xl`). Cards do not force equal heights.
- Structure is semantic: `<header>` / `<main>` / `<nav>` / `<section>` / `<article>`. No div soup.
- A skip-to-content link is the first focusable element on every route.

### 3.4 Breakpoints

`sm 640` · `md 768` · `lg 1024` · `xl 1280`. QA is run at **375 / 768 / 1280**.

---

## 4. Material and elevation

An eight-rung ladder. On dark, rungs 0–4 are pure luminance steps; only overlay surfaces
(dialog, popover, drag overlay) are allowed a shadow, because they genuinely float above
the plane.

| Rung | Token | Recipe |
|---|---|---|
| 0 | `--elev-flat` | none — inherits canvas |
| 1 | `--elev-line` | `--surface-1` + `1px solid --line-subtle` |
| 2 | `--elev-surface` | `--surface-2` + `1px solid --line` |
| 3 | `--elev-raised` | `--surface-3` + `1px solid --line` (hover target of rung 2) |
| 4 | `--elev-inset` | `inset 0 0 12px oklch(0 0 0 / 0.20)` — wells, drop zones |
| 5 | `--elev-ring` | `0 0 0 1px oklch(0 0 0 / 0.20)` — separates overlay from canvas |
| 6 | `--elev-overlay` | 5-layer stack: `0 8px 2px oklch(0 0 0/0), 0 5px 2px oklch(0 0 0/0.02), 0 3px 2px oklch(0 0 0/0.06), 0 1px 1px oklch(0 0 0/0.10), 0 0 1px oklch(0 0 0/0.12)` |
| 7 | `--elev-lifted` | `--elev-overlay` + `0 12px 32px oklch(0.145 0.004 265 / 0.55)` — drag overlay only |

Shadows are **tinted to the canvas hue** (`oklch(0.145 0.004 265)`), never neutral black.

**Surfaces are translucent, not solid.** Cards on dark are `--surface-2` at `92%` over the
canvas so the ramp underneath still reads. A flat opaque fill is the generic-card flag.

**Grain.** A fixed, `pointer-events-none`, 3% SVG-noise overlay sits above the canvas and
below content (`z-index: 0`). It is what stops large dark fields from banding. It is
`display: none` under `prefers-reduced-transparency`.

---

## 5. Primitives and their states

Every primitive below must render correctly at 375 / 768 / 1280 in **all** listed states
before any product screen is considered done.

### 5.1 Button (`src/components/ui/button.tsx`)

Radius `--radius-md`. Height `32px` default / `28px` sm / `24px` xs / `36px` lg.
Transition `--dur-fast --ease-out`.

| Variant | Rest | Hover | Active | Focus-visible | Disabled |
|---|---|---|---|---|---|
| `default` | `--accent` fill, `--accent-fg` | `--accent-hover` | `translateY(1px)` | `0 0 0 3px --accent-soft` + `--accent-line` border | `opacity .5`, no pointer |
| `outline` | transparent + `1px --line` | `--surface-3` | `translateY(1px)` | same | same |
| `secondary` | `--surface-3` | `--surface-4` | `translateY(1px)` | same | same |
| `ghost` | transparent | `--surface-2` | `translateY(1px)` | same | same |
| `destructive` | `--danger-soft` + `--danger` text | `--danger` fill + `--accent-fg` | `translateY(1px)` | `0 0 0 3px --danger-soft` | same |
| `link` | `--text-2`, underline on hover | `--text-1` | — | underline + ring | same |

The focus ring is **non-optional** on every variant. Icon buttons are `--radius-full`.

### 5.2 Card (`src/components/ui/card.tsx`)

Rung 2 at rest, rung 3 on hover *only when the card is interactive*. Radius `--radius-lg`
(task) / `--radius-xl` (project). A non-interactive card has no hover — a hover that changes
nothing is slop.

States: rest · hover · focus-within · dragging · selected.

### 5.3 Input / Textarea

`--surface-1`, `1px --line`, radius `--radius-md`, `--type-ui`, placeholder `--text-3`.
Focus: border `--accent-line` + `0 0 0 3px --accent-soft`. Invalid: border `--danger` +
`0 0 0 3px --danger-soft` and an error message in `--type-label`/`--danger`. Never rely on
color alone — the message text carries the meaning.

### 5.4 Dialog (`src/components/ui/dialog.tsx`)

Backdrop `--scrim` — `oklch(0.145 0.004 265 / 0.70)` on dark, the same hue at `0.5` on
light so the overlay dims rather than washes — plus `backdrop-blur(4px)`. Panel `--surface-2`,
radius `--radius-xl`, `--elev-overlay` + `--elev-ring`. Enter: `opacity 0→1` +
`scale(0.97)→1` over `--dur-base --ease-out`. Focus trapped, `Esc` closes, focus returns
to the trigger.

### 5.5 Skeleton (`src/components/ui/skeleton.tsx`) — NEW

Shape-matched blocks, not spinners. `--surface-3`, radius matching the element it stands in,
with a `1.4s` opacity pulse (`0.55 → 1 → 0.55`). Every loading view renders the *layout* of
its loaded state. `aria-busy="true"` on the container, `aria-hidden` on the blocks.

### 5.6 EmptyState (`src/components/ui/empty-state.tsx`) — NEW

Composed, not a shrug. Slots: lucide icon in a `--surface-3` `--radius-full` well ·
`--type-heading` line · `--type-body` `--text-3` explanation capped at `48ch` · one primary
action. Required on: no projects · no lists · no tasks in a column · no members ·
search/filter with no result.

### 5.7 ConfirmDialog — NEW

Replaces every `window.confirm`. Destructive actions name the target
("Delete list *Backlog*? Its 4 tasks are deleted too.") and the confirm button is
`destructive`. Cancel is focused by default.

### 5.8 ThemeToggle

Icon button, `--radius-full`, lucide `Sun`/`Moon`, `aria-label` reflecting the *action*
("Switch to light theme"). Writes `pk-theme` to `localStorage`. The `.dark` class is applied
in `index.html` before first paint — a theme flash is a bug, not a tradeoff.

### 5.9 Badge

`--type-micro`, `--radius-xs`, `--surface-3` + `--line` for neutral, `--accent-soft` +
`--accent-line` + accent text for "Owner". **Never a solid accent fill** — solid brand fill
is reserved for the primary CTA.

---

## 6. Motion

GPU-composited only: `transform`, `opacity`, `filter`. Never animate `top/left/width/height`.

| Token | Value | Use |
|---|---|---|
| `--dur-instant` | `80ms` | Color-only changes |
| `--dur-fast` | `140ms` | Hover, press |
| `--dur-base` | `220ms` | Enter/exit, dialogs |
| `--dur-slow` | `320ms` | Layout reflow, drag settle |
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | Everything entering |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | Reversible transitions |
| `--ease-spring` | `cubic-bezier(0.34, 1.4, 0.64, 1)` | The drag lift only |

**Signature interaction — the drag lift.** When a task leaves its column, the drag overlay
rotates `2deg`, scales to `1.03`, jumps to `--elev-lifted`, and its border lights to
`--accent-line`; the vacated slot collapses over `--dur-slow`. It is the one moment the
interface has physics, and it maps to a real state change.

**Staggered entry.** Lists and cards enter with `translateY(4px) → 0` + `opacity 0 → 1`,
`30ms` apart, capped at 8 items. Never mount a whole board at once.

Every motion above maps to an interaction or a state change. A hover that changes nothing,
or motion on a non-interactive element, is forbidden.

`prefers-reduced-motion: reduce` collapses every duration to `1ms` and removes the rotate
and scale from the drag lift. Opacity changes survive.

---

## 7. Accessibility constraints

- Contrast: body text ≥ 4.5:1, `--type-ui` and larger ≥ 4.5:1, non-text UI boundaries ≥ 3:1.
  `--text-4` is decorative only and never carries meaning.
- Keyboard: every interactive element reachable, visible focus ring on all of them, logical
  tab order, skip-to-content first. Drag-and-drop keeps its `@dnd-kit` keyboard sensor —
  drag is never the only way to move a task.
- Targets ≥ 32×32 desktop, ≥ 44×44 touch.
- Icon-only buttons carry `aria-label`; decorative icons carry `aria-hidden="true"`.
- Loading regions are `aria-busy`; toasts are `sonner`'s live region. No `window.alert`,
  no `window.confirm`.
- Color is never the sole signal: status pairs with an icon or a word.
- Respect `prefers-reduced-motion` and `prefers-reduced-transparency`.

---

## 8. Accepted debt

Named, bounded, revisited — not hidden.

1. **Icon set stays `lucide-react`.** A single ubiquitous icon set is a mild generic signal,
   but swapping libraries touches every component for zero user value. Mitigation: stroke
   width standardized at `1.5` and sizes locked to `14/16/18`.
2. **`shadcn/tailwind.css` stays imported.** It carries defaults we now override. Removing it
   risks silently unstyling `@base-ui` internals. Revisit when the primitive set is complete.
3. **Copy language is mixed EN/ID.** This pass normalizes user-facing strings to **English**
   for consistency; a real i18n layer is out of scope. Revisit if a second locale is needed.
4. **No test framework.** Verification is `tsc -b`, `oxlint`, `*.selfcheck.ts` files, and
   `/visual-qa`. Adding Vitest is a separate decision.
5. **No custom 404 route.** `react-router` falls through to the project list. Low traffic,
   authenticated app. Revisit if the app gets public URLs.
6. **Grain overlay is a static SVG data URI**, not a generated texture. Cheap and adequate;
   a per-surface generated grain is not worth the bytes.
