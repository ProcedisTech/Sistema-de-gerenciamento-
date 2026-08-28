import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import {
  COMPOSE,
  COMPOSE_PENDING,
  CT,
  CT_ON,
  KBD,
  ADDBTN,
  ADDSEC,
  BTN_PRIMARY,
  isTipoEscolha,
} from './editorDocumentoTokens.js';
import { canCommitCompose, composeCommitHint, composeHasPending } from './editorDocumentoState.js';
import { RAPIDOS, getTipoMeta } from './editorTipoMeta.js';
import { EDITOR_ACTIONS } from './editorDocumentoReducer.js';
import { AnamneseDocPopover } from './AnamneseDocPopover.jsx';
import { AnamneseDocTipoMenu } from './AnamneseDocTipoMenu.jsx';
import { AnamneseDocAlternativas } from './AnamneseDocAlternativas.jsx';

export function AnamneseDocCompose({ compose, stickyTipo, editavel, dispatch }) {
  const moreRef = useRef(null);
  const inputRef = useRef(null);
  const [openTipo, setOpenTipo] = useState(false);
  const isChild = Boolean(compose?.child);
  const extra = !RAPIDOS.includes(stickyTipo);
  const extraMeta = getTipoMeta(stickyTipo);
  const showAlts = isTipoEscolha(stickyTipo);
  const pending = composeHasPending(compose);
  const canCommit = canCommitCompose(compose, stickyTipo);
  const commitHint = composeCommitHint(compose, stickyTipo);
  const placeholder = isChild
    ? 'Detalhe — ex.: Qual? Descreva...'
    : 'Escreva a pergunta';

  useEffect(() => {
    inputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);

  const commit = () => {
    if (!canCommit) return;
    dispatch({ type: EDITOR_ACTIONS.COMMIT_COMPOSE });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!canCommit) {
        if (!pending) dispatch({ type: EDITOR_ACTIONS.CLOSE_COMPOSE });
        return;
      }
      commit();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      dispatch({ type: EDITOR_ACTIONS.TOGGLE_COMPOSE_CHILD });
    } else if (e.key === 'Escape') {
      e.preventDefault();
      dispatch({ type: EDITOR_ACTIONS.CLOSE_COMPOSE });
    }
  };

  return (
    <div className={`${pending ? COMPOSE_PENDING : COMPOSE}${isChild ? ' ml-4 sm:ml-9' : ''}`}>
      <span className="mt-0.5 w-5 shrink-0 text-right text-[11.5px] font-bold tabular-nums text-teal-700">
        ↵
      </span>
      <div className="min-w-0 flex-1">
        <input
          ref={inputRef}
          type="text"
          autoFocus
          value={compose?.texto || ''}
          disabled={!editavel}
          placeholder={placeholder}
          className="cinput w-full border-0 bg-transparent p-0 text-base font-medium leading-[1.5] text-[#0f172a] outline-none placeholder:font-normal placeholder:text-[#64748b] sm:text-[14.5px] sm:leading-[1.45]"
          onChange={(e) =>
            dispatch({ type: EDITOR_ACTIONS.SET_COMPOSE_TEXT, texto: e.target.value })
          }
          onKeyDown={handleKeyDown}
        />
        <div className="mt-2 flex flex-row flex-wrap items-center gap-2">
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
                className={on ? CT_ON : CT}
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
            className={extra ? CT_ON : CT}
          >
            {extra ? extraMeta.n : 'Outro tipo'}
          </button>
        </div>

        {showAlts ? (
          <>
            <p className="mt-2 text-[11px] font-medium text-teal-800/80">
              Defina as opções abaixo antes de criar a pergunta.
            </p>
            <AnamneseDocAlternativas
              alternativas={compose?.alternativasDraft || []}
              editavel={editavel}
              onChange={(alternativas) =>
                dispatch({ type: EDITOR_ACTIONS.SET_COMPOSE_ALTERNATIVAS, alternativas })
              }
            />
          </>
        ) : null}

        <div className="sticky bottom-16 z-10 mt-3 scroll-mb-24 sm:bottom-4">
          <button
            type="button"
            className={`${BTN_PRIMARY} w-full justify-center sm:w-auto`}
            disabled={!editavel || !canCommit}
            title={canCommit ? 'Adicionar pergunta' : commitHint}
            onClick={commit}
          >
            <Check className="h-4 w-4" strokeWidth={2.4} aria-hidden />
            Adicionar pergunta
          </button>
          {!canCommit && pending ? (
            <p className="mt-1.5 text-[11.5px] font-semibold text-amber-800">{commitHint}</p>
          ) : null}
        </div>

        <div className="chint mt-2 flex flex-wrap gap-3 text-[10.5px] text-[#64748b]">
          <span>
            <span className={KBD}>Enter</span> atalho no título
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
    <button type="button" className={ADDBTN} onClick={onClick} disabled={disabled}>
      Escrever pergunta
    </button>
  );
}

export function AnamneseDocAddSec({ onClick, disabled }) {
  return (
    <button type="button" className={ADDSEC} onClick={onClick} disabled={disabled}>
      Nova seção
    </button>
  );
}
