'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────
const BASE_HOUR_H  = 64;  // px per hour at 100% zoom
const DRAG_PX_SQ   = 16;  // 4² — pixel threshold before move-drag activates
const ZOOM_STEPS   = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];
// Each browser tab gets its own document ID so tabs hold independent documents.
// sessionStorage is tab-local (survives refresh, not shared across tabs).
const DOC_ID = (() => {
  let id = sessionStorage.getItem('agendaPlanner_docId');
  if (!id) {
    id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    sessionStorage.setItem('agendaPlanner_docId', id);
  }
  return id;
})();

const STATE_KEY      = `agendaPlanner_v2_${DOC_ID}`;
const ZOOM_KEY       = `agendaPlanner_zoom_${DOC_ID}`;
const THEME_KEY      = 'agendaPlanner_theme';
const NOWLINE_KEY    = 'agendaPlanner_nowLine';
const QUICK_EDIT_KEY = 'agendaPlanner_quickEdit';
const CASCADE_KEY    = 'agendaPlanner_cascadeResize';

const ICON_MOON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
const ICON_SUN  = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';

let zoomLevel   = 1.0;
let HOUR_H      = BASE_HOUR_H; // updated by applyZoom()
let showNowLine    = false;
let quickEdit      = false;
let cascadeResize  = false;

// ─── Default state ─────────────────────────────────────────────────────────────
function createDefaultState() {
  const days = [
    { id: uid(), label: 'Day 1' },
    { id: uid(), label: 'Day 2' },
    { id: uid(), label: 'Day 3' },
  ];
  return {
    conferenceName: 'My Conference',
    settings: {
      paperDuration: 20,
      startHour: 8,
      endHour: 20,
      snapMinutes: 15,
    },
    days,
    events: [
      { id: uid(), dayId: days[0].id, title: 'Opening Keynote',
        type: 'keynote',   startTime: '09:00', endTime: '10:00',
        speaker: 'Prof. Ada Lovelace', room: 'Main Hall', description: '' },
      { id: uid(), dayId: days[0].id, title: 'Technical Session A: ML Systems',
        type: 'technical', startTime: '10:30', endTime: '12:30',
        speaker: '', room: 'Hall A', description: '' },
      { id: uid(), dayId: days[0].id, title: 'Meal Break',
        type: 'meal',      startTime: '12:30', endTime: '14:00',
        speaker: '', room: '', description: '' },
      { id: uid(), dayId: days[0].id, title: 'Workshop: Hands-on Transformers',
        type: 'workshop',  startTime: '14:00', endTime: '16:00',
        speaker: 'Dr. Turing', room: 'Workshop Room 1', description: '' },
      { id: uid(), dayId: days[1].id, title: 'Invited Talk: Databases at Scale',
        type: 'keynote',   startTime: '09:30', endTime: '10:30',
        speaker: 'Dr. E.F. Codd', room: 'Main Hall', description: '' },
      { id: uid(), dayId: days[1].id, title: 'Technical Session B: Systems',
        type: 'technical', startTime: '11:00', endTime: '13:00',
        speaker: '', room: 'Hall B', description: '' },
      { id: uid(), dayId: days[1].id, title: 'Panel: Open Source AI',
        type: 'panel',     startTime: '14:30', endTime: '15:30',
        speaker: 'J. McCarthy', room: 'Main Hall', description: '' },
    ],
  };
}

// ─── State ────────────────────────────────────────────────────────────────────
let state;

function loadState() {
  try {
    let raw = localStorage.getItem(STATE_KEY);
    if (!raw) {
      // One-time migration: first tab inherits data from the pre-multi-tab key.
      const legacy = localStorage.getItem('agendaPlanner_v2');
      if (legacy) { raw = legacy; localStorage.removeItem('agendaPlanner_v2'); }
    }
    state = raw ? JSON.parse(raw) : createDefaultState();
    state.settings.snapMinutes = state.settings.snapMinutes || 15;
  } catch {
    state = createDefaultState();
  }
}

function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

// ─── Now-line setting ─────────────────────────────────────────────────────────
function loadNowLineSetting() {
  showNowLine = localStorage.getItem(NOWLINE_KEY) === 'true';
}

function loadQuickEdit() {
  quickEdit = localStorage.getItem(QUICK_EDIT_KEY) === 'true';
}

function loadCascadeResize() {
  cascadeResize = localStorage.getItem(CASCADE_KEY) === 'true';
}

// ─── Theme ────────────────────────────────────────────────────────────────────
function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) document.documentElement.dataset.theme = saved;
  updateThemeBtn();
  // Keep button in sync if user changes OS preference while the page is open
  window.matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', updateThemeBtn);
}

function isDark() {
  const explicit = document.documentElement.dataset.theme;
  if (explicit) return explicit === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function toggleTheme() {
  document.documentElement.dataset.theme = isDark() ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, document.documentElement.dataset.theme);
  updateThemeBtn();
}

function updateThemeBtn() {
  const btn = document.getElementById('themeToggleBtn');
  if (!btn) return;
  const dark = isDark();
  btn.title     = dark ? 'Switch to light mode' : 'Switch to dark mode';
  btn.innerHTML = dark ? ICON_SUN : ICON_MOON;
}

// ─── Zoom ─────────────────────────────────────────────────────────────────────
function loadZoom() {
  let raw = localStorage.getItem(ZOOM_KEY);
  if (!raw) {
    const legacy = localStorage.getItem('agendaPlanner_zoom');
    if (legacy) { raw = legacy; localStorage.removeItem('agendaPlanner_zoom'); }
  }
  const saved = parseFloat(raw);
  zoomLevel = isNaN(saved) ? 1.0 : Math.max(0.5, Math.min(3.0, saved));
  applyZoom(false);
}

function applyZoom(save = true) {
  HOUR_H = Math.round(BASE_HOUR_H * zoomLevel);
  document.documentElement.style.setProperty('--hour-h', `${HOUR_H}px`);
  // Sync the select — find the closest option value
  const sel = document.getElementById('zoomLevelLabel');
  if (sel) sel.value = String(zoomLevel);
  if (save) localStorage.setItem(ZOOM_KEY, String(zoomLevel));
}

function zoomIn() {
  const next = ZOOM_STEPS.find(s => s > zoomLevel + 0.01);
  if (next !== undefined) { zoomLevel = next; applyZoom(); renderDays(); }
}

function zoomOut() {
  const prev = [...ZOOM_STEPS].reverse().find(s => s < zoomLevel - 0.01);
  if (prev !== undefined) { zoomLevel = prev; applyZoom(); renderDays(); }
}

// ─── History (undo / redo) ────────────────────────────────────────────────────
const MAX_HISTORY = 50;
let undoStack = [];
let redoStack = [];

function pushHistory() {
  undoStack.push(JSON.parse(JSON.stringify(state)));
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = [];
  updateUndoRedoBtns();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(JSON.parse(JSON.stringify(state)));
  state = undoStack.pop();
  selectedEventIds.clear();
  saveState();
  render();
  updateUndoRedoBtns();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.parse(JSON.stringify(state)));
  state = redoStack.pop();
  selectedEventIds.clear();
  saveState();
  render();
  updateUndoRedoBtns();
}

function updateUndoRedoBtns() {
  const u = document.getElementById('undoBtn');
  const r = document.getElementById('redoBtn');
  if (u) u.disabled = undoStack.length === 0;
  if (r) r.disabled = redoStack.length === 0;
}

// ─── Utilities ─────────────────────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function toMin(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function fromMin(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function fmtTime(time) {
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function snapMin(min) {
  const s = state.settings.snapMinutes;
  return Math.round(min / s) * s;
}

function paperCount(event) {
  if (event.type !== 'technical') return 0;
  const dur = toMin(event.endTime) - toMin(event.startTime);
  return Math.max(0, Math.floor(dur / state.settings.paperDuration));
}

function buildPapersHTML(n, remainder = 0) {
  const icon = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"` +
    ` stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>` +
    `<polyline points="14 2 14 8 20 8"/></svg>`;
  const rem = remainder > 0
    ? ` <span class="ev-papers-rem">+ ${remainder} min</span>`
    : '';
  return icon + `${n} paper${n !== 1 ? 's' : ''}` + rem;
}

function mk(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

function findNearestEventEdge(rawMin, dayId, thresholdPx, excludeId = null) {
  const range = thresholdPx / HOUR_H * 60;
  for (const ev of state.events) {
    if (ev.dayId !== dayId) continue;
    if (ev.id === excludeId) continue;
    const s = toMin(ev.startTime), end = toMin(ev.endTime);
    if (Math.abs(rawMin - s)   <= range) return s;
    if (Math.abs(rawMin - end) <= range) return end;
  }
  return null;
}

// ─── Drag state ───────────────────────────────────────────────────────────────
// drag      — move or resize an existing event
// createDrag — drag on empty grid space to define a new event's time range
let drag       = null;
let createDrag = null;
let selectDrag = null;

// ─── Multi-event selection ────────────────────────────────────────────────────
let selectedEventIds = new Set();

// ─── Legend filter ────────────────────────────────────────────────────────────
let activeTypeFilter = null;

function setTypeFilter(type) {
  activeTypeFilter = (activeTypeFilter === type) ? null : type;
  const bar = document.querySelector('.legend-bar');
  bar.classList.toggle('has-filter', activeTypeFilter !== null);
  document.querySelectorAll('.legend-item').forEach(el => {
    const t = [...el.classList]
      .find(c => c.startsWith('legend-') && c !== 'legend-item')
      ?.slice('legend-'.length);
    el.classList.toggle('is-active', !!t && t === activeTypeFilter);
  });
  document.getElementById('papersTotal')
    .classList.toggle('is-active', activeTypeFilter === 'technical');
  renderDays();
}

// ─── Rendering ────────────────────────────────────────────────────────────────
function render() {
  document.getElementById('conferenceTitle').textContent = state.conferenceName;
  renderTimeAxis();
  renderDays();
}

function renderTimeAxis() {
  const axis = document.getElementById('timeAxis');
  axis.innerHTML = '';
  axis.appendChild(mk('div', 'time-axis-header'));
  const { startHour, endHour } = state.settings;
  for (let h = startHour; h < endHour; h++) {
    const label = mk('div', 'time-label');
    label.textContent = `${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`;
    axis.appendChild(label);
  }
}

function renderDays() {
  const cal = document.getElementById('calendar');
  cal.querySelectorAll('.day-column').forEach(c => c.remove());
  state.days.forEach(day => cal.appendChild(buildDayColumn(day)));
  updatePapersTotal();
}

function updatePapersTotal() {
  const sessions = state.events.filter(ev => ev.type === 'technical');
  const total    = sessions.reduce((sum, ev) => sum + paperCount(ev), 0);
  document.getElementById('papersTotalCount').textContent = total;
  document.getElementById('papersTotal').title =
    `${total} paper${total !== 1 ? 's' : ''} across ` +
    `${sessions.length} technical session${sessions.length !== 1 ? 's' : ''}`;
}

// ─── Day column ───────────────────────────────────────────────────────────────
// Returns Map<eventId, {col, numCols}> for tiling overlapping events side by side.
function computeOverlapLayout(events) {
  const sorted = [...events].sort((a, b) =>
    toMin(a.startTime) - toMin(b.startTime) || toMin(a.endTime) - toMin(b.endTime)
  );

  const colEnds = []; // end-time of last event placed in each column
  const colOf   = new Map();
  for (const ev of sorted) {
    const start = toMin(ev.startTime);
    const end   = toMin(ev.endTime);
    let col = colEnds.findIndex(e => e <= start);
    if (col === -1) { col = colEnds.length; colEnds.push(end); }
    else colEnds[col] = end;
    colOf.set(ev.id, col);
  }

  const result = new Map();
  for (const ev of events) {
    const start = toMin(ev.startTime);
    const end   = toMin(ev.endTime);
    let maxCol  = colOf.get(ev.id);
    for (const other of sorted) {
      if (toMin(other.startTime) < end && toMin(other.endTime) > start)
        maxCol = Math.max(maxCol, colOf.get(other.id));
    }
    result.set(ev.id, { col: colOf.get(ev.id), numCols: maxCol + 1 });
  }
  return result;
}

function buildDayColumn(day) {
  const col = mk('div', 'day-column');
  col.dataset.dayId = day.id;

  // Header
  const hdr   = mk('div', 'day-header');
  const title = mk('span', 'day-header-title');
  title.textContent     = day.label;
  title.contentEditable = 'true';
  title.spellcheck      = false;
  title.addEventListener('blur', () => {
    const newLabel = title.textContent.trim() || day.label;
    if (newLabel !== day.label) pushHistory();
    day.label = newLabel;
    title.textContent = day.label;
    saveState();
  });
  title.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); title.blur(); }
  });

  const actions    = mk('div', 'day-header-actions');
  const removeBtn  = mk('button', 'icon-btn');
  removeBtn.title  = 'Remove day';
  removeBtn.innerHTML =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
    ' stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  removeBtn.addEventListener('click', () => removeDay(day.id));
  actions.appendChild(removeBtn);
  hdr.appendChild(title);
  hdr.appendChild(actions);
  col.appendChild(hdr);

  // Grid
  const { startHour, endHour } = state.settings;
  const totalHours = endHour - startHour;
  const grid = mk('div', 'day-grid');
  grid.style.height = `${totalHours * HOUR_H}px`;

  for (let i = 0; i < totalHours; i++) grid.appendChild(mk('div', 'time-slot'));

  // Event blocks
  const dayEvents = state.events.filter(ev => ev.dayId === day.id);
  const layout    = computeOverlapLayout(dayEvents);
  dayEvents.forEach(ev => {
    const { col, numCols } = layout.get(ev.id) || { col: 0, numCols: 1 };
    grid.appendChild(buildEventBlock(ev, col, numCols));
  });

  placeNowLine(grid);

  // Drag-to-create on empty grid space (or Shift+drag to rubber-band select)
  grid.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (drag || createDrag || selectDrag) return;
    if (e.target.closest('.event-block')) return;
    if (e.target.closest('.day-header-title')) return;
    e.preventDefault();
    if (e.shiftKey) { startSelectDrag(e); return; }

    const rect    = grid.getBoundingClientRect();
    const y       = e.clientY - rect.top;
    const rawMn   = startHour * 60 + y / HOUR_H * 60;
    const edgeMn  = findNearestEventEdge(rawMn, day.id, 8);
    const startMn = edgeMn !== null ? edgeMn : snapMin(rawMn);
    const snapH   = state.settings.snapMinutes / 60 * HOUR_H;

    const eventType = activeTypeFilter ?? 'technical';
    const preview  = mk('div', `event-block create-preview type-${eventType}`);
    preview.style.cssText =
      `top:${(startMn - startHour * 60) / 60 * HOUR_H}px;` +
      `height:${Math.max(snapH, 24)}px`;
    preview.innerHTML = buildCreatePreviewHTML(eventType, startMn, null);
    grid.appendChild(preview);

    createDrag = {
      dayId: day.id, grid, previewEl: preview, eventType,
      anchorMin: startMn,
      startMin: startMn, endMin: startMn + state.settings.snapMinutes,
      startClientY: e.clientY, hasMoved: false,
    };

    document.addEventListener('mousemove', onCreateMove, { passive: false });
    document.addEventListener('mouseup',   onCreateEnd);
    document.addEventListener('keydown',   onDragKeyDown);
  });

  col.appendChild(grid);
  return col;
}

// ─── Event block ──────────────────────────────────────────────────────────────
function buildEventBlock(event, col = 0, numCols = 1) {
  const { startHour, endHour } = state.settings;
  const gridStart = startHour * 60;
  const gridEnd   = endHour * 60;
  const evStart   = Math.max(toMin(event.startTime), gridStart);
  const evEnd     = Math.min(toMin(event.endTime), gridEnd);
  if (evEnd <= evStart) return document.createDocumentFragment();

  const top    = (evStart - gridStart) / 60 * HOUR_H;
  const height = Math.max(24, (evEnd - evStart) / 60 * HOUR_H);

  const block = mk('div', `event-block type-${event.type}`);
  block.style.cssText = `top:${top}px;height:${height}px`;
  if (height < 36) block.classList.add('ev-compact');
  if (activeTypeFilter && event.type !== activeTypeFilter) block.classList.add('ev-dimmed');
  if (selectedEventIds.has(event.id)) block.classList.add('is-selected');
  if (numCols > 1) {
    const lPct = (col / numCols * 100).toFixed(3);
    const rPct = ((numCols - col - 1) / numCols * 100).toFixed(3);
    block.style.left  = `calc(${lPct}% + ${col === 0 ? 5 : 2}px)`;
    block.style.right = `calc(${rPct}% + ${col === numCols - 1 ? 5 : 2}px)`;
  }
  block.dataset.eventId = event.id;

  const titleEl = mk('div', 'ev-title');
  titleEl.textContent = event.title;
  block.appendChild(titleEl);

  if (height >= 46 || !event.title) {
    const timeEl = mk('div', 'ev-time');
    timeEl.textContent = `${fmtTime(event.startTime)} – ${fmtTime(event.endTime)}`;
    block.appendChild(timeEl);
  }

  if (event.type === 'technical' && height >= 54) {
    const dur = toMin(event.endTime) - toMin(event.startTime);
    const n   = paperCount(event);
    const rem = dur - n * state.settings.paperDuration;
    const pd  = mk('div', 'ev-papers');
    pd.innerHTML = buildPapersHTML(n, rem);
    block.appendChild(pd);
  }

  if (event.speaker && height >= 54) {
    const sp = mk('div', 'ev-speaker');
    sp.textContent = event.speaker;
    block.appendChild(sp);
  }

  if (event.room && height >= 68) {
    const rm = mk('div', 'ev-room');
    rm.textContent = event.room;
    block.appendChild(rm);
  }

  // Resize handle (bottom edge)
  const resizeHandle = mk('div', 'ev-resize');
  resizeHandle.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (block.classList.contains('ev-dimmed')) return;
    e.preventDefault();
    e.stopPropagation();
    startResizeDrag(e, event.id, block);
  });
  block.appendChild(resizeHandle);

  // Edit button (top-right, visible on hover)
  const editBtn = mk('button', 'ev-edit-btn');
  editBtn.title   = 'Edit event';
  editBtn.innerHTML =
    '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
    ' stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>';
  editBtn.addEventListener('mousedown', e => e.stopPropagation());
  editBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (block.classList.contains('ev-dimmed')) return;
    if (selectedEventIds.size > 0) { selectedEventIds.clear(); renderDays(); return; }
    openEventModal(event);
  });
  block.appendChild(editBtn);

  // Delete button (left of edit, visible on hover)
  const delBtn = mk('button', 'ev-del-btn');
  delBtn.title = 'Delete event';
  delBtn.innerHTML =
    '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
    ' stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="3 6 5 6 21 6"/>' +
    '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>' +
    '<path d="M10 11v6M14 11v6"/>' +
    '<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';
  delBtn.addEventListener('mousedown', e => e.stopPropagation());
  delBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (block.classList.contains('ev-dimmed')) return;
    if (!quickEdit && !confirm('Delete this event?')) return;
    pushHistory();
    state.events = state.events.filter(ev => ev.id !== event.id);
    selectedEventIds.delete(event.id);
    saveState();
    renderDays();
  });
  block.appendChild(delBtn);

  block.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (block.classList.contains('ev-dimmed')) return;
    if (e.target.closest('.ev-resize') || e.target.closest('.ev-edit-btn') || e.target.closest('.ev-del-btn')) return;
    if (e.shiftKey) {
      if (drag || createDrag || selectDrag) return;
      // Shift+drag → rubber-band; Shift+click → let click handler toggle
      const sx = e.clientX, sy = e.clientY;
      const onPendingMove = me => {
        const dx = me.clientX - sx, dy = me.clientY - sy;
        if (dx * dx + dy * dy >= DRAG_PX_SQ) {
          document.removeEventListener('mousemove', onPendingMove);
          document.removeEventListener('mouseup',   onPendingCancel);
          startSelectDrag(e);
          onSelectMove(me);
        }
      };
      const onPendingCancel = () => {
        document.removeEventListener('mousemove', onPendingMove);
        document.removeEventListener('mouseup',   onPendingCancel);
      };
      document.addEventListener('mousemove', onPendingMove);
      document.addEventListener('mouseup',   onPendingCancel);
      return;
    }
    startMoveDrag(e, event.id, block);
  });

  block.addEventListener('click', e => {
    e.stopPropagation();
    if (block.classList.contains('ev-dimmed')) return;
    if (e.target.closest('.ev-del-btn')) return;
    if (e.shiftKey) {
      if (selectedEventIds.has(event.id)) {
        selectedEventIds.delete(event.id);
        block.classList.remove('is-selected');
      } else {
        selectedEventIds.add(event.id);
        block.classList.add('is-selected');
      }
      return;
    }
    if (selectedEventIds.size > 0) {
      selectedEventIds.clear();
      renderDays();
      return;
    }
    openEventModal(event);
  });

  return block;
}

function placeNowLine(grid) {
  if (!showNowLine) return;
  const { startHour, endHour } = state.settings;
  const now    = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (nowMin < startHour * 60 || nowMin > endHour * 60) return;
  const line = mk('div', 'now-line');
  line.style.top = `${(nowMin - startHour * 60) / 60 * HOUR_H}px`;
  grid.appendChild(line);
}

// ─── Create-drag ─────────────────────────────────────────────────────────────
function buildCreatePreviewHTML(eventType, startMin, endMin) {
  const timeStr = endMin !== null
    ? `${fmtTime(fromMin(startMin))} – ${fmtTime(fromMin(endMin))}`
    : fmtTime(fromMin(startMin));
  let html = `<div class="ev-title">New Event</div><div class="ev-time">${timeStr}</div>`;
  if (eventType === 'technical') {
    const dur = endMin !== null ? endMin - startMin : state.settings.snapMinutes;
    const n   = Math.max(0, Math.floor(dur / state.settings.paperDuration));
    const rem = dur - n * state.settings.paperDuration;
    html += `<div class="ev-papers">${buildPapersHTML(n, rem)}</div>`;
  }
  return html;
}

function onCreateMove(e) {
  if (!createDrag) return;
  e.preventDefault();

  const { grid, previewEl, anchorMin, eventType } = createDrag;
  const { startHour, endHour, snapMinutes } = state.settings;

  const gridRect = grid.getBoundingClientRect();
  const y        = Math.max(0, e.clientY - gridRect.top);
  const rawMn    = startHour * 60 + y / HOUR_H * 60;
  const edgeMn   = findNearestEventEdge(rawMn, createDrag.dayId, 8);
  const curMn    = edgeMn !== null ? edgeMn : snapMin(rawMn);

  let startMn, endMn;
  if (curMn >= anchorMin) {
    startMn = anchorMin;
    endMn   = Math.max(anchorMin + snapMinutes, Math.min(curMn, endHour * 60));
  } else {
    endMn   = anchorMin;
    startMn = Math.max(startHour * 60, Math.min(curMn, anchorMin - snapMinutes));
  }

  createDrag.startMin = startMn;
  createDrag.endMin   = endMn;
  createDrag.hasMoved = true;

  const height = Math.max(24, (endMn - startMn) / 60 * HOUR_H);
  previewEl.style.top    = `${(startMn - startHour * 60) / 60 * HOUR_H}px`;
  previewEl.style.height = `${height}px`;
  previewEl.innerHTML    = buildCreatePreviewHTML(eventType, startMn, endMn);
}

function onCreateEnd() {
  if (!createDrag) return;
  document.removeEventListener('mousemove', onCreateMove);
  document.removeEventListener('mouseup',   onCreateEnd);
  document.removeEventListener('keydown',   onDragKeyDown);

  const { dayId, anchorMin, startMin, endMin, hasMoved, previewEl, eventType } = createDrag;
  previewEl.remove();
  createDrag = null;

  // Plain click with active selection → deselect only, don't create
  if (!hasMoved && selectedEventIds.size > 0) {
    selectedEventIds.clear();
    renderDays();
    return;
  }

  // Drag-create: clear any stale selection silently (renderDays will follow)
  selectedEventIds.clear();

  const { endHour } = state.settings;
  // Click with no drag defaults to a 1-hour event starting at the click point
  const finalStart = hasMoved ? startMin : anchorMin;
  const finalEnd   = hasMoved ? endMin   : Math.min(anchorMin + 60, endHour * 60);

  if (quickEdit) {
    pushHistory();
    state.events.push({
      id: uid(), dayId,
      title: '', type: eventType,
      startTime: fromMin(finalStart), endTime: fromMin(finalEnd),
      speaker: '', room: '', description: '',
    });
    saveState();
    renderDays();
  } else {
    openEventModal(null, dayId, fromMin(finalStart), fromMin(finalEnd));
  }
}

// ─── Rubber-band selection ────────────────────────────────────────────────────
function startSelectDrag(e) {
  const band = mk('div', 'select-band');
  band.style.cssText = `left:${e.clientX}px;top:${e.clientY}px;width:0;height:0`;
  document.body.appendChild(band);
  selectDrag = { startX: e.clientX, startY: e.clientY, bandEl: band };
  document.addEventListener('mousemove', onSelectMove, { passive: false });
  document.addEventListener('mouseup',   onSelectEnd);
  document.addEventListener('keydown',   onDragKeyDown);
}

function onSelectMove(e) {
  if (!selectDrag) return;
  e.preventDefault();
  const { startX, startY, bandEl } = selectDrag;
  const x1 = Math.min(startX, e.clientX), x2 = Math.max(startX, e.clientX);
  const y1 = Math.min(startY, e.clientY), y2 = Math.max(startY, e.clientY);
  bandEl.style.left = x1 + 'px'; bandEl.style.top    = y1 + 'px';
  bandEl.style.width = (x2 - x1) + 'px'; bandEl.style.height = (y2 - y1) + 'px';
}

function onSelectEnd(e) {
  if (!selectDrag) return;
  document.removeEventListener('mousemove', onSelectMove);
  document.removeEventListener('mouseup',   onSelectEnd);
  document.removeEventListener('keydown',   onDragKeyDown);
  const { startX, startY, bandEl } = selectDrag;
  bandEl.remove();
  selectDrag = null;

  const x1 = Math.min(startX, e.clientX), x2 = Math.max(startX, e.clientX);
  const y1 = Math.min(startY, e.clientY), y2 = Math.max(startY, e.clientY);
  // Treat as a plain click (tiny movement) — just clear selection
  if ((x2 - x1) < 4 && (y2 - y1) < 4) {
    if (selectedEventIds.size > 0) { selectedEventIds.clear(); renderDays(); }
    return;
  }
  // Suppress the click that fires after mouseup on the same element (e.g. an event block)
  document.addEventListener('click', ev => {
    if (ev.target.closest('.event-block')) ev.stopPropagation();
  }, { capture: true, once: true });

  // Add all event blocks that overlap the rectangle to the selection
  let changed = false;
  for (const block of document.querySelectorAll('.event-block:not(.ev-dimmed)')) {
    const r = block.getBoundingClientRect();
    if (r.right > x1 && r.left < x2 && r.bottom > y1 && r.top < y2) {
      const id = block.dataset.eventId;
      if (id && !selectedEventIds.has(id)) { selectedEventIds.add(id); changed = true; }
    }
  }
  if (changed) renderDays();
}

// ─── Move-drag ────────────────────────────────────────────────────────────────
function startMoveDrag(e, eventId, blockEl) {
  e.preventDefault(); // prevents text selection; does NOT suppress the later click

  const ev       = state.events.find(ev => ev.id === eventId);
  const startMn  = toMin(ev.startTime);
  const duration = toMin(ev.endTime) - startMn;
  const rect     = blockEl.getBoundingClientRect();

  // Build multi-event data when dragging a selected event with ≥2 selected
  const isMulti = selectedEventIds.has(eventId) && selectedEventIds.size >= 2;
  const origDayIndex = state.days.findIndex(d => d.id === ev.dayId);
  const multiEvents = [];
  if (isMulti) {
    for (const id of selectedEventIds) {
      if (id === eventId) continue;
      const mev = state.events.find(e => e.id === id);
      if (!mev) continue;
      const mEl = document.querySelector(`[data-event-id="${id}"]`);
      if (!mEl) continue;
      const mStart = toMin(mev.startTime);
      multiEvents.push({
        id, blockEl: mEl,
        originalStartMin: mStart, duration: toMin(mev.endTime) - mStart,
        originalDayIndex: state.days.findIndex(d => d.id === mev.dayId),
        currentGrid: mEl.closest('.day-grid'),
      });
    }
  }

  drag = {
    type: 'move',
    eventId, duration,
    offsetY:           e.clientY - rect.top,
    startClientX:      e.clientX,
    startClientY:      e.clientY,
    blockEl,
    currentGrid:       blockEl.closest('.day-grid'),
    originalGrid:      blockEl.closest('.day-grid'),
    originalTop:       blockEl.style.top,
    ghostEl:           null,
    previewStartMin:   startMn,
    previewDayId:      ev.dayId,
    hasMoved:          false,
    isCopying:         false,
    originalStartMin:  startMn,
    originalDayIndex:  origDayIndex,
    isMulti,
    multiEvents,
  };

  document.addEventListener('mousemove', onDragMove, { passive: false });
  document.addEventListener('mouseup',   onDragEnd);
  document.addEventListener('keydown',   onDragKeyDown);
  document.addEventListener('keyup',     onDragKeyUp);
}

function showCopyGhost() {
  if (!drag || drag.ghostEl) return;
  const ghost = drag.blockEl.cloneNode(true);
  ghost.classList.remove('is-dragging', 'is-copying');
  ghost.classList.add('is-copy-ghost');
  ghost.style.top = drag.originalTop;
  drag.originalGrid.appendChild(ghost);
  drag.ghostEl = ghost;
}

function hideCopyGhost() {
  if (!drag || !drag.ghostEl) return;
  drag.ghostEl.remove();
  drag.ghostEl = null;
}

function onMoveDrag(e) {
  const { blockEl, offsetY, duration, startClientX, startClientY } = drag;
  const { startHour, endHour } = state.settings;

  // Apply visual drag only after the pixel threshold is crossed
  if (!drag.hasMoved) {
    const dx = e.clientX - startClientX, dy = e.clientY - startClientY;
    if (dx * dx + dy * dy < DRAG_PX_SQ) return;
    blockEl.classList.add('is-dragging');
    if (drag.isMulti) {
      drag.multiEvents.forEach(me => me.blockEl.classList.add('is-multi-dragging'));
      document.body.classList.add('is-drag-active');
    } else {
      drag.isCopying = e.altKey;
      blockEl.classList.toggle('is-copying', e.altKey);
      document.body.classList.toggle('is-drag-active', !e.altKey);
      document.body.classList.toggle('is-copy-drag',    e.altKey);
      if (e.altKey) showCopyGhost();
    }
  }
  drag.hasMoved = true;

  // Sync copy mode if Alt is pressed/released mid-drag (single-event only)
  if (!drag.isMulti) {
    const copying = e.altKey;
    if (copying !== drag.isCopying) {
      drag.isCopying = copying;
      blockEl.classList.toggle('is-copying', copying);
      document.body.classList.toggle('is-drag-active', !copying);
      document.body.classList.toggle('is-copy-drag',    copying);
      if (copying) showCopyGhost(); else hideCopyGhost();
    }
  }

  const dayInfo = getDayAtX(e.clientX);
  if (!dayInfo) return;
  const { grid: targetGrid, dayId: targetDayId } = dayInfo;

  const gridRect = targetGrid.getBoundingClientRect();
  const relY     = e.clientY - gridRect.top - offsetY;
  let   newStart = snapMin(startHour * 60 + relY / HOUR_H * 60);
  if (!e.shiftKey) {
    const snapS = findNearestEventEdge(newStart, targetDayId, 8, drag.eventId);
    if (snapS !== null) {
      newStart = snapS;
    } else {
      const snapE = findNearestEventEdge(newStart + duration, targetDayId, 8, drag.eventId);
      if (snapE !== null) newStart = snapE - duration;
    }
  }
  newStart = Math.max(startHour * 60, Math.min(newStart, endHour * 60 - duration));
  const top = (newStart - startHour * 60) / 60 * HOUR_H;

  if (targetGrid !== drag.currentGrid) {
    blockEl.style.top = `${top}px`;
    targetGrid.appendChild(blockEl);
    drag.currentGrid = targetGrid;
  } else {
    blockEl.style.top = `${top}px`;
  }

  drag.previewStartMin = newStart;
  drag.previewDayId    = targetDayId;

  const tEl = blockEl.querySelector('.ev-time');
  if (tEl) tEl.textContent = `${fmtTime(fromMin(newStart))} – ${fmtTime(fromMin(newStart + duration))}`;

  // Sync all other selected events during multi-drag (time + day)
  if (drag.isMulti) {
    const newDayIndex = state.days.findIndex(d => d.id === targetDayId);
    const dayDelta    = newDayIndex - drag.originalDayIndex;
    const timeDelta   = newStart - drag.originalStartMin;
    for (const me of drag.multiEvents) {
      const meStart = Math.max(startHour * 60, Math.min(me.originalStartMin + timeDelta, endHour * 60 - me.duration));
      const meTargetIdx = Math.max(0, Math.min(me.originalDayIndex + dayDelta, state.days.length - 1));
      me.previewDayId = state.days[meTargetIdx].id;
      // Move block to the correct day column if it changed
      const meDayCol  = document.querySelector(`.day-column[data-day-id="${me.previewDayId}"]`);
      const meTargetGrid = meDayCol ? meDayCol.querySelector('.day-grid') : me.currentGrid;
      if (meTargetGrid !== me.currentGrid) {
        meTargetGrid.appendChild(me.blockEl);
        me.currentGrid = meTargetGrid;
      }
      me.blockEl.style.top = `${(meStart - startHour * 60) / 60 * HOUR_H}px`;
    }
  }
}

// ─── Resize-drag ──────────────────────────────────────────────────────────────
function buildCascadeChain(anchorEndMin, dayId, excludeId) {
  const chain = [];
  let curEnd = anchorEndMin;
  const seen = new Set([excludeId]);
  while (true) {
    const next = state.events.find(
      ev => ev.dayId === dayId && !seen.has(ev.id) && toMin(ev.startTime) === curEnd
    );
    if (!next) break;
    seen.add(next.id);
    const startMin = toMin(next.startTime);
    const duration = toMin(next.endTime) - startMin;
    chain.push({
      id: next.id,
      blockEl: document.querySelector(`[data-event-id="${next.id}"]`),
      originalStartMin: startMin,
      duration,
    });
    curEnd = startMin + duration;
  }
  return chain;
}

function startResizeDrag(e, eventId, blockEl) {
  const ev = state.events.find(ev => ev.id === eventId);
  blockEl.classList.add('is-resizing');
  document.body.classList.add('is-resize-active');

  const origEndMin     = toMin(ev.endTime);
  const cascadeChain   = cascadeResize ? buildCascadeChain(origEndMin, ev.dayId, eventId) : [];
  const lastChainEnd   = cascadeChain.length
    ? cascadeChain[cascadeChain.length - 1].originalStartMin + cascadeChain[cascadeChain.length - 1].duration
    : origEndMin;
  const chainSpan      = lastChainEnd - origEndMin;

  drag = {
    type: 'resize',
    eventId, blockEl,
    dayId:          ev.dayId,
    startClientY:   e.clientY,
    startMin:       toMin(ev.startTime),
    originalEndMin: origEndMin,
    previewEndMin:  origEndMin,
    hasMoved:       false,
    cascadeChain,
    maxEndMin:      state.settings.endHour * 60 - chainSpan,
  };

  document.addEventListener('mousemove', onDragMove, { passive: false });
  document.addEventListener('mouseup',   onDragEnd);
  document.addEventListener('keydown',   onDragKeyDown);
}

function onResizeDrag(e) {
  const { blockEl, startClientY, originalEndMin, startMin } = drag;
  const { endHour, snapMinutes } = state.settings;

  const deltaY = e.clientY - startClientY;
  let   newEnd = snapMin(originalEndMin + deltaY / HOUR_H * 60);
  if (!e.shiftKey && !drag.cascadeChain.length) {
    const snapE = findNearestEventEdge(newEnd, drag.dayId, 8, drag.eventId);
    if (snapE !== null) newEnd = snapE;
  }
  newEnd = Math.max(startMin + snapMinutes, Math.min(newEnd, drag.maxEndMin));

  drag.previewEndMin = newEnd;
  drag.hasMoved      = true;

  const height = Math.max(24, (newEnd - startMin) / 60 * HOUR_H);
  blockEl.style.height = `${height}px`;

  const tEl = blockEl.querySelector('.ev-time');
  if (tEl) tEl.textContent = `${fmtTime(fromMin(startMin))} – ${fmtTime(fromMin(newEnd))}`;

  // Live paper-count update while resizing a technical session
  const ev = state.events.find(ev => ev.id === drag.eventId);
  if (ev?.type === 'technical') {
    const pEl = blockEl.querySelector('.ev-papers');
    if (pEl) {
      const dur = newEnd - startMin;
      const n   = Math.max(0, Math.floor(dur / state.settings.paperDuration));
      const rem = dur - n * state.settings.paperDuration;
      pEl.innerHTML = buildPapersHTML(n, rem);
    }
  }

  // Shift cascade-chain blocks visually
  if (drag.cascadeChain.length) {
    const delta = newEnd - originalEndMin;
    const { startHour } = state.settings;
    for (const ce of drag.cascadeChain) {
      if (ce.blockEl) {
        ce.blockEl.style.top = `${(ce.originalStartMin + delta - startHour * 60) / 60 * HOUR_H}px`;
      }
    }
  }
}

// ─── Drag cancel (Escape) / copy-mode toggle (Alt) ───────────────────────────
function onDragKeyDown(e) {
  if (e.key === 'Escape') {
    if (drag) {
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('mouseup',   onDragEnd);
      document.removeEventListener('keydown',   onDragKeyDown);
      document.removeEventListener('keyup',     onDragKeyUp);
      document.body.classList.remove('is-drag-active', 'is-resize-active', 'is-copy-drag');
      hideCopyGhost();
      drag = null;
      renderDays();
    } else if (createDrag) {
      document.removeEventListener('mousemove', onCreateMove);
      document.removeEventListener('mouseup',   onCreateEnd);
      document.removeEventListener('keydown',   onDragKeyDown);
      createDrag.previewEl.remove();
      createDrag = null;
    } else if (selectDrag) {
      document.removeEventListener('mousemove', onSelectMove);
      document.removeEventListener('mouseup',   onSelectEnd);
      document.removeEventListener('keydown',   onDragKeyDown);
      selectDrag.bandEl.remove();
      selectDrag = null;
    }
  } else if (e.key === 'Alt' && drag?.type === 'move' && drag.hasMoved && !drag.isCopying && !drag.isMulti) {
    drag.isCopying = true;
    drag.blockEl.classList.add('is-copying');
    document.body.classList.remove('is-drag-active');
    document.body.classList.add('is-copy-drag');
    showCopyGhost();
  }
}

function onDragKeyUp(e) {
  if (e.key === 'Alt' && drag?.type === 'move' && drag.isCopying && !drag.isMulti) {
    drag.isCopying = false;
    drag.blockEl.classList.remove('is-copying');
    document.body.classList.add('is-drag-active');
    document.body.classList.remove('is-copy-drag');
    hideCopyGhost();
  }
}

// ─── Shared drag dispatch ─────────────────────────────────────────────────────
function onDragMove(e) {
  if (!drag) return;
  e.preventDefault();
  if (drag.type === 'move') onMoveDrag(e);
  else                      onResizeDrag(e);
}

function onDragEnd() {
  if (!drag) return;
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup',   onDragEnd);
  document.removeEventListener('keydown',   onDragKeyDown);
  document.removeEventListener('keyup',     onDragKeyUp);
  document.body.classList.remove('is-drag-active', 'is-resize-active', 'is-copy-drag');

  // Capture everything we need before clearing drag state
  const { eventId, hasMoved, type, blockEl,
          previewStartMin, previewDayId, previewEndMin, duration, isCopying,
          isMulti, multiEvents, originalStartMin,
          cascadeChain, originalEndMin } = drag;
  hideCopyGhost();
  drag = null;

  if (!hasMoved) {
    // Nothing moved — remove visual classes and let the click event open the modal
    blockEl.classList.remove('is-dragging', 'is-resizing', 'is-copying');
    return;
  }

  // Suppress the click that fires immediately after mouseup on an event block drag
  document.addEventListener('click', e => {
    if (e.target.closest('.event-block')) e.stopPropagation();
  }, { capture: true, once: true });

  const evIdx = state.events.findIndex(ev => ev.id === eventId);
  if (evIdx >= 0) {
    const ev = state.events[evIdx];
    if (type === 'move') {
      const newStart = fromMin(previewStartMin);
      const newEnd   = fromMin(previewStartMin + duration);
      if (isMulti) {
        // Move all selected events by the same time + day delta
        const { startHour, endHour } = state.settings;
        const timeDelta   = previewStartMin - originalStartMin;
        const origDayIdx  = state.days.findIndex(d => d.id === ev.dayId);
        const newDayIdx   = state.days.findIndex(d => d.id === previewDayId);
        const dayDelta    = newDayIdx - origDayIdx;
        if (timeDelta !== 0 || dayDelta !== 0) {
          pushHistory();
          const clampedStart = Math.max(startHour * 60, Math.min(previewStartMin, endHour * 60 - duration));
          state.events[evIdx] = { ...ev, dayId: previewDayId, startTime: fromMin(clampedStart), endTime: fromMin(clampedStart + duration) };
          for (const me of (multiEvents || [])) {
            const meIdx = state.events.findIndex(e => e.id === me.id);
            if (meIdx < 0) continue;
            const meEv = state.events[meIdx];
            const meStart = Math.max(startHour * 60, Math.min(me.originalStartMin + timeDelta, endHour * 60 - me.duration));
            const meTargetDayIdx = Math.max(0, Math.min(me.originalDayIndex + dayDelta, state.days.length - 1));
            state.events[meIdx] = { ...meEv, dayId: state.days[meTargetDayIdx].id, startTime: fromMin(meStart), endTime: fromMin(meStart + me.duration) };
          }
          saveState();
        }
      } else if (isCopying) {
        pushHistory();
        state.events.push({ ...ev, id: uid(), dayId: previewDayId, startTime: newStart, endTime: newEnd });
        saveState();
      } else if (previewDayId !== ev.dayId || newStart !== ev.startTime || newEnd !== ev.endTime) {
        pushHistory();
        state.events[evIdx] = { ...ev, dayId: previewDayId, startTime: newStart, endTime: newEnd };
        saveState();
      }
    } else {
      const newEnd = fromMin(previewEndMin);
      if (newEnd !== ev.endTime) {
        pushHistory();
        state.events[evIdx] = { ...ev, endTime: newEnd };
        const delta = previewEndMin - originalEndMin;
        for (const ce of (cascadeChain || [])) {
          const ceIdx = state.events.findIndex(e => e.id === ce.id);
          if (ceIdx < 0) continue;
          const ceEv = state.events[ceIdx];
          state.events[ceIdx] = { ...ceEv,
            startTime: fromMin(ce.originalStartMin + delta),
            endTime:   fromMin(ce.originalStartMin + delta + ce.duration),
          };
        }
        saveState();
      }
    }
  }
  renderDays();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDayAtX(clientX) {
  for (const col of document.querySelectorAll('.day-column')) {
    const r = col.getBoundingClientRect();
    if (clientX >= r.left && clientX < r.right) {
      return { dayId: col.dataset.dayId, grid: col.querySelector('.day-grid') };
    }
  }
  return null;
}

// ─── Day management ───────────────────────────────────────────────────────────
function addDay() {
  pushHistory();
  state.days.push({ id: uid(), label: `Day ${state.days.length + 1}` });
  saveState();
  renderDays();
}

function removeDay(dayId) {
  if (state.days.length <= 1) { alert('You need at least one day.'); return; }
  if (!confirm('Remove this day and all its events?')) return;
  pushHistory();
  state.days   = state.days.filter(d => d.id !== dayId);
  state.events = state.events.filter(e => e.dayId !== dayId);
  saveState();
  renderDays();
}

// ─── Event Modal ──────────────────────────────────────────────────────────────
let _editEvent = null, _editDayId = null;

function openEventModal(event, dayId, defaultStart, defaultEnd) {
  _editEvent = event;
  _editDayId = dayId || event?.dayId;

  const isNew = !event;
  document.getElementById('modalTitle').textContent          = isNew ? 'New Event' : 'Edit Event';
  document.getElementById('deleteEventBtn').style.display    = isNew ? 'none' : '';
  document.getElementById('eventTitle').value                = event?.title       ?? '';
  document.getElementById('eventType').value                 = event?.type        ?? activeTypeFilter ?? 'technical';
  document.getElementById('startTime').value                 = event?.startTime   ?? defaultStart ?? '09:00';
  document.getElementById('endTime').value                   = event?.endTime     ?? defaultEnd   ?? '10:00';
  document.getElementById('eventSpeaker').value              = event?.speaker     ?? '';
  document.getElementById('eventRoom').value                 = event?.room        ?? '';
  document.getElementById('eventDescription').value          = event?.description ?? '';

  refreshPaperInfo();
  document.getElementById('eventModal').classList.add('open');
  setTimeout(() => document.getElementById('eventTitle').focus(), 50);
}

function closeEventModal() {
  document.getElementById('eventModal').classList.remove('open');
  _editEvent = null;
  _editDayId = null;
}

function refreshPaperInfo() {
  const type  = document.getElementById('eventType').value;
  const start = document.getElementById('startTime').value;
  const end   = document.getElementById('endTime').value;
  const box   = document.getElementById('paperCountInfo');

  if (type === 'technical' && start && end && toMin(end) > toMin(start)) {
    const n = Math.max(0, Math.floor((toMin(end) - toMin(start)) / state.settings.paperDuration));
    document.getElementById('paperCount').textContent           = n;
    document.getElementById('paperDurationDisplay').textContent = state.settings.paperDuration;
    box.style.display = '';
  } else {
    box.style.display = 'none';
  }
}

function handleSaveEvent(e) {
  e.preventDefault();
  const title = document.getElementById('eventTitle').value.trim();
  const start = document.getElementById('startTime').value;
  const end   = document.getElementById('endTime').value;
  if (toMin(end) <= toMin(start)) { alert('End time must be after start time.'); return; }

  const data = {
    title,
    type:        document.getElementById('eventType').value,
    startTime:   start,
    endTime:     end,
    speaker:     document.getElementById('eventSpeaker').value.trim(),
    room:        document.getElementById('eventRoom').value.trim(),
    description: document.getElementById('eventDescription').value.trim(),
  };

  if (_editEvent) {
    const idx = state.events.findIndex(ev => ev.id === _editEvent.id);
    if (idx >= 0) {
      const ev = state.events[idx];
      if (Object.keys(data).some(k => data[k] !== ev[k])) {
        pushHistory();
        state.events[idx] = { ...ev, ...data };
        saveState();
      }
    }
  } else {
    pushHistory();
    state.events.push({ id: uid(), dayId: _editDayId, ...data });
    saveState();
  }

  closeEventModal();
  renderDays();
}

function handleDeleteEvent() {
  if (!_editEvent || !confirm('Delete this event?')) return;
  pushHistory();
  selectedEventIds.delete(_editEvent.id);
  state.events = state.events.filter(ev => ev.id !== _editEvent.id);
  saveState();
  closeEventModal();
  renderDays();
}

// ─── Settings Modal ───────────────────────────────────────────────────────────
function openSettings() {
  document.getElementById('settingPaperDuration').value  = state.settings.paperDuration;
  document.getElementById('settingStartHour').value      = state.settings.startHour;
  document.getElementById('settingEndHour').value        = state.settings.endHour;
  document.getElementById('settingSnapMinutes').value    = state.settings.snapMinutes;
  document.getElementById('settingShowNowLine').checked    = showNowLine;
  document.getElementById('settingQuickEdit').checked      = quickEdit;
  document.getElementById('settingCascadeResize').checked  = cascadeResize;
  document.getElementById('settingsModal').classList.add('open');
}

function closeSettings() {
  document.getElementById('settingsModal').classList.remove('open');
}

function handleSaveSettings() {
  const pd      = parseInt(document.getElementById('settingPaperDuration').value);
  const start   = parseInt(document.getElementById('settingStartHour').value);
  const end     = parseInt(document.getElementById('settingEndHour').value);
  const snap    = parseInt(document.getElementById('settingSnapMinutes').value);
  const nowLine = document.getElementById('settingShowNowLine').checked;

  if (isNaN(pd) || pd < 5 || pd > 120) { alert('Paper duration must be 5–120 minutes.'); return; }
  if (isNaN(start) || isNaN(end) || end <= start) { alert('End hour must be after start hour.'); return; }
  if (end - start > 24) { alert('Range cannot exceed 24 hours.'); return; }

  if (pd !== state.settings.paperDuration || start !== state.settings.startHour ||
      end !== state.settings.endHour || snap !== state.settings.snapMinutes) {
    pushHistory();
    state.settings = { paperDuration: pd, startHour: start, endHour: end, snapMinutes: snap };
    saveState();
  }

  if (nowLine !== showNowLine) {
    showNowLine = nowLine;
    localStorage.setItem(NOWLINE_KEY, String(showNowLine));
    refreshNowLines();
  }

  const qe = document.getElementById('settingQuickEdit').checked;
  if (qe !== quickEdit) {
    quickEdit = qe;
    localStorage.setItem(QUICK_EDIT_KEY, String(quickEdit));
  }
  const cr = document.getElementById('settingCascadeResize').checked;
  if (cr !== cascadeResize) {
    cascadeResize = cr;
    localStorage.setItem(CASCADE_KEY, String(cascadeResize));
  }
  closeSettings();
  render();
}

// ─── Export / Import ──────────────────────────────────────────────────────────
function handleExport() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = (state.conferenceName || 'agenda').replace(/[^a-z0-9]/gi, '-').toLowerCase() + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

function loadFromFile(file, onSuccess) {
  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const imported = JSON.parse(evt.target.result);
      if (!imported.days || !imported.events) throw new Error('Invalid format');
      imported.settings.snapMinutes = imported.settings.snapMinutes || 15;
      pushHistory();
      state = imported;
      selectedEventIds.clear();
      saveState();
      render();
      document.title = state.conferenceName + ' – Agenda Planner';
      if (onSuccess) onSuccess();
    } catch {
      alert('Invalid JSON file.');
    }
  };
  reader.readAsText(file);
}

function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  loadFromFile(file, () => { closeSettings(); });
  e.target.value = '';
}

function createEmptyState() {
  const days = [
    { id: uid(), label: 'Day 1' },
    { id: uid(), label: 'Day 2' },
    { id: uid(), label: 'Day 3' },
  ];
  return {
    conferenceName: 'My Conference',
    settings: { paperDuration: 20, startHour: 8, endHour: 20, snapMinutes: 15 },
    days,
    events: [],
  };
}

function handleLoadSample() {
  if (!confirm('Replace all current data with sample data?')) return;
  pushHistory();
  state = createDefaultState();
  selectedEventIds.clear();
  saveState();
  closeSettings();
  render();
  document.title = state.conferenceName + ' – Agenda Planner';
}

function handleClearData() {
  if (!confirm('Delete all events and start with an empty schedule?')) return;
  pushHistory();
  state = createEmptyState();
  selectedEventIds.clear();
  saveState();
  closeSettings();
  render();
  document.title = state.conferenceName + ' – Agenda Planner';
}

// ─── Conference title inline edit ─────────────────────────────────────────────
function initTitleEdit() {
  const titleEl = document.getElementById('conferenceTitle');
  titleEl.contentEditable = 'true';
  titleEl.spellcheck      = false;
  titleEl.addEventListener('focus', () => {
    const range = document.createRange();
    range.selectNodeContents(titleEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
  titleEl.addEventListener('blur', () => {
    const v = titleEl.textContent.trim();
    const newName = v || state.conferenceName;
    if (newName !== state.conferenceName) pushHistory();
    state.conferenceName = newName;
    titleEl.textContent  = state.conferenceName;
    document.title       = state.conferenceName + ' – Agenda Planner';
    saveState();
  });
  titleEl.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); titleEl.blur(); }
    if (e.key === 'Escape') { titleEl.textContent = state.conferenceName; titleEl.blur(); }
  });
  document.getElementById('editTitleBtn').addEventListener('click', () => titleEl.focus());
}

// ─── Now-line refresh ─────────────────────────────────────────────────────────
function refreshNowLines() {
  document.querySelectorAll('.now-line').forEach(e => e.remove());
  if (showNowLine)
    document.querySelectorAll('.day-grid').forEach(g => placeNowLine(g));
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  loadState();
  loadZoom();
  loadTheme();
  loadNowLineSetting();
  loadQuickEdit();
  loadCascadeResize();
  initTitleEdit();

  // Toolbar
  document.querySelectorAll('.legend-item').forEach(el => {
    el.addEventListener('click', () => {
      const type = [...el.classList]
        .find(c => c.startsWith('legend-') && c !== 'legend-item')
        ?.slice('legend-'.length);
      if (type) setTypeFilter(type);
    });
  });

  document.getElementById('papersTotal').addEventListener('click', () => setTypeFilter('technical'));
  document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);
  document.getElementById('undoBtn').addEventListener('click', undo);
  document.getElementById('redoBtn').addEventListener('click', redo);
  document.getElementById('addDayBtn').addEventListener('click',  addDay);
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('zoomInBtn').addEventListener('click',  zoomIn);
  document.getElementById('zoomOutBtn').addEventListener('click', zoomOut);
  document.getElementById('zoomLevelLabel').addEventListener('change', e => {
    zoomLevel = parseFloat(e.target.value);
    applyZoom();
    renderDays();
  });

  // Event modal
  document.getElementById('closeModal').addEventListener('click',     closeEventModal);
  document.getElementById('cancelModal').addEventListener('click',    closeEventModal);
  document.getElementById('deleteEventBtn').addEventListener('click', handleDeleteEvent);
  document.getElementById('eventForm').addEventListener('submit',     handleSaveEvent);
  document.getElementById('eventType').addEventListener('change',     refreshPaperInfo);
  document.getElementById('startTime').addEventListener('change',     refreshPaperInfo);
  document.getElementById('endTime').addEventListener('change',       refreshPaperInfo);
  document.getElementById('eventModal').addEventListener('click', e => {
    if (e.target === document.getElementById('eventModal')) closeEventModal();
  });

  // Settings modal
  document.getElementById('closeSettings').addEventListener('click',   closeSettings);
  document.getElementById('cancelSettings').addEventListener('click',  closeSettings);
  document.getElementById('saveSettings').addEventListener('click',    handleSaveSettings);
  document.getElementById('exportBtn').addEventListener('click',       handleExport);
  document.getElementById('importFile').addEventListener('change',     handleImport);
  document.getElementById('loadSampleBtn').addEventListener('click',   handleLoadSample);
  document.getElementById('clearDataBtn').addEventListener('click',    handleClearData);
  document.getElementById('settingsModal').addEventListener('click', e => {
    if (e.target === document.getElementById('settingsModal')) closeSettings();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const modalOpen = document.getElementById('eventModal').classList.contains('open') ||
                        document.getElementById('settingsModal').classList.contains('open');
      closeEventModal();
      closeSettings();
      if (!modalOpen) {
        const hadFilter    = !!activeTypeFilter;
        const hadSelection = selectedEventIds.size > 0;
        selectedEventIds.clear();
        if (hadFilter) setTypeFilter(activeTypeFilter); // setTypeFilter calls renderDays
        else if (hadSelection) renderDays();
      }
    }
    const inInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
    if (!inInput && (e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault(); undo();
    }
    if (!inInput && (e.metaKey || e.ctrlKey) && ((e.shiftKey && e.key.toLowerCase() === 'z') || e.key.toLowerCase() === 'y')) {
      e.preventDefault(); redo();
    }
  });

  // Drag-and-drop JSON import
  const dropOverlay = document.getElementById('dropOverlay');
  let dragCount = 0;
  document.addEventListener('dragenter', e => {
    if (!Array.from(e.dataTransfer.types).includes('Files')) return;
    dragCount++;
    if (dragCount === 1) dropOverlay.classList.add('is-active');
  });
  document.addEventListener('dragleave', () => {
    dragCount = Math.max(0, dragCount - 1);
    if (dragCount === 0) dropOverlay.classList.remove('is-active');
  });
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => {
    e.preventDefault();
    dragCount = 0;
    dropOverlay.classList.remove('is-active');
    const file = e.dataTransfer.files[0];
    if (!file || !file.name.endsWith('.json')) return;
    if (!confirm(`Import "${file.name}"?\n\nThis will replace your current schedule.`)) return;
    loadFromFile(file);
  });

  render();
  updateUndoRedoBtns();
  document.title = state.conferenceName + ' – Agenda Planner';
  setInterval(refreshNowLines, 60_000);
}

document.addEventListener('DOMContentLoaded', init);
