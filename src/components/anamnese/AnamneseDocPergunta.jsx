import React, { useRef, useState } from 'react';
import {
  Check,
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

export function AnamneseDocPergunta({
  q,
  displayNum,
  isFirst,
  editavel,
  dispatch,
  onBlur,
  onKeyDown,
}) {
  const toast = useToast();
  const [openMenu, setOpenMenu] = useState(null);
  const tipoRef = useRef(null);
  const prioRef = useRef(null);

  const tipoMeta = getTipoMeta(q.tipoRespostaCodigo);
  const prioKey = String(q.prioridade || 'NORMAL').toUpperCase();
  const prioMeta = PRIO_META[prioKey] || PRIO_META.NORMAL;
  const feed = tipoMeta.feed;

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
      <span className="mt-0.5 shrink-0 cursor-grab text-[#cbd5e1] opacity-60" aria-hidden>
        <GripVertical className="h-3 w-3" />
      </span>
      <span className={QNUM}>{q.perguntaPaiClientKey ? '↳' : displayNum}</span>
      <div className="min-w-0 flex-1">
        <input
          type="text"
          value={q.descricao}
          disabled={!editavel}
          placeholder="Escreva a pergunta..."
          className={QTEXT}
          onFocus={() => dispatch({ type: EDITOR_ACTIONS.SET_FOCUS, focusKey: q.clientKey })}
          onKeyDown={(e) => onKeyDown(e, q.clientKey, q)}
          onChange={(e) =>
            dispatch({
              type: EDITOR_ACTIONS.UPDATE_PERGUNTA,
              clientKey: q.clientKey,
              patch: { descricao: e.target.value },
            })
          }
          onBlur={() => onBlur?.(q)}
        />
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {/* a) tipo */}
          <button
            ref={tipoRef}
            type="button"
            disabled={!editavel}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOpenMenu(openMenu === 'tipo' ? null : 'tipo')}
            className={TAG}
          >
            {tipoMeta.n}
          </button>

          {/* b) prioridade */}
          <button
            ref={prioRef}
            type="button"
            disabled={!editavel}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOpenMenu(openMenu === 'prio' ? null : 'prio')}
            className={`${TAG} ${prioClass(q.prioridade)}`}
          >
            {prioMeta.n}
          </button>

          {/* c) registro */}
          {feed ? (
            <span className={`${TAG} ${TAG_HIST}`}>
              ★ o que ela escolher → {feed}
            </span>
          ) : null}

          {/* e) cond */}
          {q.perguntaPaiClientKey ? (
            <span className={`${TAG} ${TAG_COND}`}>aparece se responder SIM</span>
          ) : null}

          {/* f) obrigatório — deviação consciente */}
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
            className={`${TAG} ${q.obrigatorio ? 'border-teal-200 bg-teal-50 text-teal-700' : ''}`}
          >
            {q.obrigatorio ? 'obrigatório' : 'opcional'}
          </button>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          disabled={!editavel}
          title={
            q.perguntaPaiClientKey
              ? 'Deixar de depender da anterior'
              : 'Só perguntar se a anterior for SIM'
          }
          onClick={handleIndent}
          className="grid h-7 w-7 place-items-center rounded-[7px] border-0 bg-transparent text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#475569]"
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
          className="grid h-7 w-7 place-items-center rounded-[7px] border-0 bg-transparent text-[#94a3b8] hover:bg-rose-50 hover:text-rose-600"
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
