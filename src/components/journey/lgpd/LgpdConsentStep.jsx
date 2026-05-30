/**
 * LgpdConsentStep.jsx
 *
 * Componente de UI para a step "Termos" dentro do fluxo de Avaliação.
 * Exibe o painel de aviso legal e as duas ações principais:
 *   a) "Visualizar Documento" — abre o modal com o texto renderizado
 *   b) "Exportar PDF e Assinar" — gera o PDF, dispara download e persiste o aceite
 *
 * Este componente é APENAS de UI (presentational): toda lógica de negócio
 * vive em useLgpdConsent() e na função pura buildLgpdConsentText().
 *
 * Props obrigatórias para interpolação:
 *   - paciente:     { nome, cpf }
 *   - clinica:      { nome, cnpj }
 *   - profissional: { nome }
 *
 * Props de assinatura (necessárias para persistir o aceite):
 *   - termoId, pacienteId, roleUserId, procedimentoFeitoId
 *   - assinaturaProfissional, assinaturaPaciente (data URLs dos canvas)
 *   - profissionalAssinouEm, pacienteAssinouEm (timestamps ms)
 *
 * @module LgpdConsentStep
 */

import React, { useMemo, useState } from 'react';
import {
  Shield,
  Eye,
  FileDown,
  CheckCircle2,
  AlertTriangle,
  Info,
  Loader2,
} from 'lucide-react';

import { buildLgpdConsentText, validateLgpdContext } from './lgpdConsentText';
import { useLgpdConsent } from './useLgpdConsent';
import { LgpdDocumentModal } from './LgpdDocumentModal';

// ── Sub-componente: painel de aviso legal ────────────────────────────────────

function LegalNoticePanel({ missingFields }) {
  const hasMissing = missingFields.length > 0;
  return (
    <div
      className={`mb-6 rounded-2xl border p-4 ${
        hasMissing
          ? 'border-amber-200 bg-amber-50'
          : 'border-emerald-200 bg-[#f0fdf4]'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
            hasMissing ? 'bg-amber-100' : 'bg-emerald-100'
          }`}
        >
          {hasMissing ? (
            <AlertTriangle className="h-4.5 w-4.5 text-amber-600" strokeWidth={2} aria-hidden />
          ) : (
            <Info className="h-4.5 w-4.5 text-emerald-700" strokeWidth={2} aria-hidden />
          )}
        </div>
        <div className="min-w-0">
          <p className={`text-[13px] font-bold ${hasMissing ? 'text-amber-800' : 'text-emerald-800'}`}>
            {hasMissing
              ? 'Dados incompletos para o termo LGPD'
              : 'Termo de Consentimento LGPD pronto para assinar'}
          </p>
          <p className={`mt-1 text-[12px] leading-relaxed ${hasMissing ? 'text-amber-700' : 'text-emerald-700'}`}>
            {hasMissing ? (
              <>
                Os campos{' '}
                <span className="font-mono font-semibold">{missingFields.join(', ')}</span>{' '}
                estão ausentes. O documento será gerado com placeholders. Revise o cadastro do paciente/clínica se necessário.
              </>
            ) : (
              'Visualize o documento e clique em "Exportar PDF e Assinar" para gerar o PDF, realizar o download e registrar o aceite com validade jurídica.'
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

/**
 * @param {Object}      props
 * @param {Object}      props.paciente            { nome, cpf }
 * @param {Object}      props.clinica             { nome, cnpj }
 * @param {Object}      props.profissional        { nome }
 * @param {string}      props.termoId             UUID do tb_termo (opcional: se null, não persiste)
 * @param {string}      props.pacienteId          UUID do paciente
 * @param {string}      [props.roleUserId]        UUID do profissional (role_user)
 * @param {string}      [props.procedimentoFeitoId]
 * @param {string}      [props.assinaturaProfissional] Data URL do canvas
 * @param {string}      [props.assinaturaPaciente]     Data URL do canvas
 * @param {number|null} [props.profissionalAssinouEm]  Timestamp ms
 * @param {number|null} [props.pacienteAssinouEm]      Timestamp ms
 * @param {Function}    [props.onAceiteRegistrado] Callback após persistência bem-sucedida
 */
export function LgpdConsentStep({
  paciente,
  clinica,
  profissional,
  termoId                = null,
  pacienteId,
  roleUserId             = null,
  procedimentoFeitoId    = null,
  assinaturaProfissional = '',
  assinaturaPaciente     = '',
  profissionalAssinouEm  = null,
  pacienteAssinouEm      = null,
  onAceiteRegistrado,
}) {
  const [modalOpen,       setModalOpen]       = useState(false);
  const [aceiteRegistrado, setAceiteRegistrado] = useState(false);
  const [errorMessage,    setErrorMessage]    = useState('');

  const { isExporting, isPersisting, exportAndSign } = useLgpdConsent();

  // Texto interpolado — recalcula apenas quando o contexto muda
  const ctx = useMemo(
    () => ({ paciente, clinica, profissional }),
    [paciente, clinica, profissional],
  );

  const consentText    = useMemo(() => buildLgpdConsentText(ctx), [ctx]);
  const { missingFields } = useMemo(() => validateLgpdContext(ctx), [ctx]);

  const isBusy          = isExporting || isPersisting;
  const podeAssinar     = !aceiteRegistrado && Boolean(assinaturaProfissional) && Boolean(assinaturaPaciente);
  const faltaAssinaturas = !assinaturaProfissional || !assinaturaPaciente;

  const handleExportAndSign = async () => {
    if (!pacienteId) {
      setErrorMessage('Paciente não identificado. Não é possível registrar o aceite.');
      return;
    }
    if (faltaAssinaturas) {
      setErrorMessage('É necessário que o profissional e o paciente assinem antes de exportar e registrar o aceite.');
      return;
    }

    setErrorMessage('');
    try {
      const result = await exportAndSign({
        termoId,
        pacienteId,
        roleUserId,
        procedimentoFeitoId,
        consentText,
        assinaturaProfissional,
        assinaturaPaciente,
        profissionalAssinouEm,
        pacienteAssinouEm,
        onSuccess: (res) => {
          setAceiteRegistrado(true);
          onAceiteRegistrado?.(res);
        },
      });
      return result;
    } catch (err) {
      const msg = err?.message || 'Erro ao gerar PDF ou registrar aceite. Tente novamente.';
      setErrorMessage(msg);
    }
  };

  return (
    <div className="min-w-0">
      {/* Título da seção */}
      <div className="mb-6 flex items-center gap-4">
        <div className="rounded-2xl border border-emerald-200 bg-[#dcfce7] p-3 text-[#16a34a]">
          <Shield className="h-7 w-7" strokeWidth={2.5} aria-hidden />
        </div>
        <div>
          <h3 className="text-[20px] font-bold text-[#0f172a]">Termo de Consentimento LGPD</h3>
          <p className="text-[14px] font-medium text-[#64748b]">
            Lei nº 13.709/2018 — Proteção de Dados Pessoais
          </p>
        </div>
      </div>

      {/* Painel de aviso legal */}
      <LegalNoticePanel missingFields={missingFields} />

      {/* Estado de sucesso */}
      {aceiteRegistrado ? (
        <div
          className="flex items-center gap-3 rounded-2xl border border-emerald-300 bg-[#f0fdf4] px-5 py-4"
          role="status"
          aria-live="polite"
        >
          <CheckCircle2 className="h-7 w-7 shrink-0 text-[#16a34a]" strokeWidth={2} aria-hidden />
          <div>
            <p className="text-[15px] font-bold text-[#166534]">Aceite registrado com sucesso!</p>
            <p className="text-[13px] text-[#15803d]">
              O PDF foi gerado, o download realizado e o aceite foi persistido com hash de integridade.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Aviso de assinaturas faltando */}
          {faltaAssinaturas && (
            <div className="flex items-start gap-2 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" strokeWidth={2} aria-hidden />
              <p className="text-[12px] font-medium text-amber-800">
                {!assinaturaProfissional && !assinaturaPaciente
                  ? 'Profissional e paciente precisam assinar antes de exportar o PDF.'
                  : !assinaturaProfissional
                  ? 'O profissional precisa assinar antes de exportar o PDF.'
                  : 'O paciente precisa assinar antes de exportar o PDF.'}
              </p>
            </div>
          )}

          {/* Botão: Visualizar Documento */}
          <button
            id="lgpd-btn-visualizar"
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border-2 border-[#00a88e] bg-white px-5 py-3.5 text-[14px] font-semibold text-[#00a88e] transition-colors hover:bg-[#f0fdfa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a88e] focus-visible:ring-offset-2 active:bg-[#e6f7f5]"
          >
            <Eye className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            Visualizar Documento
          </button>

          {/* Botão: Exportar PDF e Assinar */}
          <button
            id="lgpd-btn-exportar-assinar"
            type="button"
            onClick={handleExportAndSign}
            disabled={isBusy || !podeAssinar}
            aria-busy={isBusy}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#00a88e] px-5 py-3.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#00967f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a88e] focus-visible:ring-offset-2 active:bg-[#00967f] disabled:cursor-not-allowed disabled:bg-[#e2e8f0] disabled:text-[#94a3b8]"
          >
            {isBusy ? (
              <>
                <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                {isExporting ? 'Gerando PDF…' : 'Registrando aceite…'}
              </>
            ) : (
              <>
                <FileDown className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                Exportar PDF e Assinar
              </>
            )}
          </button>

          {/* Mensagem de erro */}
          {errorMessage && (
            <p
              role="alert"
              className="mt-2 flex items-center gap-1.5 text-[12px] font-medium text-red-600"
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
              {errorMessage}
            </p>
          )}
        </div>
      )}

      {/* Modal de visualização */}
      <LgpdDocumentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        consentText={consentText}
        missingFields={missingFields}
        paciente={paciente}
        clinica={clinica}
        profissional={profissional}
      />
    </div>
  );
}
