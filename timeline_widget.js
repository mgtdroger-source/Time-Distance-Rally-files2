/*!
 * timeline_widget_v1_26.js
 * Extracted from Timeline_Shell_v0_81_soften_sg1_only_embedded_gate.html
 * Phase-1: widget-only (no storage wiring). Host owns overlay/card.
 */
(function (global) {
  'use strict';
  const TLW_VERSION = '1.26';

  const _instances = new WeakMap();
  // v1.14 — in-memory focus persistence (no localStorage)
  const _memFocus = new Map();

  let _styleInjected = false;

  function injectStylesOnce() {
    if (_styleInjected) return;
    _styleInjected = true;

    const css = `
/* Timeline Widget (scoped under .tlw-root) */
.tlw-root{ --bg:#f9fafb; --panel:#f5f5f7; --border:#d3d7df; --text:#111827; --accent:#2563eb; color:var(--text); font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
.tlw-root *{ box-sizing:border-box; }
.tlw-row{ display:flex; gap:12px; align-items:stretch; }
.tlw-panel{ background:var(--panel); border-radius:10px; border:1px solid var(--border); padding:10px 12px; }
.tlw-panel h2{ font-size:14px; margin:0 0 6px; }
.tlw-panel small{ font-size:11px; color:#6b7280; }
.tlw-panel-controls{ width:260px; flex-shrink:0; display:flex; flex-direction:column; gap:8px; }
.tlw-panel-timeline{ flex:1; min-width:0; display:flex; flex-direction:column; gap:8px; }

.tlw-delay-table{ width:100%; border-collapse:collapse; table-layout:fixed; }
.tlw-delay-table th,.tlw-delay-table td{ padding:4px 6px; text-align:left; white-space:nowrap; font-size:12px; }
.tlw-delay-table th{ font-weight:600; border-bottom:1px solid #e5e7eb; background:#f3f4f6; }
.tlw-delay-table td:first-child{ font-weight:600; }
.tlw-delay-table th:nth-child(2), .tlw-delay-table td:nth-child(2){ width:74px; }
.tlw-delay-table th:nth-child(3), .tlw-delay-table td:nth-child(3){ width:68px; text-align:center; }

.tlw-num{ text-align:center; } /* keep spinners */
.tlw-delay-input, .tlw-cars-input{ width:56px; padding:2px 6px; font-size:12px; text-align:center; display:block; margin:0; }

.tlw-focus{ line-height:1.4; margin-top:6px; padding:6px 8px; border-radius:8px; border:1px solid var(--border); background:#fff; min-height:34px; white-space:normal; font-size:11px; color:#111; font-weight:500; }
.tlw-summary{ font-size:11px; color:#374151; white-space:pre-line; }
.tlw-viewport{ position:relative; border-radius:10px; border:1px solid var(--border); background:#fff; overflow:hidden; padding:8px; }
.tlw-inner{ width:100%; min-width:100%; }
.tlw-svg{ display:block; }
.tlw-legend{ display:none; } /* hidden per v0.81 */
.tlw-scanner{ margin-top:8px; display:flex; flex-direction:column; gap:4px; }
.tlw-scanner-label{ font-size:11px; color:#4b5563; }
.tlw-range{ width:100%; }

.tlw-nav-btn{
  position:absolute; bottom:12px;
  width:32px; height:32px; border-radius:999px;
  border:1px solid #9ca3af;
  background:rgba(255,255,255,0.96);
  display:flex; align-items:center; justify-content:center;
  font-size:18px; line-height:1; cursor:pointer;
  box-shadow:0 1px 3px rgba(15,23,42,0.15);
  user-select:none;
}
.tlw-nav-btn:hover{ box-shadow:0 2px 6px rgba(15,23,42,0.25); }
.tlw-nav-btn:active{ transform:translateY(1px); }
.tlw-nav-btn.left{ left:50%; margin-left:-56px; }
.tlw-nav-btn.right{ left:50%; margin-left:24px; }

.tlw-focus-select{
  width:100%; font-size:12px;
  box-sizing:border-box;
  min-height:28px; height:28px; line-height:20px;
  padding:3px 8px;
}
`;
    const st = document.createElement('style');
    st.id = 'timeline-widget-styles';
    st.textContent = css;
    document.head.appendChild(st);
  }

  function makeTemplate(prefix) {
    // Note: IDs are prefixed to avoid collisions when multiple instances exist.
    const id = (s) => `${prefix}${s}`;
    return `
<div class="tlw-root" data-tlw-root="1">
  <div class="tlw-row">
    <div class="tlw-panel tlw-panel-controls">
      <h2>Start delays</h2>
      <small>Adjust start delay per group (minutes). Blocks move along the road.</small>

      <div style="margin-top:6px; font-size:11px;">
        <label style="display:flex; align-items:center; gap:4px;">
          <input id="${id('elasticToggle')}" type="checkbox" checked>
          Apply live delays
        </label>
      </div>

      <table class="tlw-delay-table">
        <thead><tr><th>Group</th><th>Delay (min)</th><th>Cars</th></tr></thead>
        <tbody id="${id('delayTableBody')}"></tbody>
      </table>

      <div style="margin-top:8px; font-size:11px;">
        <label style="display:flex; align-items:center; gap:4px;">
          <input id="${id('showCarsToggle')}" type="checkbox" checked>
          Show individual cars inside each group
        </label>
      </div>

      <h2 style="margin-top:10px;">Focus row</h2>
      <small>Select a row to centre the scanner on that point.</small>

      <div style="margin-top:4px;">
        <select id="${id('focusRowSelect')}" class="tlw-focus-select"></select>
      </div>

      <div class="tlw-focus" id="${id('focusInstruction')}" style="margin-top:6px;"></div>
      <div class="tlw-summary" id="${id('rowSummary')}" style="margin-top:8px;"></div>
      <div class="tlw-summary" id="${id('gapSummary')}" style="margin-top:4px;"></div>
    </div>

    <div class="tlw-panel tlw-panel-timeline">
      <h2>Distance lanes (20 km window)</h2>
      <small id="${id('laneNote')}"></small>

      <div class="tlw-viewport">
        <div class="tlw-inner">
          <svg id="${id('timelineSvg')}" class="tlw-svg" width="800" height="280"></svg>
        </div>
        <div id="${id('timelinePrevBtn')}" class="tlw-nav-btn left" title="Previous waypoint" aria-label="Previous waypoint">◀</div>
        <div id="${id('timelineNextBtn')}" class="tlw-nav-btn right" title="Next waypoint" aria-label="Next waypoint">▶</div>
      </div>

      <div id="${id('legend')}" class="tlw-legend"></div>

      <div class="tlw-scanner">
        <div id="${id('scannerLabel')}" class="tlw-scanner-label">Route scanner – initialising…</div>
        <input id="${id('routeScanner')}" class="tlw-range" type="range">

        <div id="${id('timeOffsetLabel')}" class="tlw-scanner-label" style="margin-top:6px; text-align:center;">
          Time offset around this row (–20 to +20 min): 0.0 min
        </div>
        <input id="${id('timeOffsetSlider')}" type="range" min="-20" max="20" step="0.5" value="0"
               style="width:220px; margin:4px auto 0 auto; display:block;">
      </div>
    </div>
  </div>
</div>`;
  }

  function createInstance(containerEl, opts) {
    injectStylesOnce();

    const prefix = `tlw_${Math.random().toString(36).slice(2)}_`;
    containerEl.innerHTML = makeTemplate(prefix);

    const root = containerEl.querySelector('[data-tlw-root="1"]');

    const rallyId = (opts && opts.rallyId) ? String(opts.rallyId) : '';
    const dayKey  = (opts && opts.dayKey != null) ? String(opts.dayKey) : '1';

    // Day start clock (host-owned). Admin stores HH:MM:SS; widget displays A/D as dayStart + elapsed.
    let _dayStartStr = (opts && (opts.dayStart || opts.startTime)) ? String(opts.dayStart || opts.startTime) : '00:00:00';
    let _dayStartMin = 0; // computed after parseTime is available

    const q = (id) => root.querySelector('#' + prefix + id);
    let _booting = true;

    const memKey = String((opts && opts.rallyId) || rallyId || 'demo') + '|' + String((opts && opts.dayKey) || dayKey || '1');
    const _memGet = ()=> _memFocus.get(memKey) || null;
    const _memSet = (st)=> { try{ _memFocus.set(memKey, st); }catch(_e){} };

    function persistMemFocus(){
      try{
        const st = _memGet() || {};
        const idx = (focusSelect && !focusSelect.disabled) ? clampInt(focusSelect.value, 0, Math.max(0, hostRows.length-1)) : (st.focusIdx ?? 0);
        const scanner = q('routeScanner');
        const sc = scanner ? parseFloat(scanner.value) : (st.scannerPosKm ?? NaN);
        st.focusIdx = idx;
        if (Number.isFinite(sc)) st.scannerPosKm = sc;
        if (Number.isFinite(windowCenterKm)) st.windowCenterKm = windowCenterKm;
        if (Number.isFinite(timeOffsetMin)) st.timeOffsetMin = timeOffsetMin;
        _memSet(st);
      }catch(_e){}
    }

    function restoreMemFocus(){
      const st = _memGet();
      if (!st) return;
      try{
        if (focusSelect && !focusSelect.disabled && hostRows.length){
          const idx = clampInt(st.focusIdx, 0, hostRows.length-1);
          focusSelect.value = String(idx);
        }
      }catch(_e){}
      try{
        const scanner = q('routeScanner');
        if (scanner && Number.isFinite(st.scannerPosKm)) scanner.value = String(st.scannerPosKm);
        if (Number.isFinite(st.windowCenterKm)) windowCenterKm = st.windowCenterKm;
      }catch(_e){}
      try{
        if (Number.isFinite(st.timeOffsetMin)) timeOffsetMin = st.timeOffsetMin;
      }catch(_e){}
    }



    const ALL_GROUPS = ['SG1', 'SG2', 'SG3', 'SG4'];

    // Enabled lanes (host-controlled). SG1 + SG2 are always present; SG3/SG4 are optional.
    let _enabled = { SG3: true, SG4: true };
    function getEnabledGroups(){
      const out = ['SG1','SG2'];
      if (_enabled.SG3) out.push('SG3');
      if (_enabled.SG4) out.push('SG4');
      return out;
    }

    // Renderer colours — keyed by SG name
    // NOTE: Train dots (cars) use strokeCol + white surround; keep that logic unchanged.
    const groupStroke = { SG1:'#6d28d9', SG2:'#c58a00', SG3:'#3b82f6', SG4:'#58b879' };
    const groupStrokeOpacity = { SG1:0.75, SG2:1, SG3:1, SG4:1 };
    const groupFill   = { SG1:'#7c3aed', SG2:'#fff8cc', SG3:'#eaf2ff', SG4:'#eaf9ee' };
    const groupFillOpacity   = { SG1:0.15, SG2:1, SG3:1, SG4:1 };

    // Widget-owned controls/state
    const groupMeta = {
      SG1:{ delayMin:0, cars:5, intervalMin:1, allocCars:null },
      SG2:{ delayMin:0, cars:5, intervalMin:1, allocCars:null },
      SG3:{ delayMin:0, cars:5, intervalMin:1, allocCars:null },
      SG4:{ delayMin:0, cars:5, intervalMin:1, allocCars:null }
    };


    // ---- Persist (DISABLED) ----
    // v1.16: The widget is READ-ONLY with respect to TD_RALLIES.
    // The host page (Schedule) is the single writer. The widget may still update its in-memory UI state.
    function schedulePersistStartDelays(){
      /* no-op (host-owned persistence) */
    }
    function persistStartDelaysNow(){
      /* no-op (host-owned persistence) */
    }

    // ---- TD_RALLIES (read-only) wiring ----
    function safeJsonParse(str){
      try { return JSON.parse(str); } catch(e){ return null; }
    }
    function readTdRallies(){
      const raw = localStorage.getItem('TD_RALLIES');
      if (!raw) return null;
      return safeJsonParse(raw);
    }
    function resolveRallyObj(td){
      if (!td || !td.rallies) return null;
      if (rallyId && td.rallies[rallyId]) return td.rallies[rallyId];
      const keys = Object.keys(td.rallies);
      if (keys.length === 1) return td.rallies[keys[0]];
      return null;
    }

    function resolveRallyEntry(td){
      if (!td || !td.rallies) return null;
      if (rallyId && td.rallies[rallyId]) return { id: rallyId, rally: td.rallies[rallyId] };
      const keys = Object.keys(td.rallies);
      if (keys.length === 1) return { id: keys[0], rally: td.rallies[keys[0]] };
      return null;
    }
    function clampSpeed6_120(v){
      const n = Number(v);
      if (!Number.isFinite(n)) return null;
      return Math.max(6, Math.min(120, Math.round(n)));
    }
    function applyExternalFromStorage(){
      const td = readTdRallies();
      const rally = resolveRallyObj(td);
      if (!rally) return;

      // A) Entrants -> allocCars (group label allocation ONLY; does NOT touch Cars inputs)
      const entrants = rally.timeline && rally.timeline.entrants;
      if (entrants) {
        const map = { '1':'SG1', '2':'SG2', '3':'SG3', '4':'SG4' };
        Object.keys(map).forEach(k=>{
          const v = Number(entrants[k]);
          if (Number.isFinite(v) && v >= 0) {
            groupMeta[map[k]].allocCars = Math.max(0, Math.min(99, Math.round(v)));
          }
        });
      }

      // A2) Timeline inputs (Delay/Cars) -> groupMeta (drives the UI table)
      const tl = rally.timeline || {};
      const dayTl = (tl.days && tl.days[dayKey]) ? tl.days[dayKey] : null;
      const delaySrc = (dayTl && dayTl.startDelays) ? dayTl.startDelays : (tl.delays || tl.delay || tl.delayMin || tl.startDelayMin) || null;
      const carsSrc  = (tl.cars || tl.carCounts || tl.carsByGroup) || null;
      if (delaySrc || carsSrc) {
        const map = { '1':'SG1', '2':'SG2', '3':'SG3', '4':'SG4' };
        Object.keys(map).forEach(k=>{
          const g = map[k];
          if (delaySrc && delaySrc[k] != null) {
            const d = Number(delaySrc[k]);
            if (Number.isFinite(d) && d >= 0) groupMeta[g].delayMin = Math.max(0, Math.min(999, Math.round(d)));
          }
          if (carsSrc && carsSrc[k] != null) {
            const c = Number(carsSrc[k]);
            if (Number.isFinite(c) && c >= 0) groupMeta[g].cars = Math.max(0, Math.min(99, Math.round(c)));
          }
        });
      }

      // v0.90 ensure widget-owned UI always refreshes after applying external state
      try{ buildDelayCarsRows(); }catch(e){}// B) Shared SG max speeds -> display only (labels). Timing uses schedule snapshot row speeds.

      // C) Schedule rows -> hostRows (Stage 1 wiring: id,rowNo,type,dist,instr only)
      const sched = rally.schedule && rally.schedule.days && rally.schedule.days[dayKey] && rally.schedule.days[dayKey].rows;
      if (Array.isArray(sched)) {
        hostRows = sched.map(r => ({
  id: r.id,
  rowNo: r.rowNo,
  type: r.type,
  dist: Number(r.dist),
  distKm: Number(r.dist),
  label: r.type,
  instruction: r.instr || '',
  instr: r.instr || '',
  // per-row speeds for timing engine: prefer rowSpeedsById, else per-row sgSpeeds
  speeds: (function(){
    const byId = rally.schedule && rally.schedule.days && rally.schedule.days[dayKey] && rally.schedule.days[dayKey].rowSpeedsById;
    const src = (byId && r.id && byId[r.id]) ? byId[r.id] : (r.sgSpeeds || r.speeds || null);
    if (!src) return null;
    // normalise to SG keys
    return {
      SG1: (src.SG1!=null?src.SG1:src['1']),
      SG2: (src.SG2!=null?src.SG2:src['2']),
      SG3: (src.SG3!=null?src.SG3:src['3']),
      SG4: (src.SG4!=null?src.SG4:src['4'])
    };
  })(),
  // added time seconds (one-leg only): allow atSec, or atSecBySg with numeric keys
  atSec: (r.atSec != null ? Number(r.atSec) : null),
  atSecBySg: (r.atSecBySg || null),
  atLabel: (r.atLabel != null ? String(r.atLabel) : '')
}));
        hostRows = sanitizeRowsByDist_(hostRows);
        buildFocusSelect();
        updateFocusSummary();
        if(!_booting){ renderTimeline(); }
      }

      const speeds = rally.shared && rally.shared.sg && rally.shared.sg.speeds;
      if (speeds) {
        const map = { '1':'SG1', '2':'SG2', '3':'SG3', '4':'SG4' };
        Object.keys(map).forEach(k=>{
          const clamped = clampSpeed6_120(speeds[k]);
          if (clamped != null) displaySpeedByGroup[map[k]] = clamped;
        });
      }
      try{ syncIntervalFromAdmin(); }catch(e){}
    }
    // ----


    let hostRows = []; // schedule snapshot from host
    let hasAnyTimes = false; // true if any row carries real times

    // DOM
    const delayTableBody = q('delayTableBody');
    const focusSelect    = q('focusRowSelect');
    const focusInstr     = q('focusInstruction');
    const rowSummary     = q('rowSummary');
    const gapSummary     = q('gapSummary');
    const svg            = q('timelineSvg');
    const btnPrev        = q('timelinePrevBtn');
    const btnNext        = q('timelineNextBtn');

    // --- Utilities ---
    function clampInt(n, lo, hi){
      n = Number.isFinite(+n) ? Math.trunc(+n) : lo;
      if (n < lo) n = lo;
      if (n > hi) n = hi;
      return n;
    }
function sanitizeRowsByDist_(rows){
  // Ensure distKm is numeric + non-decreasing to avoid NaN/negative SVG positions.
  // Strategy: invalid dist -> previous valid (or 0 for first); enforce monotonic non-decreasing.
  if (!Array.isArray(rows)) return [];
  let last = 0;
  return rows.map((r, i)=>{
    const out = r || {};
    let d = Number(out.distKm);
    if (!Number.isFinite(d)) d = Number(out.dist);
    if (!Number.isFinite(d)) d = last;
    if (!Number.isFinite(d)) d = 0;
    if (i === 0 && d < 0) d = 0;
    if (d < last) d = last;
    out.distKm = d;
    out.dist = d;
    last = d;
    return out;
  });
}
function syncIntervalFromAdmin(){
  // Admin-owned "incMin" (minutes between cars) -> applies to all groups for spacing.
  // Widget is read-only; this only updates in-memory intervalMin used for rendering car gaps.
  const td = readTdRallies();
  const rally = resolveRallyObj(td);
  if (!rally) return;
  const days = rally.admin && rally.admin.days;
  if (!days) return;
  const dkNum = String(parseInt(dayKey, 10));
  const dayObj = days[dayKey] || days[dkNum];
  const inc = Number(dayObj && dayObj.incMin);
  if (!Number.isFinite(inc)) return;
  const v = Math.max(1, Math.min(99, Math.round(inc)));
  ALL_GROUPS.forEach(g=>{ groupMeta[g].intervalMin = v; });
}

    function displayType(type){
      const t = (type != null) ? String(type).trim() : '';
      if (!t) return '';
      if (t === 'INSTRUCTION') return 'INST';
      return t;
    }
    function getRowLabel(r){
      const km = (typeof r.dist === 'number') ? r.dist.toFixed(1) : '—';
      const rn = (r && (r.rowNo != null)) ? r.rowNo : (r && (r.idx != null) ? r.idx : '');
      const typeTxt = displayType(r && r.type) || '—';

      const instrFull = (r && r.instr != null) ? String(r.instr).trim() : '';
      let snippet = '';
      if (instrFull){
        const words = instrFull.split(/\s+/).filter(Boolean);
        snippet = words.slice(0, 5).join(' ');
        if (words.length > 5) snippet += '…';
      }

      return `${rn} - ${km} - ${typeTxt}${snippet ? ' - ' + snippet : ''}`.trim();
    }
    function parseTime(str){
      const s = String(str || '').trim();
      const parts = s.split(':').map(n => Number(n));
      const hh = Number.isFinite(parts[0]) ? parts[0] : 0;
      const mm = Number.isFinite(parts[1]) ? parts[1] : 0;
      const ss = Number.isFinite(parts[2]) ? parts[2] : 0;
      return (hh * 60) + mm + (ss / 60);
    }
    function formatTime(totalMinutes){
      let totalSec = Math.round((Number(totalMinutes) || 0) * 60);
      if (!Number.isFinite(totalSec)) totalSec = 0;
      if (totalSec < 0) totalSec = 0;
      const hh = Math.floor(totalSec / 3600);
      const rem = totalSec % 3600;
      const mm = Math.floor(rem / 60);
      const ss = rem % 60;
      return String(hh).padStart(2,'0') + ':' + String(mm).padStart(2,'0') + ':' + String(ss).padStart(2,'0');
    }

    function setDayStartClock(str){
      _dayStartStr = String(str || '').trim() || '00:00:00';
      _dayStartMin = parseTime(_dayStartStr);
      renderTimeline();
      updateFocusSummary();
    }

    function formatClock(elapsedMinutes){
      return formatTime(_dayStartMin + (Number(elapsedMinutes) || 0));
    }

    // Initialize day start clock now that parseTime exists
    _dayStartMin = parseTime(_dayStartStr);

    // --- Delay / Cars table ---
    function buildDelayCarsRows(){
      // Instruction-only mode: if we have no timing data, keep UI but disable time-dependent controls.
      if (!delayTableBody) return;
      delayTableBody.innerHTML = '';

      getEnabledGroups().forEach(g => {
        const tr = document.createElement('tr');

        const tdG = document.createElement('td');
        tdG.style.fontWeight = '600';
        tdG.style.fontSize = '12px';
        tdG.textContent = g + (Number.isFinite(groupMeta[g].allocCars) ? ` - ${groupMeta[g].allocCars}` : '');
        tr.appendChild(tdG);

        const tdD = document.createElement('td');
        const inpD = document.createElement('input');
        inpD.className = 'tlw-num tlw-delay-input';
        inpD.type = 'number';
        inpD.min = '0';
        inpD.max = '999';
        inpD.step = '1';
        inpD.value = String(groupMeta[g].delayMin ?? 0);
        const onDelay = () => {
          groupMeta[g].delayMin = clampInt(inpD.value, 0, 999);
          inpD.value = String(groupMeta[g].delayMin);
          renderTimeline();
          updateFocusSummary();
        };
        inpD.addEventListener('input', onDelay);
        // v1.16: persistence is host-owned (no widget writes)
        // inpD.addEventListener('blur', schedulePersistStartDelays);
        tdD.appendChild(inpD);
        tr.appendChild(tdD);

        const tdC = document.createElement('td');
        const inpC = document.createElement('input');
        inpC.className = 'tlw-num tlw-cars-input';
        inpC.type = 'number';
        inpC.min = '0';
        inpC.max = '99';
        inpC.step = '1';
        inpC.value = String(groupMeta[g].cars ?? 5);
        const onCars = () => {
          groupMeta[g].cars = clampInt(inpC.value, 0, 99);
          inpC.value = String(groupMeta[g].cars);
          renderTimeline();
          updateFocusSummary();
        };
        inpC.addEventListener('input', onCars);
        tdC.appendChild(inpC);
        tr.appendChild(tdC);

        delayTableBody.appendChild(tr);
      });
    }

    // --- Focus list + summary ---
    function buildFocusSelect(){
      if (!focusSelect) return;
      focusSelect.innerHTML = '';

      if (!hostRows.length){
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '— no schedule loaded —';
        focusSelect.appendChild(opt);
        focusSelect.disabled = true;
        if (focusInstr) focusInstr.textContent = '';
        if (rowSummary) rowSummary.textContent = '';
        if (gapSummary) gapSummary.textContent = '';
        return;
      }

      focusSelect.disabled = false;
      hostRows.forEach((r, i)=>{
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = getRowLabel(r);
        focusSelect.appendChild(opt);
      });
      focusSelect.value = '0';
    }

    function updateFocusSummary(){
      if (!hostRows.length || !focusSelect || focusSelect.disabled) return;
      const idx = clampInt(focusSelect.value, 0, hostRows.length-1);
      const row = hostRows[idx] || {};
      if (focusInstr) {
        const dt = displayType(row.type);
        const instr = (row.instr != null) ? String(row.instr).trim() : '';
        if (dt) {
          focusInstr.textContent = instr ? `${dt} ${instr}` : dt;
        } else {
          focusInstr.textContent = instr;
        }
      }
      if (!rowSummary) return;

      const km = (typeof row.dist === 'number') ? row.dist.toFixed(1) : '—';
      const lines = [];
      lines.push(`Selected point – ${km} km`);
      lines.push(`ETAs at selected point`);
      getEnabledGroups().forEach(g=>{
        const t = row.times && row.times[g] ? row.times[g] : '—';
        const d = groupMeta[g].delayMin ? ` (+${groupMeta[g].delayMin}m)` : '';
        lines.push(`${g}: ${t}${d}`);
      });
      rowSummary.textContent = lines.join('\n');
    }

    // --- Renderer core (from v0.81, adapted to scoped DOM) ---
    const speedKmhByGroup = { SG1: 90, SG2: 80, SG3: 70, SG4: 60 };
    // Display-only max speed per group (from Admin stub / TD_RALLIES); does NOT drive timing maths
    const displaySpeedByGroup = { SG1: 90, SG2: 80, SG3: 70, SG4: 60 };

    function updateLaneNote(){
      const el = q('laneNote');
      if (!el) return;
      const parts = getEnabledGroups().map(g=>{
        const sp = displaySpeedByGroup[g];
        return (Number.isFinite(sp) && sp>0) ? `${g} (${sp})` : g;
      });
      el.textContent = parts.join(', ');
    }



    let elasticEnabled = true;
    let showCars = true;
    let timeOffsetMin = 0;

    let groupStats = {};

    let windowCenterKm = NaN;
    let scannerPosKm = NaN;
    let _lastFocusIdxForWindow = null;
    const windowWidthKm = 20;
    const scannerConfig = { enabled: false, min: 0, max: 0 };

    let _rendererWired = false;

    function getFocusIdx(){
      if (!hostRows.length) return 0;
      if (!focusSelect || focusSelect.disabled) return 0;
      return clampInt(focusSelect.value, 0, hostRows.length - 1);
    }
    function getFocusRow(){
      const rows = Array.isArray(hostRows) ? hostRows : [];
      if (!rows.length) return null;
      let i = getFocusIdx();
      if (!Number.isFinite(i)) i = 0;
      i = Math.max(0, Math.min(rows.length - 1, i));
      return rows[i] || rows[0] || null;
    }
    function getSpeedForGroupAtFocus(group){
      const fallback = speedKmhByGroup[group] || 60;
      const row = getFocusRow();
      if (!row || !row.speeds) return fallback;
      const raw = row.speeds[group];
      const v = Number(raw);
      return Number.isFinite(v) && v > 0 ? v : fallback;
    }

    function computeGroupStats(){
      groupStats = {};
      getEnabledGroups().forEach(g => {
        const speedKmh = getSpeedForGroupAtFocus(g);
        let vKmPerMin = speedKmh / 60;
        if (!Number.isFinite(vKmPerMin) || vKmPerMin <= 0) vKmPerMin = 1;

        const meta = groupMeta[g] || {};
        const cars = meta.cars || 5;
        const intervalMin = meta.intervalMin || 1;

        let lengthKm = Math.max(0, (cars - 1)) * intervalMin * vKmPerMin;
        if (!Number.isFinite(lengthKm) || lengthKm < 0) lengthKm = 0;

        groupStats[g] = { avgKmPerMin: vKmPerMin, trainLengthKm: lengthKm, cars, intervalMin };
      });
    }


// --- Schedule timing engine (dist + per-row speeds + one-leg ADDED_TIME) ---
function _getAddedSecForRow(row, sg){
  if (!row) return 0;
  // Prefer per-SG if present, else fall back to single atSec applied to all groups.
  if (row.atSecBySg) {
    const key = (sg === 'SG1') ? '1' : (sg === 'SG2') ? '2' : (sg === 'SG3') ? '3' : '4';
    const v = row.atSecBySg[key];
    const n = Number(v);
    if (Number.isFinite(n)) return Math.max(0, Math.round(n));
  }
  const n = Number(row.atSec);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function _getSpeedForRow(row, sg){
  if (!row || !row.speeds) return null;
  const v = Number(row.speeds[sg]);
  return Number.isFinite(v) && v > 0 ? v : null;
}

function _computeRowTimesFromInputs(){
  // Computes row.times[SGn] for all rows using:
  // time[i] = time[i-1] + legTime(prevRowSpeed, dist[i]-dist[i-1]) + (addedTimeOnPrevRow)
  // Added time applies ONE-LEG ONLY (from AddedTime row to next row).
  // START_STC rows are ignored for timeline timing (treated as markers only).
  const rows = Array.isArray(hostRows) ? hostRows : [];
  if (rows.length === 0) { hasAnyTimes = false; return; }

  const sgs = ['SG1','SG2','SG3','SG4'];

  // Validate distances & monotonicity
  for (let i=0;i<rows.length;i++){
    const d = Number(rows[i].distKm);
    if (!Number.isFinite(d)) { hasAnyTimes = false; return; }
    if (i>0 && d < Number(rows[i-1].distKm) - 1e-9) { hasAnyTimes = false; return; }
  }

  // We need a usable speed on row 0 for each SG (departure speed).
  const speed0Ok = sgs.every(sg => _getSpeedForRow(rows[0], sg) != null);
  if (!speed0Ok) { hasAnyTimes = false; return; }

  // running seconds per SG
  const tSec = { SG1:0, SG2:0, SG3:0, SG4:0 };

  // init row 0
  rows[0].times = rows[0].times || {};
  sgs.forEach(sg => { rows[0].times[sg] = '00:00:00'; });

  for (let i=1;i<rows.length;i++){
    const prev = rows[i-1];
    const cur  = rows[i];

    const d0 = Number(prev.distKm);
    const d1 = Number(cur.distKm);
    const dd = d1 - d0;

    cur.times = cur.times || {};

    sgs.forEach(sg=>{
      const sp = _getSpeedForRow(prev, sg);
      if (sp == null || sp <= 0) { hasAnyTimes = false; return; }

      // leg seconds from prev->cur using prev speed
      const legSec = Math.round((dd / sp) * 3600);

      // one-leg added time from prev row if it is ADDED_TIME
      const addSec = (String(prev.type||'') === 'ADDED_TIME') ? _getAddedSecForRow(prev, sg) : 0;

      tSec[sg] = Math.max(0, tSec[sg] + Math.max(0, legSec) + addSec);
      cur.times[sg] = formatTime(tSec[sg] / 60);
    });
  }

  hasAnyTimes = true;
}
// ---

    function computePositionsForRow(rowIndex){
      const rows = hostRows;
      const row = rows[rowIndex];
      const totalDistKm = rows[rows.length - 1].distKm;
      if (!hasAnyTimes){
        const dist = Number.isFinite(row.distKm) ? row.distKm : 0;
        const total = Number.isFinite(totalDistKm) ? totalDistKm : dist;
        const positions = getEnabledGroups().map(g => {
          const len = (groupStats[g] && Number.isFinite(groupStats[g].trainLengthKm)) ? groupStats[g].trainLengthKm : 0;
          const startKm = Math.max(0, dist - len);
          return { group: g, timeMin: 0, frontKm: dist, startKm, endKm: dist };
        });
        const centreKm = dist;
        const half = windowWidthKm / 2;
        let viewMinKm = centreKm - half;
        let viewMaxKm = centreKm + half;
        if (total <= windowWidthKm){
          viewMinKm = 0;
          viewMaxKm = total;
        } else {
          if (viewMinKm < 0){
            viewMinKm = 0;
            viewMaxKm = windowWidthKm;
          } else if (viewMaxKm > total){
            viewMaxKm = total;
            viewMinKm = total - windowWidthKm;
          }
        }
        return { row, positions, totalDistKm: total, viewMinKm, viewMaxKm };
      }
      const baseTimes = getEnabledGroups().map(g => {
        const base = parseTime((row.times||{})[g]);
        return { group: g, baseMin: base };
      });

      // --- Absolute carStart clock (slowFirst) ---
      // SG4 is slowest; enabled groups release slowest -> fastest. Disabled groups (cars=0) are skipped.
      const enabledOrder = getEnabledGroups().slice().reverse().filter(g => (groupMeta[g]?.cars ?? 0) > 0);

      // Base first-car start times from cars * interval chain (minutes)
      const startDelayByGroup = {};
      let cursorMin = 0;
      enabledOrder.forEach(g=>{
        startDelayByGroup[g] = cursorMin;
        const cars = clampInt(groupMeta[g]?.cars ?? 0, 0, 99);
        const interval = Math.max(0, Number(groupMeta[g]?.intervalMin ?? 1) || 1);
        cursorMin += cars * interval;
      });

      // Apply user trims (StartDelays) if elastic is enabled
      if (elasticEnabled){
        enabledOrder.forEach(g=>{
          startDelayByGroup[g] += clampInt(groupMeta[g]?.delayMin ?? 0, 0, 999);
        });
      }

      // Convert elapsed row times -> absolute arrival times (minutes since rally start)
      const absTimes = baseTimes.map(entry => ({
        group: entry.group,
        absMin: entry.baseMin + (startDelayByGroup[entry.group] || 0)
      }));

      // Shell-style time offset projection (scanner)
      const tRef = Math.min.apply(null, absTimes.map(t => t.absMin));
      const tRefOffset = tRef + timeOffsetMin;

      const positions = absTimes.map(entry => {
        const stats = groupStats[entry.group] || { avgKmPerMin: 1, trainLengthKm: 0 };

        const dt = entry.absMin - tRefOffset; // minutes from scan time
        let frontKm = row.distKm - stats.avgKmPerMin * dt;

        if (!Number.isFinite(frontKm)) frontKm = row.distKm;
        if (frontKm < 0) frontKm = 0;
        if (frontKm > totalDistKm) frontKm = totalDistKm;

        const lengthKm = stats.trainLengthKm || 0;
        let startKm = frontKm - lengthKm;
        if (startKm < 0) startKm = 0;

        return { group: entry.group, timeMin: entry.absMin, frontKm, startKm, endKm: frontKm };
      });

      const last = rows[rows.length - 1];
      const total = last.distKm;

      let centreKm = windowCenterKm;
      if (!Number.isFinite(centreKm)) centreKm = row.distKm;

      const half = windowWidthKm / 2;
      let viewMinKm = centreKm - half;
      let viewMaxKm = centreKm + half;

      if (total <= windowWidthKm){
        viewMinKm = 0;
        viewMaxKm = total;
      } else {
        if (viewMinKm < 0){
          viewMinKm = 0;
          viewMaxKm = windowWidthKm;
        } else if (viewMaxKm > total){
          viewMaxKm = total;
          viewMinKm = total - windowWidthKm;
        }
      }

      return { row, positions, totalDistKm, viewMinKm, viewMaxKm };

    }

    function updateSummaries(positions, row){
      if (!row || !positions || !positions.length){
        if (rowSummary) rowSummary.textContent = '';
        if (gapSummary) gapSummary.textContent = '';
        return;
      }

      const byTime = [...positions].sort((a,b) => a.timeMin - b.timeMin);
      const lines = [];
      for (let i = 0; i < byTime.length; i += 2) {
        const left = byTime[i];
        const right = byTime[i + 1];
        if (right) {
          lines.push(`${left.group}: ${formatClock(left.timeMin)}    ${right.group}: ${formatClock(right.timeMin)}`);
        } else {
          lines.push(`${left.group}: ${formatClock(left.timeMin)}`);
        }
      }
      if (rowSummary){
        rowSummary.innerHTML = `Selected point – ${row.dist.toFixed(1)} km\nETAs at selected point\n${lines.join('\n')}`;
      }
      if (gapSummary) gapSummary.textContent = '';
    }

    function setupScanner(){
      const scanner = q('routeScanner');
      const label = q('scannerLabel');
      const rows = Array.isArray(hostRows) ? hostRows : [];

      if (!scanner || !label) return;

      if (!rows.length){
        scanner.disabled = true;
        scannerConfig.enabled = false;
        windowCenterKm = 0;
        label.textContent = 'Route scanner – no schedule loaded yet.';
        return;
      }

      const last = rows[rows.length - 1];
      const total = (last && Number.isFinite(last.distKm)) ? last.distKm : 0;

      if (total <= windowWidthKm){
        // Keep scanner alive even for short stages so panning/focus linkage still feels responsive.
        scanner.disabled = false;
        scannerConfig.enabled = true;
        scannerConfig.minCenterKm = 0;
        scannerConfig.maxCenterKm = total;
        windowCenterKm = total / 2;
        label.textContent = `Route scanner – stage is ${total.toFixed(1)} km (shorter than 20 km), full route is shown.`;
        // continue to configure scanner range below
      }

      const half = windowWidthKm / 2;
      if (total > windowWidthKm) {
        scannerConfig.minCenterKm = half;
        scannerConfig.maxCenterKm = total - half;
        scannerConfig.enabled = true;
      }

      scanner.disabled = false;
      scanner.min = 0;
      scanner.max = total;
      scanner.step = 0.1;

      const focusRow = getFocusRow() || rows[0];
      const focusIdx = getFocusIdx();

      if (_lastFocusIdxForWindow !== focusIdx) {
        _lastFocusIdxForWindow = focusIdx;
        scannerPosKm = (focusRow && Number.isFinite(focusRow.distKm)) ? focusRow.distKm : 0;
      } else {
        if (!Number.isFinite(scannerPosKm)) scannerPosKm = (Number.isFinite(windowCenterKm) ? windowCenterKm : 0);
      }

      if (!Number.isFinite(windowCenterKm)) windowCenterKm = scannerPosKm;
      windowCenterKm = Math.min(Math.max(scannerPosKm, scannerConfig.minCenterKm), scannerConfig.maxCenterKm);

      scanner.value = String(scannerPosKm);
      label.textContent = `Route scanner – position: ${scannerPosKm.toFixed(1)} km (centre ${windowCenterKm.toFixed(1)} of ${total.toFixed(1)} km)`;

      if (!scanner._tlWired) {
        scanner._tlWired = true;
        scanner.addEventListener('input', () => {
          if (!scannerConfig.enabled) return;
          const v = parseFloat(scanner.value);
          if (!Number.isFinite(v)) return;
          scannerPosKm = v;
          windowCenterKm = Math.min(Math.max(v, scannerConfig.minCenterKm), scannerConfig.maxCenterKm);
          label.textContent = `Route scanner – position: ${scannerPosKm.toFixed(1)} km (centre ${windowCenterKm.toFixed(1)} of ${total.toFixed(1)} km)`;
          renderTimeline();
          persistMemFocus();
        });
      }
    }

    function wireRendererControlsOnce(){
      if (_rendererWired) return;
      _rendererWired = true;

      const show = q('showCarsToggle');
      if (show) {
        showCars = !!show.checked;
        show.addEventListener('change', ()=>{ showCars = !!show.checked; renderTimeline(); });
      }

      const elastic = q('elasticToggle');
      if (elastic) {
        elasticEnabled = !!elastic.checked;
        elastic.addEventListener('change', ()=>{ elasticEnabled = !!elastic.checked; renderTimeline(); updateFocusSummary(); });
      }

      const slider = q('timeOffsetSlider');
      const label = q('timeOffsetLabel');
      if (slider && label) {
        const upd = ()=>{ label.textContent = `Time offset around this row (–20 to +20 min): ${timeOffsetMin.toFixed(1)} min`; };
        timeOffsetMin = parseFloat(slider.value) || 0;
        try{ slider.value = String(Math.max(-20, Math.min(20, Number(timeOffsetMin)||0))); }catch(_e){}
        upd();
        slider.addEventListener('input', ()=>{ timeOffsetMin = parseFloat(slider.value) || 0; upd(); renderTimeline(); persistMemFocus(); });
      }

      // Resize handler scoped per instance
      const onResize = () => renderTimeline();
      window.addEventListener('resize', onResize);
      instance._cleanup.push(() => window.removeEventListener('resize', onResize));
    }

    function renderTimeline(){
      wireRendererControlsOnce();
      try{ syncIntervalFromAdmin(); }catch(e){}
      updateLaneNote();
      computeGroupStats();
      setupScanner();
      // If host did not provide times, compute them from dist+speeds+added-time.
      if (!hasAnyTimes) { try { _computeRowTimesFromInputs(); } catch(e){} }

      while (svg.firstChild) svg.removeChild(svg.firstChild);

      const rows = Array.isArray(hostRows) ? hostRows : [];
      let rowIndex = getFocusIdx();

      if (!rows.length){
        if (focusInstr) focusInstr.textContent = '';
        if (rowSummary) rowSummary.textContent = '';
        if (gapSummary) gapSummary.textContent = '';
        return;
      }
      if (!Number.isFinite(rowIndex)) rowIndex = 0;
      rowIndex = Math.max(0, Math.min(rows.length - 1, rowIndex));

      const { row, positions, viewMinKm, viewMaxKm } = computePositionsForRow(rowIndex);

      const viewport = root.querySelector('.tlw-viewport');
      let viewportWidth = viewport ? viewport.clientWidth : 800;
      if (viewportWidth < 400) viewportWidth = 400;

      const innerPadding = 16;
      const drawingWidth = Math.max(500, viewportWidth - innerPadding);

      const leftMargin = 70;
      const rightMargin = 30;
      const laneSpacing = 55;
      const topMargin = 50;

      const kmSpan = Math.max(1, viewMaxKm - viewMinKm);
      const pxPerKm = (drawingWidth - leftMargin - rightMargin) / kmSpan;

      const width = drawingWidth;
      const height = topMargin + laneSpacing * getEnabledGroups().length + 60;

      svg.setAttribute('width', width);
      svg.setAttribute('height', height);
      svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);

      const NS = 'http://www.w3.org/2000/svg';
      const laneY = gIndex => topMargin + laneSpacing * gIndex;
      const distToX = d => leftMargin + (d - viewMinKm) * pxPerKm;

      function line(x1,y1,x2,y2,opts={}){
        const el = document.createElementNS(NS,'line');
        el.setAttribute('x1', x1);
        el.setAttribute('y1', y1);
        el.setAttribute('x2', x2);
        el.setAttribute('y2', y2);
        if (opts.stroke) el.setAttribute('stroke', opts.stroke);
        if (opts.strokeWidth) el.setAttribute('stroke-width', opts.strokeWidth);
        if (opts.dash) el.setAttribute('stroke-dasharray', opts.dash);
        svg.appendChild(el);
        return el;
      }
      function text(x,y,txt,opts={}){
        const el = document.createElementNS(NS,'text');
        el.setAttribute('x', x);
        el.setAttribute('y', y);
        el.textContent = txt;
        el.setAttribute('font-size', opts.size || 10);
        el.setAttribute('fill', opts.fill || '#374151');
        if (opts.weight) el.setAttribute('font-weight', opts.weight);
        if (opts.anchor) el.setAttribute('text-anchor', opts.anchor);
        svg.appendChild(el);
        return el;
      }
      function rect(x,y,w,h,opts={}){
        const el = document.createElementNS(NS,'rect');
        el.setAttribute('x', x);
        el.setAttribute('y', y);
        el.setAttribute('width', w);
        el.setAttribute('height', h);
        el.setAttribute('rx', opts.rx || 8);
        if (opts.fill) el.setAttribute('fill', opts.fill);
        if (opts.fillOpacity != null) el.setAttribute('fill-opacity', opts.fillOpacity);
        if (opts.stroke) el.setAttribute('stroke', opts.stroke);
        if (opts.strokeWidth) el.setAttribute('stroke-width', opts.strokeWidth);
        if (opts.strokeOpacity != null) el.setAttribute('stroke-opacity', opts.strokeOpacity);
        svg.appendChild(el);
        return el;
      }
      function circle(x,y,r,opts={}){
        const el = document.createElementNS(NS,'circle');
        el.setAttribute('cx', x);
        el.setAttribute('cy', y);
        el.setAttribute('r', r);
        if (opts.fill) el.setAttribute('fill', opts.fill);
        if (opts.stroke) el.setAttribute('stroke', opts.stroke);
        if (opts.strokeWidth) el.setAttribute('stroke-width', opts.strokeWidth);
        svg.appendChild(el);
        return el;
      }

      const gridTop = topMargin - 30;
      const gridBottom = height - 50;

      const firstTick = Math.ceil(viewMinKm / 5) * 5;
      for (let d = firstTick; d <= viewMaxKm + 0.001; d += 5){
        const x = distToX(d);
        line(x, gridTop, x, gridBottom, { stroke:'#e5e7eb', strokeWidth:1 });
        text(x, gridBottom + 14, d.toFixed(0) + ' km', { anchor:'middle', size:9, fill:'#6b7280' });
      }
      text(width - 10, gridBottom + 28, 'Distance along route (km)', { anchor:'end', size:10, fill:'#6b7280' });

      getEnabledGroups().forEach((g, i) => {
        const y = laneY(i);
        line(distToX(viewMinKm), y, distToX(viewMaxKm), y, { stroke:'#e5e7eb', strokeWidth:1 });
        const speed = getSpeedForGroupAtFocus(g);
        const speedTxt = (Number.isFinite(speed) && speed > 0) ? String(Math.round(speed)) : '';
        const label = speedTxt ? `${g} · ${speedTxt}` : g;
        text(12, y + 3, label, { size:12, fill:'#111827', weight:'600' });
      });

      function markerStyleForRow(r){
        const type = String((r && r.type) || '').toUpperCase();
        const name = String((r && (r.label || r.type)) || '').trim();
        let stroke = '#9ca3af', strokeWidth = 1, dash = '3 3', textFill = '#374151';

        // Type-first classification (label is fallback only when type is missing/unknown)
        if (type === 'MARSHAL' || (!type && /Marshal/i.test(name))){
          stroke = '#dc2626'; strokeWidth = 1.5; dash = '4 4'; textFill = '#b91c1c';
        } else if (type === 'STC' || /STC/.test(type) || (!type && /STC/i.test(name))){
          stroke = '#6b7280'; strokeWidth = 2; dash = '4 4'; textFill = '#374151';
        } else if (type === 'ADDED_TIME' || (!type && /ADDED\s*TIME|Added\s*Time|\bAT\b/i.test(name))){
          stroke = '#f59e0b'; strokeWidth = 2.5; dash = '4 4'; textFill = '#f59e0b';
        }
        return { stroke, strokeWidth, dash, textFill };
      }

      rows.forEach(r => {
        if (r.dist < viewMinKm - 0.001 || r.dist > viewMaxKm + 0.001) return;
        const x = distToX(r.dist);
        const style = markerStyleForRow(r);
        line(x, gridTop + 4, x, gridTop + 10, { stroke:style.stroke, strokeWidth:style.strokeWidth, dash:style.dash || undefined });
        const t = String((r && r.type) || '').toUpperCase();
        const isATrow = (t === 'ADDED_TIME');
        const isStc = (t === 'STC') || (!t && /STC/i.test(r.label));
        const isMarshal = (t === 'MARSHAL') || (!t && /Marshal/i.test(r.label));
        if (isATrow || isStc || isMarshal){
          const atTxt = (r && r.atLabel != null) ? String(r.atLabel).trim() : '';
          const lbl = isATrow ? (atTxt ? ('AT ' + atTxt) : 'AT') : r.label;
          text(x, gridTop, lbl, { anchor:'middle', size:9, fill:style.textFill });
        }
      });

      const xRow = distToX(row.dist);
      // Focus marker line: follow the row's waypoint type style (no blanket orange override)
      const fStyle = markerStyleForRow(row);
      line(xRow, gridTop + 2, xRow, gridBottom, { stroke:fStyle.stroke, strokeWidth:Math.max(2.5, fStyle.strokeWidth), dash:fStyle.dash || undefined });

      const laneIndexMap = {};
      getEnabledGroups().forEach((g, i) => { laneIndexMap[g] = i; });

      const blockHeight = 24;
      positions.forEach(pos => {
        const laneIndex = laneIndexMap[pos.group] ?? 0;
        const yCenter = laneY(laneIndex);
        const yTop = yCenter - blockHeight / 2;

        const visStartKm = Math.max(pos.startKm, viewMinKm);
        const visEndKm = Math.max(visStartKm, Math.min(pos.frontKm, viewMaxKm));

        const xStart = distToX(visStartKm);
        const xEnd = distToX(Math.min(pos.frontKm, viewMaxKm));
        const widthPx = Math.max(8, (visEndKm - visStartKm) * pxPerKm);

        const strokeCol = (groupStroke[pos.group] || '#0f172a');
        const fillCol = (groupFill[pos.group] || strokeCol);

        const fillOp = (groupFillOpacity && groupFillOpacity[pos.group] != null) ? groupFillOpacity[pos.group] : 1;
        const strokeOp = (groupStrokeOpacity && groupStrokeOpacity[pos.group] != null) ? groupStrokeOpacity[pos.group] : 1;
        rect(xStart, yTop, widthPx, blockHeight, { fill:fillCol, fillOpacity:fillOp, stroke:strokeCol, strokeWidth:0.4, strokeOpacity:strokeOp });

        const stats = groupStats[pos.group] || {};
        if (showCars && stats.cars && stats.cars > 1) {
          const gapKm = (stats.avgKmPerMin || 0) * (stats.intervalMin || 1);
          if (gapKm > 0) {
            for (let i = 0; i < stats.cars; i++) {
              const carKm = pos.frontKm - gapKm * i;
              if (carKm < pos.startKm - 1e-3) break;
              if (carKm < viewMinKm - 1e-3 || carKm > viewMaxKm + 1e-3) continue;
              const cx = distToX(carKm);
              circle(cx, yCenter, 4, { fill:strokeCol, stroke:'white', strokeWidth:2 });
            }
          }
        }
        circle(xEnd, yCenter, 4, { fill:'white', stroke:strokeCol, strokeWidth:2 });
      });

      const etaX = xRow + 8;
      const isAT = (String(row.type || row.label || '').toUpperCase() === 'ADDED_TIME');
      positions.forEach(pos => {
        const laneIndex = laneIndexMap[pos.group] ?? 0;
        const yCenter = laneY(laneIndex);

        const arrMin = pos.timeMin;
        let depMin = arrMin;
        if (isAT) {
          const addSec = _getAddedSecForRow(row, pos.group) || 0;
          depMin = arrMin + (addSec / 60);
        }

if (isAT) {
            text(etaX, yCenter - 2, 'A ' + formatClock(arrMin), { size:10, fill:'#111827', weight:'500', anchor:'start' });
            text(etaX, yCenter + 12, 'D ' + formatClock(depMin), { size:10, fill:'#111827', weight:'500', anchor:'start' });
          } else {
            text(etaX, yCenter + 6, 'A ' + formatClock(arrMin), { size:10, fill:'#111827', weight:'500', anchor:'start' });
          }
        });

      updateSummaries(positions, row);
    }

    // --- Event wiring ---
    const instance = {
      rallyId: opts && opts.rallyId ? String(opts.rallyId) : '',
      mode: (opts && opts.mode) ? opts.mode : 'embed',
      root,
      _cleanup: [],
      // Host can update day start clock at runtime (HH:MM or HH:MM:SS)
      setStartTime(startStr){ setDayStartClock(startStr); },
      setDayStart(startStr){ setDayStartClock(startStr); },
      setScheduleSnapshot(snapshot) {
        // v1.25: preserve focus/scanner state across live updates
        try{ persistMemFocus(); }catch(_e){}
        if (!Array.isArray(snapshot)) snapshot = [];
        hostRows = snapshot.map((r, i)=>({
          idx: (r.rowNo ?? r.idx ?? (i+1)),
          distKm: (typeof r.dist === 'number') ? r.dist : (typeof r.dist === 'string' ? parseFloat(r.dist) : null),
          type: r.type ?? '',
          label: r.label ?? r.waypoint ?? '',
          instruction: r.instruction ?? '',
          times: r.times ?? {},
          speeds: r.speeds ?? null,
          atLabel: (r.atLabel != null ? String(r.atLabel) : '')
        }));
        hostRows = sanitizeRowsByDist_(hostRows);
        hasAnyTimes = hostRows.some(rr => rr && rr.times && Object.values(rr.times).some(v => String(v||'').trim() !== ''));
        buildFocusSelect();
        try{ restoreMemFocus(); }catch(_e){}
        updateFocusSummary();
        renderTimeline();
        try{ persistMemFocus(); }catch(_e){}
      },
      setEnabledGroups(flags){
        // flags: { SG3: boolean, SG4: boolean }
        if (!flags || typeof flags !== 'object') return;
        _enabled.SG3 = !!flags.SG3;
        _enabled.SG4 = !!flags.SG4;
        updateLaneNote();
        buildDelayCarsRows();
        updateFocusSummary();
        renderTimeline();
      },
      setAllocatedCars(map){
        if (!map || typeof map !== 'object') return;
        ALL_GROUPS.forEach(g=>{
          const v = map[g];
          if (v === null || v === undefined) return;
          groupMeta[g].allocCars = clampInt(v, 0, 99);
        });
        buildDelayCarsRows();
      },
      render() { renderTimeline(); },
      unmount() {
        persistMemFocus();
        // run cleanup handlers
        try { instance._cleanup.forEach(fn => { try { fn(); } catch(_){} }); } catch(_){}
        instance._cleanup = [];
        containerEl.innerHTML = '';
        _instances.delete(containerEl);
      }
    };

    // Focus events
    function resetTimeOffsetToZero(){
      timeOffsetMin = 0;
      const slider = q('timeOffsetSlider');
      const label  = q('timeOffsetLabel');
      try{ if (slider) slider.value = '0'; }catch(_e){}
      if (label) label.textContent = `Time offset around this row (–20 to +20 min): ${timeOffsetMin.toFixed(1)} min`;
    }

    if (focusSelect){
      const onChange = ()=>{ resetTimeOffsetToZero(); updateFocusSummary(); renderTimeline(); persistMemFocus(); };
      focusSelect.addEventListener('change', onChange);
      instance._cleanup.push(()=>focusSelect.removeEventListener('change', onChange));
    }
if (btnPrev){
      const onPrev = ()=>{
        if (!hostRows.length || !focusSelect || focusSelect.disabled) return;
        const idx = clampInt(focusSelect.value, 0, hostRows.length-1);
        const nextIdx = Math.max(0, idx - 1);
        focusSelect.value = String(nextIdx);
        resetTimeOffsetToZero();
        updateFocusSummary();
        renderTimeline();
        persistMemFocus();
      };
      btnPrev.addEventListener('click', onPrev);
      instance._cleanup.push(()=>btnPrev.removeEventListener('click', onPrev));
    }
    if (btnNext){
      const onNext = ()=>{
        if (!hostRows.length || !focusSelect || focusSelect.disabled) return;
        const idx = clampInt(focusSelect.value, 0, hostRows.length-1);
        const nextIdx = Math.min(hostRows.length-1, idx + 1);
        focusSelect.value = String(nextIdx);
        resetTimeOffsetToZero();
        updateFocusSummary();
        renderTimeline();
        persistMemFocus();
      };
      btnNext.addEventListener('click', onNext);
      instance._cleanup.push(()=>btnNext.removeEventListener('click', onNext));
    }

    // Initial paint
    applyExternalFromStorage();
    buildDelayCarsRows();
    buildFocusSelect();
    restoreMemFocus();
    _booting = false;
    updateFocusSummary();
    renderTimeline();
    persistMemFocus();
return instance;
  }

  const Timeline = {
    mount(containerEl, opts) {
      if (!containerEl) throw new Error('Timeline.mount: containerEl is required');
      // If already mounted, unmount first (idempotent)
      const existing = _instances.get(containerEl);
      if (existing && typeof existing.unmount === 'function') existing.unmount();

      const inst = createInstance(containerEl, opts || {});
      _instances.set(containerEl, inst);
      return inst;
    },
    unmount(containerEl) {
      const inst = _instances.get(containerEl);
      if (inst && typeof inst.unmount === 'function') inst.unmount();
    }
  };

  global.Timeline = Timeline;
})(window);