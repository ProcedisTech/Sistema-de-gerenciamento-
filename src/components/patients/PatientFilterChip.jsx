/**
 * Chip de filtro da lista de pacientes com ícone opcional à esquerda do label.
 *
 * Props:
 *   label        — texto do chip
 *   active       — se está ativo/selecionado
 *   onClick      — handler de clique
 *   disabled     — desabilita o botão (ex.: durante busca text)
 *   icon         — componente de ícone (Lucide ou custom); recebe className + strokeWidth
 *   activeClass  — classe Tailwind para o estado ativo (padrão: teal da marca)
 */
export function PatientFilterChip({
  label,
  active,
  onClick,
  disabled,
  icon: Icon,
  activeClass = 'bg-[#00a88e] text-white',
  title,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? activeClass
          : 'border border-[#e2e8f0] bg-white text-[#475569] hover:border-[#cbd5e1] hover:bg-slate-50'
      }`}
    >
      {Icon ? (
        <Icon
          className="h-3.5 w-3.5 shrink-0"
          strokeWidth={2}
          aria-hidden
        />
      ) : null}
      {label}
    </button>
  );
}
