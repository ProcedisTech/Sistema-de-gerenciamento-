import React, { useEffect, useRef } from 'react';

/**
 * Casca presentacional fina para campos de busca com dropdown inline.
 * Responsabilidade ÚNICA: container relativo, fechar no clique-fora e
 * posicionar o painel do dropdown. NÃO conhece dados nem semântica de
 * seleção — cada campo (paciente/procedimento/profissional) injeta seu
 * próprio gatilho (`children`) e conteúdo do painel (`dropdown`).
 */
export function SearchDropdownShell({ open, onRequestClose, className = '', children, dropdown }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!containerRef.current?.contains(e.target)) onRequestClose?.();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onRequestClose]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {children}
      {open && dropdown ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[280px] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {dropdown}
        </div>
      ) : null}
    </div>
  );
}
