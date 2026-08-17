import React from 'react';
import { DynamicQuestion } from './DynamicQuestion.jsx';
import { isFullWidthItem } from './anamneseFichaUtils.js';

/**
 * Wrapper compartilhado para preview/preenchimento (mobile, wide, readonly).
 */
export function AnamneseFillLayout({
  itens = [],
  respostas = {},
  onChange,
  readOnly = false,
  layout = 'wide',
  pacienteSexo = null,
  searchFnForPergunta,
  className = '',
}) {
  const isMobile = layout === 'mobile';
  const gridCls = isMobile
    ? 'grid grid-cols-1 gap-y-5'
    : 'grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2';

  return (
    <div className={`min-w-0 ${className}`}>
      <div className={gridCls}>
        {itens.map((item) => {
          const pergunta = item.pergunta || item;
          const pid = pergunta.id;
          const full = isFullWidthItem({ pergunta });
          const resposta = respostas[pid] ?? respostas[String(pid)];
          const searchFn = searchFnForPergunta?.(pergunta, pacienteSexo);

          return (
            <div
              key={item.id || pid || item.clientKey}
              className={`min-w-0 ${!isMobile && full ? 'md:col-span-2' : ''}`}
            >
              <DynamicQuestion
                numero={item.ordem}
                pergunta={pergunta}
                resposta={resposta}
                onChange={onChange}
                readOnly={readOnly}
                obrigatorio={item.obrigatorio}
                alerta={pergunta.prioridade === 'ALERTA' || pergunta.prioridade === 'CRITICA'}
                searchFn={searchFn}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
