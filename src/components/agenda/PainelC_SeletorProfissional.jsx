import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { gerarCorAvatar, iniciaisDoNome } from '../../utils/gerarCorAvatar.js';

// STUB — Checkpoint 2 implementará busca client-side por nome/especialidade.
export function PainelC_SeletorProfissional({ equipeList, horaSelecionandoPendente, onSelecionarProfissional, onVoltar }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onVoltar?.()}
          className="rounded-lg p-1 text-ink-500 hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500"
          aria-label="Voltar para horários"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-ink-800">Escolher profissional</span>
      </div>

      <div className="space-y-1.5">
        {(equipeList || []).map((prof) => {
          const cor = gerarCorAvatar(prof.nome);
          const iniciais = iniciaisDoNome(prof.nome);

          return (
            <button
              key={prof.roleUserId}
              type="button"
              onClick={() => onSelecionarProfissional?.({ hora: horaSelecionandoPendente, profissional: prof })}
              className="flex w-full items-center gap-3 rounded-xl border border-ink-100 bg-white px-3 py-2.5 text-left hover:border-vivid-teal-200 hover:bg-vivid-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500"
            >
              {prof.fotoUrl ? (
                <img
                  src={prof.fotoUrl}
                  alt={prof.nome}
                  className="h-8 w-8 shrink-0 rounded-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${cor.bg} ${cor.fg}`}
                >
                  {iniciais}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-800">{prof.nome}</p>
                {prof.roleNome && (
                  <p className="truncate text-xs text-ink-500">{prof.roleNome}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs text-ink-400">
        Busca e filtro no Checkpoint 2
      </p>
    </div>
  );
}
