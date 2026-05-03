import { Check, UserX, Calendar, XCircle, MessageCircle } from 'lucide-react';
import { getAgendaSlotActionVisibility } from '../../utils/agendaSlotActionVisibility.js';
import { labelMotivoCancelamentoCodigo, resolveMotivoCancelamentoFromRow } from '../../utils/agendaCancelamentoMotivo.js';
import { formatDestinoReagendamentoLabel, isSlotCanceladoPorReagendamento } from '../../utils/agendaReagendamentoUi.js';

/**
 * Ações disponíveis pra um slot da agenda.
 * @param {object} props
 * @param {object} props.agenda — slot atual
 * @param {Function} props.onMarcarRealizado
 * @param {Function} props.onMarcarFalta
 * @param {Function} props.onReagendar — abre modal
 * @param {Function} props.onCancelar — abre modal
 * @param {Function} props.onEnviarWhatsApp — gera link e abre
 * @param {boolean} props.disabled
 */
export default function AgendaSlotActions({
  agenda,
  onMarcarRealizado,
  onMarcarFalta,
  onReagendar,
  onCancelar,
  onEnviarWhatsApp,
  disabled = false,
}) {
  const status = agenda?.status;
  const isReagendado = status === 'cancelado' && isSlotCanceladoPorReagendamento(agenda);
  const destinoReagendamentoLabel = isReagendado ? formatDestinoReagendamentoLabel(agenda) : null;
  const v = getAgendaSlotActionVisibility(status);
  const anyChip =
    v.showRealizado || v.showFalta || v.showWhatsApp || v.showReagendar || v.showCancelar;

  const { codigo: motivoCodigo, texto: motivoTexto } =
    status === 'cancelado' ? resolveMotivoCancelamentoFromRow(agenda) : { codigo: null, texto: '' };
  const codigoTrim = motivoCodigo != null && String(motivoCodigo).trim() !== '' ? String(motivoCodigo).trim() : '';
  const showMotivoLine = status === 'cancelado' && codigoTrim !== '';
  const labelMotivo = showMotivoLine ? labelMotivoCancelamentoCodigo(codigoTrim) : '';

  return (
    <div className="flex flex-col gap-1.5">
      {status === 'realizado' ? (
        <span className="text-xs italic text-gray-500">Atendimento finalizado</span>
      ) : null}
      {status === 'cancelado' && destinoReagendamentoLabel ? (
        <span className="text-xs italic text-orange-800">{destinoReagendamentoLabel}</span>
      ) : status === 'cancelado' ? (
        <span className="text-xs italic text-gray-500">Cancelado</span>
      ) : null}
      {showMotivoLine ? (
        <p className="text-sm text-gray-500">
          Motivo: {labelMotivo}
          {motivoTexto ? (
            <>
              {' '}
              — &quot;{motivoTexto}&quot;
            </>
          ) : null}
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
          {v.showFalta ? (
            <button
              type="button"
              onClick={onMarcarFalta}
              disabled={disabled}
              title="Marcar como falta"
              className="inline-flex items-center gap-1 rounded-md bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-50"
            >
              <UserX className="h-3.5 w-3.5" />
              Falta
            </button>
          ) : null}
          {v.showWhatsApp ? (
            <button
              type="button"
              onClick={onEnviarWhatsApp}
              disabled={disabled}
              title="Enviar confirmação via WhatsApp"
              className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
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
              className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
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
              title="Cancelar"
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
