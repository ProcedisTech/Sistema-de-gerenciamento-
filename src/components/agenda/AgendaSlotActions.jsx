import { Check, UserX, Calendar, XCircle, MessageCircle } from 'lucide-react';
import { getAgendaSlotActionVisibility } from '../../utils/agendaSlotActionVisibility.js';
import {
  resolveMotivoCancelamentoFromRow,
  labelMotivoCancelamentoFallback,
  isAgendaNoShow,
} from '../../utils/agendaCancelamentoMotivo.js';

/**
 * Ações disponíveis pra um slot da agenda.
 * @param {object} props
 * @param {object} props.agenda — slot atual
 * @param {Function} props.onMarcarRealizado
 * @param {Function} props.onMarcarNaoCompareceu
 * @param {Function} props.onReagendar — abre modal
 * @param {Function} props.onCancelar — abre modal
 * @param {Function} props.onEnviarWhatsApp — gera link e abre
 * @param {boolean} props.disabled
 */
export default function AgendaSlotActions({
  agenda,
  onMarcarRealizado,
  onMarcarNaoCompareceu,
  onReagendar,
  onCancelar,
  onEnviarWhatsApp,
  disabled = false,
}) {
  const status = agenda?.status;
  const v = getAgendaSlotActionVisibility(status);
  const anyChip =
    v.showRealizado ||
    v.showNaoCompareceu ||
    v.showWhatsApp ||
    v.showReagendar ||
    v.showCancelar;

  const { codigo: motivoCodigo, nome: motivoNome } =
    status === 'cancelado' ? resolveMotivoCancelamentoFromRow(agenda) : { codigo: null, nome: '' };
  const codigoTrim = motivoCodigo != null && String(motivoCodigo).trim() !== '' ? String(motivoCodigo).trim() : '';
  const noShow = status === 'cancelado' && isAgendaNoShow(agenda);
  const showMotivoLine = status === 'cancelado' && (motivoNome || codigoTrim || noShow);
  const labelMotivo = noShow
    ? 'Não compareceu (no-show)'
    : motivoNome || (codigoTrim ? labelMotivoCancelamentoFallback(codigoTrim) : '');

  return (
    <div className="flex flex-col gap-1.5">
      {status === 'realizado' ? (
        <span className="text-xs italic text-gray-500">Atendimento finalizado</span>
      ) : null}
      {status === 'cancelado' ? (
        <span className="text-xs italic text-gray-500">{noShow ? 'Cancelado — no-show' : 'Cancelado'}</span>
      ) : status === 'reagendado' ? (
        <span className="text-xs italic text-purple-800">Reagendado</span>
      ) : null}
      {showMotivoLine ? (
        <p className="text-sm text-gray-500">
          Motivo: {labelMotivo}
        </p>
      ) : null}

      {anyChip ? (
        <div className="flex flex-wrap gap-1">
          {v.showRealizado ? (
            <button
              type="button"
              onClick={onMarcarRealizado}
              disabled={disabled}
              title="Marcar como realizado"
              className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              Realizado
            </button>
          ) : null}
          {v.showNaoCompareceu ? (
            <button
              type="button"
              onClick={onMarcarNaoCompareceu}
              disabled={disabled}
              title="Marcar não compareceu (no-show)"
              className="inline-flex items-center gap-1 rounded-md bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-50"
            >
              <UserX className="h-3.5 w-3.5" />
              Não compareceu
            </button>
          ) : null}
          {v.showWhatsApp ? (
            <button
              type="button"
              onClick={onEnviarWhatsApp}
              disabled={disabled}
              title="Enviar confirmação via WhatsApp"
              className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-800 hover:bg-green-100 disabled:opacity-50"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </button>
          ) : null}
          {v.showReagendar ? (
            <button
              type="button"
              onClick={onReagendar}
              disabled={disabled}
              title="Reagendar"
              className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-800 hover:bg-purple-100 disabled:opacity-50"
            >
              <Calendar className="h-3.5 w-3.5" />
              Reagendar
            </button>
          ) : null}
          {v.showCancelar ? (
            <button
              type="button"
              onClick={onCancelar}
              disabled={disabled}
              title="Cancelar agendamento"
              className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancelar
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
