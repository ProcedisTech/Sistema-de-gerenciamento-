import { Check, UserX, Calendar, XCircle, MessageCircle, Info, FileText } from 'lucide-react';
import { getAgendaSlotActionVisibility } from '../../utils/agendaSlotActionVisibility.js';
import {
  resolveMotivoCancelamentoFromRow,
  labelMotivoCancelamentoFallback,
  isAgendaNoShow,
} from '../../utils/agendaCancelamentoMotivo.js';

const CHIP_BASE =
  'inline-flex items-center justify-center rounded-md disabled:opacity-50 transition-colors';
const CHIP_COMPACT = `${CHIP_BASE} p-1.5`;
const CHIP_DEFAULT = `${CHIP_BASE} gap-1 px-2 py-1 text-xs font-medium`;

/**
 * Ações disponíveis pra um slot da agenda.
 */
export default function AgendaSlotActions({
  agenda,
  onMarcarRealizado,
  onMarcarNaoCompareceu,
  onReagendar,
  onCancelar,
  onEnviarWhatsApp,
  onEnviarAnamnese,
  onRemoverBloqueio,
  disabled = false,
  compact = false,
  panel = false,
}) {
  const status = agenda?.status;
  const tipo = agenda?.tipo;
  const v = getAgendaSlotActionVisibility(status, { tipo });
  const anyChip =
    v.showRealizado ||
    v.showNaoCompareceu ||
    v.showWhatsApp ||
    v.showAnamnese ||
    v.showReagendar ||
    v.showCancelar ||
    v.showRemoverBloqueio;

  const { codigo: motivoCodigo, nome: motivoNome } =
    status === 'cancelado' ? resolveMotivoCancelamentoFromRow(agenda) : { codigo: null, nome: '' };
  const codigoTrim = motivoCodigo != null && String(motivoCodigo).trim() !== '' ? String(motivoCodigo).trim() : '';
  const noShow = status === 'cancelado' && isAgendaNoShow(agenda);
  const showMotivoLine = status === 'cancelado' && (motivoNome || codigoTrim || noShow);
  const labelMotivo = noShow
    ? 'Não compareceu (no-show)'
    : motivoNome || (codigoTrim ? labelMotivoCancelamentoFallback(codigoTrim) : '');
  const motivoTitle = showMotivoLine ? `Motivo: ${labelMotivo}` : '';

  if (panel) {
    return (
      <div className="flex flex-col gap-1.5">
        {showMotivoLine ? (
          <span
            className="inline-block max-w-full truncate rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
            title={motivoTitle}
          >
            {labelMotivo}
          </span>
        ) : null}
        {anyChip ? (
          <div className="flex flex-wrap gap-1">
            {v.showRealizado ? (
              <button
                type="button"
                onClick={onMarcarRealizado}
                disabled={disabled}
                title="Marcar como realizado"
                className={`${CHIP_DEFAULT} bg-blue-50 text-blue-700 hover:bg-blue-100`}
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
                className={`${CHIP_DEFAULT} bg-orange-50 text-orange-700 hover:bg-orange-100`}
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
                className={`${CHIP_DEFAULT} bg-green-50 text-green-800 hover:bg-green-100`}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp
              </button>
            ) : null}
            {v.showAnamnese ? (
              <button
                type="button"
                onClick={onEnviarAnamnese}
                disabled={disabled}
                title="Enviar link da Anamnese via WhatsApp"
                className={`${CHIP_DEFAULT} bg-teal-50 text-teal-800 hover:bg-teal-100`}
              >
                <FileText className="h-3.5 w-3.5" />
                Anamnese
              </button>
            ) : null}
            {v.showReagendar ? (
              <button
                type="button"
                onClick={onReagendar}
                disabled={disabled}
                title="Reagendar"
                className={`${CHIP_DEFAULT} bg-purple-50 text-purple-800 hover:bg-purple-100`}
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
                className={`${CHIP_DEFAULT} bg-red-50 text-red-700 hover:bg-red-100`}
              >
                <XCircle className="h-3.5 w-3.5" />
                Cancelar
              </button>
            ) : null}
            {v.showRemoverBloqueio ? (
              <button
                type="button"
                onClick={onRemoverBloqueio}
                disabled={disabled}
                title="Remover bloqueio"
                className={`${CHIP_DEFAULT} bg-slate-100 text-slate-700 hover:bg-slate-200`}
              >
                <XCircle className="h-3.5 w-3.5" />
                Remover bloqueio
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-1">
        {showMotivoLine ? (
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-1 text-gray-500 hover:bg-gray-100"
            title={motivoTitle}
            aria-label={motivoTitle}
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
        {v.showRealizado ? (
          <button
            type="button"
            onClick={onMarcarRealizado}
            disabled={disabled}
            title="Marcar como realizado"
            aria-label="Marcar como realizado"
            className={`${CHIP_COMPACT} bg-blue-50 text-blue-700 hover:bg-blue-100`}
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
        {v.showNaoCompareceu ? (
          <button
            type="button"
            onClick={onMarcarNaoCompareceu}
            disabled={disabled}
            title="Marcar não compareceu (no-show)"
            aria-label="Marcar não compareceu (no-show)"
            className={`${CHIP_COMPACT} bg-orange-50 text-orange-700 hover:bg-orange-100`}
          >
            <UserX className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
        {v.showWhatsApp ? (
          <button
            type="button"
            onClick={onEnviarWhatsApp}
            disabled={disabled}
            title="Enviar confirmação via WhatsApp"
            aria-label="Enviar confirmação via WhatsApp"
            className={`${CHIP_COMPACT} bg-green-50 text-green-800 hover:bg-green-100`}
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
        {v.showAnamnese ? (
          <button
            type="button"
            onClick={onEnviarAnamnese}
            disabled={disabled}
            title="Enviar link da Anamnese via WhatsApp"
            aria-label="Enviar link da Anamnese via WhatsApp"
            className={`${CHIP_COMPACT} bg-teal-50 text-teal-800 hover:bg-teal-100`}
          >
            <FileText className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
        {v.showReagendar ? (
          <button
            type="button"
            onClick={onReagendar}
            disabled={disabled}
            title="Reagendar"
            aria-label="Reagendar"
            className={`${CHIP_COMPACT} bg-purple-50 text-purple-800 hover:bg-purple-100`}
          >
            <Calendar className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
        {v.showCancelar ? (
          <button
            type="button"
            onClick={onCancelar}
            disabled={disabled}
            title="Cancelar agendamento"
            aria-label="Cancelar agendamento"
            className={`${CHIP_COMPACT} bg-red-50 text-red-700 hover:bg-red-100`}
          >
            <XCircle className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
        {v.showRemoverBloqueio ? (
          <button
            type="button"
            onClick={onRemoverBloqueio}
            disabled={disabled}
            title="Remover bloqueio"
            aria-label="Remover bloqueio"
            className={`${CHIP_COMPACT} bg-slate-100 text-slate-700 hover:bg-slate-200`}
          >
            <XCircle className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {tipo === 'bloqueio' && status !== 'cancelado' ? (
        <span className="text-xs font-medium text-slate-600">Horário bloqueado</span>
      ) : null}
      {status === 'realizado' ? (
        <span className="text-xs italic text-gray-500">Atendimento finalizado</span>
      ) : null}
      {status === 'cancelado' ? (
        <span className="text-xs italic text-gray-500">{noShow ? 'Cancelado — no-show' : 'Cancelado'}</span>
      ) : status === 'reagendado' ? (
        <span className="text-xs italic text-purple-800">Reagendado</span>
      ) : null}
      {showMotivoLine ? (
        <p className="text-sm text-gray-500">Motivo: {labelMotivo}</p>
      ) : null}

      {anyChip ? (
        <div className="flex flex-wrap gap-1">
          {v.showRealizado ? (
            <button
              type="button"
              onClick={onMarcarRealizado}
              disabled={disabled}
              title="Marcar como realizado"
              className={`${CHIP_DEFAULT} bg-blue-50 text-blue-700 hover:bg-blue-100`}
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
              className={`${CHIP_DEFAULT} bg-orange-50 text-orange-700 hover:bg-orange-100`}
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
              className={`${CHIP_DEFAULT} bg-green-50 text-green-800 hover:bg-green-100`}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </button>
          ) : null}
          {v.showAnamnese ? (
            <button
              type="button"
              onClick={onEnviarAnamnese}
              disabled={disabled}
              title="Enviar link da Anamnese via WhatsApp"
              className={`${CHIP_DEFAULT} bg-teal-50 text-teal-800 hover:bg-teal-100`}
            >
              <FileText className="h-3.5 w-3.5" />
              Anamnese
            </button>
          ) : null}
          {v.showReagendar ? (
            <button
              type="button"
              onClick={onReagendar}
              disabled={disabled}
              title="Reagendar"
              className={`${CHIP_DEFAULT} bg-purple-50 text-purple-800 hover:bg-purple-100`}
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
              className={`${CHIP_DEFAULT} bg-red-50 text-red-700 hover:bg-red-100`}
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancelar
            </button>
          ) : null}
          {v.showRemoverBloqueio ? (
            <button
              type="button"
              onClick={onRemoverBloqueio}
              disabled={disabled}
              title="Remover bloqueio"
              className={`${CHIP_DEFAULT} bg-slate-100 text-slate-700 hover:bg-slate-200`}
            >
              <XCircle className="h-3.5 w-3.5" />
              Remover bloqueio
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
