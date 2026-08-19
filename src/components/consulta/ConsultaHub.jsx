import React from 'react';
import { BookOpen, ClipboardList, Eye, FileText, RotateCcw, Syringe } from 'lucide-react';
import { getPatientInitials as defaultGetPatientInitials } from '../utils';
import { useTermosPendentes } from '../../hooks/useTermosPendentes';
import { temFaltantes, consentimentosAguardandoExecucao } from '../../utils/termoResolucao';

const MODULE_CARDS = [
  { id: 'anamnese', label: 'Anamnese', description: 'Ficha e histórico clínico', icon: FileText },
  { id: 'avaliacao', label: 'Avaliação', description: 'Fotos e desenho sobre as imagens', icon: Eye },
  { id: 'planejamento', label: 'Planejamento', description: 'Planos de tratamento e procedimentos', icon: BookOpen },
  { id: 'termos', label: 'Termos', description: 'Consentimentos e assinaturas', icon: ClipboardList },
  { id: 'procedimento', label: 'Procedimento', description: 'Registro, fotos e finalização', icon: Syringe },
  {
    id: 'retorno-avulso',
    label: 'Retorno',
    description: 'Avaliar retorno de procedimento anterior',
    icon: RotateCcw,
  },
];

function getCardConsentDot(cardId, termosPendentes, hasCatalogo) {
  if (!hasCatalogo) return null;
  if (temFaltantes(termosPendentes?.resolucao)) return null;
  const credits = consentimentosAguardandoExecucao(termosPendentes?.resolucao);
  if (credits.length === 0) return null;
  if (cardId !== 'termos' && cardId !== 'procedimento') return null;
  return {
    badgeClass: 'bg-emerald-50 text-emerald-800',
    tooltipClass: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    tooltip: 'Consentimento válido aguardando execução',
    label: 'Válido',
  };
}

function getCardPendingDot(cardId, paciente, termosPendentes) {
  if (!paciente) return null;
  if (cardId === 'termos' && (termosPendentes?.count ?? 0) > 0) {
    const n = termosPendentes.count;
    return {
      badgeClass: 'bg-status-warn-bg text-status-warn-ink',
      tooltipClass: 'border-status-warn-ink/30 bg-status-warn-bg text-status-warn-ink',
      tooltip: `${n} termo${n > 1 ? 's' : ''} pendente${n > 1 ? 's' : ''} de assinatura`,
    };
  }
  if (cardId === 'anamnese' && paciente.anamnesePendente === true) {
    return {
      badgeClass: 'bg-status-danger-bg text-status-danger-ink',
      tooltipClass: 'border-status-danger-ink/30 bg-status-danger-bg text-status-danger-ink',
      tooltip: 'Paciente novo sem ficha de anamnese preenchida',
    };
  }
  if (cardId === 'anamnese' && paciente.anamneseDesatualizada === true) {
    return {
      badgeClass: 'bg-status-danger-bg text-status-danger-ink',
      tooltipClass: 'border-status-danger-ink/30 bg-status-danger-bg text-status-danger-ink',
      tooltip: 'Anamnese desatualizada — revisar antes de continuar',
    };
  }
  if (
    cardId === 'planejamento' &&
    paciente.statusPlanoCodigo != null &&
    paciente.statusPlanoCodigo !== 'sem_plano'
  ) {
    return {
      badgeClass: 'bg-status-warn-bg text-status-warn-ink',
      tooltipClass: 'border-status-warn-ink/30 bg-status-warn-bg text-status-warn-ink',
      tooltip: 'Há planejamento em andamento para este paciente',
    };
  }
  return null;
}

function buildModuleCards(isRetorno) {
  if (isRetorno) {
    return [
      {
        id: 'retorno',
        label: 'Retorno',
        description: 'Avaliação do resultado, foto e retoque',
        icon: RotateCcw,
      },
      { id: 'termos', label: 'Termos', description: 'Consentimentos', icon: ClipboardList },
    ];
  }
  return MODULE_CARDS;
}

export function ConsultaHub({
  paciente,
  isRetorno = false,
  onSelectModule,
  onIniciarRetornoAvulso,
  onEncerrarConsulta,
  getPatientInitials,
  catalogoIds = [],
  exigirFilaVinculo = true,
  nomeProcedimento,
  onTermosBloqueio,
}) {
  const initialsFn = getPatientInitials ?? defaultGetPatientInitials;
  const iniciais = paciente ? initialsFn(paciente.nome || '') || '—' : '—';
  const cards = buildModuleCards(isRetorno);
  const termosPendentes = useTermosPendentes(paciente?.id, {
    catalogoIds,
    exigirFilaVinculo,
  });
  const semVinculo = termosPendentes.resolucao?.procedimentosSemVinculo || [];

  const handleSelectModule = (id) => {
    if (id === 'procedimento' && exigirFilaVinculo && temFaltantes(termosPendentes.resolucao)) {
      onTermosBloqueio?.({
        nomeProcedimento: nomeProcedimento || 'procedimento',
        faltantes: termosPendentes.resolucao.faltantes,
      });
      return;
    }
    onSelectModule?.(id);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-app-border pb-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#00a88e] text-[13px] font-bold text-white sm:h-12 sm:w-12">
            {iniciais}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-[18px] font-bold text-[#0f172a] sm:text-[20px]">
              {paciente?.nome || 'Paciente'}
            </h2>
            {isRetorno ? (
              <p className="inline-flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-[#00a88e] sm:text-[14px]">
                <span className="rounded-full bg-[#e6f7f5] px-2.5 py-0.5 text-[11px] font-bold uppercase text-[#0f766e]">
                  Retorno
                </span>
                Retorno em andamento
              </p>
            ) : (
              <p className="text-[13px] font-medium text-[#00a88e] sm:text-[14px]">Consulta em andamento</p>
            )}
          </div>
        </div>
        {typeof onEncerrarConsulta === 'function' ? (
          <button
            type="button"
            onClick={onEncerrarConsulta}
            className="rounded-xl border border-app-border bg-white px-4 py-2.5 text-[13px] font-semibold text-[#64748b] transition-colors hover:bg-app-nav-hover active:bg-app-nav-active"
          >
            Encerrar consulta
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const ModuleIcon = card.icon;
          const pendingDot = getCardPendingDot(card.id, paciente, termosPendentes);
          const consentDot =
            pendingDot == null
              ? getCardConsentDot(card.id, termosPendentes, (catalogoIds || []).length > 0)
              : null;
          const statusDot = pendingDot || consentDot;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => {
                if (card.id === 'retorno-avulso') {
                  onIniciarRetornoAvulso?.();
                  return;
                }
                handleSelectModule(card.id);
              }}
              className="group relative flex flex-col gap-3 rounded-xl border border-app-border bg-white p-4 text-left transition-colors hover:bg-app-nav-hover active:bg-app-nav-active sm:p-5"
            >
              {statusDot ? (
                <span className="absolute right-3 top-3 sm:right-3.5 sm:top-3.5">
                  <span
                    tabIndex={0}
                    aria-label={statusDot.tooltip}
                    className={`block animate-pulse rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${statusDot.badgeClass}`}
                  >
                    {statusDot.label || 'Pendência'}
                  </span>
                  <span
                    role="tooltip"
                    className={`pointer-events-none absolute right-0 top-6 z-20 hidden w-max max-w-[200px] whitespace-normal rounded-md border px-2 py-1 text-[11px] font-semibold leading-snug shadow-md group-hover:block group-focus-visible:block ${statusDot.tooltipClass}`}
                  >
                    {statusDot.tooltip}
                  </span>
                </span>
              ) : null}
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e6f7f5] text-[#00a88e]">
                <ModuleIcon className="h-5 w-5" strokeWidth={2.2} aria-hidden />
              </span>
              <span>
                <span className="block text-[15px] font-bold text-[#0f172a] sm:text-[16px]">{card.label}</span>
                <span className="mt-1 block text-[13px] leading-snug text-[#64748b]">{card.description}</span>
              </span>
            </button>
          );
        })}
      </div>
      {termosPendentes.resolucao?.clinicaSemTermosAtivos ? (
        <p className="rounded-xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-[13px] font-medium text-[#92400e]">
          Nenhum termo cadastrado. Configure em Configurações → Clínica → Termos.
        </p>
      ) : null}
      {!isRetorno && semVinculo.length > 0 ? (
        <p className="text-[12px] text-[#94a3b8]">
          Este procedimento não exige termo vinculado.
        </p>
      ) : null}
    </div>
  );
}
