/**
 * Modal para escolher nova data/hora do slot (paciente e procedimento mantidos no backend).
 * O pai deve passar `key` que mude ao reabrir, para reinicializar o estado local.
 */
import { useState } from 'react';
import { X } from 'lucide-react';

function toDateInputValue(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function initialFromAgenda(agenda) {
  if (!agenda) return { data: '', horaInicio: '', horaFim: '' };
  const raw = agenda.rawSlot || {};
  const d = agenda.data || (raw.dataAgendamento && String(raw.dataAgendamento).slice(0, 10)) || '';
  const hi = (agenda.horaInicio && String(agenda.horaInicio).slice(0, 5)) || '';
  const hfRaw = raw.horaFim && String(raw.horaFim).slice(0, 5);
  return { data: d, horaInicio: hi, horaFim: hfRaw || '' };
}

export default function ReagendarAgendaModal({ agenda, onClose, onConfirm, isSubmitting = false }) {
  const init = initialFromAgenda(agenda);
  const [data, setData] = useState(init.data);
  const [horaInicio, setHoraInicio] = useState(init.horaInicio);
  const [horaFim, setHoraFim] = useState(init.horaFim);
  const [motivo, setMotivo] = useState('');

  const valida = () => {
    if (!data || !horaInicio || !horaFim) return false;
    if (horaInicio >= horaFim) return false;
    const hoje = toDateInputValue(new Date());
    if (data < hoje) return false;
    return true;
  };

  const handleConfirm = () => {
    if (!valida() || !agenda?.roleUserId) return;
    onConfirm({
      dataAgendamento: data,
      horaInicio: `${horaInicio}:00`,
      horaFim: `${horaFim}:00`,
      roleUserId: agenda.roleUserId,
      tipo: agenda.tipo || 'atendimento',
      motivoCancelamentoTexto: motivo.trim() || null,
    });
  };

  const minDate = toDateInputValue(new Date());
  const dataPassada = Boolean(data) && data < minDate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Reagendar atendimento</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-600">
          Escolha a nova data e horário. O paciente e procedimento serão mantidos.
        </p>

        <div className="mb-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Data *</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              min={minDate}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
            {dataPassada ? (
              <p className="mt-1 text-sm text-red-500">Data inválida — não é possível agendar para o passado.</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Início *</label>
              <input
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Fim *</label>
              <input
                type="time"
                value={horaFim}
                onChange={(e) => setHoraFim(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Observação (opcional)</label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value.slice(0, 500))}
              maxLength={500}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="Ex.: paciente pediu pra adiar"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!valida() || isSubmitting || !agenda?.roleUserId}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Reagendando...' : 'Confirmar reagendamento'}
          </button>
        </div>
      </div>
    </div>
  );
}
