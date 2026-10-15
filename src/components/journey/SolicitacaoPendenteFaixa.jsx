import React from 'react';
import { formatarInstante } from '../../utils/datasClinica';
import { useFusoClinica } from '../hooks/useFusoClinica';

function formatarDataHora(valor, fuso) {
  if (!valor) return null;
  return formatarInstante(valor, fuso, 'dataHoraSeg') || null;
}

/** Pedido de anamnese em branco aguardando o paciente. Visual do bloco "Aguardando resposta" de AnamneseAssinaturaActions. */
export function SolicitacaoPendenteFaixa({ pedido, onVerQr, onCancelar }) {
  const { fuso } = useFusoClinica();
  if (!pedido) return null;
  const enviada = formatarDataHora(pedido.enviadoEm, fuso);
  const expira = formatarDataHora(pedido.expiraEm, fuso);
  return (
    <div className="mb-4 flex flex-col items-end gap-1" data-testid="solicitacao-pendente-faixa">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-3 py-1.5 text-[11px] font-bold tracking-wide text-[#1d4ed8]">
        Anamnese solicitada ao paciente · aguardando resposta
        {enviada ? ` · enviada ${enviada}` : ''}
        {expira ? ` · expira ${expira}` : ''}
      </span>
      <div className="flex items-center gap-3">
        {typeof onVerQr === 'function' && (
          <button
            type="button"
            onClick={() => onVerQr()}
            className="text-[11px] font-bold text-[#1d4ed8] underline hover:text-[#1e40af]"
          >
            Ver QR / link
          </button>
        )}
        <button
          type="button"
          onClick={() => onCancelar?.()}
          className="text-[11px] font-bold text-[#1d4ed8] underline hover:text-[#1e40af]"
        >
          Cancelar solicitação
        </button>
      </div>
    </div>
  );
}
