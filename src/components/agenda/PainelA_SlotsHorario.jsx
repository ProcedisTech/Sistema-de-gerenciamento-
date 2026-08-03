import React, { useState } from 'react';
import { RefreshCw, CalendarX, Users, Clock, Lock, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useDisponibilidadeDoDia } from '../../hooks/agenda/useDisponibilidadeDoDia.js';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { parseHhmmToMinutes } from '../../utils/agendaAvailability.js';
import { intervalWithinWindows } from '../../utils/disponibilidadeDayWindows.js';
import {
  SLOT_STEP_MIN,
  buildFimTerminoRuler,
  computeValidFimSlots,
  deriveDuracaoFromRange,
} from '../../utils/agendaRangeSelection.js';
import { gerarCorAvatar, iniciaisDoNome } from '../../utils/gerarCorAvatar.js';

function formatarHora(hhmm) {
  return String(hhmm || '').slice(0, 5);
}

function slotDataMin(startMin) {
  return startMin % 60 === 0 ? '00' : '30';
}

function isHoraCheia(startMin) {
  return startMin % 60 === 0;
}

/** Faixa #fbfcfd a cada bloco de 2 horas (0–1h, 2–3h, …). */
function faixaAlternada(startMin) {
  const block = Math.floor(startMin / 120);
  return block % 2 === 1;
}

function slotEhClicavel(slot, isFallback, slotsDisponiveis) {
  if (slot.state === 'selecionado') return true;
  if (slot.state !== 'livre' || !slot.clickable) return false;
  if (isFallback) return true;
  return slotsDisponiveis.has(slot.hhmm);
}

function motivoTerminoInvalido(gradeSlots, inicioMin, fimMin, windows, dayEndMin) {
  if (fimMin > dayEndMin || !intervalWithinWindows(inicioMin, fimMin, windows)) {
    return 'fora do expediente';
  }
  const byStart = new Map(gradeSlots.map((s) => [s.startMin, s]));
  for (let t = inicioMin; t < fimMin; t += SLOT_STEP_MIN) {
    const slot = byStart.get(t);
    if (!slot) return 'indisponível';
    if (slot.state === 'bloqueio') return slot.observacao || 'bloqueio';
    if (slot.state === 'ocupado') return slot.label || 'ocupado';
    if (slot.clickable === false && slot.state !== 'selecionado') return 'indisponível';
  }
  return 'indisponível';
}

function AvatarProfissional({ nome, fotoUrl, size = 'sm' }) {
  const [imgError, setImgError] = useState(false);
  const dim = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  const { bg, fg } = gerarCorAvatar(nome);
  const iniciais = iniciaisDoNome(nome);

  if (fotoUrl && !imgError) {
    return (
      <img
        src={fotoUrl}
        alt={nome}
        onError={() => setImgError(true)}
        className={`${dim} shrink-0 rounded-full object-cover`}
      />
    );
  }

  return (
    <span
      className={`${dim} ${bg} ${fg} flex shrink-0 items-center justify-center rounded-full font-bold`}
      aria-hidden
    >
      {iniciais}
    </span>
  );
}

function ProfissionalSlotRow({ profissional, onSelecionar }) {
  const nome = profissional?.nomeProfissional || profissional?.nome || 'Profissional';
  const cargo = profissional?.especialidade || profissional?.roleNome || '';

  return (
    <div className="flex items-center gap-2 rounded-lg border border-ink-100 bg-ink-50/80 px-2 py-2">
      <AvatarProfissional nome={nome} fotoUrl={profissional?.fotoUrl} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink-900">{nome}</p>
        {cargo ? <p className="truncate text-[11px] text-ink-500">{cargo}</p> : null}
      </div>
      <button
        type="button"
        onClick={onSelecionar}
        className="shrink-0 rounded-lg bg-gradient-to-br from-vivid-teal-500 to-vivid-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:brightness-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6] focus-visible:ring-offset-1"
      >
        Selecionar
      </button>
    </div>
  );
}

function LinhaDesabilitada({ hora, motivo, title, startMin, colunas }) {
  const minAttr = startMin != null ? slotDataMin(startMin) : undefined;
  const cheia = startMin != null && isHoraCheia(startMin);
  const faixa = startMin != null && faixaAlternada(startMin);
  return (
    <div
      role="option"
      aria-selected={false}
      aria-disabled="true"
      aria-label={`${hora}, ${motivo || 'indisponível'}`}
      title={title || motivo}
      data-min={minAttr}
      className={`sl flex min-h-[44px] w-full cursor-not-allowed items-center justify-between rounded-lg border border-ink-100 px-3 py-2 opacity-50 ${
        faixa ? 'bg-[#fbfcfd]' : 'bg-ink-50'
      } ${colunas === 2 && minAttr === '00' ? '[grid-column:1]' : ''} ${
        colunas === 2 && minAttr === '30' ? '[grid-column:2]' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <Lock className="h-3.5 w-3.5 shrink-0 text-[#94a3b8]" />
        <span
          className={`text-sm text-[#94a3b8] ${cheia ? 'font-bold' : 'font-medium'}`}
        >
          {hora}
        </span>
      </div>
      <span className="max-w-[40%] truncate text-[10px] text-[#94a3b8]">{motivo}</span>
    </div>
  );
}

/**
 * @param {boolean} [hidePhaseBanner=false] — se true, banners de fase ficam no cabeçalho do pai.
 */
export function PainelA_SlotsHorario({
  diaSelecionado,
  dayModel,
  roleUserIdFiltro,
  horaInicio,
  horaFimSlot,
  rangePhase = 'idle',
  profissionalFixado,
  onRangeSlotClick,
  onClearRange,
  colunas = 1,
  hidePhaseBanner = false,
}) {
  const [expansao, setExpansao] = useState({ dia: '', hora: null });
  const [hoverTermino, setHoverTermino] = useState(null);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const slotExpandido = expansao.dia === diaSelecionado ? expansao.hora : null;
  const isFallback = Boolean(dayModel?.isFallback);
  const apiEnabled = Boolean(diaSelecionado) && !isFallback;

  const { slots: apiSlots, loading: apiLoading, error: apiError, reload } = useDisponibilidadeDoDia({
    data: diaSelecionado || '',
    roleUserId: roleUserIdFiltro || undefined,
    enabled: apiEnabled,
  });

  if (!diaSelecionado) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <CalendarX className="h-8 w-8 text-ink-300" />
        <p className="text-sm text-ink-400">Selecione um dia no calendário</p>
      </div>
    );
  }

  if (!dayModel) {
    return (
      <div className="space-y-1.5 py-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-ink-100" />
        ))}
      </div>
    );
  }

  if (!dayModel.slots?.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <CalendarX className="h-8 w-8 text-ink-300" />
        <p className="text-sm text-ink-400">Sem expediente neste dia</p>
      </div>
    );
  }

  if (apiEnabled && apiError) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <p className="text-xs text-ink-500">Falha ao carregar horários</p>
        <button
          type="button"
          onClick={reload}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-vivid-teal-700 hover:bg-vivid-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6] focus-visible:ring-offset-1"
        >
          <RefreshCw className="h-3 w-3" />
          Tentar novamente
        </button>
      </div>
    );
  }

  const gradeSlots = dayModel.slots || [];
  const slotsDisponiveis = new Set((apiSlots || []).map((s) => formatarHora(s.hora)));
  const windows = dayModel.windows || [];
  const dayEndMin = dayModel.dayEndMin ?? 0;
  const inicioMin = horaInicio ? parseHhmmToMinutes(horaInicio) : null;
  const fimMin = horaFimSlot ? parseHhmmToMinutes(horaFimSlot) : null;
  const duracaoTotalMin =
    rangePhase === 'complete' ? deriveDuracaoFromRange(horaInicio, horaFimSlot) : 0;

  const validFimSlots =
    rangePhase === 'awaitingEnd' && inicioMin != null
      ? computeValidFimSlots(gradeSlots, inicioMin, windows, dayEndMin)
      : null;

  const fimRuler =
    rangePhase === 'awaitingEnd' && inicioMin != null
      ? buildFimTerminoRuler(inicioMin, dayEndMin)
      : [];

  function handleToggleExpandir(hora, apiSlot) {
    if (profissionalFixado) {
      const profissional = apiSlot?.profissionais?.[0] || null;
      onRangeSlotClick?.({ hora, profissional });
      return;
    }
    setExpansao((prev) => {
      if (prev.dia === diaSelecionado && prev.hora === hora) {
        return { dia: '', hora: null };
      }
      return { dia: diaSelecionado, hora };
    });
  }

  function handleSelecionarProfissional(hora, profissional) {
    onRangeSlotClick?.({ hora, profissional });
    setExpansao({ dia: '', hora: null });
  }

  function handleSelecionarTermino(hora) {
    onRangeSlotClick?.({ hora });
  }

  const hoverTerminoMin = hoverTermino ? parseHhmmToMinutes(hoverTermino) : null;

  function anchorClass(startMin, expandido = false) {
    if (colunas !== 2) return '';
    if (expandido) return 'col-span-full';
    const m = slotDataMin(startMin);
    return m === '00' ? '[grid-column:1]' : '[grid-column:2]';
  }

  function horaClass(startMin, destaque) {
    const cheia = isHoraCheia(startMin);
    const weight = cheia ? 'font-bold' : 'font-medium';
    if (destaque) return `${weight} text-white`;
    if (cheia) return `${weight} text-ink-800`;
    return `${weight} text-ink-500`;
  }

  function renderGradeInicios() {
    return gradeSlots.map((slot) => {
      const hora = slot.hhmm;
      const slotMin = slot.startMin;
      const clicavel = slotEhClicavel(slot, isFallback, slotsDisponiveis);
      const expandido = slotExpandido === hora;
      const isInicio = horaInicio === hora;
      const isFimMarca =
        rangePhase === 'complete' &&
        fimMin != null &&
        inicioMin != null &&
        (slotMin + SLOT_STEP_MIN === fimMin || horaFimSlot === hora);
      const isNoMiolo =
        rangePhase === 'complete' &&
        fimMin != null &&
        inicioMin != null &&
        slotMin > inicioMin &&
        slotMin + SLOT_STEP_MIN < fimMin;
      const isRangeDestaque = isInicio || isFimMarca;
      const faixa = faixaAlternada(slotMin);

      if (!clicavel) {
        const labelOcupado =
          slot.state === 'bloqueio'
            ? slot.observacao || 'bloqueio'
            : slot.state === 'ocupado'
              ? slot.label || 'ocupado'
              : 'indisponível';
        return (
          <LinhaDesabilitada
            key={hora}
            hora={hora}
            motivo={labelOcupado}
            title="Horário indisponível"
            startMin={slotMin}
            colunas={colunas}
          />
        );
      }

      const apiSlot = (apiSlots || []).find((s) => formatarHora(s.hora) === hora);
      const profissionais = Array.isArray(apiSlot?.profissionais) ? apiSlot.profissionais : [];
      const qtdProfs = profissionais.length;

      let cardClass =
        'flex min-h-[44px] w-full cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6] focus-visible:ring-offset-1';

      if (isRangeDestaque) {
        cardClass += ' border-[#14B8A6] bg-[#0f766e] text-white ring-1 ring-[#14B8A6]';
      } else if (isNoMiolo) {
        cardClass += ' border-vivid-teal-200 bg-vivid-teal-50/60';
      } else if (expandido) {
        cardClass += ' border-vivid-teal-200 bg-vivid-teal-50/60';
      } else {
        cardClass += ` border-ink-100 hover:border-[#14B8A6] hover:bg-vivid-teal-50 ${
          faixa ? 'bg-[#fbfcfd]' : 'bg-white'
        }`;
      }

      const estadoLabel = isRangeDestaque
        ? 'selecionado'
        : isNoMiolo
          ? 'no intervalo'
          : 'disponível';

      return (
        <div
          key={hora}
          data-min={slotDataMin(slotMin)}
          className={`sl space-y-1 ${anchorClass(slotMin, expandido)}`}
        >
          <button
            type="button"
            role="option"
            aria-selected={isRangeDestaque}
            aria-expanded={!profissionalFixado && !isFallback ? expandido : undefined}
            aria-label={`${hora}, ${estadoLabel}${qtdProfs > 0 ? `, ${qtdProfs} profissional${qtdProfs !== 1 ? 'is' : ''}` : ''}`}
            onClick={() => handleToggleExpandir(hora, apiSlot)}
            className={cardClass}
          >
            <div className="flex items-center gap-2">
              <Clock
                className={`h-3.5 w-3.5 shrink-0 ${
                  isRangeDestaque
                    ? 'text-white'
                    : isNoMiolo
                      ? 'text-vivid-teal-600'
                      : 'text-[#6b7280]'
                }`}
              />
              <span className={`text-sm ${horaClass(slotMin, isRangeDestaque)}`}>
                {hora}
              </span>
            </div>
            {!profissionalFixado && !isFallback ? (
              <div
                className={`flex items-center gap-1 text-[11px] ${
                  isRangeDestaque ? 'text-white/80' : 'text-[#6b7280]'
                }`}
              >
                {qtdProfs > 0 ? (
                  <>
                    <Users className="h-3 w-3" />
                    <span>{qtdProfs}</span>
                    {expandido ? (
                      <ChevronUp className="h-3 w-3 text-vivid-teal-600" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </>
                ) : null}
              </div>
            ) : null}
          </button>
          {!profissionalFixado && !isFallback && expandido && profissionais.length > 0 ? (
            <div className="ml-3 space-y-1.5 border-l-2 border-vivid-teal-200 py-1 pl-3">
              {profissionais.map((prof) => (
                <ProfissionalSlotRow
                  key={String(prof.roleUserId)}
                  profissional={prof}
                  onSelecionar={() => handleSelecionarProfissional(hora, prof)}
                />
              ))}
            </div>
          ) : null}
        </div>
      );
    });
  }

  function renderReguaTerminos() {
    return fimRuler.map(({ fimMin: terminoMin, hhmm }) => {
      const clicavel = validFimSlots?.has(hhmm);
      const isPreview =
        isDesktop &&
        hoverTerminoMin != null &&
        inicioMin != null &&
        terminoMin <= hoverTerminoMin &&
        validFimSlots?.has(hoverTermino);
      const faixa = faixaAlternada(terminoMin);
      const minAttr = slotDataMin(terminoMin);

      if (!clicavel) {
        const motivo = motivoTerminoInvalido(gradeSlots, inicioMin, terminoMin, windows, dayEndMin);
        return (
          <LinhaDesabilitada
            key={hhmm}
            hora={hhmm}
            motivo={motivo}
            title="Término indisponível"
            startMin={terminoMin}
            colunas={colunas}
          />
        );
      }

      let cardClass =
        'sl flex min-h-[44px] w-full cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6] focus-visible:ring-offset-1';

      if (isPreview) {
        cardClass += ' border-vivid-teal-200 bg-vivid-teal-50/40';
      } else {
        cardClass += ` border-ink-100 hover:border-[#14B8A6] hover:bg-vivid-teal-50 ${
          faixa ? 'bg-[#fbfcfd]' : 'bg-white'
        }`;
      }

      if (colunas === 2) {
        cardClass += minAttr === '00' ? ' [grid-column:1]' : ' [grid-column:2]';
      }

      return (
        <button
          key={hhmm}
          type="button"
          role="option"
          aria-selected={false}
          aria-label={`${hhmm}, término disponível`}
          data-min={minAttr}
          onMouseEnter={() => {
            if (isDesktop) setHoverTermino(hhmm);
          }}
          onMouseLeave={() => {
            if (isDesktop) setHoverTermino(null);
          }}
          onClick={() => handleSelecionarTermino(hhmm)}
          className={cardClass}
        >
          <div className="flex items-center gap-2">
            <Clock
              className={`h-3.5 w-3.5 shrink-0 ${isPreview ? 'text-vivid-teal-600' : 'text-[#6b7280]'}`}
            />
            <span className={`text-sm ${horaClass(terminoMin, false)} ${isPreview ? '!text-vivid-teal-700' : ''}`}>
              {hhmm}
            </span>
          </div>
          <span className="text-[10px] text-[#6b7280]">término</span>
        </button>
      );
    });
  }

  const listClass =
    colunas === 2
      ? `grid grid-cols-1 gap-1 sm:grid-cols-2 ${apiEnabled && apiLoading ? 'opacity-60' : ''}`
      : `space-y-1 ${apiEnabled && apiLoading ? 'opacity-60' : ''}`;

  const showBanners = !hidePhaseBanner;

  return (
    <div
      className={listClass}
      role="listbox"
      aria-label={rangePhase === 'awaitingEnd' ? 'Horários de término' : 'Horários disponíveis'}
    >
      {showBanners && rangePhase === 'idle' ? (
        <p className={`mb-2 text-xs font-medium text-ink-500 ${colunas === 2 ? 'col-span-full' : ''}`}>
          Selecione o horário de início
        </p>
      ) : null}

      {showBanners && rangePhase === 'awaitingEnd' ? (
        <div
          className={`mb-2 flex items-center justify-between gap-2 rounded-lg border border-vivid-teal-200 bg-vivid-teal-50/80 px-3 py-2 ${
            colunas === 2 ? 'col-span-full' : ''
          }`}
        >
          <p className="text-xs font-medium text-vivid-teal-800">
            Início {formatarHora(horaInicio)} — agora selecione o término
          </p>
          {typeof onClearRange === 'function' ? (
            <button
              type="button"
              onClick={onClearRange}
              className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-vivid-teal-700 hover:bg-vivid-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6] focus-visible:ring-offset-1"
              aria-label="Limpar seleção de horário"
            >
              <X className="h-3.5 w-3.5" />
              Limpar
            </button>
          ) : null}
        </div>
      ) : null}

      {showBanners && rangePhase === 'complete' ? (
        <div
          className={`mb-2 flex items-center justify-between gap-2 rounded-lg border border-vivid-teal-200 bg-vivid-teal-50/80 px-3 py-2 ${
            colunas === 2 ? 'col-span-full' : ''
          }`}
        >
          <p className="text-xs font-semibold text-vivid-teal-800">
            {formatarHora(horaInicio)}–{formatarHora(horaFimSlot)} ({duracaoTotalMin} min)
          </p>
          {typeof onClearRange === 'function' ? (
            <button
              type="button"
              onClick={onClearRange}
              className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-vivid-teal-700 hover:bg-vivid-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6] focus-visible:ring-offset-1"
              aria-label="Limpar seleção de horário"
            >
              <X className="h-3.5 w-3.5" />
              Limpar
            </button>
          ) : null}
        </div>
      ) : null}

      {rangePhase === 'awaitingEnd' ? renderReguaTerminos() : renderGradeInicios()}
    </div>
  );
}
