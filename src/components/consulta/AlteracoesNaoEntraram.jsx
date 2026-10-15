import React, { useEffect, useRef, useState } from 'react';

const MAX_VISIVEIS = 5;
const COPIADO_MS = 2000;

/**
 * Aviso: a consulta foi encerrada em outro aparelho e estes dados não entraram.
 * Só guarda o feedback "Copiado!" (timer limpo ao desmontar).
 */
export function AlteracoesNaoEntraram({ quantidade, itens = [], onCopiar, onDescartar }) {
  const [copiado, setCopiado] = useState(false);
  const timerRef = useRef(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  if (!(quantidade > 0)) return null;

  const lista = Array.isArray(itens) ? itens : [];
  const visiveis = lista.slice(0, MAX_VISIVEIS);
  const restantes = lista.length - visiveis.length;

  const copiar = async () => {
    try {
      await onCopiar?.();
    } catch {
      return;
    }
    setCopiado(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setCopiado(false);
    }, COPIADO_MS);
  };

  return (
    <div role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
      <p className="text-[14px] font-bold">
        {quantidade} {quantidade === 1 ? 'alteração não entrou' : 'alterações não entraram'}
      </p>
      <p className="mt-1 text-[13px] font-medium">
        A consulta foi encerrada em outro aparelho antes de estes dados serem enviados.
      </p>
      {visiveis.length > 0 ? (
        <ul className="mt-3 space-y-1 text-[13px]">
          {visiveis.map((it) => (
            <li key={it.chave} className="flex gap-2">
              <span className="shrink-0 font-bold">{it.rotulo}</span>
              <span className="min-w-0 truncate" title={it.texto}>
                {it.texto}
              </span>
            </li>
          ))}
          {restantes > 0 ? <li className="font-medium">e mais {restantes}</li> : null}
        </ul>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copiar}
          aria-label="Copiar alterações que não entraram"
          className="rounded-lg border border-amber-400 bg-white px-3 py-2 text-[12px] font-bold text-amber-900 hover:bg-amber-100"
        >
          {copiado ? 'Copiado!' : 'Copiar'}
        </button>
        <button
          type="button"
          onClick={() => onDescartar?.()}
          aria-label="Descartar alterações que não entraram"
          className="rounded-lg border border-amber-400 bg-white px-3 py-2 text-[12px] font-bold text-amber-900 hover:bg-amber-100"
        >
          Descartar
        </button>
      </div>
    </div>
  );
}
