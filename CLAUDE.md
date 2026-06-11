# CLAUDE.md — Agenda Planner

Vanilla JS/HTML/CSS single-page app. No framework, no build toolchain, no dependencies beyond a Google Fonts CDN link. Open `index.html` directly in a browser.

## Architecture

Three files, clear separation:

- **`index.html`** — static markup only. All dynamic content (calendar columns, event blocks) is built by `app.js`. Contains two `<dialog>`-style modals (event editor, settings) and the legend bar.
- **`style.css`** — all visual styles. Uses CSS custom properties for every colour so dark mode only needs variable overrides at the bottom of the file.
- **`app.js`** — entire application. No modules, one script tag. Globals are intentional; the file is short enough that module splitting would add ceremony with no benefit.

## State model

```js
state = {
  conferenceName: string,
  settings: {
    paperDuration: number,   // minutes per paper presentation
    startHour: number,       // 0–23
    endHour: number,         // 1–24
    snapMinutes: number,     // 5 | 10 | 15 | 30 | 60
  },
  days:   [{ id, label }],
  events: [{ id, dayId, title, type, startTime, endTime, speaker, room, description }],
}
```

Two separate `localStorage` keys keep non-agenda UI state out of exports:
- `agendaPlanner_v2` — the full state object above
- `agendaPlanner_zoom` — zoom level (0.5–3.0)
- `agendaPlanner_theme` — `"light"` | `"dark"` | absent (follow OS)

## Rendering

`render()` → `renderTimeAxis()` + `renderDays()`. `renderDays()` tears down and rebuilds all `.day-column` elements on every call; this is intentional simplicity — the calendar is not large enough to need incremental updates.

`HOUR_H` (px per hour) is the single source of truth for all vertical calculations. It is kept in sync with the CSS `--hour-h` custom property via `applyZoom()`.

## Drag system

Two independent drag states:

| Variable | Purpose |
|---|---|
| `drag` | Moving or resizing an **existing** event block |
| `createDrag` | Dragging on empty grid space to **define** a new event's time range |

Both attach `mousemove`/`mouseup` to `document` on start and remove them on end. They never run concurrently — each handler bails early if the other is active.

**Critical:** `onDragEnd` only calls `renderDays()` when `hasMoved === true`. When `hasMoved` is false (the user just clicked), the DOM is left intact so the `click` event that fires after `mouseup` can reach the event block's listener and open the edit modal. Rebuilding the DOM before the click event fires would detach the listener and silently swallow the click.

Move drag stores `previewStartMin` and `previewDayId`; resize drag stores `previewEndMin`. These are set during `mousemove` and consumed by `onDragEnd` to update state — the DOM position is never read back for state updates.

## Event types

Valid `type` values: `keynote` | `technical` | `workshop` | `panel` | `break` | `meal` | `social` | `other`. Each maps to a `type-<name>` CSS class and a `--c-<name>-*` set of custom properties. "Lunch" was renamed to "Meal" — there is no backward-compatibility alias.

## Dark mode

Theme is stored in `document.documentElement.dataset.theme` (`"light"` or `"dark"`). An inline `<script>` in `<head>` sets this before CSS parses to prevent flash-of-unstyled-content on reload.

CSS structure: light-mode variables in `:root`, overrides in `[data-theme="dark"]` and in `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])`. The two blocks are intentionally duplicated — CSS has no native mixin mechanism.

## Paper count

`paperCount(event)` returns `Math.floor(duration / paperDuration)`. The remainder (`duration % paperDuration`) is computed at call sites and passed to `buildPapersHTML(n, remainder)` for display. The total across all technical sessions is computed by `updatePapersTotal()`, called at the end of every `renderDays()`.

## Keeping README.md current

After any change to `app.js`, `index.html`, or `style.css`, check whether `README.md` needs updating. Update it if the change affects anything a user would read about: features, event types, settings, keyboard/mouse interactions, or the project structure table.

## Adding a new event type

1. Add the `value` to the `<select>` in `index.html`
2. Add a `legend-item legend-<name>` span to the legend bar in `index.html`
3. Add `--c-<name>-bg`, `--c-<name>-border`, `--c-<name>-text` to `:root` in `style.css`
4. Add matching overrides in the two dark-mode blocks at the bottom of `style.css`
5. Add `.legend-<name>` and `.event-block.type-<name>` rules to `style.css` (copy any existing type block)
