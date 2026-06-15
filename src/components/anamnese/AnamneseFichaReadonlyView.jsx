import React, { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { DynamicQuestion } from './DynamicQuestion.jsx';
import {
  buildPerguntaTipoById,
  groupItensByCategoria,
  isFullWidthItem,
  mergeApiRespostasToMap,
  sortFichaItens,
} from './anamneseFichaUtils.js';

/**
 * Exibe uma ficha de anamnese preenchida no mesmo layout do Step2Anamnese (modo leitura).
 */
export function AnamneseFichaReadonlyView({
  ficha,
  respostasApi = [],
  loading = false,
  className = '',
}) {
  const itensOrdenados = useMemo(() => sortFichaItens(ficha), [ficha]);
  const respostasMap = useMemo(
    () => mergeApiRespostasToMap(respostasApi, buildPerguntaTipoById(ficha)),
    [respostasApi, ficha],
  );
  const itensPorSecao = useMemo(() => groupItensByCategoria(itensOrdenados), [itensOrdenados]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-[#00a88e]" aria-hidden />
        <span className="ml-2 text-[13px] text-[#64748b]">Carregando ficha…</span>
      </div>
    );
  }

  if (!ficha || itensOrdenados.length === 0) {
    return (
      <p className="py-4 text-center text-[13px] text-[#94a3b8]">Sem perguntas nesta ficha</p>
    );
  }

  return (
    <div className={`w-full min-w-0 ${className}`.trim()}>
      <p className="mb-5 text-[15px] font-semibold text-slate-700">{ficha.nome}</p>

      {itensPorSecao.map(({ categoriaNome, itens: secaoItens }, secIdx) => (
        <div key={categoriaNome || `sec-${secIdx}`} className={secIdx > 0 ? 'mt-8' : ''}>
          {categoriaNome ? (
            <div className="mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{categoriaNome}</p>
              <div className="mt-1 border-b border-slate-100" />
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-x-6 gap-y-6 md:grid-cols-2">
            {secaoItens.map((item) => {
              const isAlerta = item.pergunta?.prioridade === 'ALERTA';
              const showObrigatorio = Boolean(item.obrigatorio);
              const perguntaId = item.pergunta?.id;
              return (
                <div
                  key={item.id ?? perguntaId}
                  className={`min-w-0 ${isFullWidthItem(item) ? 'md:col-span-2' : ''} ${
                    isAlerta ? 'border-l-2 border-l-red-400 pl-3' : ''
                  }`}
                >
                  <DynamicQuestion
                    numero={item.ordem ?? (itensOrdenados.findIndex((i) => i.id === item.id) + 1)}
                    pergunta={item.pergunta}
                    resposta={respostasMap[item.pergunta?.id] ?? respostasMap[String(item.pergunta?.id)]}
                    onChange={() => {}}
                    alerta={isAlerta}
                    obrigatorio={showObrigatorio}
                    readOnly
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
