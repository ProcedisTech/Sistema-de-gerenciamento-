import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { gerarCorAvatar, iniciaisDoNome } from '../../utils/gerarCorAvatar.js';

export function PainelC_SeletorProfissional({ equipeList, equipeLoading, equipeError, horaSelecionandoPendente, onSelecionarProfissional, onVoltar }) {
  const [busca, setBusca] = useState('');

  const termo = busca.trim().toLowerCase();
  const lista = (equipeList || []).filter((p) =>
    !termo ||
    p.nome.toLowerCase().includes(termo) ||
    (p.especialidade || '').toLowerCase().includes(termo) ||
    (p.roleNome || '').toLowerCase().includes(termo)
  );

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
        <span className="text-sm font-semibold text-ink-800">Escolher profissional</span>
      </div>

      {/* Busca */}
      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome ou especialidade..."
        className="w-full rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-800 outline-none placeholder:text-ink-400 focus:border-vivid-teal-400 focus:ring-2 focus:ring-vivid-teal-100"
        autoFocus
      />

      {/* Loading */}
      {equipeLoading && (
        <div className="space-y-1.5 py-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-ink-100" />
          ))}
        </div>
      )}

      {/* Erro */}
      {!equipeLoading && equipeError && (
        <div className="py-4 text-center text-xs text-ink-500">
          Falha ao carregar profissionais. Feche e reabra o modal para tentar novamente.
        </div>
      )}

      {/* Lista */}
      {!equipeLoading && !equipeError && (
        lista.length === 0 ? (
          <div className="py-6 text-center text-xs text-ink-400">
            {termo ? `Nenhum resultado para "${busca}"` : 'Nenhum profissional disponível'}
          </div>
        ) : (
          <div className="space-y-1.5">
            {lista.map((prof) => {
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
                    {(prof.roleNome || prof.especialidade) && (
                      <p className="truncate text-xs text-ink-500">
                        {prof.roleNome || prof.especialidade}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
