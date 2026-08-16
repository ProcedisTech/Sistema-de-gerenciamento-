import React, { useEffect, useRef, useState } from 'react';
import { catalogoClinicoApi } from '../../services/api';
import { HABITO_INPUT_CLASS } from './HabitoModalShell';

/**
 * Campos de molde: tipo de antecedente, item fixo, pergunta pai.
 */
export function PerguntaMoldeExtraFields({
  tipoSelecionado,
  tipoAntecedentePessoalId,
  onTipoAntecedenteChange,
  antecedenteCatalogoId,
  antecedenteCatalogoNome,
  onAntecedenteCatalogoChange,
  perguntaPaiId,
  onPerguntaPaiChange,
  tiposAntecedente = [],
  perguntasPai = [],
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const debounceRef = useRef(null);

  const runSearch = (q) => {
    clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await catalogoClinicoApi.antecedentesPessoais(q.trim());
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      }
    }, 300);
  };

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const showTipoAnt = tipoSelecionado === 'catalogo_antecedente';
  const showItemFixo = tipoSelecionado === 'sim_nao_naosei';
  const showPai = tipoSelecionado === 'sim_nao_naosei' || String(tipoSelecionado).startsWith('catalogo_');

  if (!showTipoAnt && !showItemFixo && !showPai) return null;

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      {showTipoAnt ? (
        <div className="space-y-1.5">
          <label className="ml-1 text-[13px] font-bold text-[#00a88e]">Tipo de antecedente</label>
          <select
            value={tipoAntecedentePessoalId || ''}
            onChange={(e) => onTipoAntecedenteChange(e.target.value || null)}
            className={HABITO_INPUT_CLASS}
          >
            <option value="">Todos / sem filtro</option>
            {tiposAntecedente.filter((t) => t.ativo !== false).map((t) => (
              <option key={t.id || t.tipoAntecedentePessoalId} value={t.id || t.tipoAntecedentePessoalId}>
                {t.nome || t.codigo}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {showItemFixo ? (
        <div className="space-y-1.5">
          <label className="ml-1 text-[13px] font-bold text-[#00a88e]">Item fixo (opcional)</label>
          {antecedenteCatalogoId ? (
            <div className="flex items-center justify-between rounded-lg border border-[#00a88e]/30 bg-[#e6f7f5] px-3 py-2 text-[13px] text-[#0f766e]">
              <span>{antecedenteCatalogoNome || antecedenteCatalogoId}</span>
              <button type="button" className="text-[12px] font-bold" onClick={() => onAntecedenteCatalogoChange(null, '')}>
                Limpar
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="search"
                value={query}
                placeholder="Buscar antecedente…"
                onChange={(e) => { setQuery(e.target.value); runSearch(e.target.value); }}
                className={HABITO_INPUT_CLASS}
              />
              {results.length > 0 ? (
                <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow">
                  {results.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-[13px] hover:bg-[#e6f7f5]"
                        onClick={() => {
                          onAntecedenteCatalogoChange(item.id, item.nome);
                          setQuery('');
                          setResults([]);
                        }}
                      >
                        {item.nome}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {showPai ? (
        <div className="space-y-1.5">
          <label className="ml-1 text-[13px] font-bold text-[#00a88e]">Pergunta pai (condicional)</label>
          <select
            value={perguntaPaiId || ''}
            onChange={(e) => onPerguntaPaiChange(e.target.value || null)}
            className={HABITO_INPUT_CLASS}
          >
            <option value="">Nenhuma (raiz)</option>
            {perguntasPai.map((p) => (
              <option key={p.id} value={p.id}>{p.descricao}</option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}
