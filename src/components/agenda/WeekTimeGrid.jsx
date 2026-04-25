import React from 'react';
import { toDateKey } from '../../utils/agendaDateUtils';

const SLOT_HEIGHT = 48;
const START_MIN = 7 * 60;
const END_MIN = 20 * 60;
const SLOT_MIN = 30;

const WEEK_ABBR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function timeToMinutes(t) {
  if (t == null || t === '') return 0;
  const parts = String(t).trim().split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? 0);
  if (Number.isNaN(h)) return 0;
  return h * 60 + (Number.isNaN(m) ? 0 : m);
}

function formatSlotLabel(totalMin) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function buildTimeSlots() {
  const rows = [];
  for (let m = START_MIN; m <= END_MIN; m += SLOT_MIN) {
    rows.push(m);
  }
  return rows;
}

function maxConcurrent(events) {
  const pts = [];
  for (const e of events) {
    pts.push({ t: e.start, d: 1 });
    pts.push({ t: e.end, d: -1 });
  }
  pts.sort((a, b) => a.t - b.t || a.d - b.d);
  let c = 0;
  let mx = 0;
  for (const p of pts) {
    c += p.d;
    mx = Math.max(mx, c);
  }
  return Math.max(1, mx);
}

function buildOverlapComponents(indices, items) {
  const n = indices.length;
  const adj = Array.from({ length: n }, () => []);
  for (let a = 0; a < n; a += 1) {
    for (let b = a + 1; b < n; b += 1) {
      const A = items[indices[a]];
      const B = items[indices[b]];
      if (A.end > B.start && B.end > A.start) {
        adj[a].push(b);
        adj[b].push(a);
      }
    }
  }
  const visited = new Array(n).fill(false);
  const components = [];
  for (let i = 0; i < n; i += 1) {
    if (visited[i]) continue;
    const compIdx = [];
    const stack = [i];
    visited[i] = true;
    while (stack.length) {
      const u = stack.pop();
      compIdx.push(indices[u]);
      for (const v of adj[u]) {
        if (!visited[v]) {
          visited[v] = true;
          stack.push(v);
        }
      }
    }
    components.push(compIdx);
  }
  return components;
}

function layoutDayColumn(dayAppointments) {
  const raw = dayAppointments.map((appt) => {
    const start = timeToMinutes(appt.horaInicio);
    const dur = Number(appt.duracaoMin) || 45;
    const end = start + dur;
    return { appt, start, end };
  });

  const items = raw
    .filter((e) => e.end > START_MIN && e.start < END_MIN + SLOT_MIN)
    .map((e) => ({
      ...e,
      startC: Math.max(e.start, START_MIN),
      endC: Math.min(e.end, END_MIN + SLOT_MIN),
    }))
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const n = items.length;
  const layouts = new Map();

  if (n === 0) return layouts;

  const components = buildOverlapComponents(
    items.map((_, i) => i),
    items
  );

  for (const compIdx of components) {
    const comp = compIdx.map((i) => items[i]);
    const M = maxConcurrent(comp);
    const sorted = [...comp].sort((a, b) => a.start - b.start || b.end - a.end);
    const placed = [];
    for (const ev of sorted) {
      const active = placed.filter((p) => p.end > ev.start && p.start < ev.end);
      const used = new Set(active.map((p) => p.lane));
      let lane = 0;
      while (lane < M && used.has(lane)) lane += 1;
      if (lane >= M) lane = M - 1;
      ev.lane = lane;
      placed.push(ev);
    }
    for (const ev of comp) {
      layouts.set(ev.appt.id, { lane: ev.lane, colCount: M });
    }
  }

  return layouts;
}

function getMobileDayIsos(weekDayIsos, todayIso) {
  const ti = weekDayIsos.findIndex((d) => d === todayIso);
  if (ti < 0) return weekDayIsos.slice(0, 3);
  let a = ti - 1;
  let b = ti + 1;
  if (a < 0) {
    a = 0;
    b = Math.min(6, 2);
  }
  if (b > 6) {
    b = 6;
    a = Math.max(0, 4);
  }
  return weekDayIsos.slice(a, b + 1);
}

function dayHeader(iso, todayIso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay();
  const isToday = iso === todayIso;
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-2">
      <span className="text-[10px] font-bold uppercase text-[#888888]">{WEEK_ABBR[dow]}</span>
      {isToday ? (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0FA37F] text-[13px] font-black text-white">
          {d}
        </span>
      ) : (
        <span className="text-[13px] font-black text-[#1A1A2E]">{d}</span>
      )}
    </div>
  );
}

function eventBlockStyle(appt, layout) {
  const start = timeToMinutes(appt.horaInicio);
  const dur = Number(appt.duracaoMin) || 45;
  const top = Math.max(0, ((start - START_MIN) / SLOT_MIN) * SLOT_HEIGHT);
  const height = Math.max(SLOT_HEIGHT, (dur / SLOT_MIN) * SLOT_HEIGHT);
  const lane = layout?.lane ?? 0;
  const colCount = Math.max(1, layout?.colCount ?? 1);
  const widthPct = 100 / colCount;
  const leftPct = (lane / colCount) * 100;
  return {
    top,
    height,
    left: `calc(${leftPct}% + 3px)`,
    width: `calc(${widthPct}% - 6px)`,
  };
}

function statusCardClass(status) {
  if (status === 'pendente') return 'bg-[#FFF4E0] border-l-[3px] border-l-[#F5A623]';
  if (status === 'cancelado') return 'bg-[#FCE8E8] border-l-[3px] border-l-[#E24B4A]';
  return 'bg-[#E1F5EE] border-l-[3px] border-l-[#0FA37F]';
}

function DayColumn({ iso, appointments, todayIso, onEdit }) {
  const layouts = React.useMemo(() => layoutDayColumn(appointments), [appointments]);
  const slots = React.useMemo(() => buildTimeSlots(), []);
  const gridHeight = slots.length * SLOT_HEIGHT;
  const now = new Date();
  const showNow =
    iso === todayIso &&
    now.getHours() * 60 + now.getMinutes() >= START_MIN &&
    now.getHours() * 60 + now.getMinutes() <= END_MIN + SLOT_MIN;
  const nowTop = ((now.getHours() * 60 + now.getMinutes() - START_MIN) / SLOT_MIN) * SLOT_HEIGHT;

  return (
    <div className="relative min-w-0 overflow-hidden border-l border-[#E8E8E8]" style={{ minHeight: gridHeight }}>
      {slots.map((_, i) => (
        <div
          key={i}
          className="box-border border-b border-[#E8E8E8]"
          style={{ height: SLOT_HEIGHT, borderBottomWidth: 0.5 }}
        />
      ))}
      {showNow ? (
        <div
          className="pointer-events-none absolute left-0 right-0 z-[5]"
          style={{ top: nowTop }}
          aria-hidden
        >
          <div className="relative flex items-center">
            <span className="absolute left-0 top-1/2 z-[6] h-2 w-2 min-h-[8px] min-w-[8px] -translate-y-1/2 rounded-full bg-[#E24B4A]" />
            <div className="ml-1 h-[1.5px] flex-1 bg-[#E24B4A]" />
          </div>
        </div>
      ) : null}
      {appointments.map((appt) => {
        const layout = layouts.get(appt.id);
        const style = eventBlockStyle(appt, layout);
        const showProc = style.height >= 72;
        return (
          <button
            key={appt.id}
            type="button"
            onClick={() => onEdit(appt)}
            className={`absolute z-[4] overflow-hidden rounded-md px-1.5 py-1 text-left shadow-sm transition-opacity hover:opacity-95 ${statusCardClass(appt.status)}`}
            style={style}
          >
            <div
              className={`text-[11px] font-bold leading-tight text-[#0FA37F] ${appt.status === 'cancelado' ? 'line-through' : ''}`}
            >
              {appt.horaInicio}
            </div>
            <div className={`truncate text-[11px] font-bold text-[#1A1A2E] ${appt.status === 'cancelado' ? 'line-through' : ''}`}>
              {appt.pacienteNome}
            </div>
            {showProc ? (
              <div className={`truncate text-[10px] font-medium text-[#888888] ${appt.status === 'cancelado' ? 'line-through' : ''}`}>
                {appt.procedimentoNome}
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function WeekTimeGrid({ weekDayIsos, appointments, todayIso, onEdit }) {
  const scrollRef = React.useRef(null);
  const slots = React.useMemo(() => buildTimeSlots(), []);
  const gridHeight = slots.length * SLOT_HEIGHT;

  const byDay = React.useMemo(() => {
    const map = {};
    for (const iso of weekDayIsos) {
      map[iso] = [];
    }
    for (const row of appointments) {
      const k = toDateKey(row.data);
      if (map[k]) map[k].push(row);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => timeToMinutes(a.horaInicio) - timeToMinutes(b.horaInicio));
    }
    return map;
  }, [appointments, weekDayIsos]);

  const weekKey = weekDayIsos[0] || '';

  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const now = new Date();
    const hm = now.getHours() * 60 + now.getMinutes();
    const anchorMin = hm >= START_MIN && hm <= END_MIN + SLOT_MIN ? hm : 8 * 60;
    const targetRow = Math.floor((anchorMin - START_MIN) / SLOT_MIN);
    const y = Math.max(0, targetRow * SLOT_HEIGHT - 80);
    el.scrollTo({ top: y, behavior: 'smooth' });
  }, [weekKey]);

  const mobileDays = React.useMemo(() => getMobileDayIsos(weekDayIsos, todayIso), [weekDayIsos, todayIso]);

  const innerGrid = (days) => (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div
        className="sticky left-0 z-[3] w-14 shrink-0 border-r border-[#E8E8E8] bg-white"
        style={{ minHeight: gridHeight }}
      >
        {slots.map((m) => (
          <div
            key={m}
            className="box-border flex items-start justify-end border-b border-[#E8E8E8] pr-1 pt-0.5 text-[11px] font-semibold text-[#888888]"
            style={{ height: SLOT_HEIGHT, borderBottomWidth: 0.5 }}
          >
            {formatSlotLabel(m)}
          </div>
        ))}
      </div>
      <div
        className="grid min-w-0 flex-1"
        style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`, minHeight: gridHeight }}
      >
        {days.map((iso) => (
          <DayColumn key={iso} iso={iso} appointments={byDay[iso] || []} todayIso={todayIso} onEdit={onEdit} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="w-full min-w-0">
      <div className="hidden md:block">
        <div className="flex border-b border-[#E8E8E8]">
          <div className="w-14 shrink-0" />
          <div
            className="grid min-w-0 flex-1"
            style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}
          >
            {weekDayIsos.map((iso) => (
              <div key={iso} className="min-w-0 border-l border-transparent">
                {dayHeader(iso, todayIso)}
              </div>
            ))}
          </div>
        </div>
        <div
          ref={scrollRef}
          className="max-h-[520px] overflow-y-auto scroll-smooth"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {innerGrid(weekDayIsos)}
        </div>
      </div>

      <div className="md:hidden">
        <div className="-mx-1 flex gap-2 overflow-x-auto pb-2 scroll-smooth px-1" style={{ WebkitOverflowScrolling: 'touch' }}>
          {mobileDays.map((iso) => (
            <div key={iso} className="w-[min(92vw,360px)] shrink-0 rounded-lg border border-[#E8E8E8] bg-white">
              <div className="border-b border-[#E8E8E8]">{dayHeader(iso, todayIso)}</div>
              <div className="max-h-[520px] overflow-y-auto scroll-smooth">
                {innerGrid([iso])}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
