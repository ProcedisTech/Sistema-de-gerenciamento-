import React, { useRef, useState } from 'react';
import { COMPOSE, CT, CT_ON, KBD } from './editorDocumentoTokens.js';
import { RAPIDOS, getTipoMeta } from './editorTipoMeta.js';
import { EDITOR_ACTIONS } from './editorDocumentoReducer.js';
import { AnamneseDocPopover } from './AnamneseDocPopover.jsx';
import { AnamneseDocTipoMenu } from './AnamneseDocTipoMenu.jsx';

export function AnamneseDocCompose({ compose, stickyTipo, editavel, dispatch }) {
  const moreRef = useRef(null);
  const [openTipo, setOpenTipo] = useState(false);
  const isChild = Boolean(compose?.child);
  const extra = !RAPIDOS.includes(stickyTipo);
  const extraMeta = getTipoMeta(stickyTipo);
  const placeholder = isChild
    ? 'Detalhe — ex.: Qual? Descreva...'
    : 'Escreva a pergunta e aperte Enter';

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!String(compose?.texto || '').trim()) {
        dispatch({ type: EDITOR_ACTIONS.CLOSE_COMPOSE });
        return;
      }
      dispatch({ type: EDITOR_ACTIONS.COMMIT_COMPOSE });
    } else if (e.key === 'Tab') {
      e.preventDefault();
      dispatch({ type: EDITOR_ACTIONS.TOGGLE_COMPOSE_CHILD });
    } else if (e.key === 'Escape') {
      e.preventDefault();
      dispatch({ type: EDITOR_ACTIONS.CLOSE_COMPOSE });
    }
  };

  return (
    <div className={`${COMPOSE}${isChild ? ' ml-9' : ''}`}>
      <span className="mt-0.5 w-5 shrink-0 text-right text-[11.5px] font-bold tabular-nums text-teal-700">
        ↵
      </span>
      <div className="min-w-0 flex-1">
        <input
          type="text"
          autoFocus
          value={compose?.texto || ''}
          disabled={!editavel}
          placeholder={placeholder}
          className="cinput w-full border-0 bg-transparent p-0 text-[14.5px] font-medium leading-[1.45] text-[#0f172a] outline-none placeholder:font-normal placeholder:text-[#64748b]"
          onChange={(e) =>
            dispatch({ type: EDITOR_ACTIONS.SET_COMPOSE_TEXT, texto: e.target.value })
          }
          onKeyDown={handleKeyDown}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-teal-700/80">
            Ela responde com
          </span>
          {RAPIDOS.map((tipo) => {
            const meta = getTipoMeta(tipo);
            const on = stickyTipo === tipo;
            return (
              <button
                key={tipo}
                type="button"
                disabled={!editavel}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => dispatch({ type: EDITOR_ACTIONS.SET_STICKY_TIPO, tipo })}
                className={`${CT} ${on ? CT_ON : ''}`}
              >
                {meta.n}
              </button>
            );
          })}
          <button
            ref={moreRef}
            type="button"
            disabled={!editavel}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOpenTipo((v) => !v)}
            className={`${CT} ${extra ? CT_ON : ''}`}
          >
            {extra ? extraMeta.n : 'Outro tipo'}
          </button>
        </div>
        <div className="chint mt-2 flex flex-wrap gap-3 text-[10.5px] text-[#64748b]">
          <span>
            <span className={KBD}>Enter</span> criar
          </span>
          <span>
            <span className={KBD}>Tab</span> {isChild ? 'soltar' : 'depende da anterior'}
          </span>
          <span>
            <span className={KBD}>Esc</span> sair
          </span>
        </div>
      </div>

      <AnamneseDocPopover
        open={openTipo}
        anchorRef={moreRef}
        variant="menu"
        onClose={() => setOpenTipo(false)}
      >
        <AnamneseDocTipoMenu
          current={stickyTipo}
          onSelect={(tipo) => {
            dispatch({ type: EDITOR_ACTIONS.SET_STICKY_TIPO, tipo });
            setOpenTipo(false);
          }}
        />
      </AnamneseDocPopover>
    </div>
  );
}

export function AnamneseDocAddBtn({ onClick, disabled }) {
  return (
    <button
      type="button"
      className="addbtn my-2 ml-[71px] inline-flex cursor-pointer items-center gap-1.5 rounded-[9px] border border-dashed border-teal-200 bg-transparent px-3 py-2 text-[13px] font-semibold text-teal-700 transition-all hover:border-solid hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
      onClick={onClick}
      disabled={disabled}
    >
      Escrever pergunta
    </button>
  );
}

export function AnamneseDocAddSec({ onClick, disabled }) {
  return (
    <button
      type="button"
      className="addsec mx-[30px] mt-2.5 flex w-[calc(100%-60px)] cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#cbd5e1] bg-transparent px-3.5 py-3.5 text-[13px] font-semibold text-[#64748b] transition-all hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
      onClick={onClick}
      disabled={disabled}
    >
      Nova seção
    </button>
  );
}
