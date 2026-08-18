import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ClipboardList,
  History,
  LayoutGrid,
  Loader2,
  Users,
} from 'lucide-react';
import {
  CARD_BORDER_CLASSES,
  CARD_DOT_CLASSES,
  CARD_LABEL_CLASSES,
  COLOR_CLASSES,
  FAIXA_CELL,
  FAIXA_CONTAINER,
  FAIXA_GROUP_NAME,
  FAIXA_TRANSITION,
} from './alertaSeveridadeStyle.js';
import { buildGroupedChips } from './alertaGrouping.js';
import { EMPTY_RESUMO, normalizeResumo } from '../../hooks/useAlertasClinicos.js';

function formatDiaMes(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function itemNome(item) {
  if (item == null) return '';
  if (typeof item === 'string') return item;
  return item.nome ?? '';
}

function Chev({ className = '', inverted = false }) {
  return (
    <ChevronDown
      className={`h-3 w-3 shrink-0 ${FAIXA_TRANSITION} ${inverted ? 'text-white opacity-100' : 'text-slate-400 opacity-45'} ${className}`}
      strokeWidth={2.4}
      aria-hidden
    />
  );
}

const MAX_SIDEBAR_ITEMS = 6;

/** Corta a lista de grupos em `max` itens no total, preservando a ordem dos campos. */
function capGroups(groups, max) {
  let remaining = max;
  const capped = [];
  for (const group of groups) {
    if (remaining <= 0) break;
    const items = group.items.slice(0, remaining);
    remaining -= items.length;
    capped.push({ ...group, items });
  }
  return capped;
}

/**
 * Grade de cards por campo — um bloco por categoria com borda superior colorida, contagem
 * e itens em lista com marcador. Usado no modal "Ver todos" do perfil do paciente.
 */
export function AlertasGroupCards({ groups, columns = 'grid-cols-2 sm:grid-cols-4' }) {
  return (
    <div className={`grid gap-2 ${columns}`}>
      {groups.map((group) => {
        const GroupIcon = group.Icon;
        return (
          <div
            key={group.secao}
            className={`rounded-lg border-t-[3px] bg-white p-2.5 shadow-sm ${CARD_BORDER_CLASSES[group.color]}`}
          >
            <div className="mb-1.5 flex items-center justify-between gap-1.5">
              <span
                className={`flex min-w-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wide ${CARD_LABEL_CLASSES[group.color]}`}
              >
                <GroupIcon className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
                <span className="truncate">{group.label}</span>
              </span>
              <span className="shrink-0 rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-[#64748b]">
                {group.items.length}
              </span>
            </div>
            <ul className="flex flex-col gap-1">
              {group.items.map((item) => (
                <li key={item.key} className="flex items-start gap-1.5">
                  <span
                    className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${CARD_DOT_CLASSES[group.color]}`}
                    aria-hidden
                  />
                  <span
                    title={item.label}
                    className="min-w-0 break-words text-[11.5px] font-semibold leading-snug text-[#0f172a]"
                  >
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function ItemList({ items, risco = false }) {
  return (
    <ul
      className={`grid grid-cols-[repeat(auto-fill,minmax(238px,1fr))] gap-x-6 gap-y-px ${
        risco ? 'font-[560] text-[#0f172a]' : 'font-medium text-[#334155]'
      }`}
    >
      {items.map((texto, i) => (
        <li key={`${texto}-${i}`} className="flex items-start gap-2 py-[3.5px] text-[12.5px] leading-[1.42]">
          <span
            className={`mt-[7.5px] h-1 w-1 shrink-0 rounded-full ${
              risco ? 'bg-[#e11d48] opacity-85' : 'bg-current opacity-40'
            }`}
            aria-hidden
          />
          {texto}
        </li>
      ))}
    </ul>
  );
}

function SeloConfira() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#fecdd3] bg-[#fff1f2] px-[7px] py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-[#be123c]">
      <AlertTriangle className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
      confira antes do procedimento
    </span>
  );
}

function GrupoDetalhe({ natureza }) {
  const nomes = natureza.items.map(itemNome).filter(Boolean);
  const criticas = natureza.criticas ?? [];
  const demais = natureza.sub ? nomes.filter((n) => !criticas.includes(n)) : nomes;
  const mostraSelo = (natureza.risk || criticas.length > 0) && nomes.length > 0;

  return (
    <div className="not-first:mt-[15px] not-first:border-t not-first:border-dashed not-first:border-[#e2e8f0] not-first:pt-3.5">
      <div className="mb-2 flex flex-wrap items-center gap-[7px]">
        <span
          className={`text-[10.5px] font-bold uppercase tracking-[0.085em] ${FAIXA_GROUP_NAME[natureza.k]}`}
        >
          {natureza.full}
        </span>
        <span className="rounded-full bg-[#eef2f6] px-1.5 py-px text-[10px] font-semibold text-[#5b6b7f]">
          {nomes.length}
        </span>
        {mostraSelo ? <SeloConfira /> : null}
      </div>
      {nomes.length === 0 ? (
        <p className="text-[12.5px] font-medium text-[#5b6b7f]">Nada declarado na anamnese vigente.</p>
      ) : natureza.sub && criticas.length > 0 ? (
        <>
          <ItemList items={criticas} risco />
          <div className="mb-1.5 mt-[11px] flex items-center gap-[7px]">
            <span className="text-[9.5px] font-bold uppercase tracking-[0.085em] text-[#5b6b7f]">
              demais declarações
            </span>
            <span className="rounded-full bg-[#eef2f6] px-1.5 py-px text-[10px] font-semibold text-[#5b6b7f]">
              {demais.length}
            </span>
          </div>
          {demais.length > 0 ? <ItemList items={demais} /> : null}
        </>
      ) : (
        <ItemList items={nomes} risco={Boolean(natureza.risk)} />
      )}
    </div>
  );
}

function RodapeDetalhe({ familiar, historico }) {
  const [histOpen, setHistOpen] = useState(false);
  return (
    <>
      {familiar.length > 0 ? (
        <div className="mt-[15px] flex items-start gap-2 border-t border-[#e2e8f0] pt-[13px] text-xs font-medium text-[#5b6b7f]">
          <Users className="mt-0.5 h-[13px] w-[13px] shrink-0 opacity-50" strokeWidth={2} aria-hidden />
          <span>
            <b className="font-semibold text-[#334155]">Histórico familiar:</b> {familiar.join(' · ')}
          </span>
        </div>
      ) : null}
      {historico.length > 0 ? (
        <div className="mt-3 border-t border-[#e2e8f0] pt-3">
          <button
            type="button"
            className={`inline-flex min-h-8 items-center gap-[7px] rounded-md p-0 text-[11.5px] font-semibold text-slate-400 hover:text-[#334155] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-teal-600 ${FAIXA_TRANSITION}`}
            aria-expanded={histOpen}
            onClick={() => setHistOpen((prev) => !prev)}
          >
            <History className="h-3 w-3" strokeWidth={2} aria-hidden />
            <span>Histórico — não consta na anamnese vigente</span>
            <Chev className={histOpen ? 'rotate-180 opacity-100' : ''} />
          </button>
          {histOpen ? (
            <div className="mt-2.5 rounded-[9px] border border-[#e2e8f0] bg-[#f6f8fa] px-[13px] py-[11px]">
              {historico.map((h) => (
                <div key={`${h.natureza}-${h.texto}`} className="text-xs leading-[1.85]">
                  <em className="mr-2 text-[9.5px] font-bold not-italic uppercase tracking-[0.08em] text-slate-400">
                    {h.natureza}
                  </em>
                  <b className="font-[550] text-[#334155]">{h.texto}</b>
                </div>
              ))}
              <p className="mt-2 text-[10.5px] leading-normal text-slate-400">
                Continuam registrados no prontuário. Não constam na anamnese vigente.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function FaixaHub({ resumo, isLoading, onSolicitarAnamnese }) {
  const [openIndex, setOpenIndex] = useState(-1);
  const [allOpen, setAllOpen] = useState(false);
  const r = useMemo(() => normalizeResumo(resumo), [resumo]);

  const naturezas = useMemo(
    () => [
      {
        k: 'ali',
        lab: (
          <>
            alergias
            <br />
            alimentares
          </>
        ),
        full: 'Alergia alimentar',
        risk: true,
        items: r.alergiasAlimentares,
      },
      {
        k: 'pa',
        lab: (
          <>
            alergias a
            <br />
            princípio ativo
          </>
        ),
        full: 'Alergia a princípio ativo',
        risk: true,
        items: r.alergiasPrincipioAtivo,
      },
      {
        k: 'med',
        lab: (
          <>
            medicamentos
            <br />
            em uso
          </>
        ),
        full: 'Medicamento em uso',
        items: r.medicamentosEmUso,
      },
      {
        k: 'ant',
        lab: (
          <>
            condições
            <br />
            de saúde
          </>
        ),
        full: 'Condição de saúde',
        items: r.condicoesSaude,
      },
      {
        k: 'ana',
        lab: (
          <>
            declarações
            <br />
            na anamnese
          </>
        ),
        full: 'Declarado na anamnese',
        sub: true,
        items: [...r.declaracoesCriticas, ...r.declaracoesDemais],
        criticas: r.declaracoesCriticas,
      },
    ],
    [r]
  );

  const criticosCount =
    r.alergiasAlimentares.length + r.alergiasPrincipioAtivo.length + r.declaracoesCriticas.length;
  const estado = criticosCount > 0 ? 'crit' : r.temVigente ? 'ok' : 'nada';
  const detalheAberto = allOpen || openIndex >= 0;
  const dataCurta = formatDiaMes(r.vigenteEm);
  const statusQuando = r.vigenteAssinada ? 'assinada' : 'finalizada';

  if (isLoading) {
    return (
      <div className={`overflow-hidden rounded-[11px] border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] ${FAIXA_CONTAINER.nada}`}>
        <div className="flex min-h-12 items-center gap-2 px-4 text-[12px] font-medium text-[#5b6b7f]">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-teal-600" aria-hidden />
          Carregando alertas…
        </div>
      </div>
    );
  }

  if (estado === 'nada') {
    return (
      <div className={`overflow-hidden rounded-[11px] border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] ${FAIXA_CONTAINER.nada}`}>
        <div className="flex items-center gap-[11px] px-[17px] py-[15px] text-[13px] font-medium text-[#5b6b7f]">
          <ClipboardList className="h-[17px] w-[17px] shrink-0" strokeWidth={2} aria-hidden />
          <span>
            <b className="font-semibold text-[#334155]">Nenhuma anamnese preenchida.</b> Solicite o
            preenchimento antes de qualquer procedimento.
          </span>
          {typeof onSolicitarAnamnese === 'function' ? (
            <button
              type="button"
              onClick={onSolicitarAnamnese}
              className={`ml-auto min-h-[38px] whitespace-nowrap rounded-lg border border-teal-600 bg-teal-600 px-3.5 text-xs font-semibold text-white hover:border-teal-700 hover:bg-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 ${FAIXA_TRANSITION}`}
            >
              Solicitar anamnese
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const abrirNatureza = (idx) => {
    setAllOpen(false);
    setOpenIndex((prev) => (prev === idx ? -1 : idx));
  };
  const abrirTudo = () => {
    setAllOpen((prev) => !prev);
    setOpenIndex(-1);
  };

  return (
    <div
      className={`overflow-hidden rounded-[11px] border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] ${FAIXA_CONTAINER[estado]}`}
    >
      <div
        className="flex items-stretch gap-0.5 overflow-x-auto py-[5px] pl-1.5 pr-[5px] [scrollbar-width:thin]"
        role="group"
        aria-label="Resumo clínico do paciente"
      >
        {naturezas.map((n, idx) => {
          const count = n.items.length;
          const expanded = openIndex === idx && !allOpen;
          const risk = (n.risk || n.sub) && count > 0;
          return (
            <React.Fragment key={n.k}>
              {idx > 0 ? <span className="my-3.5 w-px shrink-0 bg-[#e2e8f0]" aria-hidden /> : null}
              <button
                type="button"
                id={`faixa-cell-${n.k}`}
                aria-expanded={expanded}
                onClick={() => abrirNatureza(idx)}
                className={`relative flex min-h-12 shrink-0 items-center gap-2.5 rounded-[9px] border border-transparent px-3 py-[9px] text-left ${FAIXA_CELL[n.k]} ${FAIXA_TRANSITION} hover:border-[#dbe3ec] hover:bg-slate-100 hover:[&_.faixa-chev]:translate-y-px hover:[&_.faixa-chev]:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 aria-expanded:border-[#cfd9e4] aria-expanded:bg-[#eef2f7] aria-expanded:shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)] aria-expanded:[&_.faixa-chev]:rotate-180 aria-expanded:[&_.faixa-chev]:opacity-100 ${count === 0 ? 'opacity-50' : ''} ${
                  risk
                    ? "before:absolute before:left-3 before:right-3 before:top-[-5px] before:h-[3px] before:rounded-b-[3px] before:bg-current before:content-['']"
                    : ''
                }`}
              >
                <span
                  className={`min-w-[15px] text-xl font-bold tabular-nums leading-none tracking-tight ${count === 0 ? 'text-slate-400' : ''}`}
                >
                  {count}
                </span>
                <span className="whitespace-nowrap text-[10.5px] font-semibold leading-[1.28] tracking-tight text-[#5b6b7f]">
                  {n.lab}
                </span>
                <Chev className="faixa-chev ml-px" />
                <span className="sr-only">
                  {count} {n.full}. Abrir detalhes.
                </span>
              </button>
            </React.Fragment>
          );
        })}
        <div className="ml-auto flex shrink-0 items-center gap-[9px] pl-3">
          <span
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-[11px] py-1.5 text-[11.5px] font-semibold ${
              criticosCount > 0
                ? 'border-[#fecdd3] bg-[#fff1f2] text-[#be123c]'
                : 'border-[#99f6e4] bg-[#f0fdfa] text-[#0f766e]'
            }`}
          >
            <AlertTriangle className="h-3 w-3" strokeWidth={2} aria-hidden />
            {criticosCount > 0 ? `${criticosCount} críticos` : 'sem críticos'}
          </span>
          <button
            type="button"
            aria-expanded={allOpen}
            onClick={abrirTudo}
            className={`inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 ${FAIXA_TRANSITION} ${
              allOpen
                ? 'border-[#0f172a] bg-[#0f172a] text-white'
                : 'border-[#e2e8f0] bg-white text-[#334155] hover:border-slate-300 hover:bg-slate-100 hover:text-[#0f172a]'
            }`}
          >
            <LayoutGrid className="h-3 w-3" strokeWidth={2} aria-hidden />
            Ver tudo
            <Chev inverted={allOpen} className={allOpen ? 'rotate-180' : ''} />
          </button>
          {dataCurta ? (
            <span className="pr-2 text-right text-[10.5px] font-medium leading-[1.3] text-slate-400">
              <b className="block font-semibold text-[#5b6b7f]">Anamnese</b>
              {dataCurta} · {statusQuando}
            </span>
          ) : null}
        </div>
      </div>
      {detalheAberto ? (
        <div className="border-t border-[#e2e8f0] bg-[#fcfdfe] px-[17px] py-4 motion-safe:animate-[in_200ms_cubic-bezier(.4,0,.2,1)]">
          {allOpen
            ? naturezas.map((n) => <GrupoDetalhe key={n.k} natureza={n} />)
            : openIndex >= 0
              ? <GrupoDetalhe natureza={naturezas[openIndex]} />
              : null}
          <RodapeDetalhe familiar={r.historicoFamiliar} historico={r.historico} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Bloco de alertas clínicos (perfil clínico + fatos da anamnese vigente).
 * `variant="sidebar"` devolve só o conteúdo (cartão "Alertas" do perfil).
 * `variant="hub"` é a faixa de contadores por natureza no cabeçalho da consulta.
 */
export function AlertasClinicosPanel({
  alertasPerfil = [],
  alertasAnamnese = [],
  // eslint-disable-next-line no-unused-vars
  alertasAlergia = [],
  isLoading = false,
  variant = 'sidebar',
  onVerTodos,
  temAnamneseVigente = false,
  vigenteEm = null,
  vigenteAssinada = false,
  resumo = null,
  onSolicitarAnamnese,
  alergiasAlimentares,
  alergiasPrincipioAtivo,
  medicamentosEmUso,
  condicoesSaude,
  declaracoesCriticas,
  declaracoesDemais,
  historicoFamiliar,
  historico,
}) {
  const groups = useMemo(
    () => buildGroupedChips(alertasPerfil, alertasAnamnese),
    [alertasPerfil, alertasAnamnese]
  );
  const totalCount = useMemo(
    () => groups.reduce((sum, group) => sum + group.items.length, 0),
    [groups]
  );

  if (variant === 'hub') {
    const hubResumo = resumo
      ? resumo
      : {
          ...EMPTY_RESUMO,
          temVigente: temAnamneseVigente,
          vigenteEm,
          vigenteAssinada,
          alergiasAlimentares: alergiasAlimentares ?? [],
          alergiasPrincipioAtivo: alergiasPrincipioAtivo ?? [],
          medicamentosEmUso: medicamentosEmUso ?? [],
          condicoesSaude: condicoesSaude ?? [],
          declaracoesCriticas: declaracoesCriticas ?? [],
          declaracoesDemais: declaracoesDemais ?? [],
          historicoFamiliar: historicoFamiliar ?? [],
          historico: historico ?? [],
        };
    return (
      <FaixaHub resumo={hubResumo} isLoading={isLoading} onSolicitarAnamnese={onSolicitarAnamnese} />
    );
  }

  const hasVerTodos = typeof onVerTodos === 'function';
  const visibleGroups = hasVerTodos ? capGroups(groups, MAX_SIDEBAR_ITEMS) : groups;

  return (
    <div className="space-y-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wide text-red-700">Alertas clínicos</span>
      {isLoading ? (
        <div className="flex items-center gap-2 text-[11px] font-medium text-[#64748b]">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-red-600" aria-hidden />
          Carregando alertas…
        </div>
      ) : totalCount === 0 ? (
        <p className="text-[11px] font-medium leading-snug text-[#64748b]">Nenhum alerta clínico registrado.</p>
      ) : (
        <>
          <div className="space-y-2">
            {visibleGroups.map((group) => {
              const GroupIcon = group.Icon;
              return (
                <div key={group.secao}>
                  <p
                    className={`mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide ${CARD_LABEL_CLASSES[group.color]}`}
                  >
                    <GroupIcon className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
                    {group.label}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.items.map((item) => (
                      <span
                        key={item.key}
                        title={item.label}
                        className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold ${COLOR_CLASSES[group.color]}`}
                      >
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {hasVerTodos && totalCount > MAX_SIDEBAR_ITEMS ? (
            <button
              type="button"
              onClick={onVerTodos}
              className="mt-1 flex h-7 w-full items-center justify-center rounded-md border border-red-200 text-[11px] font-semibold text-red-700 transition-colors hover:bg-red-50"
            >
              Ver todos ({totalCount})
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
