import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  CornerDownRight,
  CornerUpLeft,
  GripVertical,
  Trash2,
} from 'lucide-react';
import { useToast } from '../../contexts/useToast';
import {
  Q_BASE,
  Q_AT,
  Q_CR,
  Q_CHILD,
  QNUM,
  QTEXT,
  TAG,
  TAG_ALERTA,
  TAG_CRITICA,
  TAG_HIST,
  TAG_COND,
  IA,
  IA_DANGER,
  isTipoEscolha,
} from './editorDocumentoTokens.js';
import {
  getTipoMeta,
  PRIO_META,
} from './editorTipoMeta.js';
import { EDITOR_ACTIONS } from './editorDocumentoReducer.js';
import {
  AnamneseDocPopover,
  PopoverBody,
  PopoverHead,
  PopoverItem,
} from './AnamneseDocPopover.jsx';
import { AnamneseDocTipoMenu } from './AnamneseDocTipoMenu.jsx';
import { AnamneseDocAlternativas } from './AnamneseDocAlternativas.jsx';

function prioClass(prioridade) {
  const p = String(prioridade || 'NORMAL').toUpperCase();
  if (p === 'CRITICA') return TAG_CRITICA;
  if (p === 'ALERTA') return TAG_ALERTA;
  return '';
}

function qRowClass(q) {
  const pri = String(q.prioridade || 'NORMAL').toUpperCase();
  let cls = Q_BASE;
  if (pri === 'CRITICA') cls += ` ${Q_CR}`;
  else if (pri === 'ALERTA') cls += ` ${Q_AT}`;
  if (q.perguntaPaiClientKey) cls += ` ${Q_CHILD}`;
  return cls;
}

function autoResize(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.max(el.scrollHeight, 24)}px`;
}

export function AnamneseDocPergunta({
  q,
  displayNum,
  isFirst,
  isLast,
  editavel,
  dispatch,
  onBlur,
  onKeyDown,
  onMoveUp,
  onMoveDown,
}) {
  const toast = useToast();
  const [openMenu, setOpenMenu] = useState(null);
  const tipoRef = useRef(null);
  const prioRef = useRef(null);
  const textRef = useRef(null);

  const tipoMeta = getTipoMeta(q.tipoRespostaCodigo);
  const prioKey = String(q.prioridade || 'NORMAL').toUpperCase();
  const prioMeta = PRIO_META[prioKey] || PRIO_META.NORMAL;
  const feed = tipoMeta.feed;
  const showAlts = isTipoEscolha(q.tipoRespostaCodigo);

  useEffect(() => {
    autoResize(textRef.current);
  }, [q.descricao]);

  const handleIndent = () => {
    if (q.perguntaPaiClientKey) {
      dispatch({
        type: EDITOR_ACTIONS.SET_PAI,
        clientKey: q.clientKey,
        perguntaPaiId: null,
        perguntaPaiClientKey: null,
      });
      return;
    }
    if (isFirst) {
      toast.info('A primeira pergunta da seção não pode depender de outra');
      return;
    }
    dispatch({ type: EDITOR_ACTIONS.KEY_TAB, focusKey: q.clientKey });
  };

  return (
    <div className={qRowClass(q)}>
      <span className="mt-0.5 hidden shrink-0 cursor-grab text-[#cbd5e1] opacity-60 lg:inline" aria-hidden>
        <GripVertical className="h-3 w-3" />
      </span>
      <span className={QNUM}>{q.perguntaPaiClientKey ? '↳' : displayNum}</span>
      <div className="min-w-0 flex-1">
        <textarea
          ref={textRef}
          rows={1}
          value={q.descricao}
          disabled={!editavel}
          placeholder="Escreva a pergunta..."
          className={QTEXT}
          onFocus={() => dispatch({ type: EDITOR_ACTIONS.SET_FOCUS, focusKey: q.clientKey })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onKeyDown?.(e, q.clientKey, q);
              return;
            }
            onKeyDown?.(e, q.clientKey, q);
          }}
          onChange={(e) => {
            dispatch({
              type: EDITOR_ACTIONS.UPDATE_PERGUNTA,
              clientKey: q.clientKey,
              patch: { descricao: e.target.value },
            });
            autoResize(e.target);
          }}
          onBlur={() => onBlur?.(q)}
        />
        <div className="mt-1.5 flex flex-row flex-wrap items-center gap-1.5">
          <button
            ref={tipoRef}
            type="button"
            disabled={!editavel}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOpenMenu(openMenu === 'tipo' ? null : 'tipo')}
            className={`${TAG} whitespace-nowrap`}
          >
            {tipoMeta.n}
          </button>

          <button
            ref={prioRef}
            type="button"
            disabled={!editavel}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOpenMenu(openMenu === 'prio' ? null : 'prio')}
            className={`${TAG} whitespace-nowrap ${prioClass(q.prioridade)}`}
          >
            {prioMeta.n}
          </button>

          {feed ? (
            <span className={`${TAG} ${TAG_HIST}`}>
              ★ → {feed}
            </span>
          ) : null}

          {q.perguntaPaiClientKey ? (
            <span className={`${TAG} ${TAG_COND} whitespace-nowrap`}>aparece se SIM</span>
          ) : null}

          <button
            type="button"
            disabled={!editavel}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() =>
              dispatch({
                type: EDITOR_ACTIONS.UPDATE_PERGUNTA,
                clientKey: q.clientKey,
                patch: { obrigatorio: !q.obrigatorio },
              })
            }
            className={`${TAG} whitespace-nowrap ${q.obrigatorio ? 'border-teal-200 bg-teal-50 text-teal-700' : ''}`}
          >
            {q.obrigatorio ? 'obrigatório' : 'opcional'}
          </button>
        </div>

        {showAlts ? (
          <AnamneseDocAlternativas
            alternativas={q.alternativas}
            editavel={editavel}
            onChange={(alternativas) =>
              dispatch({
                type: EDITOR_ACTIONS.UPDATE_PERGUNTA,
                clientKey: q.clientKey,
                patch: { alternativas },
              })
            }
          />
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-center gap-0.5 sm:flex-row">
        {editavel ? (
          <>
            <button
              type="button"
              disabled={isFirst}
              title="Subir pergunta"
              aria-label="Subir pergunta"
              onClick={onMoveUp}
              className={`${IA} disabled:opacity-[0.38]`}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={isLast}
              title="Descer pergunta"
              aria-label="Descer pergunta"
              onClick={onMoveDown}
              className={`${IA} disabled:opacity-[0.38]`}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </>
        ) : null}
        <button
          type="button"
          disabled={!editavel}
          title={
            q.perguntaPaiClientKey
              ? 'Deixar de depender da anterior'
              : 'Só perguntar se a anterior for SIM'
          }
          onClick={handleIndent}
          className={IA}
        >
          {q.perguntaPaiClientKey ? (
            <CornerUpLeft className="h-3.5 w-3.5" />
          ) : (
            <CornerDownRight className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          disabled={!editavel}
          title="Remover"
          onClick={() => {
            dispatch({ type: EDITOR_ACTIONS.REMOVE_PERGUNTA, clientKey: q.clientKey });
            toast.success('Pergunta removida');
          }}
          className={`${IA} ${IA_DANGER}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <AnamneseDocPopover
        open={openMenu === 'tipo'}
        anchorRef={tipoRef}
        variant="menu"
        onClose={() => setOpenMenu(null)}
      >
        <AnamneseDocTipoMenu
          current={q.tipoRespostaCodigo}
          onSelect={(key) => {
            dispatch({ type: EDITOR_ACTIONS.SET_STICKY_TIPO, tipo: key });
            dispatch({
              type: EDITOR_ACTIONS.UPDATE_PERGUNTA,
              clientKey: q.clientKey,
              patch: { tipoRespostaCodigo: key },
            });
            setOpenMenu(null);
            const feedLabel = getTipoMeta(key).feed;
            if (feedLabel) {
              toast.success(`A resposta vai virar ${feedLabel} no prontuário dela`);
            }
          }}
        />
      </AnamneseDocPopover>

      <AnamneseDocPopover
        open={openMenu === 'prio'}
        anchorRef={prioRef}
        variant="pop"
        onClose={() => setOpenMenu(null)}
      >
        <PopoverHead
          title="Nível de alerta clínico"
          subtitle="Define se e onde o sistema avisa a equipe."
        />
        <PopoverBody>
          {Object.entries(PRIO_META).map(([key, meta]) => {
            const active = prioKey === key;
            return (
              <PopoverItem
                key={key}
                active={active}
                onClick={() => {
                  dispatch({
                    type: EDITOR_ACTIONS.UPDATE_PERGUNTA,
                    clientKey: q.clientKey,
                    patch: { prioridade: key },
                  });
                  setOpenMenu(null);
                }}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: meta.c }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-semibold text-[#0f172a]">{meta.n}</span>
                    {active ? <Check className="ml-auto h-3.5 w-3.5 text-teal-600" /> : null}
                  </div>
                  <span className="mt-0.5 block text-[11px] leading-snug text-[#64748b]">{meta.d}</span>
                </div>
              </PopoverItem>
            );
          })}
        </PopoverBody>
      </AnamneseDocPopover>
    </div>
  );
}
