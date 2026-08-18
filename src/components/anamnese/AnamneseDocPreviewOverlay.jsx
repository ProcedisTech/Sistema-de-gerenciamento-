import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnamneseFillLayout } from './AnamneseFillLayout.jsx';
import { computeDocStats } from './editorTipoMeta.js';

const SEGMENTS = [
  { id: 'cel', label: 'Ela preenche', subtitle: 'Assim a paciente vê no celular', layout: 'mobile', wide: false },
  { id: 'at', label: 'Equipe preenche', subtitle: 'Visão ampla para a recepção', layout: 'wide', wide: true },
  { id: 'doc', label: 'Documento assinado', subtitle: 'Como fica arquivado após envio', layout: null, wide: true },
];

function fichaToPreviewItens(secoes) {
  const itens = [];
  for (const sec of secoes) {
    for (const q of sec.perguntas) {
      if (!q.descricao?.trim()) continue;
      itens.push({
        id: q.clientKey,
        ordem: q.ordem,
        obrigatorio: q.obrigatorio,
        pergunta: {
          id: q.clientKey,
          descricao: q.descricao,
          tipoResposta: q.tipoRespostaCodigo,
          prioridade: q.prioridade,
          alternativas: q.alternativas || [],
        },
      });
    }
  }
  return itens;
}

function DocModePlaceholder({ state }) {
  const stats = computeDocStats(state.secoes);
  return (
    <div className="docmode flex h-full flex-col overflow-y-auto bg-white p-6 text-[#0f172a]">
      <div className="border-b border-[#f1f5f9] pb-4">
        <h2 className="text-[20px] font-bold tracking-[-0.02em]">{state.nome || 'Nova ficha'}</h2>
        {state.textoDeclaracao ? (
          <p className="mt-3 rounded-lg border border-dashed border-[#cbd5e1] bg-[#fcfdfd] p-3 text-[12px] leading-relaxed text-[#64748b]">
            {state.textoDeclaracao}
          </p>
        ) : null}
      </div>
      <div className="mt-4 space-y-4">
        {state.secoes.map((sec, i) => (
          <section key={sec.clientKey}>
            <h3 className="text-[14px] font-semibold text-[#0f172a]">
              {sec.nome || `Seção ${i + 1}`}
            </h3>
            <ul className="mt-2 space-y-1.5">
              {sec.perguntas
                .filter((q) => q.descricao?.trim())
                .map((q) => (
                  <li key={q.clientKey} className="text-[13px] text-[#475569]">
                    {q.perguntaPaiClientKey ? '↳ ' : ''}
                    {q.descricao}
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-auto pt-6 text-center text-[11px] text-[#94a3b8]">
        Pré-visualização estrutural · {stats.q} perguntas · documento assinado requer preenchimento real
      </p>
    </div>
  );
}

export function AnamneseDocPreviewOverlay({ open, onClose, state }) {
  const [segment, setSegment] = useState('cel');
  const previewItens = useMemo(() => fichaToPreviewItens(state.secoes || []), [state.secoes]);
  const activeSeg = SEGMENTS.find((s) => s.id === segment) || SEGMENTS[0];

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="anamnese-sora fixed inset-0 z-[150] bg-[radial-gradient(ellipse_at_center,#1e293b_0%,#0f172a_70%)]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-x-0 top-0 z-[2] flex flex-wrap items-center gap-3 px-6 py-[18px]">
        <div>
          <h4 className="text-[13px] font-semibold text-white/90">{state.nome || 'Ficha'}</h4>
          <p className="mt-px text-[11.5px] text-white/40">{activeSeg.subtitle}</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1 rounded-lg bg-white/10 p-1">
          {SEGMENTS.map((seg) => (
            <button
              key={seg.id}
              type="button"
              onClick={() => setSegment(seg.id)}
              className={`rounded-md px-3 py-1.5 text-[11.5px] font-semibold transition-colors ${
                segment === seg.id ? 'bg-white text-[#0f172a]' : 'text-white/70 hover:text-white'
              }`}
            >
              {seg.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-[11.5px] font-semibold text-white/80 hover:bg-white/20"
        >
          Fechar ✕
        </button>
      </div>

      <div className="flex h-full items-center justify-center px-6 pb-6 pt-24">
        <div
          className={`relative overflow-hidden rounded-[28px] border-[10px] border-[#1e293b] bg-white shadow-[0_24px_64px_rgba(0,0,0,0.45)] ${
            activeSeg.wide ? 'h-[min(720px,85vh)] w-[min(920px,95vw)]' : 'h-[min(720px,85vh)] w-[min(390px,95vw)]'
          }`}
        >
          {!activeSeg.wide ? (
            <div className="absolute left-1/2 top-2 z-10 h-[22px] w-[100px] -translate-x-1/2 rounded-full bg-[#1e293b]" />
          ) : null}
          <div className={`h-full overflow-hidden ${activeSeg.wide ? '' : 'pt-6'}`}>
            {segment === 'doc' ? (
              <DocModePlaceholder state={state} />
            ) : (
              <AnamneseFillLayout
                itens={previewItens}
                respostas={{}}
                readOnly={false}
                layout={activeSeg.layout}
              />
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
