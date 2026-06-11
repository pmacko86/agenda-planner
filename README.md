# Agenda Planner

A browser-based conference schedule editor. No server, no build step — open `index.html` directly in any modern browser.

## Getting started

```
open index.html
```

Data is saved automatically to `localStorage` and survives page reloads.

## Features

### Calendar view
- Days displayed as columns with a shared time axis on the left
- Configurable day start/end hours (default 08:00–20:00)
- A red "now" line marks the current time
- Vertical zoom (50%–300%) via the header controls

### Creating events
- **Drag** on any empty time slot to set start and end time, then fill in details
- **Click** an empty slot to create a 1-hour event at that time
- Events snap to a configurable grid (5 / 10 / 15 / 30 / 60 min)

### Editing events
- **Click** an event block or use the pencil icon that appears on hover
- Change title, type, time, speaker, room, and notes
- **Drag** an event block to move it to a new time or a different day
- **Drag the bottom edge** of a block to resize it

### Event types and colours
| Type | Colour |
|---|---|
| Keynote | Indigo |
| Technical Session | Green |
| Workshop | Purple |
| Panel | Sky blue |
| Break / Coffee | Amber |
| Meal | Orange |
| Social / Reception | Pink |
| Other | Grey |

### Technical sessions
- Each technical session block shows how many papers fit given the configured paper presentation length (default: 20 min)
- If the session duration doesn't divide evenly, the remainder is shown (e.g. "4 papers + 10 min")
- The paper count updates live while resizing
- A running **total papers** badge is shown in the legend bar

### Conference setup
- Click the conference name in the header to rename it
- Click a day header to rename that day
- Add or remove days freely

### Dark mode
- Toggle with the sun/moon button in the header
- Respects the OS `prefers-color-scheme` setting when no explicit choice has been made
- Preference is persisted across reloads

### Data management (Settings → Data)
| Action | Effect |
|---|---|
| Export JSON | Downloads the full schedule as a `.json` file |
| Import JSON | Replaces the current schedule from a previously exported file |
| Load Sample Data | Replaces current data with the built-in demo schedule |
| Clear All Data | Deletes all events and resets to three empty days |

## Settings

| Setting | Default | Description |
|---|---|---|
| Paper presentation length | 20 min | Used to calculate papers-per-session |
| Snap granularity | 15 min | Grid interval for drag, resize, and create |
| Day starts at | 08:00 | First hour shown in the calendar |
| Day ends at | 20:00 | Last hour shown in the calendar |

## Project structure

```
index.html   — markup and modals
style.css    — all styles, including dark-mode variable overrides
app.js       — all application logic (state, rendering, drag, modals)
```
