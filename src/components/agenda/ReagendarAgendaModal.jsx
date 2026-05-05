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
  if (!agenda) return { novaData: '', novaHoraInicio: '', novaHoraFim: '' };
  const raw = agenda.rawSlot || {};
  const d = agenda.data || (raw.dataAgendamento && String(raw.dataAgendamento).slice(0, 10)) || '';
  const hi = (agenda.horaInicio && String(agenda.horaInicio).slice(0, 5)) || '';
  const hfRaw = raw.horaFim && String(raw.horaFim).slice(0, 5);
  return { novaData: d, novaHoraInicio: hi, novaHoraFim: hfRaw || '' };
}

export default function ReagendarAgendaModal({ agenda, onClose, onConfirm, isSubmitting = false }) {
  const init = initialFromAgenda(agenda);
  const [novaData, setNovaData] = useState(init.novaData);
  const [novaHoraInicio, setNovaHoraInicio] = useState(init.novaHoraInicio);
  const [novaHoraFim, setNovaHoraFim] = useState(init.novaHoraFim);
  const [observacao, setObservacao] = useState('');

  const valida = () => {
    if (!novaData || !novaHoraInicio || !novaHoraFim) return false;
    if (novaHoraInicio >= novaHoraFim) return false;
    const hoje = toDateInputValue(new Date());
    if (novaData < hoje) return false;
    return true;
  };

  const handleConfirm = () => {
    if (!valida()) return;
    onConfirm({
      novaData,
      novaHoraInicio: `${novaHoraInicio}:00`,
      novaHoraFim: `${novaHoraFim}:00`,
      observacao: observacao.trim() || null,
    });
  };

  const minDate = toDateInputValue(new Date());
  const dataPassada = Boolean(novaData) && novaData < minDate;
  // BUG #3: feedback inline (a função `valida()` já bloqueia o submit; aqui só mostramos
  // a mensagem vermelha, espelhando o padrão de `dataPassada`).
  const horarioInvalido = Boolean(novaHoraInicio && novaHoraFim && novaHoraInicio >= novaHoraFim);

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
              value={novaData}
              onChange={(e) => setNovaData(e.target.value)}
              min={minDate}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
            {dataPassada ? (
              <p className="mt-1 text-sm text-red-500">Data inválida — não é possível agendar para o passado.</p>
            ) : null}
          </div>

          <div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Início *</label>
                <input
                  type="time"
                  value={novaHoraInicio}
                  onChange={(e) => setNovaHoraInicio(e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 ${
                    horarioInvalido ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Fim *</label>
                <input
                  type="time"
                  value={novaHoraFim}
                  onChange={(e) => setNovaHoraFim(e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 ${
                    horarioInvalido ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              </div>
            </div>
            {horarioInvalido ? (
              <p className="mt-1 text-sm text-red-500">
                Horário final deve ser depois do horário inicial
              </p>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Observação (opcional)</label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value.slice(0, 500))}
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
            disabled={!valida() || isSubmitting}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Reagendando...' : 'Confirmar reagendamento'}
          </button>
        </div>
      </div>
    </div>
  );
}
