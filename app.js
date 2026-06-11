'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────
const BASE_HOUR_H  = 64;  // px per hour at 100% zoom
const DRAG_PX_SQ   = 16;  // 4² — pixel threshold before move-drag activates
const ZOOM_STEPS   = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];
const ZOOM_KEY     = 'agendaPlanner_zoom';
const THEME_KEY    = 'agendaPlanner_theme';

const ICON_MOON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
const ICON_SUN  = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';

let zoomLevel = 1.0;
let HOUR_H    = BASE_HOUR_H; // updated by applyZoom()

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
    const raw = localStorage.getItem('agendaPlanner_v2');
    state = raw ? JSON.parse(raw) : createDefaultState();
    state.settings.snapMinutes = state.settings.snapMinutes || 15;
  } catch {
    state = createDefaultState();
  }
}

function saveState() {
  localStorage.setItem('agendaPlanner_v2', JSON.stringify(state));
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
  const saved = parseFloat(localStorage.getItem(ZOOM_KEY));
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
  saveState();
  render();
  updateUndoRedoBtns();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.parse(JSON.stringify(state)));
  state = redoStack.pop();
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

// ─── Drag state ───────────────────────────────────────────────────────────────
// drag      — move or resize an existing event
// createDrag — drag on empty grid space to define a new event's time range
let drag       = null;
let createDrag = null;

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

  // Drag-to-create on empty grid space
  grid.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (drag || createDrag) return;
    if (e.target.closest('.event-block')) return;
    if (e.target.closest('.day-header-title')) return;
    e.preventDefault();

    const rect     = grid.getBoundingClientRect();
    const y        = e.clientY - rect.top;
    const startMn  = snapMin(startHour * 60 + y / HOUR_H * 60);
    const snapH    = state.settings.snapMinutes / 60 * HOUR_H;

    const preview  = mk('div', 'event-block create-preview');
    preview.style.cssText =
      `top:${(startMn - startHour * 60) / 60 * HOUR_H}px;` +
      `height:${Math.max(snapH, 24)}px`;
    preview.innerHTML =
      `<div class="ev-title">New Event</div>` +
      `<div class="ev-time">${fmtTime(fromMin(startMn))}</div>`;
    grid.appendChild(preview);

    createDrag = {
      dayId: day.id, grid, previewEl: preview,
      startMin: startMn, endMin: startMn + state.settings.snapMinutes,
      startClientY: e.clientY, hasMoved: false,
    };

    document.addEventListener('mousemove', onCreateMove, { passive: false });
    document.addEventListener('mouseup',   onCreateEnd);
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

  if (height >= 46) {
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
  editBtn.addEventListener('mousedown', e => e.stopPropagation()); // don't start move drag
  editBtn.addEventListener('click', e => { e.stopPropagation(); openEventModal(event); });
  block.appendChild(editBtn);

  // Mousedown on the block body starts a move drag
  block.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (e.target.closest('.ev-resize') || e.target.closest('.ev-edit-btn')) return;
    startMoveDrag(e, event.id, block);
  });

  // Click (fires only when no drag occurred, because onDragEnd won't re-render)
  block.addEventListener('click', e => {
    e.stopPropagation();
    openEventModal(event);
  });

  return block;
}

function placeNowLine(grid) {
  const { startHour, endHour } = state.settings;
  const now    = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (nowMin < startHour * 60 || nowMin > endHour * 60) return;
  const line = mk('div', 'now-line');
  line.style.top = `${(nowMin - startHour * 60) / 60 * HOUR_H}px`;
  grid.appendChild(line);
}

// ─── Create-drag ─────────────────────────────────────────────────────────────
function onCreateMove(e) {
  if (!createDrag) return;
  e.preventDefault();

  const { grid, previewEl, startMin } = createDrag;
  const { startHour, endHour, snapMinutes } = state.settings;

  const gridRect = grid.getBoundingClientRect();
  const y        = Math.max(0, e.clientY - gridRect.top);
  let   endMn    = snapMin(startHour * 60 + y / HOUR_H * 60);
  endMn = Math.max(startMin + snapMinutes, Math.min(endMn, endHour * 60));

  createDrag.endMin   = endMn;
  createDrag.hasMoved = true;

  previewEl.style.height = `${Math.max(24, (endMn - startMin) / 60 * HOUR_H)}px`;
  previewEl.innerHTML =
    `<div class="ev-title">New Event</div>` +
    `<div class="ev-time">${fmtTime(fromMin(startMin))} – ${fmtTime(fromMin(endMn))}</div>`;
}

function onCreateEnd() {
  if (!createDrag) return;
  document.removeEventListener('mousemove', onCreateMove);
  document.removeEventListener('mouseup',   onCreateEnd);

  const { dayId, startMin, endMin, hasMoved, previewEl } = createDrag;
  previewEl.remove();
  createDrag = null;

  const { endHour } = state.settings;
  // Click with no drag defaults to a 1-hour event
  const finalEnd = hasMoved
    ? endMin
    : Math.min(startMin + 60, endHour * 60);

  openEventModal(null, dayId, fromMin(startMin), fromMin(finalEnd));
}

// ─── Move-drag ────────────────────────────────────────────────────────────────
function startMoveDrag(e, eventId, blockEl) {
  e.preventDefault(); // prevents text selection; does NOT suppress the later click

  const ev       = state.events.find(ev => ev.id === eventId);
  const startMn  = toMin(ev.startTime);
  const duration = toMin(ev.endTime) - startMn;
  const rect     = blockEl.getBoundingClientRect();

  drag = {
    type: 'move',
    eventId, duration,
    offsetY:         e.clientY - rect.top,
    startClientX:    e.clientX,
    startClientY:    e.clientY,
    blockEl,
    currentGrid:     blockEl.closest('.day-grid'),
    previewStartMin: startMn,
    previewDayId:    ev.dayId,
    hasMoved:        false,
  };

  document.addEventListener('mousemove', onDragMove, { passive: false });
  document.addEventListener('mouseup',   onDragEnd);
}

function onMoveDrag(e) {
  const { blockEl, offsetY, duration, startClientX, startClientY } = drag;
  const { startHour, endHour } = state.settings;

  // Apply visual drag only after the pixel threshold is crossed
  if (!drag.hasMoved) {
    const dx = e.clientX - startClientX, dy = e.clientY - startClientY;
    if (dx * dx + dy * dy < DRAG_PX_SQ) return;
    blockEl.classList.add('is-dragging');
    document.body.classList.add('is-drag-active');
  }
  drag.hasMoved = true;

  const dayInfo = getDayAtX(e.clientX);
  if (!dayInfo) return;
  const { grid: targetGrid, dayId: targetDayId } = dayInfo;

  const gridRect = targetGrid.getBoundingClientRect();
  const relY     = e.clientY - gridRect.top - offsetY;
  let   newStart = snapMin(startHour * 60 + relY / HOUR_H * 60);
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
}

// ─── Resize-drag ──────────────────────────────────────────────────────────────
function startResizeDrag(e, eventId, blockEl) {
  const ev = state.events.find(ev => ev.id === eventId);
  blockEl.classList.add('is-resizing');
  document.body.classList.add('is-resize-active');

  drag = {
    type: 'resize',
    eventId, blockEl,
    startClientY:   e.clientY,
    startMin:       toMin(ev.startTime),
    originalEndMin: toMin(ev.endTime),
    previewEndMin:  toMin(ev.endTime),
    hasMoved:       false,
  };

  document.addEventListener('mousemove', onDragMove, { passive: false });
  document.addEventListener('mouseup',   onDragEnd);
}

function onResizeDrag(e) {
  const { blockEl, startClientY, originalEndMin, startMin } = drag;
  const { endHour, snapMinutes } = state.settings;

  const deltaY = e.clientY - startClientY;
  let   newEnd = snapMin(originalEndMin + deltaY / HOUR_H * 60);
  newEnd = Math.max(startMin + snapMinutes, Math.min(newEnd, endHour * 60));

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
  document.body.classList.remove('is-drag-active', 'is-resize-active');

  // Capture everything we need before clearing drag state
  const { eventId, hasMoved, type, blockEl,
          previewStartMin, previewDayId, previewEndMin, duration } = drag;
  drag = null;

  if (!hasMoved) {
    // Nothing moved — remove visual classes and let the click event open the modal
    blockEl.classList.remove('is-dragging', 'is-resizing');
    return;
  }

  // Suppress the click event that fires immediately after mouseup on a drag
  document.addEventListener('click', e => e.stopPropagation(), { capture: true, once: true });

  const evIdx = state.events.findIndex(ev => ev.id === eventId);
  if (evIdx >= 0) {
    pushHistory();
    if (type === 'move') {
      state.events[evIdx] = {
        ...state.events[evIdx],
        dayId:     previewDayId,
        startTime: fromMin(previewStartMin),
        endTime:   fromMin(previewStartMin + duration),
      };
    } else {
      state.events[evIdx] = {
        ...state.events[evIdx],
        endTime: fromMin(previewEndMin),
      };
    }
    saveState();
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
  document.getElementById('eventType').value                 = event?.type        ?? 'technical';
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
  if (!title) { document.getElementById('eventTitle').focus(); return; }
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

  pushHistory();
  if (_editEvent) {
    const idx = state.events.findIndex(ev => ev.id === _editEvent.id);
    if (idx >= 0) state.events[idx] = { ...state.events[idx], ...data };
  } else {
    state.events.push({ id: uid(), dayId: _editDayId, ...data });
  }

  saveState();
  closeEventModal();
  renderDays();
}

function handleDeleteEvent() {
  if (!_editEvent || !confirm('Delete this event?')) return;
  pushHistory();
  state.events = state.events.filter(ev => ev.id !== _editEvent.id);
  saveState();
  closeEventModal();
  renderDays();
}

// ─── Settings Modal ───────────────────────────────────────────────────────────
function openSettings() {
  document.getElementById('settingPaperDuration').value = state.settings.paperDuration;
  document.getElementById('settingStartHour').value     = state.settings.startHour;
  document.getElementById('settingEndHour').value       = state.settings.endHour;
  document.getElementById('settingSnapMinutes').value   = state.settings.snapMinutes;
  document.getElementById('settingsModal').classList.add('open');
}

function closeSettings() {
  document.getElementById('settingsModal').classList.remove('open');
}

function handleSaveSettings() {
  const pd    = parseInt(document.getElementById('settingPaperDuration').value);
  const start = parseInt(document.getElementById('settingStartHour').value);
  const end   = parseInt(document.getElementById('settingEndHour').value);
  const snap  = parseInt(document.getElementById('settingSnapMinutes').value);

  if (isNaN(pd) || pd < 5 || pd > 120) { alert('Paper duration must be 5–120 minutes.'); return; }
  if (isNaN(start) || isNaN(end) || end <= start) { alert('End hour must be after start hour.'); return; }
  if (end - start > 24) { alert('Range cannot exceed 24 hours.'); return; }

  pushHistory();
  state.settings = { paperDuration: pd, startHour: start, endHour: end, snapMinutes: snap };
  saveState();
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
      saveState();
      render();
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
  saveState();
  closeSettings();
  render();
}

function handleClearData() {
  if (!confirm('Delete all events and start with an empty schedule?')) return;
  pushHistory();
  state = createEmptyState();
  saveState();
  closeSettings();
  render();
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
  document.querySelectorAll('.day-grid').forEach(g => placeNowLine(g));
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  loadState();
  loadZoom();
  loadTheme();
  initTitleEdit();

  // Toolbar
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
    if (e.key === 'Escape') { closeEventModal(); closeSettings(); }
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
