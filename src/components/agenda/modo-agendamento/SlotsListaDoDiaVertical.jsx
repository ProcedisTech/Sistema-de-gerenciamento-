import { useDisponibilidadeDoDia } from '../../../hooks/agenda/useDisponibilidadeDoDia.js';
import { formatLongDate } from '../useAgendaPage.js';
import SlotHorarioCard from './SlotHorarioCard.jsx';

export default function SlotsListaDoDiaVertical({
  data,
  roleUserFiltro,
  enabled = true,
  selecao,
  onSelecionarSlot,
}) {
  const { slots, loading, error } = useDisponibilidadeDoDia({
    data,
    roleUserId: roleUserFiltro || undefined,
    enabled: Boolean(enabled && data),
  });

  const headerLabel = data ? formatLongDate(data) : '—';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-ink-100 px-4 py-3">
        <h3 className="text-sm font-black text-ink-900">{headerLabel}</h3>
        <p className="mt-0.5 text-xs font-medium text-ink-500">Horários disponíveis</p>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
        {loading ? (
          <p className="py-8 text-center text-sm text-ink-500">Carregando horários…</p>
        ) : null}

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            Não foi possível carregar os horários disponíveis.
          </p>
        ) : null}

        {!loading && !error && slots.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-500">
            Nenhum horário disponível neste dia. Tente outro dia.
          </p>
        ) : null}

        {!loading && !error && slots.length > 0 ? (
          <div className="space-y-2">
            {slots.flatMap((slot) => {
              const profs = Array.isArray(slot.profissionais) ? slot.profissionais : [];
              return profs.map((prof) => {
                const selected =
                  selecao?.hora === slot.hora &&
                  String(selecao?.roleUserId) === String(prof.roleUserId);
                return (
                  <SlotHorarioCard
                    key={`${slot.hora}-${prof.roleUserId}`}
                    hora={slot.hora}
                    profissional={prof}
                    selected={selected}
                    onSelecionar={() => onSelecionarSlot({ hora: slot.hora, profissional: prof })}
                  />
                );
              });
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
