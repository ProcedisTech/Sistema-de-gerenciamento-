import React, { useRef, useState } from 'react';
import { Check, GripVertical, Trash2, User } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useToast } from '../../contexts/useToast';
import {
  SECHEAD,
  SECNUM,
  SECNAME,
  WHOBTN,
  WHOBTN_SET,
  IA,
  IA_DANGER,
  SECSUM,
  SECEMPTY,
} from './editorDocumentoTokens.js';
import { computeSecaoSummary, QUEM_OPCOES, sexoToWhobtnLabel } from './editorTipoMeta.js';
import { EDITOR_ACTIONS } from './editorDocumentoReducer.js';
import { AnamneseDocPergunta } from './AnamneseDocPergunta.jsx';
import { getPerguntaDisplayNum } from './editorDocumentoState.js';
import { AnamneseDocCompose, AnamneseDocAddBtn } from './AnamneseDocCompose.jsx';
import {
  AnamneseDocPopover,
  PopoverBody,
  PopoverHead,
  PopoverItem,
} from './AnamneseDocPopover.jsx';

function SecaoSummary({ secao }) {
  const { total, crit, alert, hist } = computeSecaoSummary(secao);
  return (
    <div className={SECSUM}>
      <span>
        <b>{total}</b> perguntas
      </span>
      {crit > 0 ? (
        <span className="text-rose-600">
          ⚠ <b>{crit}</b> críticas
        </span>
      ) : null}
      {alert > 0 ? (
        <span className="text-amber-600">
          ⚠ <b>{alert}</b> de atenção
        </span>
      ) : null}
      {hist > 0 ? (
        <span className="text-violet-700">
          ★ <b>{hist}</b> vão pro prontuário
        </span>
      ) : null}
    </div>
  );
}

export function AnamneseDocSecao({
  secao,
  secaoIndex,
  editavel,
  dispatch,
  onPerguntaBlur,
  onKeyDown,
  compose,
  stickyTipo,
  dragHandleProps,
}) {
  const toast = useToast();
  const quemRef = useRef(null);
  const [openQuem, setOpenQuem] = useState(false);
  const displayNums = getPerguntaDisplayNum(secao);
  const composeHere = compose?.secKey === secao.clientKey;
  const composeAtEnd = composeHere && compose.afterKey == null;
  const isEmpty = secao.perguntas.length === 0 && !composeHere;

  const whobtnCls = secao.sexoAplicavel ? WHOBTN_SET : '';

  return (
    <div className="sec">
      <div className={SECHEAD}>
        <div className={SECNUM}>{secaoIndex + 1}</div>
        <input
          type="text"
          value={secao.nome}
          disabled={!editavel}
          placeholder="Nome da seção"
          style={{ width: `${Math.max(168, (secao.nome?.length || 0) * 9.6)}px` }}
          className={SECNAME}
          onChange={(e) =>
            dispatch({
              type: EDITOR_ACTIONS.RENAME_SECAO,
              secaoKey: secao.clientKey,
              nome: e.target.value,
            })
          }
        />
        <button
          ref={quemRef}
          type="button"
          disabled={!editavel}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpenQuem((v) => !v)}
          className={`${WHOBTN} ${whobtnCls}`}
        >
          <User className="h-3 w-3" />
          {sexoToWhobtnLabel(secao.sexoAplicavel)}
        </button>
        <div className="ml-auto flex items-center gap-0.5">
          {editavel ? (
            <button
              type="button"
              className={`${IA} cursor-grab touch-none active:cursor-grabbing`}
              aria-label="Reordenar seção"
              {...dragHandleProps}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="button"
            disabled={!editavel}
            title="Remover"
          onClick={() => {
            dispatch({ type: EDITOR_ACTIONS.REMOVE_SECAO, secaoKey: secao.clientKey });
            toast.success('Seção removida');
          }}
            className={`${IA} ${IA_DANGER}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <SecaoSummary secao={secao} />

      <div className="qs px-[30px] pb-2">
        {isEmpty ? (
          <div className={SECEMPTY}>
            Seção vazia. Escreva abaixo, ou use uma pergunta pronta da direita.
          </div>
        ) : null}

        {secao.perguntas.map((q) => (
          <React.Fragment key={q.clientKey}>
            <AnamneseDocPergunta
              q={q}
              displayNum={displayNums.get(q.clientKey)}
              isFirst={secao.perguntas[0]?.clientKey === q.clientKey}
              editavel={editavel}
              dispatch={dispatch}
              onBlur={onPerguntaBlur}
              onKeyDown={onKeyDown}
            />
            {composeHere && compose.afterKey === q.clientKey ? (
              <AnamneseDocCompose
                compose={compose}
                stickyTipo={stickyTipo}
                editavel={editavel}
                dispatch={dispatch}
              />
            ) : null}
          </React.Fragment>
        ))}

        {composeAtEnd ? (
          <AnamneseDocCompose
            compose={compose}
            stickyTipo={stickyTipo}
            editavel={editavel}
            dispatch={dispatch}
          />
        ) : (
          <AnamneseDocAddBtn
            onClick={() =>
              dispatch({
                type: EDITOR_ACTIONS.OPEN_COMPOSE,
                secKey: secao.clientKey,
                afterKey: null,
              })
            }
            disabled={!editavel}
          />
        )}
      </div>

      <AnamneseDocPopover open={openQuem} anchorRef={quemRef} variant="pop" onClose={() => setOpenQuem(false)}>
        <PopoverHead
          title="Quem responde esta seção?"
          subtitle="O sistema esconde de quem não se aplica."
        />
        <PopoverBody>
          {QUEM_OPCOES.map((opt) => {
            const active =
              (opt.api === null && !secao.sexoAplicavel) ||
              secao.sexoAplicavel === opt.api;
            return (
              <PopoverItem
                key={opt.k ?? 'all'}
                active={active}
                onClick={() => {
                  dispatch({
                    type: EDITOR_ACTIONS.SET_SECAO_SEXO,
                    secaoKey: secao.clientKey,
                    sexoAplicavel: opt.api,
                  });
                  setOpenQuem(false);
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-semibold text-[#0f172a]">{opt.n}</span>
                    {active ? <Check className="ml-auto h-3.5 w-3.5 text-teal-600" /> : null}
                  </div>
                  <span className="mt-0.5 block text-[11px] text-[#64748b]">{opt.d}</span>
                </div>
              </PopoverItem>
            );
          })}
        </PopoverBody>
      </AnamneseDocPopover>
    </div>
  );
}

export function SortableDocSecao(props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.secao.clientKey,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <AnamneseDocSecao
        {...props}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}
