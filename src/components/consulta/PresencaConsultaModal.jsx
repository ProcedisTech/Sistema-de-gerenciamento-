import { useEffect, useRef, useState } from 'react';

const UM_MINUTO = 60 * 1000;
const HORA = 60 * UM_MINUTO;

/** Pergunta "você ainda está aí?" quando o prazo de presença da consulta vence. Só o clique confirma (digitar não conta). */
export default function PresencaConsultaModal({ minhas, confirmarPresenca, reler, onErro }) {
  const [agora, setAgora] = useState(() => Date.now());
  const [confirmadaChave, setConfirmadaChave] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const relidaRef = useRef(null);
  const relerRef = useRef(reler);
  relerRef.current = reler;

  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const candidata = (minhas ?? []).find(
    (c) => c?.status === 'aberto' && c.presencaAte && agora >= new Date(c.presencaAte).getTime(),
  );
  const chave = candidata ? `${candidata.id}|${candidata.presencaAte}` : null;

  // Relê uma vez por chave antes de mostrar: outra aba pode já ter dito "Sim".
  useEffect(() => {
    if (!chave || relidaRef.current === chave) return;
    relidaRef.current = chave;
    Promise.resolve(relerRef.current?.()).catch(() => {}).finally(() => setConfirmadaChave(chave));
  }, [chave]);

  useEffect(() => {
    const aoVoltar = () => { if (document.visibilityState === 'visible') relerRef.current?.(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, []);

  const visivel = chave !== null && confirmadaChave === chave;

  // Aberto, não fica na tela depois de a consulta fechar em outra aba ou no job.
  useEffect(() => {
    if (!visivel) return undefined;
    const id = setInterval(() => relerRef.current?.(), UM_MINUTO);
    return () => clearInterval(id);
  }, [visivel]);

  if (!visivel) return null;

  const horas = Math.max(0, Math.floor((agora - new Date(candidata.iniciadoEm).getTime()) / HORA));

  const sim = async () => {
    setEnviando(true);
    try {
      await confirmarPresenca(candidata.id);
    } catch (err) {
      if (err?.status === 409) relerRef.current?.();
      else onErro?.('Não foi possível confirmar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="presenca-consulta-title"
    >
      <div className="w-full max-w-sm rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-2xl">
        <h4 id="presenca-consulta-title" className="text-[16px] font-bold text-[#0f172a]">
          {`Já faz ${horas} h de consulta. Você ainda está aí?`}
        </h4>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            autoFocus
            disabled={enviando}
            onClick={sim}
            className="h-10 rounded-lg bg-[#14B8A6] px-4 text-[13px] font-semibold text-white hover:bg-[#0d9488] disabled:opacity-60"
          >
            Sim, estou aqui
          </button>
        </div>
      </div>
    </div>
  );
}
