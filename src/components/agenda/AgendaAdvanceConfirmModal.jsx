import { X } from 'lucide-react';

export function AgendaAdvanceConfirmModal({
  appointment,
  targetHoraInicio,
  onClose,
  onConfirm,
  isSubmitting = false,
}) {
  if (!appointment || !targetHoraInicio) return null;

  const paciente = appointment.pacienteNome || 'Paciente';
  const horaAtual = String(appointment.horaInicio || '').slice(0, 5);
  const horaAlvo = String(targetHoraInicio || '').slice(0, 5);

  return (
    <div className="fixed inset-0 z-[225] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Adiantar consulta?</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-gray-100" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-gray-700">
          Adiantar consulta de <span className="font-semibold">{paciente}</span> das{' '}
          <span className="font-semibold">{horaAtual}</span> para{' '}
          <span className="font-semibold">{horaAlvo}</span>?
        </p>
        <p className="mt-3 text-xs text-amber-800">Lembre-se de avisar o paciente.</p>
        <div className="mt-6 flex gap-2">
          <button type="button" onClick={onClose} disabled={isSubmitting} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Voltar</button>
          <button type="button" onClick={onConfirm} disabled={isSubmitting} className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{isSubmitting ? 'Aguarde…' : 'Confirmar'}</button>
        </div>
      </div>
    </div>
  );
}

