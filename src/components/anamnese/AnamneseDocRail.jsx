import React, { useMemo, useState } from 'react';
import { Lightbulb, Search, Smartphone, Zap } from 'lucide-react';
import { getTipoMeta, PRIO_META, perguntaAlimentaProntuario } from './editorTipoMeta.js';
import { tipoLabel } from './anamneseTipoLabels';

const RAIL_TABS = [
  { id: 'fichas', label: 'Fichas' },
  { id: 'secoes', label: 'Seções' },
  { id: 'perguntas', label: 'Perguntas' },
];

function RailHelp({ children }) {
  return (
    <div className="railhelp mt-3 rounded-lg border border-[#f1f5f9] bg-[#fbfcfd] px-3 py-2.5">
      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-[#64748b]">
        <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
        {children}
      </p>
    </div>
  );
}

export function AnamneseDocRail({
  railTab,
  onRailTabChange,
  fichas,
  modulos,
  banco,
  onUseFicha,
  onAddModulo,
  onAddBank,
  onEspiar,
  embedded = false,
}) {
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('Todas');

  const categories = useMemo(() => {
    const cats = new Set((banco || []).map((p) => p.cat).filter(Boolean));
    return ['Todas', ...cats];
  }, [banco]);

  const filteredBanco = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (banco || []).filter((p) => {
      const catOk = filterCat === 'Todas' || p.cat === filterCat;
      const textOk = !q || p.descricao?.toLowerCase().includes(q);
      return catOk && textOk;
    });
  }, [banco, search, filterCat]);

  return (
    <aside className={embedded ? 'w-full min-w-0' : 'w-full min-w-0 shrink-0'}>
      <div className={embedded ? 'overflow-hidden' : 'overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-sm'}>
        <div className="flex border-b border-[#f1f5f9] bg-[#fbfcfd] p-1">
          {RAIL_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onRailTabChange(tab.id)}
              className={`rt flex-1 rounded-lg py-2.5 text-[11px] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 motion-reduce:transition-none ${
                railTab === tab.id
                  ? 'on bg-white text-teal-700 shadow-sm'
                  : 'text-[#64748b] hover:text-[#475569]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="custom-scrollbar overflow-y-auto p-3">
          {railTab === 'fichas' ? (
            <>
              <div className="railbody mb-3">
                <p className="text-[11.5px] leading-relaxed text-[#64748b]">
                  Anamneses completas, com alertas clínicos e prontuário já configurados. Você edita tudo depois.
                </p>
              </div>
              <div className="rlist space-y-2">
                {fichas.map((s) => {
                  const n = s.nums || {};
                  return (
                    <div
                      key={s.codigo}
                      role="button"
                      tabIndex={0}
                      onClick={() => onUseFicha?.(s)}
                      onKeyDown={(e) => e.key === 'Enter' && onUseFicha?.(s)}
                      className="rfic cursor-pointer overflow-hidden rounded-[13px] border border-[#e2e8f0] bg-white transition-all hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)]"
                    >
                      <div className="flex items-start gap-3 bg-gradient-to-br from-teal-50 to-white px-3.5 py-3">
                        <span className="text-2xl leading-none">{s.ic || '📋'}</span>
                        <div className="min-w-0">
                          <b className="block text-[13.5px] font-bold tracking-[-0.015em] text-[#0f172a]">
                            {s.nome}
                          </b>
                          <span className="mt-1 block text-[11px] leading-snug text-[#64748b]">
                            {s.descricao}
                          </span>
                        </div>
                      </div>
                      <div className="flex border-t border-[#f1f5f9] bg-[#fbfcfd]">
                        {[
                          { v: n.secoes, l: 'seções' },
                          { v: n.perguntas, l: 'perguntas' },
                          { v: n.criticas, l: 'críticas', c: 'text-rose-600' },
                          { v: n.prontuario, l: 'prontuário', c: 'text-violet-700' },
                        ].map((item, i) => (
                          <div
                            key={item.l}
                            className={`relative flex-1 px-1 py-2 text-center ${i > 0 ? 'before:absolute before:bottom-2.5 before:left-0 before:top-2.5 before:w-px before:bg-[#e2e8f0]' : ''}`}
                          >
                            <b className={`block text-[14px] font-bold leading-none ${item.c || 'text-[#0f172a]'}`}>
                              {item.v}
                            </b>
                            <span className="mt-0.5 block text-[9.5px] text-[#64748b]">{item.l}</span>
                          </div>
                        ))}
                      </div>
                      {s.origem ? (
                        <div className="rficorig px-3.5 py-1.5 text-[10.5px] italic text-[#94a3b8]">
                          {s.origem}
                        </div>
                      ) : null}
                      <div className="flex gap-1.5 border-t border-[#f1f5f9] p-2.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUseFicha?.(s);
                          }}
                          className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border-0 bg-teal-600 text-[11.5px] font-semibold text-white hover:bg-teal-700"
                        >
                          <Zap className="h-3.5 w-3.5" />
                          Usar esta ficha
                        </button>
                        <button
                          type="button"
                          title="Espiar"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEspiar?.(s);
                          }}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-[#e2e8f0] bg-white text-[#64748b] hover:border-teal-200 hover:text-teal-700"
                        >
                          <Smartphone className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <RailHelp>
                Usar uma ficha pronta substitui o que estiver aqui. Depois é tudo seu para editar.
              </RailHelp>
            </>
          ) : null}

          {railTab === 'secoes' ? (
            <>
              <div className="railbody mb-3">
                <p className="text-[11.5px] leading-relaxed text-[#64748b]">
                  Blocos de seção com as perguntas já configuradas. Some quantos quiser.
                </p>
              </div>
              <div className="rlist space-y-2">
                {modulos.map((s) => (
                  <button
                    key={s.nome}
                    type="button"
                    onClick={() => onAddModulo(s)}
                    className="rm flex w-full items-center gap-3 rounded-[11px] border border-[#e2e8f0] px-3 py-2.5 text-left transition-all hover:-translate-y-px hover:border-teal-200 hover:bg-teal-50 hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)]"
                  >
                    <span className="text-[19px] leading-none">{s.ic || '🧩'}</span>
                    <div className="min-w-0 flex-1">
                      <b className="block text-[12.5px] font-semibold tracking-[-0.01em] text-[#0f172a]">
                        {s.nome}
                        {s.feminino ? ' 👩' : ''}
                      </b>
                      <span className="mt-0.5 block text-[10.5px] leading-snug text-[#64748b]">
                        {s.d || s.nome}
                        {s.criticas ? ` · ${s.criticas} críticas` : ''}
                        {s.prontuario ? ` · ${s.prontuario} pro prontuário` : ''}
                      </span>
                    </div>
                    <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700">
                      +{s.nPerguntas}
                    </span>
                  </button>
                ))}
              </div>
              <RailHelp>Adicionar o mesmo bloco duas vezes cria duas seções.</RailHelp>
            </>
          ) : null}

          {railTab === 'perguntas' ? (
            <>
              <div className="railbody mb-3">
                <p className="text-[11.5px] leading-relaxed text-[#64748b]">
                  Clique para jogar no fim da ficha.
                </p>
                <div className="relative mb-2 mt-2">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#64748b]" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={`Buscar entre ${banco.length} perguntas...`}
                    className="w-full rounded-lg border border-[#e2e8f0] bg-white py-2 pl-8 pr-3 text-[12px] outline-none focus:border-teal-300"
                  />
                </div>
                <div className="mb-2 flex flex-wrap gap-1">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFilterCat(cat)}
                      className={`rf rounded-[7px] border px-2 py-1 text-[10px] font-semibold ${
                        filterCat === cat
                          ? 'on border-teal-600 bg-teal-600 text-white'
                          : 'border-teal-200 bg-white text-[#475569] hover:bg-teal-50'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rlist space-y-1.5">
                {filteredBanco.length === 0 ? (
                  <div className="rempty rounded-lg border border-dashed border-[#cbd5e1] px-3 py-6 text-center text-[12px] leading-relaxed text-[#64748b]">
                    Nada encontrado.
                    <br />
                    <br />
                    Escreva direto na ficha para criar.
                  </div>
                ) : (
                  filteredBanco.map((p, i) => {
                    const tipo = getTipoMeta(p.tipoRespostaCodigo);
                    const pri = String(p.prioridade || 'NORMAL').toUpperCase();
                    const priCls =
                      pri === 'CRITICA'
                        ? 'pCR border-l-rose-600'
                        : pri === 'ALERTA'
                          ? 'pAT border-l-amber-500'
                          : 'border-l-transparent';
                    return (
                      <button
                        key={`${p.descricao}-${i}`}
                        type="button"
                        onClick={() => onAddBank(p)}
                        className={`rq relative w-full rounded-[10px] border border-[#e2e8f0] border-l-[3px] px-2.5 py-2.5 text-left transition-all hover:-translate-y-px hover:border-teal-200 hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)] ${priCls}`}
                      >
                        <h4 className="mb-1.5 pr-4 text-[12.5px] font-semibold leading-snug text-[#0f172a]">
                          {p.descricao}
                        </h4>
                        <div className="rqm flex flex-wrap gap-1">
                          <span className="inline-flex items-center rounded-[7px] border border-[#e2e8f0] bg-white px-1.5 py-0.5 text-[9.5px] font-semibold text-[#475569]">
                            {tipo.n || tipoLabel(p.tipoRespostaCodigo)}
                          </span>
                          {pri !== 'NORMAL' ? (
                            <span
                              className={`inline-flex rounded-[7px] border px-1.5 py-0.5 text-[9.5px] font-semibold ${
                                pri === 'CRITICA'
                                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                                  : 'border-amber-200 bg-amber-50 text-amber-700'
                              }`}
                            >
                              {PRIO_META[pri]?.n || pri}
                            </span>
                          ) : null}
                          {p.cond || perguntaAlimentaProntuario(p) ? (
                            <span className="inline-flex rounded-[7px] border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[9.5px] font-semibold text-violet-700">
                              ★ prontuário
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              <RailHelp>Não achou? Escreva direto na ficha — a nova entra aqui automaticamente.</RailHelp>
            </>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
