import React, { useRef, useState } from 'react';
import { Check, PenLine } from 'lucide-react';
import {
  DOCHEAD,
  DOCTITLE,
  DOCBACK,
  CHIP,
  CHIP_ON,
  STATS,
  STAT,
  STAT_DIVIDER,
  STAT_B,
  STAT_SPAN,
  DECL,
  DECL_LB,
} from './editorDocumentoTokens.js';
import { computeDocStats } from './editorTipoMeta.js';
import { EDITOR_ACTIONS } from './editorDocumentoReducer.js';
import {
  AnamneseDocPopover,
  PopoverBody,
  PopoverHead,
  PopoverItem,
} from './AnamneseDocPopover.jsx';

export function AnamneseDocHead({
  state,
  dispatch,
  editavel,
  onTogglePadrao,
  onBack,
  especialidades,
}) {
  const especRef = useRef(null);
  const [openEspec, setOpenEspec] = useState(false);

  const hasSecoes = (state.secoes?.length || 0) > 0;
  const stats = computeDocStats(state.secoes);

  const especNome =
    especialidades.find(
      (e) => String(e.especialidade_id || e.id) === String(state.especialidadeId)
    )?.nome || 'Escolher especialidade';

  return (
    <div className={DOCHEAD}>
      <button type="button" className={DOCBACK} onClick={onBack}>
        ‹ Todas as fichas
      </button>

      <input
        type="text"
        className={DOCTITLE}
        value={state.nome}
        disabled={!editavel}
        placeholder="Dê um nome para a ficha..."
        onChange={(e) =>
          dispatch({ type: EDITOR_ACTIONS.SET_META, patch: { nome: e.target.value } })
        }
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          ref={especRef}
          type="button"
          disabled={!editavel}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpenEspec((v) => !v)}
          className={`${CHIP} ${state.especialidadeId ? CHIP_ON : ''}`}
        >
          {state.especialidadeId ? especNome : 'Escolher especialidade'}
        </button>
        <button
          type="button"
          disabled={!editavel}
          onClick={onTogglePadrao}
          className={`${CHIP} ${state.padrao ? CHIP_ON : ''}`}
        >
          {state.padrao ? 'É a ficha padrão da clínica' : 'Usar nos novos atendimentos'}
        </button>
      </div>

      {hasSecoes ? (
        <div className={STATS}>
          <div className={`${STAT} ${STAT_DIVIDER}`}>
            <b className={STAT_B}>{stats.q}</b>
            <span className={STAT_SPAN}>perguntas em {stats.s} seções</span>
          </div>
          <div className={`${STAT} ${STAT_DIVIDER}`}>
            <b className={`${STAT_B} text-rose-600`}>{stats.cr}</b>
            <span className={STAT_SPAN}>críticas · avisam no atendimento</span>
          </div>
          <div className={`${STAT} ${STAT_DIVIDER}`}>
            <b className={`${STAT_B} text-amber-600`}>{stats.at}</b>
            <span className={STAT_SPAN}>de atenção · vão pro resumo</span>
          </div>
          <div className={`${STAT} ${STAT_DIVIDER}`}>
            <b className={`${STAT_B} text-violet-700`}>{stats.hi}</b>
            <span className={STAT_SPAN}>entram no prontuário dela</span>
          </div>
        </div>
      ) : null}

      {hasSecoes ? (
        <div className={DECL}>
          <div className={DECL_LB}>
            <PenLine className="h-3 w-3" />
            Ao enviar, esta declaração aparece para o paciente assinar
          </div>
          <textarea
            rows={2}
            value={state.textoDeclaracao}
            disabled={!editavel}
            onChange={(e) =>
              dispatch({
                type: EDITOR_ACTIONS.SET_META,
                patch: { textoDeclaracao: e.target.value },
              })
            }
            className="w-full resize-none border-0 bg-transparent p-0 text-[13px] leading-relaxed text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
            placeholder="Declaro que as informações prestadas são verdadeiras..."
          />
        </div>
      ) : null}

      <AnamneseDocPopover
        open={openEspec}
        anchorRef={especRef}
        variant="pop"
        onClose={() => setOpenEspec(false)}
      >
        <PopoverHead
          title="Especialidade da ficha"
          subtitle="Ajuda a organizar quando você tiver muitas."
        />
        <PopoverBody className="p-1">
          <PopoverItem
            active={!state.especialidadeId}
            onClick={() => {
              dispatch({ type: EDITOR_ACTIONS.SET_META, patch: { especialidadeId: '' } });
              setOpenEspec(false);
            }}
          >
            <span className="text-[12.5px] font-semibold">Nenhuma (geral)</span>
            {!state.especialidadeId ? <Check className="ml-auto h-3.5 w-3.5 text-teal-600" /> : null}
          </PopoverItem>
          {especialidades.map((e) => {
            const id = e.especialidade_id || e.id;
            const active = String(state.especialidadeId) === String(id);
            return (
              <PopoverItem
                key={id}
                active={active}
                onClick={() => {
                  dispatch({ type: EDITOR_ACTIONS.SET_META, patch: { especialidadeId: id } });
                  setOpenEspec(false);
                }}
              >
                <span className="text-[12.5px] font-semibold">{e.nome}</span>
                {active ? <Check className="ml-auto h-3.5 w-3.5 text-teal-600" /> : null}
              </PopoverItem>
            );
          })}
        </PopoverBody>
      </AnamneseDocPopover>
    </div>
  );
}
