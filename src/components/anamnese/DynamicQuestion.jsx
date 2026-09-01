import React, { useCallback, useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { AnamneseCatalogoPicker } from './AnamneseCatalogoPicker.jsx';
import { isTipoCatalogoMulti } from './anamneseTipoLabels';

/** Label da pergunta com numeração inline, obrigatório* e ícone de alerta. */
export function QuestionLabel({ numero, descricao, obrigatorio = false, alerta = false }) {
  return (
    <span className="mb-2 flex flex-wrap items-baseline gap-1.5">
      {alerta && <span aria-hidden className="shrink-0 text-[12px] leading-none text-red-500">⚠</span>}
      <span className={`text-[13px] font-semibold leading-snug ${alerta ? 'text-slate-800' : 'text-slate-700'}`}>
        {numero != null && (
          <span className="font-bold tabular-nums text-slate-600">{numero} – </span>
        )}
        {descricao}
      </span>
      {obrigatorio && (
        <span className="text-[11px] font-semibold text-red-600" aria-label="obrigatório">obrigatório*</span>
      )}
    </span>
  );
}

function CatalogoReacaoQuestion({
  pergunta,
  resposta,
  onChange,
  readOnly,
  searchFn,
  numero,
  obrigatorio,
  alerta,
}) {
  const searchEnabled = typeof searchFn === 'function';
  const fetchScope = searchEnabled ? searchFn : null;
  const [loadedScope, setLoadedScope] = useState(null);
  const [opcoes, setOpcoes] = useState([]);

  useEffect(() => {
    if (!searchEnabled) return undefined;
    let cancelled = false;
    const scope = searchFn;
    searchFn('')
      .then((list) => {
        if (!cancelled) setOpcoes(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setOpcoes([]);
      })
      .finally(() => {
        if (!cancelled) setLoadedScope(scope);
      });
    return () => {
      cancelled = true;
    };
  }, [searchFn, searchEnabled]);

  const displayOpcoes = searchEnabled && loadedScope === fetchScope ? opcoes : [];
  const displayLoading = searchEnabled && loadedScope !== fetchScope;

  const selectedId = resposta?.reacaoAdversaId ?? resposta?.catalogoItens?.[0]?.id;

  return (
    <div className="flex w-full min-w-0 flex-col">
      <QuestionLabel numero={numero} descricao={pergunta.descricao} obrigatorio={obrigatorio} alerta={alerta} />
      {displayLoading ? (
        <p className="text-[13px] text-slate-400">Carregando opções…</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {displayOpcoes.map((op) => {
            const id = op.id ?? op.reacaoAdversaId;
            const nome = op.nome ?? op.descricao ?? String(id);
            const ativo = selectedId != null && String(selectedId) === String(id);
            return (
              <button
                key={String(id)}
                type="button"
                disabled={readOnly}
                aria-pressed={ativo}
                onClick={() => {
                  if (readOnly) return;
                  onChange({
                    perguntaId: pergunta.id,
                    reacaoAdversaId: ativo ? null : id,
                    catalogoItens: ativo ? [] : [{ id, nome, fonte: 'catalogo' }],
                  });
                }}
                className={`rounded-xl border px-4 py-2.5 text-[13px] font-medium transition-all ${
                  readOnly ? 'cursor-default opacity-90 ' : 'cursor-pointer '
                }${ativo ? 'border-[#00a88e] bg-[#e6f7f5] text-[#0f766e]' : 'border-slate-200 text-slate-600 hover:border-[#00a88e]/40'}`}
              >
                {nome}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DynamicQuestion({
  pergunta,
  resposta,
  onChange = () => {},
  alerta = false,
  readOnly = false,
  obrigatorio = false,
  numero = null,
  searchFn = null,
}) {
  const tipo = pergunta.tipoResposta;
  const fieldBase = `w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-[14px] text-slate-700 outline-none focus:border-[#00a88e] focus:ring-2 focus:ring-[#00a88e]/15 transition-colors${readOnly ? ' cursor-default bg-slate-50 opacity-90' : ''}`;

  const handleCatalogo = useCallback((next) => {
    onChange({
      perguntaId: pergunta.id,
      catalogoItens: next.catalogoItens,
      textosLivres: next.textosLivres,
      declarouAusencia: next.declarouAusencia,
    });
  }, [onChange, pergunta.id]);

  if (tipo === 'texto') {
    return (
      <div className="flex w-full min-w-0 flex-col">
        <QuestionLabel numero={numero} descricao={pergunta.descricao} obrigatorio={obrigatorio} alerta={alerta} />
        <textarea
          value={resposta?.respostaTexto || ''}
          onChange={(e) => onChange({ perguntaId: pergunta.id, respostaTexto: e.target.value })}
          rows={2}
          readOnly={readOnly}
          className={fieldBase}
          placeholder="Digite a resposta..."
        />
      </div>
    );
  }

  if (tipo === 'numero') {
    return (
      <div className="flex w-full min-w-0 flex-col">
        <QuestionLabel numero={numero} descricao={pergunta.descricao} obrigatorio={obrigatorio} alerta={alerta} />
        <input
          type="number"
          value={resposta?.respostaNumero ?? ''}
          onChange={(e) => onChange({ perguntaId: pergunta.id, respostaNumero: e.target.value === '' ? null : Number(e.target.value) })}
          readOnly={readOnly}
          className={fieldBase}
          placeholder="0"
        />
      </div>
    );
  }

  if (tipo === 'booleano') {
    const valor = resposta?.respostaBoolean ?? null;
    return (
      <div className="flex w-full min-w-0 flex-col">
        <QuestionLabel numero={numero} descricao={pergunta.descricao} obrigatorio={obrigatorio} alerta={alerta} />
        <div className="flex flex-wrap gap-2">
          {[{ label: 'Sim', value: true }, { label: 'Não', value: false }].map(({ label, value }) => {
            const ativo = valor === value;
            return (
              <button
                key={label}
                type="button"
                disabled={readOnly}
                aria-pressed={ativo}
                onClick={() => { if (readOnly) return; onChange({ perguntaId: pergunta.id, respostaBoolean: ativo ? null : value }); }}
                className={`max-w-[140px] flex-1 rounded-lg border px-4 py-2 text-[13px] font-medium transition-all ${
                  readOnly ? 'cursor-default opacity-90 ' : 'cursor-pointer '
                }${ativo ? 'border-[#00a88e] bg-[#e6f7f5] text-[#0f766e]' : 'border-slate-200 text-slate-500 hover:border-[#00a88e]/40'}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (tipo === 'escolha_unica') {
    const selecionada = resposta?.perguntaOpcaoId || null;
    const alts = [...(pergunta.alternativas || [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    return (
      <div className="flex w-full min-w-0 flex-col">
        <QuestionLabel numero={numero} descricao={pergunta.descricao} obrigatorio={obrigatorio} alerta={alerta} />
        <div className="flex w-full min-w-0 flex-col gap-0.5">
          {alts.map((alt) => {
            const ativa = String(selecionada) === String(alt.id);
            return (
              <div
                key={alt.id}
                role="button"
                tabIndex={readOnly ? -1 : 0}
                aria-pressed={ativa}
                onClick={() => { if (readOnly) return; onChange({ perguntaId: pergunta.id, perguntaOpcaoId: ativa ? null : alt.id }); }}
                onKeyDown={(e) => {
                  if (readOnly) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onChange({ perguntaId: pergunta.id, perguntaOpcaoId: ativa ? null : alt.id });
                  }
                }}
                className={`flex w-full min-w-0 items-center gap-3 rounded-lg px-2 py-2 transition-colors ${
                  readOnly ? 'cursor-default opacity-90' : 'cursor-pointer'
                } ${ativa ? 'bg-[#e6f7f5]/60' : 'hover:bg-slate-50'}`}
              >
                <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${ativa ? 'border-[#00a88e]' : 'border-slate-300'}`}>
                  {ativa && <div className="h-2 w-2 rounded-full bg-[#00a88e]" />}
                </div>
                <span className={`text-[14px] ${ativa ? 'font-medium text-[#0f766e]' : 'text-slate-600'}`}>{alt.alternativa}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (tipo === 'sim_nao_naosei') {
    const valor = resposta?.respostaTrivalente ?? null;
    return (
      <div className="flex w-full min-w-0 flex-col">
        <QuestionLabel numero={numero} descricao={pergunta.descricao} obrigatorio={obrigatorio} alerta={alerta} />
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Sim', value: 'SIM' },
            { label: 'Não', value: 'NAO' },
            { label: 'Não sei', value: 'NAO_SEI' },
          ].map(({ label, value }) => {
            const ativo = valor === value;
            return (
              <button
                key={value}
                type="button"
                disabled={readOnly}
                aria-pressed={ativo}
                onClick={() => {
                  if (readOnly) return;
                  onChange({ perguntaId: pergunta.id, respostaTrivalente: ativo ? null : value });
                }}
                className={`max-w-[160px] flex-1 rounded-lg border px-4 py-2 text-[13px] font-medium transition-all ${
                  readOnly ? 'cursor-default opacity-90 ' : 'cursor-pointer '
                }${ativo ? 'border-[#00a88e] bg-[#e6f7f5] text-[#0f766e]' : 'border-slate-200 text-slate-500 hover:border-[#00a88e]/40'}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (tipo === 'catalogo_reacao') {
    return (
      <CatalogoReacaoQuestion
        pergunta={pergunta}
        resposta={resposta}
        onChange={onChange}
        readOnly={readOnly}
        searchFn={searchFn}
        numero={numero}
        obrigatorio={obrigatorio}
        alerta={alerta}
      />
    );
  }

  if (isTipoCatalogoMulti(tipo)) {
    return (
      <div className="flex w-full min-w-0 flex-col">
        <QuestionLabel numero={numero} descricao={pergunta.descricao} obrigatorio={obrigatorio} alerta={alerta} />
        <AnamneseCatalogoPicker
          searchFn={searchFn}
          catalogoItens={resposta?.catalogoItens || []}
          textosLivres={resposta?.textosLivres || []}
          declarouAusencia={Boolean(resposta?.declarouAusencia)}
          onChange={handleCatalogo}
          readOnly={readOnly}
        />
      </div>
    );
  }

  if (tipo === 'multipla_escolha') {
    const selecionadas = (resposta?.opcoesSelecionadas || []).map((x) => String(x));
    const alts = [...(pergunta.alternativas || [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    return (
      <div className="flex w-full min-w-0 flex-col">
        <QuestionLabel numero={numero} descricao={pergunta.descricao} obrigatorio={obrigatorio} alerta={alerta} />
        <div className="flex w-full min-w-0 flex-col gap-0.5">
          {alts.map((alt) => {
            const ativa = selecionadas.includes(String(alt.id));
            const toggle = () => {
              if (readOnly) return;
              const idStr = String(alt.id);
              const next = ativa ? selecionadas.filter((id) => id !== idStr) : [...selecionadas, idStr];
              onChange({ perguntaId: pergunta.id, opcoesSelecionadas: next });
            };
            return (
              <div
                key={alt.id}
                role="button"
                tabIndex={readOnly ? -1 : 0}
                aria-pressed={ativa}
                onClick={toggle}
                onKeyDown={(e) => {
                  if (readOnly) return;
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
                }}
                className={`flex w-full min-w-0 items-center gap-3 rounded-lg px-2 py-2 transition-colors ${
                  readOnly ? 'cursor-default opacity-90' : 'cursor-pointer'
                } ${ativa ? 'bg-[#e6f7f5]/60' : 'hover:bg-slate-50'}`}
              >
                <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-2 ${ativa ? 'border-[#00a88e] bg-[#00a88e]' : 'border-slate-300'}`}>
                  {ativa && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                </div>
                <span className={`text-[14px] ${ativa ? 'font-medium text-[#0f766e]' : 'text-slate-600'}`}>{alt.alternativa}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="text-[13px] italic text-slate-400">
      Tipo de resposta não suportado: {tipo}
    </div>
  );
}
