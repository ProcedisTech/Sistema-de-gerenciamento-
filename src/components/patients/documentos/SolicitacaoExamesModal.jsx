import React, { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { generateSolicitacaoExamesPdf, EXAMES_COMPLEMENTARES_CATALOGO } from '../../../utils/pdfGenerator';
import { ViewportDialog } from '../../shared/ViewportDialog.jsx';

export function SolicitacaoExamesModal({ open, onClose, clinicaCtx, pacienteCtx, profissionalCtx }) {
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [observacoes, setObservacoes] = useState('');

  // Reseta a seleção sempre que o modal é reaberto — evita que exames marcados pra um
  // paciente vazem pro PDF de outro se o profissional trocar de paciente sem recarregar
  // a página (ex: botões "Paciente anterior"/"Próximo paciente" no perfil). Ajuste em tempo
  // de render (não em efeito) pra não disparar um segundo render à toa.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSelecionados(new Set());
      setObservacoes('');
    }
  }

  const toggleExame = (nome) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(nome)) next.delete(nome);
      else next.add(nome);
      return next;
    });
  };

  const handleGerarPdf = () => {
    generateSolicitacaoExamesPdf({
      clinicaCtx,
      pacienteCtx,
      profissionalCtx,
      examesSelecionados: Array.from(selecionados),
      observacoes,
    });
    onClose?.();
  };

  return (
    <ViewportDialog open={open} onDismiss={onClose} titleId="solicitacao-exames-title">
      <div className="flex items-center gap-2 border-b border-[#e2e8f0] px-5 py-4">
        <FlaskConical className="h-5 w-5 text-[#00a88e]" />
        <h2 id="solicitacao-exames-title" className="text-[16px] font-bold text-[#0f172a]">
          Solicitação de Exames Complementares
        </h2>
      </div>

      <div className="px-5 py-4">
        <p className="text-[13px] text-[#64748b]">
          Selecione os exames a solicitar. O PDF sai timbrado com os dados da clínica e do paciente.
        </p>
        <div className="mt-3 max-h-[45vh] space-y-1 overflow-y-auto pr-1">
          {EXAMES_COMPLEMENTARES_CATALOGO.map((nome) => (
            <label
              key={nome}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-[#334155] hover:bg-[#f8fafc]"
            >
              <input
                type="checkbox"
                checked={selecionados.has(nome)}
                onChange={() => toggleExame(nome)}
                className="h-4 w-4 rounded border-[#cbd5e1] text-[#00a88e] focus:ring-[#00a88e]"
              />
              {nome}
            </label>
          ))}
        </div>

        <label className="mt-4 block text-[13px] font-semibold text-[#334155]">
          Observações (opcional)
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={3}
            maxLength={400}
            className="mt-1 w-full rounded-xl border border-[#e2e8f0] px-3 py-2 text-[13px] font-normal text-[#0f172a] outline-none focus:border-[#00a88e]"
            placeholder="Ex: jejum de 12h, repetir em 90 dias..."
          />
        </label>
      </div>

      <div className="flex flex-col gap-2 border-t border-[#e2e8f0] px-5 py-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[13px] font-semibold text-[#64748b]"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleGerarPdf}
          disabled={selecionados.size === 0}
          className="rounded-xl bg-[#00a88e] px-4 py-2.5 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Gerar PDF ({selecionados.size})
        </button>
      </div>
    </ViewportDialog>
  );
}
