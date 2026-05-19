function Kbd({ children }) {
  return (
    <kbd className="rounded border border-ink-200 border-b-2 bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-ink-700">
      {children}
    </kbd>
  );
}

function HintGroup({ keys, label }) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((k) => (
        <Kbd key={k}>{k}</Kbd>
      ))}
      <span>{label}</span>
    </span>
  );
}

export function AgendaKbdHint({ showEntrance = false, className = '' }) {
  const enterClass = showEntrance ? 'animate-agenda-rise agenda-delay-1000 agenda-duration-600' : '';

  return (
    <aside
      className={`pointer-events-none absolute bottom-3.5 left-6 z-40 hidden items-center gap-3 font-mono text-[10.5px] text-ink-500 lg:flex ${enterClass} ${className}`}
      aria-hidden
    >
      <HintGroup keys={['←', '→']} label="mês" />
      <HintGroup keys={['T']} label="hoje" />
      <HintGroup keys={['F']} label="filtros" />
      <HintGroup keys={['N']} label="novo" />
    </aside>
  );
}
