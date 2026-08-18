import React, { useState } from 'react';
import { Check, LayoutGrid, List, Plus, Smartphone, Type } from 'lucide-react';
import { EDITOR_ACTIONS } from './editorDocumentoReducer.js';

function ForkButton({ active, count, icon, title, subtitle, onClick }) {
  const Icon = icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[13px] border p-4 text-left transition-all ${
        active
          ? 'border-teal-200 bg-teal-50/50 shadow-[0_4px_12px_rgba(15,23,42,0.06)]'
          : 'border-[#e2e8f0] bg-white hover:border-teal-200 hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)]'
      }`}
    >
      {count ? (
        <span className="mb-2 inline-block rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700">
          {count}
        </span>
      ) : null}
      <div className="mb-2 text-teal-700">
        <Icon className="h-5 w-5" strokeWidth={1.9} />
      </div>
      <b className="block text-[14px] font-bold tracking-[-0.015em] leading-snug text-[#0f172a]">
        {title}
      </b>
      <span className="mt-1 block text-[11.5px] leading-relaxed text-[#64748b]">{subtitle}</span>
    </button>
  );
}

function FichaCard({ ficha, onUse, onEspiar }) {
  const n = ficha.nums || {};
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onUse?.(ficha)}
      onKeyDown={(e) => e.key === 'Enter' && onUse?.(ficha)}
      className="fcard cursor-pointer overflow-hidden rounded-[13px] border border-[#e2e8f0] bg-white transition-all hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)]"
    >
      <div className="flex gap-3 bg-gradient-to-br from-teal-50 to-white px-4 py-3.5">
        <span className="text-[27px] leading-none">{ficha.ic || '📋'}</span>
        <div>
          <b className="block text-[14px] font-bold tracking-[-0.015em]">{ficha.nome}</b>
          <span className="mt-1 block text-[11.5px] leading-snug text-[#64748b]">
            {ficha.descricao}
          </span>
        </div>
      </div>
      <div className="flex border-t border-[#f1f5f9] bg-[#fbfcfd]">
        {[
          { v: n.secoes ?? 0, l: 'seções' },
          { v: n.perguntas ?? 0, l: 'perguntas' },
          { v: n.criticas ?? 0, l: 'críticas', c: 'text-rose-600' },
          { v: n.prontuario ?? 0, l: 'prontuário', c: 'text-violet-700' },
        ].map((item, i) => (
          <div
            key={item.l}
            className={`flex-1 px-1 py-2.5 text-center ${i > 0 ? 'relative before:absolute before:bottom-2.5 before:left-0 before:top-2.5 before:w-px before:bg-[#e2e8f0]' : ''}`}
          >
            <b className={`block text-[15px] font-bold ${item.c || ''}`}>{item.v}</b>
            <span className="mt-0.5 block text-[9.5px] text-[#64748b]">{item.l}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 border-t border-[#f1f5f9] p-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onUse?.(ficha);
          }}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[9px] border-0 bg-teal-600 text-[12.5px] font-semibold text-white hover:bg-teal-700"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
          Usar esta ficha
        </button>
        <button
          type="button"
          title="Espiar no celular"
          onClick={(e) => {
            e.stopPropagation();
            onEspiar?.(ficha);
          }}
          className="grid h-9 w-9 place-items-center rounded-[9px] border border-[#e2e8f0] bg-white text-[#64748b] hover:border-teal-200 hover:text-teal-700"
        >
          <Smartphone className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function AnamneseDocStartScreen({
  fichas,
  modulos,
  dispatch,
  onUseFicha,
  onAppendModulo,
  onEspiar,
  onForkChange,
}) {
  const [fork, setFork] = useState(null);

  const toggleFork = (f) => {
    const next = fork === f ? null : f;
    setFork(next);
    if (next === 'ficha') onForkChange?.('fichas');
    if (next === 'secao') onForkChange?.('secoes');
  };

  return (
    <div className="start px-[30px] py-8">
      <h2 className="text-[18px] font-bold tracking-[-0.02em] text-[#0f172a]">
        Como você quer montar esta ficha?
      </h2>
      <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[#64748b]">
        Os três caminhos dão o mesmo resultado. Escolha o que combina com o seu jeito de trabalhar — dá para misturar depois.
      </p>

      <div className="forks mt-5 grid gap-[11px] md:grid-cols-3">
        <ForkButton
          active={fork === 'ficha'}
          count={`${fichas.length} modelos`}
          icon={LayoutGrid}
          title="Partir de uma ficha pronta"
          subtitle="Uma anamnese completa e revisada, com os alertas clínicos já configurados. Você edita o que quiser."
          onClick={() => toggleFork('ficha')}
        />
        <ForkButton
          active={fork === 'secao'}
          count={`${modulos.length} blocos`}
          icon={List}
          title="Montar por seções"
          subtitle="Junte só os blocos que a sua clínica usa. Cada um já vem com as perguntas configuradas."
          onClick={() => toggleFork('secao')}
        />
        <ForkButton
          active={fork === 'zero'}
          icon={Type}
          title="Escrever do zero"
          subtitle="Página em branco. Você cria cada seção e cada pergunta do seu jeito, sem partir de nada."
          onClick={() => toggleFork('zero')}
        />
      </div>

      {fork === 'ficha' ? (
        <div className="reveal mt-6">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.09em] text-[#64748b]">
            Escolha o modelo
          </div>
          <div className="fgrid grid gap-3 sm:grid-cols-2">
            {fichas.map((f) => (
              <FichaCard key={f.codigo} ficha={f} onUse={onUseFicha} onEspiar={onEspiar} />
            ))}
          </div>
        </div>
      ) : null}

      {fork === 'secao' ? (
        <div className="reveal mt-6">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.09em] text-[#64748b]">
            Clique nos blocos que você quer — some quantos precisar
          </div>
          <div className="mgrid grid gap-2 sm:grid-cols-2">
            {modulos.map((m) => (
              <button
                key={m.nome}
                type="button"
                onClick={() => onAppendModulo?.(m)}
                className="mchip flex items-center gap-3 rounded-[11px] border border-[#e2e8f0] px-3 py-2.5 text-left hover:border-teal-200 hover:bg-teal-50"
              >
                <span className="text-xl">{m.ic || '🧩'}</span>
                <span className="min-w-0 flex-1">
                  <b className="block text-[12.5px] font-semibold text-[#0f172a]">{m.nome}</b>
                  <span className="text-[10.5px] text-[#64748b]">{m.nPerguntas} perguntas</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {fork === 'zero' ? (
        <div className="reveal mt-6">
          <div className="zero flex flex-wrap items-center gap-4 rounded-xl border border-dashed border-[#cbd5e1] bg-[#fcfdfd] px-4 py-4">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-teal-50 text-teal-700">
              <Type className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <b className="block text-[14px] font-bold text-[#0f172a]">Página em branco</b>
              <span className="mt-0.5 block text-[12px] leading-relaxed text-[#64748b]">
                Cria a primeira seção e você começa a escrever. Enter cria a próxima pergunta, Tab faz uma depender da outra.
              </span>
            </div>
            <button
              type="button"
              onClick={() => dispatch({ type: EDITOR_ACTIONS.ADD_SECAO })}
              className="inline-flex h-10 items-center gap-1.5 rounded-[9px] border-0 bg-teal-600 px-4 text-[13px] font-semibold text-white hover:bg-teal-700"
            >
              <Plus className="h-[15px] w-[15px]" strokeWidth={2.3} />
              Criar primeira seção
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
