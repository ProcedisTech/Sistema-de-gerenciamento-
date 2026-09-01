import React, { useEffect, useState, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Loader2, Smartphone, CheckCircle2 } from 'lucide-react';
import { anamneseEnvioApi } from '../../services/api';
import {
  chaveGerarAnamneseEnvio,
  obterGerarInFlight,
  registrarGerarInFlight,
  liberarGerarInFlight,
  montarUrlWhatsAppAnamnese,
} from './solicitarAnamneseEnvio.js';

/**
 * @param {{ metodoCodigo: string, canalCodigo?: string|null }} escolha
 * @param {{
 *   pacienteId: string,
 *   telefonePaciente?: string,
 *   pacienteNome?: string,
 *   pacienteCpf?: string,
 *   preenchimentoAnamneseId?: string|null,
 *   anamneseId?: string|null,
 * }} payload
 */
export function SolicitarAnamneseModal({
  open,
  onClose,
  escolha,
  payload,
  onConcluido,
  onCancelar,
  onEnvioGerado,
  onEnvioExpirado,
}) {
  const [sessaoData, setSessaoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expirado, setExpirado] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const pollingRef = useRef(null);
  const gerarSeqRef = useRef(0);
  const wasOpenRef = useRef(false);

  const onConcluidoRef = useRef(onConcluido);
  const onEnvioGeradoRef = useRef(onEnvioGerado);
  const onEnvioExpiradoRef = useRef(onEnvioExpirado);
  useEffect(() => { onConcluidoRef.current = onConcluido; }, [onConcluido]);
  useEffect(() => { onEnvioGeradoRef.current = onEnvioGerado; }, [onEnvioGerado]);
  useEffect(() => { onEnvioExpiradoRef.current = onEnvioExpirado; }, [onEnvioExpirado]);

  const canalCodigo = escolha?.canalCodigo ?? null;
  const isQr = !canalCodigo;
  const isWhatsApp = canalCodigo === 'WHATSAPP';
  const pacienteId = payload?.pacienteId;
  const telefonePaciente = payload?.telefonePaciente;
  const preenchimentoAnamneseId = payload?.preenchimentoAnamneseId ?? null;
  const anamneseId = payload?.anamneseId ?? null;

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) {
      setSessaoData(null);
      setLoading(true);
      setError(null);
      setExpirado(false);
      setConcluido(false);
    }
  }

  const montarPayloadGerar = useCallback(() => ({
    pacienteId,
    canalCodigo: canalCodigo || null,
    telefonePaciente: canalCodigo ? (telefonePaciente || null) : null,
    ...(preenchimentoAnamneseId ? { preenchimentoAnamneseId } : {}),
    ...(anamneseId ? { anamneseId } : {}),
  }), [pacienteId, canalCodigo, telefonePaciente, preenchimentoAnamneseId, anamneseId]);

  const iniciarGeracao = useCallback((forcarNovo = false) => {
    const key = chaveGerarAnamneseEnvio(
      pacienteId,
      canalCodigo,
      telefonePaciente,
      preenchimentoAnamneseId,
    );
    if (forcarNovo) {
      liberarGerarInFlight(key);
    }

    setLoading(true);
    setError(null);
    setExpirado(false);
    setConcluido(false);
    if (pollingRef.current) clearInterval(pollingRef.current);

    const seq = gerarSeqRef.current + 1;
    gerarSeqRef.current = seq;

    let pending = forcarNovo ? null : obterGerarInFlight(key);
    if (!pending) {
      pending = anamneseEnvioApi.gerar(montarPayloadGerar());
      registrarGerarInFlight(key, pending);
    }

    pending
      .then((data) => {
        if (gerarSeqRef.current !== seq) return;
        setSessaoData(data);
        setLoading(false);
        onEnvioGeradoRef.current?.(data);
        if (data?.envioId) {
          pollingRef.current = setInterval(async () => {
            try {
              const statusData = await anamneseEnvioApi.status(data.envioId);
              if (statusData.status === 'CONCLUIDO') {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
                setConcluido(true);
                setTimeout(() => {
                  onConcluidoRef.current?.();
                }, 1500);
              } else if (statusData.status === 'EXPIRADO' || statusData.status === 'CANCELADO') {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
                setExpirado(true);
                setLoading(false);
                onEnvioExpiradoRef.current?.();
              }
            } catch (err) {
              console.error('Erro no polling da anamnese', err);
            }
          }, 3000);
        }
      })
      .catch((err) => {
        if (gerarSeqRef.current !== seq) return;
        setError(err.message || 'Falha ao gerar solicitação');
        setLoading(false);
        liberarGerarInFlight(key);
      });
  }, [
    pacienteId,
    canalCodigo,
    telefonePaciente,
    preenchimentoAnamneseId,
    montarPayloadGerar,
  ]);

  const iniciarGeracaoRef = useRef(iniciarGeracao);
  useEffect(() => {
    iniciarGeracaoRef.current = iniciarGeracao;
  }, [iniciarGeracao]);

  useEffect(() => {
    const key = chaveGerarAnamneseEnvio(
      pacienteId,
      canalCodigo,
      telefonePaciente,
      preenchimentoAnamneseId,
    );
    if (!open) {
      wasOpenRef.current = false;
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = null;
      liberarGerarInFlight(key);
      return undefined;
    }

    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      iniciarGeracaoRef.current(false);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = null;
    };
  }, [open, pacienteId, canalCodigo, telefonePaciente, preenchimentoAnamneseId]);

  if (!open) return null;

  const urlWhatsApp = () => montarUrlWhatsAppAnamnese({
    telefonePaciente: payload.telefonePaciente,
    pacienteCpf: payload.pacienteCpf,
    pacienteNome: payload.pacienteNome,
    urlPublica: sessaoData?.urlPublica,
  });

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-300">
        <header className="flex justify-end p-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="px-6 pb-8 text-center flex flex-col items-center">
          {concluido ? (
            <div className="flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-500">
                <CheckCircle2 className="h-10 w-10" strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Anamnese recebida!</h3>
              <p className="text-sm text-slate-500">A paciente preencheu e assinou a ficha.</p>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
              <p className="text-slate-600 font-medium">Gerando solicitação...</p>
            </div>
          ) : expirado ? (
            <div className="flex flex-col items-center gap-4 py-4 w-full">
              <div className="rounded-full bg-amber-100 p-4 text-amber-600">
                <X className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Link expirado</h3>
              <p className="text-sm text-slate-500">
                O prazo acabou. Gere um novo link com as mesmas respostas da entrevista.
              </p>
              <button
                type="button"
                onClick={() => iniciarGeracao(true)}
                className="mt-2 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
              >
                Gerar novo link
              </button>
              <button
                type="button"
                onClick={onCancelar}
                className="text-sm font-semibold text-slate-400 hover:text-slate-600 underline"
              >
                Tentar outro método
              </button>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="rounded-full bg-red-100 p-4 text-red-500">
                <X className="h-8 w-8" />
              </div>
              <p className="text-slate-800 font-bold">{error}</p>
              <button
                type="button"
                onClick={onCancelar}
                className="mt-2 text-sm font-semibold text-slate-500 underline"
              >
                Tentar outro método
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-5 w-full">
              <div className="rounded-2xl bg-indigo-50 p-4 text-indigo-600">
                <Smartphone className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Aguardando paciente</h3>

              {isQr && sessaoData?.urlPublica && (
                <div className="rounded-2xl border-2 border-slate-100 bg-white p-4 shadow-sm">
                  <QRCodeSVG value={sessaoData.urlPublica} size={180} />
                </div>
              )}

              {isWhatsApp && sessaoData?.urlPublica && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 w-full">
                  <p className="text-sm font-semibold text-emerald-800 mb-3">Link gerado com sucesso!</p>
                  <a
                    href={urlWhatsApp()}
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-full items-center justify-center rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#1ebd5b] transition-all"
                  >
                    Enviar via WhatsApp
                  </a>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm text-slate-500 mt-2 bg-slate-50 py-2 px-4 rounded-full">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                Aguardando preenchimento...
              </div>

              <button
                type="button"
                onClick={onCancelar}
                className="mt-2 text-sm font-semibold text-slate-400 hover:text-slate-600 underline"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
