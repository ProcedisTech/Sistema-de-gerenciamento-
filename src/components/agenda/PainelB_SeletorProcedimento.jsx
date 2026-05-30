import React, { useState } from 'react';
import { ArrowLeft, Check, Plus } from 'lucide-react';
import { gerarCorAvatar, iniciaisDoNome } from '../../utils/gerarCorAvatar.js';

export function PainelB_SeletorProcedimento({ procedimentoOptions, procedimentosSelecionados, onToggle, onVoltar }) {
  const [busca, setBusca] = useState('');

  const termo = busca.trim().toLowerCase();
  const lista = (procedimentoOptions || []).filter((p) =>
    !termo || p.nome.toLowerCase().includes(termo)
  );

  const idsSelecionados = new Set((procedimentosSelecionados || []).map((p) => p.id));

  return (
    <div className="flex flex-col gap-3">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onVoltar?.()}
          className="rounded-lg p-1 text-ink-500 hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500"
          aria-label="Voltar para horários"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-ink-800">Selecionar procedimentos</span>
      </div>

      {/* Busca */}
      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar procedimento..."
        className="w-full rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-800 outline-none placeholder:text-ink-400 focus:border-vivid-teal-400 focus:ring-2 focus:ring-vivid-teal-100"
        autoFocus
      />

      {/* Lista com scroll */}
      <div className="max-h-[320px] overflow-y-auto">
      {lista.length === 0 ? (
        <div className="py-6 text-center text-xs text-ink-400">
          {termo ? `Nenhum resultado para "${busca}"` : 'Nenhum procedimento disponível'}
        </div>
      ) : (
        <ul className="space-y-1">
          {lista.map((proc) => {
            const selecionado = idsSelecionados.has(proc.id);
            const cor = gerarCorAvatar(proc.nome);
            const iniciais = iniciaisDoNome(proc.nome);

            return (
              <li key={proc.id}>
                <button
                  type="button"
                  onClick={() => onToggle?.(proc)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500 ${
                    selecionado
                      ? 'border-vivid-teal-300 bg-vivid-teal-50'
                      : 'border-ink-100 bg-white hover:border-vivid-teal-200 hover:bg-vivid-teal-50'
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${cor.bg} ${cor.fg}`}
                  >
                    {iniciais}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${selecionado ? 'text-vivid-teal-800' : 'text-ink-800'}`}>
                      {proc.nome}
                    </p>
                    <p className="text-[11px] text-ink-400">{proc.duracaoMin} min</p>
                  </div>

                  {/* Indicador */}
                  {selecionado ? (
                    <Check className="h-4 w-4 shrink-0 text-vivid-teal-600" />
                  ) : (
                    <Plus className="h-4 w-4 shrink-0 text-ink-400" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      </div>
    </div>
  );
}
