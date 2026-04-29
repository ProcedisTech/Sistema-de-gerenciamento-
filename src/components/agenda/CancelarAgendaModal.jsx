/**
 * Modal de cancelamento de slot da agenda.
 * Recebe agenda + onClose + onConfirm callback.
 * onConfirm recebe { motivoCancelamentoCodigo, motivoCancelamentoTexto }
 */
import { useState } from 'react';
import { X } from 'lucide-react';

const MOTIVOS = [
  { codigo: 'paciente_desistiu', label: 'Paciente desistiu' },
  { codigo: 'remarcado', label: 'Remarcado' },
  { codigo: 'clinica_fechou', label: 'Clínica fechou' },
  { codigo: 'outro', label: 'Outro' },
];

export default function CancelarAgendaModal({ agenda: _agenda, onClose, onConfirm, isSubmitting = false }) {
  const [codigo, setCodigo] = useState('');
  const [texto, setTexto] = useState('');

  const exigeTexto = codigo === 'outro';
  const podeConfirmar = codigo && (!exigeTexto || texto.trim().length > 0);

  const handleConfirm = () => {
    if (!podeConfirmar) return;
    onConfirm({
      motivoCancelamentoCodigo: codigo,
      motivoCancelamentoTexto: texto.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Cancelar agendamento</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-600">Por favor, informe o motivo do cancelamento.</p>

        <div className="mb-4 space-y-2">
          {MOTIVOS.map((m) => (
            <label
              key={m.codigo}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50"
            >
              <input
                type="radio"
                name="motivo"
                value={m.codigo}
                checked={codigo === m.codigo}
                onChange={(e) => setCodigo(e.target.value)}
                className="h-4 w-4 text-emerald-600"
              />
              <span className="text-sm text-gray-900">{m.label}</span>
            </label>
          ))}
        </div>

        {exigeTexto ? (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">Descreva o motivo *</label>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value.slice(0, 500))}
              maxLength={500}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="Explique o motivo do cancelamento"
            />
            <p className="mt-1 text-xs text-gray-500">{texto.length}/500</p>
          </div>
        ) : null}

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
            disabled={!podeConfirmar || isSubmitting}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Cancelando...' : 'Confirmar cancelamento'}
          </button>
        </div>
      </div>
    </div>
  );
}
