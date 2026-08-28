import React, { useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { newClientKey } from './editorDocumentoState.js';

function normalizeOrdem(list) {
  return list.map((a, i) => ({ ...a, ordem: i + 1 }));
}

/**
 * Editor inline de alternativas (escolha_unica / multipla_escolha).
 * Reordenação por setas (touch-friendly). ordem 1-based.
 */
export function AnamneseDocAlternativas({ alternativas = [], editavel, onChange }) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);
  const list = Array.isArray(alternativas) ? alternativas : [];
  const validCount = list.filter((a) => String(a.alternativa || '').trim()).length;

  const commitDraft = () => {
    const texto = draft.trim();
    if (!texto || !editavel) return;
    const dup = list.some(
      (a) => String(a.alternativa || '').trim().toLowerCase() === texto.toLowerCase()
    );
    if (dup) return;
    onChange(
      normalizeOrdem([
        ...list,
        { id: null, clientKey: newClientKey('alt'), alternativa: texto, ordem: list.length + 1 },
      ])
    );
    setDraft('');
    queueMicrotask(() => inputRef.current?.focus());
  };

  const updateAt = (idx, texto) => {
    onChange(
      normalizeOrdem(
        list.map((a, i) => (i === idx ? { ...a, alternativa: texto } : a))
      )
    );
  };

  const removeAt = (idx) => {
    onChange(normalizeOrdem(list.filter((_, i) => i !== idx)));
  };

  const move = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    const tmp = next[idx];
    next[idx] = next[j];
    next[j] = tmp;
    onChange(normalizeOrdem(next));
  };

  return (
    <div className="mt-2 rounded-xl border border-dashed border-teal-200 bg-white/80 px-2.5 py-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-teal-700/80">
          Opções de resposta
        </span>
        {validCount < 2 ? (
          <span className="text-[10.5px] font-medium text-amber-700">Mínimo 2 opções</span>
        ) : null}
      </div>

      {list.length === 0 ? (
        <p className="mb-2 rounded-lg border border-dashed border-[#cbd5e1] bg-[#fcfdfd] px-3 py-2.5 text-[12px] leading-relaxed text-[#64748b]">
          Nenhuma opção ainda. Digite abaixo e aperte Enter.
        </p>
      ) : (
        <ul className="mb-2 space-y-1.5">
          {list.map((alt, idx) => (
            <li
              key={alt.clientKey || alt.id || `alt-${idx}`}
              className="flex items-center gap-1.5"
            >
              <div className="flex shrink-0 flex-col gap-0.5">
                <button
                  type="button"
                  disabled={!editavel || idx === 0}
                  aria-label="Subir opção"
                  onClick={() => move(idx, -1)}
                  className="grid h-8 w-8 place-items-center rounded-md text-[#94a3b8] hover:bg-teal-50 hover:text-teal-700 disabled:opacity-[0.38] focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={!editavel || idx === list.length - 1}
                  aria-label="Descer opção"
                  onClick={() => move(idx, 1)}
                  className="grid h-8 w-8 place-items-center rounded-md text-[#94a3b8] hover:bg-teal-50 hover:text-teal-700 disabled:opacity-[0.38] focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                type="text"
                value={alt.alternativa || ''}
                disabled={!editavel}
                className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#e2e8f0] bg-white px-2.5 text-base font-medium text-[#0f172a] outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100 disabled:opacity-[0.42] sm:min-h-9 sm:text-[13px]"
                onChange={(e) => updateAt(idx, e.target.value)}
              />
              <button
                type="button"
                disabled={!editavel}
                aria-label="Remover opção"
                onClick={() => removeAt(idx)}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-[#94a3b8] hover:bg-rose-50 hover:text-rose-600 disabled:opacity-[0.38] focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 sm:h-9 sm:w-9"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          disabled={!editavel}
          placeholder="Nova opção…"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-dashed border-teal-200 bg-teal-50/40 px-2.5 text-base font-medium text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-teal-400 focus:bg-white disabled:opacity-[0.42] sm:min-h-9 sm:text-[13px]"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              commitDraft();
            }
          }}
        />
        <button
          type="button"
          disabled={!editavel || !draft.trim()}
          aria-label="Adicionar opção"
          onClick={commitDraft}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 disabled:opacity-[0.38] focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 sm:h-9 sm:w-9"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
