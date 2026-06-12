import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  Cake,
  Calendar,
  ChevronDown,
  Clock,
  ClipboardList,
  FileText,
  Image as ImageIcon,
  Loader2,
  Play,
  StickyNote,
  Trash2,
  Pencil,
  Plus,
  User as   UserIcon,
  X,
} from 'lucide-react';
import {
  anamneseApi,
  pacientesApi,
  pacienteAlertasManuaisApi,
  pacientesGaleriaApi,
  notasApi,
  procedimentosApi,
  termoAssinaturaApi,
  getApiErrorDetail,
} from '../../services/api';
import { useToast } from '../../contexts/useToast.js';
import { usePapel } from '../../hooks/usePapel';
import { mapBackendPatient, mergePacienteDtoWithEditing } from '../../utils/patientMapping';
import { convertToWebP } from '../../utils/imageUtils.js';
import {
  fetchNextAppointmentIsoForPaciente,
  latestProcedureOccurredInstantIso,
} from '../../utils/patientProfileDerivedDates.js';
import { validatePacienteFormBasics } from '../../utils/patientFormValidation';
import { PACIENTE_FIELD_MAX } from '../../utils/patientFieldMaxLength';
import {
  maskCPF,
  maskRG,
  validateBirthDateDigits8,
  birthDateValidationUserMessage,
} from '../utils/formatters';
import { PatientForm } from './PatientForm.jsx';
import { formatPhoneAsYouType, formatPhoneForApi, parsePhoneFromApi } from '../../utils/phoneUtils';
import {
  birthdayModalStorageKey,
  getBirthdayAlertInfo,
  parsePatientBirthDate,
} from '../../utils/birthday.js';
import {
  compressImageFileToJpegDataUrl,
  profilePhotoStorageKey,
  setStoredProfilePhotoDataUrl,
} from '../../utils/patientProfilePhoto.js';
import { ProfileBreadcrumb } from './ProfileBreadcrumb.jsx';
import { ProfileHero } from './ProfileHero.jsx';
import { ProfileKpiStrip } from './ProfileKpiStrip.jsx';
import { formatDiasAtrasPtBr } from './profileDisplayUtils.js';
import {
  ProcedureTimelineHeading,
  ProcedureTimelineRail,
  ProcedureTimelineEntry,
  ProcedureTimelineProfileVerMaisStrip,
  ProcedureTimelinePreviewCard,
} from './ProcedureTimelineBlock.jsx';
import { sortProcedimentosPorCriadoEmDesc } from './procedureTimelineUtils.js';
import {
  formatPacienteGaleriaError,
  normalizePacienteGaleriaResponse,
  filterGaleriaItemsForUi,
  groupGaleriaItemsBySession,
  formatGaleriaLegendaForUpload,
  itemMesReferenciaISO,
} from '../../utils/pacienteGaleria.js';
import {
  GaleriaArquivoImage,
  GaleriaLocalImage,
} from './GaleriaArquivoImage.jsx';
import { ZoomableGalleryLightbox } from './ZoomableGalleryLightbox.jsx';
import { RelatoAcompanhamentoModal } from '../journey/RelatoAcompanhamentoModal.jsx';
import { GaleriaTab } from './galeria/GaleriaTab.jsx';

function birthdayAlertSidebarCopy(alert) {
  if (!alert) return null;
  if (alert.isToday) return 'Aniversário hoje — celebre com o paciente!';
  if (alert.daysUntil === 1) return 'Aniversário amanhã';
  return `Aniversário em ${alert.daysUntil} dias`;
}

/** ISO `YYYY-MM-DD` → exibição DD/MM/AAAA para o campo de data. */
function isoDateToBrazilianDisplay(iso) {
  if (!iso || typeof iso !== 'string') return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Normaliza sexo vindo do backend / seeds para o select F|M|N. */
function sexoForPatientFormSelect(patientSexoRaw) {
  const u = String(patientSexoRaw ?? '').trim().toUpperCase();
  if (['F', 'M', 'N'].includes(u)) return u;
  const low = String(patientSexoRaw ?? '').trim().toLowerCase();
  if (low === 'feminino') return 'F';
  if (low === 'masculino') return 'M';
  if (low === 'prefiro não dizer' || low === 'prefiro nao dizer') return 'N';
  if (low === 'f') return 'F';
  if (low === 'm') return 'M';
  if (low === 'n') return 'N';
  return '';
}

function normalizeListaAlertasManualApi(payload) {
  if (payload == null) return [];
  if (Array.isArray(payload)) return payload;
  const c =
    payload?.content ??
    payload?.items ??
    payload?.data ??
    payload?.lista ??
    payload?._embedded?.alertas ??
    [];
  return Array.isArray(c) ? c : [];
}

function normalizeAlertaManualItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id ?? raw.alertaId ?? raw.alertaManualId ?? raw.uuid;
  if (id == null || String(id).trim() === '') return null;
  return {
    id: String(id),
    titulo: String(raw.titulo ?? raw.title ?? '').trim(),
    descricao: String(raw.descricao ?? raw.description ?? '').trim(),
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
  };
}

function renderRespostaValue(resp) {
  if (resp.opcaoSelecionada) return resp.opcaoSelecionada;
  if (Array.isArray(resp.opcoesSelecionadasLabels) && resp.opcoesSelecionadasLabels.length > 0) {
    return resp.opcoesSelecionadasLabels.join(', ');
  }
  if (resp.respostaTexto) return resp.respostaTexto;
  if (resp.respostaNumero !== null && resp.respostaNumero !== undefined) return String(resp.respostaNumero);
  if (resp.respostaBoolean === true) return 'Sim';
  if (resp.respostaBoolean === false) return 'Não';
  return '-';
}

/** Resposta cuja pergunta foi marcada como alerta na ficha (ALERTA / alert). */
function isRespostaPrioridadeAlerta(resp) {
  const p = resp?.pergunta;
  const pr = p?.prioridade ?? resp?.prioridade ?? resp?.priority ?? p?.priority;
  if (pr == null || pr === '') return false;
  const s = String(pr).trim().toLowerCase();
  return pr === 'ALERTA' || s === 'alerta' || s === 'alert';
}

/** Pergunta em ALERTA só entra no painel se o paciente de fato respondeu algo relevante. */
function isRespostaPreocupante(resp) {
  if (resp.respostaBoolean === true) return true;
  if (resp.respostaBoolean === false) return false;
  if (resp.respostaTexto != null && String(resp.respostaTexto).trim() !== '') return true;
  if (resp.perguntaOpcaoId != null && resp.perguntaOpcaoId !== '') return true;
  if (Array.isArray(resp.opcoesSelecionadas) && resp.opcoesSelecionadas.length > 0) return true;
  if (Array.isArray(resp.opcoes_selecionadas) && resp.opcoes_selecionadas.length > 0) return true;
  if (resp.respostaNumero != null && resp.respostaNumero !== '') return true;
  return false;
}

function textoPerguntaResposta(resp) {
  return (resp?.perguntaDescricao || resp?.pergunta?.descricao || 'Pergunta').trim() || 'Pergunta';
}

function isRespostaCategoria(resp, nomeCategoria) {
  const cat = (
    resp?.pergunta?.categoria?.nome ||
    resp?.pergunta?.categoriaNome ||
    resp?.categoriaName ||
    resp?.categoria?.nome ||
    ''
  ).trim().toLowerCase();
  return cat === nomeCategoria.toLowerCase();
}

function isRespostaPositiva(resp) {
  if (resp.respostaBoolean === false) return false;
  if (resp.respostaBoolean === true) return true;
  if (resp.respostaTexto && resp.respostaTexto.trim() !== '') return true;
  if (resp.perguntaOpcaoId) return true;
  if (Array.isArray(resp.opcoesSelecionadas) && resp.opcoesSelecionadas.length > 0) return true;
  if (Array.isArray(resp.opcoes_selecionadas) && resp.opcoes_selecionadas.length > 0) return true;
  return false;
}

/** Formato gravado em AppRefactored: `Queixa: …. Expectativas: …` */
function parseQueixaExpectativas(observacoes) {
  if (!observacoes || typeof observacoes !== 'string') return null;
  const marker = '. Expectativas:';
  const idx = observacoes.indexOf(marker);
  if (idx === -1) return null;
  const queixa = observacoes.slice(0, idx).replace(/^Queixa:\s*/i, '').trim();
  const expectativas = observacoes.slice(idx + marker.length).trim();
  return { queixa: queixa || '—', expectativas: expectativas || '—' };
}

function buildPerguntaMapFromFicha(ficha) {
  const map = {};
  const itens = ficha?.itens || [];
  itens.forEach((item) => {
    const p = item.pergunta || item;
    const pid = p.id ?? item.perguntaId;
    if (pid == null) return;
    const alts = Array.isArray(p.alternativas) ? [...p.alternativas] : [];
    alts.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    map[String(pid)] = {
      tipoResposta: p.tipoResposta || p.tipo_resposta || '',
      alternativas: alts,
    };
  });
  return map;
}

function getPerguntaIdFromResp(resp) {
  return resp.perguntaId ?? resp.pergunta?.id ?? null;
}

function getEmbeddedAlternativas(resp) {
  if (Array.isArray(resp.alternativas) && resp.alternativas.length > 0) {
    return [...resp.alternativas].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  }
  const p = resp.pergunta;
  if (p && Array.isArray(p.alternativas) && p.alternativas.length > 0) {
    return [...p.alternativas].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  }
  return [];
}

function resolveTipoResposta(resp, perguntaMap) {
  const pid = getPerguntaIdFromResp(resp);
  if (pid != null && perguntaMap?.[String(pid)]?.tipoResposta) {
    return perguntaMap[String(pid)].tipoResposta;
  }
  return (
    resp.tipoResposta ||
    resp.tipo_resposta ||
    resp.pergunta?.tipoResposta ||
    resp.pergunta?.tipo_resposta ||
    ''
  );
}

function alternativasForResp(resp, perguntaMap) {
  const embedded = getEmbeddedAlternativas(resp);
  if (embedded.length > 0) return embedded;
  const pid = getPerguntaIdFromResp(resp);
  if (pid != null && perguntaMap?.[String(pid)]?.alternativas?.length) {
    return perguntaMap[String(pid)].alternativas;
  }
  return [];
}

function AnamneseObservacoesBlock({ texto }) {
  const parsed = parseQueixaExpectativas(texto);
  if (parsed) {
    return (
      <div className="p-3 rounded-xl bg-[#fffbeb] border-[2px] border-[#f59e0b]/20">
        <span className="text-[12px] font-bold text-[#b45309]">Observações</span>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-4 rounded-xl bg-[#f8fbfb] border border-slate-200">
            <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wide">Queixa principal</span>
            <p className="text-[13px] text-[#0f172a] mt-1.5 whitespace-pre-wrap">{parsed.queixa}</p>
          </div>
          <div className="p-4 rounded-xl bg-[#f8fbfb] border border-slate-200">
            <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wide">Expectativas do paciente</span>
            <p className="text-[13px] text-[#0f172a] mt-1.5 whitespace-pre-wrap">{parsed.expectativas}</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="p-3 rounded-xl bg-[#fffbeb] border-[2px] border-[#f59e0b]/20">
      <span className="text-[12px] font-bold text-[#b45309]">Observações</span>
      <p className="text-[13px] text-[#0f172a] mt-1 whitespace-pre-wrap">{texto}</p>
    </div>
  );
}

const BOOLEAN_ALTS = [
  { id: '__sim', alternativa: 'Sim' },
  { id: '__nao', alternativa: 'Não' },
];

function AnamneseRespostaRow({ resp, rowKey, expanded, onToggle, perguntaMap }) {
  const tipo = resolveTipoResposta(resp, perguntaMap);
  let alternativas = alternativasForResp(resp, perguntaMap);
  const isBoolean =
    tipo === 'booleano' ||
    resp.respostaBoolean === true ||
    resp.respostaBoolean === false;
  if (isBoolean) {
    alternativas = BOOLEAN_ALTS;
  }
  const expandable =
    isBoolean ||
    ((tipo === 'escolha_unica' || tipo === 'multipla_escolha') && alternativas.length > 0);

  const isAltSelected = (alt) => {
    if (isBoolean) {
      if (alt.alternativa === 'Sim') return resp.respostaBoolean === true;
      if (alt.alternativa === 'Não') return resp.respostaBoolean === false;
      return false;
    }
    if (tipo === 'multipla_escolha') {
      const ids = resp.opcoesSelecionadas || resp.opcoes_selecionadas || [];
      return ids.map(String).includes(String(alt.id));
    }
    if (resp.perguntaOpcaoId != null && resp.perguntaOpcaoId !== '') {
      return String(resp.perguntaOpcaoId) === String(alt.id);
    }
    if (resp.opcaoSelecionada && alt.alternativa) {
      return String(resp.opcaoSelecionada).trim() === String(alt.alternativa).trim();
    }
    return false;
  };

  const header = (
    <>
      <div className="flex-1 min-w-0">
        <span className="text-[14px] text-[#0f766e] font-medium">{resp.perguntaDescricao || 'Pergunta'}</span>
        <p className="text-[15px] font-semibold text-[#0f172a] mt-2">{renderRespostaValue(resp)}</p>
      </div>
      {expandable ? (
        <ChevronDown
          className={`w-5 h-5 text-[#00a88e] flex-shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden
        />
      ) : null}
    </>
  );

  const shellClass =
    'rounded-xl border-[2px] border-[#00a88e]/25 bg-[#f0fdfa] overflow-hidden';

  if (!expandable) {
    return <div className={`${shellClass} p-4`}>{header}</div>;
  }

  return (
    <div className={shellClass}>
      <button
        type="button"
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-[#e6f7f5]/50 transition-colors"
        onClick={() => onToggle(rowKey)}
        aria-expanded={expanded}
      >
        {header}
      </button>
      {expanded ? (
        <div className="px-4 pb-4 pt-2 space-y-3 border-t border-[#00a88e]/15">
          {alternativas.map((alt) => {
            const selected = isAltSelected(alt);
            return (
              <div
                key={alt.id ?? alt.alternativa}
                className={`flex items-center gap-3 p-3 rounded-xl border-[2px] transition-all ${
                  selected
                    ? 'border-[#00a88e] bg-[#e6f7f5] shadow-sm'
                    : 'border-[#00a88e]/15 bg-white/90 text-[#64748b]'
                }`}
              >
                <span
                  className={`text-[15px] flex-1 ${selected ? 'font-bold text-[#0f766e]' : 'font-medium text-[#475569]'}`}
                >
                  {alt.alternativa}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function AnamneseTab({ pacienteId }) {
  const [anamneses, setAnamneses] = useState([]);
  const [detalhes, setDetalhes] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedRespKeys, setExpandedRespKeys] = useState(() => new Set());
  const [perguntaMapByAnId, setPerguntaMapByAnId] = useState({});

  useEffect(() => {
    if (!pacienteId) return;
    setLoading(true);
    anamneseApi.listPaciente(pacienteId)
      .then(async (data) => {
        const list = Array.isArray(data) ? data : [];
        setAnamneses(list);

        const detMap = {};
        const results = await Promise.all(
          list.map((an) =>
            anamneseApi.getPaciente(pacienteId, an.id)
              .then((det) => ({ id: an.id, det }))
              .catch(() => ({ id: an.id, det: null }))
          )
        );
        results.forEach(({ id, det }) => { if (det) detMap[id] = det; });
        setDetalhes(detMap);

        if (list.length > 0) setExpandedId(list[0].id);
      })
      .catch((err) => console.warn('Erro ao buscar anamneses:', err.message))
      .finally(() => setLoading(false));
  }, [pacienteId]);

  useEffect(() => {
    setExpandedRespKeys(new Set());
  }, [expandedId]);

  useEffect(() => {
    if (!expandedId) return;

    const targetId = expandedId;
    const detalhe = detalhes[targetId];
    const an = anamneses.find((a) => a.id === targetId);
    const fichaTemplateId =
      detalhe?.anamneseId ??
      detalhe?.fichaId ??
      detalhe?.anamneseFichaId ??
      an?.anamneseId ??
      an?.fichaId ??
      an?.anamneseFichaId;

    if (!fichaTemplateId) return;

    let cancelled = false;
    anamneseApi
      .getFicha(fichaTemplateId)
      .then((ficha) => {
        if (cancelled || !ficha) return;
        setPerguntaMapByAnId((prev) => {
          if (prev[targetId]) return prev;
          return { ...prev, [targetId]: buildPerguntaMapFromFicha(ficha) };
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [expandedId, detalhes, anamneses]);

  const toggleRespKey = useCallback((rowKey) => {
    setExpandedRespKeys((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#00a88e]" />
        <span className="ml-2 text-[#64748b] text-[13px]">Carregando anamneses...</span>
      </div>
    );
  }

  if (anamneses.length === 0) {
    return (
      <div className="text-center py-12 text-[#94a3b8]">
        <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p className="text-[14px] font-medium">Nenhuma anamnese preenchida</p>
        <p className="text-[12px] mt-1">Preencha uma ficha na jornada do paciente</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="text-[16px] font-bold text-[#0f172a] mb-2">Anamneses Preenchidas ({anamneses.length})</h4>
      {anamneses.map((an) => {
        const isOpen = expandedId === an.id;
        const detalhe = detalhes[an.id] || an;
        const respostas = Array.isArray(detalhe.respostas)
          ? [...detalhe.respostas].sort((a, b) => (a.fichaItemOrdem ?? 999) - (b.fichaItemOrdem ?? 999))
          : [];

        return (
          <div key={an.id} className="border border-app-border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedId(isOpen ? null : an.id)}
              className="w-full flex items-center justify-between p-4 bg-[#f8fbfb] hover:bg-[#f0fdfa] transition-all text-left"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <ClipboardList className="w-4 h-4 text-[#00a88e]" strokeWidth={2} />
                  <span className="text-[14px] font-bold text-[#0f172a]">{an.anamneseNome || 'Anamnese'}</span>
                  <span className="text-[12px] text-[#64748b]">({respostas.length} respostas)</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[12px] text-[#64748b]">
                  {an.preenchidoPorPaciente ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#f0fdf4] text-[#16a34a] border border-[#bbf7d0]">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                      Preenchido pelo paciente
                    </span>
                  ) : (
                    an.profissionalNome && <span>Por: {an.profissionalNome}</span>
                  )}
                  {an.dataHora && <span>{new Date(an.dataHora).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} {new Date(an.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}</span>}
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border-[2px] ${
                    an.status === 'finalizada' || an.status === 'finalizado' || an.status === 'FINALIZADO'
                      ? 'bg-[#dcfce7] text-[#16a34a] border-[#22c55e]/20'
                      : 'bg-[#fef9c3] text-[#b45309] border-[#f59e0b]/20'
                  }`}>
                    {an.status || 'rascunho'}
                  </span>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 text-[#94a3b8] transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
              <div className="p-4 border-t border-app-border space-y-3">
                {detalhe.observacoes ? (
                  <AnamneseObservacoesBlock texto={detalhe.observacoes} />
                ) : null}

                {respostas.length > 0 ? (
                  <div className="space-y-4">
                    {respostas.map((resp, rIdx) => {
                      const rowKey = `${an.id}:${resp.id ?? rIdx}`;
                      return (
                        <AnamneseRespostaRow
                          key={resp.id ?? `r-${rIdx}`}
                          resp={resp}
                          rowKey={rowKey}
                          expanded={expandedRespKeys.has(rowKey)}
                          onToggle={toggleRespKey}
                          perguntaMap={perguntaMapByAnId[an.id]}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[13px] text-[#94a3b8] text-center py-4">Sem respostas registradas</p>
                )}

                {an.preenchidoPorPaciente && an.assinaturaPaciente && (
                  <div className="mt-6 border-t border-[#e2e8f0] pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      <h4 className="text-[14px] font-bold text-[#0f172a]">Assinatura e Termo do Paciente</h4>
                    </div>
                    
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row gap-6">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 text-[12px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100 w-fit">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Termo de consentimento aceito
                        </div>
                        <p className="text-[12px] text-slate-600 leading-relaxed">
                          O paciente declarou que preencheu pessoalmente esta ficha com informações verdadeiras e completas sobre seu histórico de saúde.
                        </p>
                        {an.termoAceitoEm && (
                          <div className="text-[11px] text-slate-500 font-medium">
                            Aceito em {new Date(an.termoAceitoEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} às {new Date(an.termoAceitoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
                          </div>
                        )}
                      </div>
                      
                      <div className="w-full md:w-64 shrink-0 flex flex-col items-center gap-2">
                        <div className="w-full bg-white border border-slate-200 rounded-xl p-2 flex items-center justify-center min-h-[80px]">
                          <img 
                            src={an.assinaturaPaciente} 
                            alt="Assinatura do Paciente" 
                            className="max-h-20 w-auto object-contain"
                          />
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium text-center">
                          Assinatura digital registrada
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ModuloFuturoBadge({ children }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-[#f1f5f9] px-2.5 py-1 text-[11px] font-bold text-[#64748b]">
      <Clock className="h-3.5 w-3.5 shrink-0 text-[#94a3b8]" strokeWidth={2.25} aria-hidden />
      {children}
    </span>
  );
}

/** Data e hora para blocos de assinatura no prontuário (ex.: 16/04/2026, 14:32). */
function formatDataHoraAssinaturaPtBr(iso) {
  if (!iso) return '—';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '—';
  return t.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Cartões resumo (Última visita / Próximo retorno): só dia em America/Sao_Paulo. */
function formatCartaoDiaPtBr(iso) {
  if (!iso) return '-';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '-';
  return t.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/** ISO instant em string legada → somente data para o cartão. */
function formatCartaoIfIsoString(raw) {
  const leg = String(raw ?? '').trim();
  if (!leg || leg === '-' || leg === '—') return null;
  if (!/^\d{4}-\d{2}-\d{2}/.test(leg) && !leg.includes('T')) return null;
  const t = new Date(leg);
  if (Number.isNaN(t.getTime())) return null;
  return t.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/** Perfil: backend manda ISO em ultimaVinda; seeds/lista legada podem ter só ultimaVisita (dd/mm/aaaa). */
function profileUltimaVindaCard(p) {
  if (!p) return '-';
  if (p.ultimaVinda != null && String(p.ultimaVinda).trim() !== '') {
    return formatCartaoDiaPtBr(p.ultimaVinda);
  }
  const leg = String(p.ultimaVisita || '').trim();
  const isoFmt = formatCartaoIfIsoString(leg);
  if (isoFmt) return isoFmt;
  return leg && leg !== '-' && leg !== '—' ? leg : '-';
}

function profileProximoAgendamentoCard(p) {
  if (!p) return '-';
  if (p.proximoAgendamento != null && String(p.proximoAgendamento).trim() !== '') {
    return formatCartaoDiaPtBr(p.proximoAgendamento);
  }
  const leg = String(p.proximoRetorno || '').trim();
  const isoFmt = formatCartaoIfIsoString(leg);
  if (isoFmt) return isoFmt;
  return leg && leg !== '-' && leg !== '—' ? leg : '-';
}

function profileProximoAgendamentoResumo(p) {
  if (!p) return 'Nenhum agendamento';
  if (p.proximoAgendamento != null && String(p.proximoAgendamento).trim() !== '') {
    return formatCartaoDiaPtBr(p.proximoAgendamento);
  }
  const leg = String(p.proximoRetorno || '').trim();
  const isoFmt = formatCartaoIfIsoString(leg);
  if (isoFmt) return isoFmt;
  return leg && leg !== '-' && leg !== '—' ? leg : 'Nenhum agendamento';
}

export function PatientProfileView({
  selectedPatient,
  patientDetailTab,
  setPatientDetailTab,
  setPatientView,
  setSelectedPatientCpf,
  getPatientInitials,
  onStartAttendance,
  onAgendarPaciente,
  onUpdatePatient,
  onAddGalleryFiles: _onAddGalleryFiles,
  onDeleteGalleryPhoto,
  mergePatientById,
  refreshPatients,
  roleUserId,
  isRecepcionista: _isRecepcionista,
  profileNav = null,
  onProfileNavigatePrev,
  onProfileNavigateNext,
}) {
  const toast = useToast();
  const { isNivel1, canEditPacientes, papel } = usePapel();
  const patient = useMemo(() => selectedPatient || {}, [selectedPatient]);
  const birthParts = useMemo(
    () => parsePatientBirthDate(patient.dataNascimento),
    [patient.dataNascimento],
  );
  const birthAlert = birthParts ? getBirthdayAlertInfo(birthParts) : null;
  const [birthdayModalOpen, setBirthdayModalOpen] = useState(false);
  const [apiNotes, setApiNotes] = useState([]);
  const [apiProcedures, setApiProcedures] = useState([]);
  /** Fallback ao DTO: próximo compromisso futuro (pipeline da agenda). */
  const [proximoAgendaIso, setProximoAgendaIso] = useState(null);
  const [assinaturas, setAssinaturas] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState('');
  const [editFormErrors, setEditFormErrors] = useState({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  /** Preview da galeria: `authFetch` quando a imagem vem da API (precisa X-Org-Id). */
  const [galleryPreview, setGalleryPreview] = useState(null);
  const [sessoesExpandidas, setSessoesExpandidas] = useState({});
  const [categoriasEmEdicao, setCategoriasEmEdicao] = useState({});
  const [modoComparar, setModoComparar] = useState(false);
  const [compararSelecionadas, setCompararSelecionadas] = useState({ antes: null, depois: null });
  const [compararModalOpen, setCompararModalOpen] = useState(false);
  const [quickNoteText, setQuickNoteText] = useState('');
  /** 'loading' | 'api' = lista no servidor; 'local' = fallback (fotos da jornada / legado). */
  const [galeriaBackend, setGaleriaBackend] = useState('loading');
  const [apiGaleriaItems, setApiGaleriaItems] = useState([]);
  const [galeriaFilterCategoria, setGaleriaFilterCategoria] = useState('all');
  const [galeriaFilterMes, setGaleriaFilterMes] = useState('all');
  const [galeriaFilterProcedimento, setGaleriaFilterProcedimento] = useState('all');
  const [galeriaUploadBusy, setGaleriaUploadBusy] = useState(false);
  const [profilePhotoBusy, setProfilePhotoBusy] = useState(false);
  const [alertasAnamnese, setAlertasAnamnese] = useState([]);
  const [alertasAlergia, setAlertasAlergia] = useState([]);
  const [alertasAnamneseLoading, setAlertasAnamneseLoading] = useState(false);
  const [prontuarioExpanded, setProntuarioExpanded] = useState(() => ({}));
  const [showAllProntuario, setShowAllProntuario] = useState(false);
  const [alertasModalOpen, setAlertasModalOpen] = useState(false);
  const [manualAlerts, setManualAlerts] = useState([]);
  const [manualAlertsLoading, setManualAlertsLoading] = useState(false);
  const [manualAlertEditorOpen, setManualAlertEditorOpen] = useState(false);
  const [manualAlertDraft, setManualAlertDraft] = useState({ id: null, titulo: '', descricao: '' });
  const [manualAlertSaving, setManualAlertSaving] = useState(false);
  /** `{ type:'delete', id }` | `{ type:'save-edit' }` para confirmação em edit/excluir */
  const [manualAlertConfirm, setManualAlertConfirm] = useState(null);
  const [inativarModalOpen, setInativarModalOpen] = useState(false);
  const [inativarMotivo, setInativarMotivo] = useState('');
  const [inativarSenha, setInativarSenha] = useState('');
  const [inativarSenhaErro, setInativarSenhaErro] = useState('');
  const [inativarSubmitting, setInativarSubmitting] = useState(false);
  const [relatoModal, setRelatoModal] = useState({
    open: false,
    procedimentoFeitoId: null,
    pacienteId: null,
  });
  const profilePhotoInputRef = useRef(null);
  const alertasCardRef = useRef(null);

  const ultimaVisitaCardDisplay = useMemo(() => {
    const primary = profileUltimaVindaCard(selectedPatient);
    if (primary !== '-') return primary;
    const iso = latestProcedureOccurredInstantIso(apiProcedures);
    return iso ? formatCartaoDiaPtBr(iso) : '-';
  }, [selectedPatient, apiProcedures]);

  const proximoRetornoCardDisplay = useMemo(() => {
    const primary = profileProximoAgendamentoCard(selectedPatient);
    if (primary !== '-') return primary;
    return proximoAgendaIso ? formatCartaoDiaPtBr(proximoAgendaIso) : '-';
  }, [selectedPatient, proximoAgendaIso]);

  const proximoRetornoResumoDisplay = useMemo(() => {
    const primary = profileProximoAgendamentoResumo(selectedPatient);
    if (primary !== 'Nenhum agendamento') return primary;
    return proximoAgendaIso ? formatCartaoDiaPtBr(proximoAgendaIso) : 'Nenhum agendamento';
  }, [selectedPatient, proximoAgendaIso]);

  const sortedApiProceduresEarly = useMemo(
    () => sortProcedimentosPorCriadoEmDesc(apiProcedures || []),
    [apiProcedures],
  );

  const ultimaVisitaIso = useMemo(() => {
    if (selectedPatient?.ultimaVinda != null && String(selectedPatient.ultimaVinda).trim() !== '') {
      return selectedPatient.ultimaVinda;
    }
    return latestProcedureOccurredInstantIso(apiProcedures);
  }, [selectedPatient, apiProcedures]);

  const ultimaVisitaMeta = useMemo(() => {
    const dias = formatDiasAtrasPtBr(ultimaVisitaIso);
    const procName =
      sortedApiProceduresEarly[0]?.procedimentoNome || sortedApiProceduresEarly[0]?.nome;
    const parts = [dias, procName].filter(Boolean);
    return parts.length ? parts.join(' · ') : null;
  }, [ultimaVisitaIso, sortedApiProceduresEarly]);

  const proximoRetornoKpiDisplay = useMemo(() => {
    if (proximoRetornoCardDisplay === '-' || proximoRetornoCardDisplay === '—') {
      return 'Sem agendamento';
    }
    return proximoRetornoCardDisplay;
  }, [proximoRetornoCardDisplay]);

  const proximoRetornoMeta = useMemo(() => {
    if (proximoRetornoKpiDisplay === 'Sem agendamento') return 'Sem agendamento';
    return null;
  }, [proximoRetornoKpiDisplay]);

  const handleCompararFotoClick = (foto) => {
    const cat = foto.categoria || 'outro';
    if (cat === 'antes') {
      setCompararSelecionadas((prev) => ({ ...prev, antes: foto }));
    } else if (cat === 'depois') {
      setCompararSelecionadas((prev) => ({ ...prev, depois: foto }));
    }
  };

  const refreshGaleriaFromApi = useCallback(async () => {
    const id = selectedPatient?.id;
    if (!id) return;
    try {
      const data = await pacientesGaleriaApi.list(id);
      setApiGaleriaItems(normalizePacienteGaleriaResponse(data));
      setGaleriaBackend('api');
    } catch (e) {
      setApiGaleriaItems([]);
      setGaleriaBackend('local');
      const st = e?.status;
      if (st != null && st !== 401 && st !== 403 && st !== 404) {
        console.warn('[PatientProfileView] Galeria API:', e.message);
      }
    }
  }, [selectedPatient?.id]);

  useEffect(() => {
    if (compararSelecionadas.antes && compararSelecionadas.depois) {
      setCompararModalOpen(true);
    }
  }, [compararSelecionadas]);

  useEffect(() => {
    setGaleriaFilterCategoria('all');
    setGaleriaFilterMes('all');
    setGaleriaFilterProcedimento('all');
    setProntuarioExpanded({});
    setSessoesExpandidas({});
    setCategoriasEmEdicao({});
    setRelatoModal({ open: false, procedimentoFeitoId: null, pacienteId: null });
    setShowAllProntuario(false);
    setApiProcedures([]);
    setProximoAgendaIso(null);
    setApiNotes([]);
    setManualAlerts([]);
    setManualAlertsLoading(false);
    setManualAlertEditorOpen(false);
    setManualAlertDraft({ id: null, titulo: '', descricao: '' });
    setManualAlertConfirm(null);
    setManualAlertSaving(false);
  }, [selectedPatient?.id]);

  const closeRelatoModal = useCallback(() => {
    setRelatoModal({ open: false, procedimentoFeitoId: null, pacienteId: null });
  }, []);

  const handleAgendarPacienteClick = useCallback(() => {
    if (!selectedPatient?.id) {
      toast.error('Paciente sem cadastro no servidor (UUID).');
      return;
    }
    onAgendarPaciente?.(selectedPatient);
  }, [selectedPatient, onAgendarPaciente, toast]);

  useEffect(() => {
    if (patientDetailTab === 'timeline' || patientDetailTab === 'cadastro') {
      setPatientDetailTab('atendimento');
    }
  }, [patientDetailTab, setPatientDetailTab]);

  const isEditing = Boolean(editing);

  const applyProfilePhoto = useCallback(
    (dataUrl) => {
      const key = profilePhotoStorageKey(selectedPatient);
      if (dataUrl && key) setStoredProfilePhotoDataUrl(key, dataUrl);
      if (!dataUrl && key) setStoredProfilePhotoDataUrl(key, null);
      if (selectedPatient?.id) {
        mergePatientById?.(selectedPatient.id, (prev) => ({ ...prev, fotoPerfilUrl: dataUrl || '' }));
      }
      if (selectedPatient?.cpf) {
        onUpdatePatient?.(selectedPatient.cpf, { fotoPerfilUrl: dataUrl || '' });
      }
    },
    [selectedPatient, mergePatientById, onUpdatePatient],
  );

  const mergeServerPatientIntoState = useCallback(
    (dto) => {
      if (!selectedPatient?.id || !dto) return;
      const mapped = mapBackendPatient(dto);
      mergePatientById?.(selectedPatient.id, (prev) => ({
        ...mapped,
        fotoPerfilUrl: mapped.fotoPerfilUrl ?? '',
        evaluationCapturedPhotos: prev.evaluationCapturedPhotos,
        evaluationSelectedPhotoIndex: prev.evaluationSelectedPhotoIndex,
        evaluationAnnotatedPhotoUrl: prev.evaluationAnnotatedPhotoUrl,
        galeria: prev.galeria,
        notas: prev.notas,
        procedures: prev.procedures,
        medicamentos: prev.medicamentos,
        condicoesSaude: prev.condicoesSaude,
        alergias: prev.alergias,
      }));
      if (selectedPatient.cpf) {
        onUpdatePatient?.(selectedPatient.cpf, { fotoPerfilUrl: mapped.fotoPerfilUrl ?? '' });
      }
    },
    [selectedPatient?.id, selectedPatient?.cpf, mergePatientById, onUpdatePatient],
  );

  const isServerProfilePhotoType = (file) => {
    const t = (file?.type || '').toLowerCase();
    return (
      t === 'image/jpeg' ||
      t === 'image/jpg' ||
      t === 'image/png' ||
      t === 'image/webp'
    );
  };

  const handleProfilePhotoFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (selectedPatient?.id) {
      if (file.type && !isServerProfilePhotoType(file)) {
        toast.error('Use JPEG, PNG ou WebP (como no cadastro do servidor).');
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        toast.error('Arquivo acima de 50 MB. Escolha um arquivo menor.');
        return;
      }
      setProfilePhotoBusy(true);
      try {
        const updated = await pacientesApi.uploadFotoPerfil(selectedPatient.id, file);
        const key = profilePhotoStorageKey(selectedPatient);
        if (key) setStoredProfilePhotoDataUrl(key, null);
        const sameId =
          updated &&
          typeof updated === 'object' &&
          String(updated.id) === String(selectedPatient.id);
        const dto = sameId ? updated : await pacientesApi.get(selectedPatient.id);
        mergeServerPatientIntoState(dto);
        refreshPatients?.();
        toast.success('Foto de perfil salva no servidor.');
      } catch (err) {
        toast.error(err?.message || 'Não foi possível enviar a foto.');
      } finally {
        setProfilePhotoBusy(false);
      }
      return;
    }

    try {
      const dataUrl = await compressImageFileToJpegDataUrl(file, 480, 0.86);
      applyProfilePhoto(dataUrl);
      toast.success('Foto de perfil atualizada (somente neste aparelho).');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível usar esta imagem.');
    }
  };


  const createEditDraft = () => {
    const { countryCode, nationalNumber } = parsePhoneFromApi(patient.telefone || '', 'BR');
    const cpfRaw = String(patient.cpf || '').replace(/\D/g, '');
    const rgStr = patient.rg != null ? String(patient.rg) : '';
    return {
      nome: patient.nome || '',
      email: patient.email || '',
      telefoneCountryCode: countryCode,
      telefoneNumero: formatPhoneAsYouType(countryCode, nationalNumber),
      telefoneTouched: false,
      profissaoId: patient.profissaoId ?? null,
      nomePai: patient.nomePai || '',
      nomeMae: patient.nomeMae || '',
      cep: patient.cep || '',
      enderecoRua: patient.enderecoRua || '',
      enderecoNumero: patient.enderecoNumero || '',
      enderecoComplemento: patient.enderecoComplemento || '',
      enderecoBairro: patient.enderecoBairro || '',
      enderecoCidade: patient.enderecoCidade || '',
      enderecoEstado: patient.enderecoEstado || '',
      instagram: patient.instagram || '',
      tiktok: patient.tiktok || '',
      indicacao: patient.indicacao || '',
      rg: rgStr ? maskRG(rgStr) : '',
      cpfDisplay: cpfRaw ? maskCPF(cpfRaw) : '',
      sexo: sexoForPatientFormSelect(patient.sexo),
      estadoCivilId: patient.estadoCivilId || '',
      genero: patient.genero || '',
      dataNascimentoIso: patient.dataNascimento || '',
      dataNascimentoDisplay: isoDateToBrazilianDisplay(patient.dataNascimento || ''),
      idade: patient.idade ?? '',
    };
  };

  const openEditProfile = useCallback(() => {
    setEditFormErrors({});
    setProfileSaveError('');
    setEditing(createEditDraft());
  }, [patient]);

  const clearEditFieldError = (field) =>
    setEditFormErrors((prev) => ({ ...prev, [field]: false }));



  const handleScrollToAlertas = () => {
    alertasCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const reloadManualAlerts = useCallback(async () => {
    const pacienteId = selectedPatient?.id;
    if (!pacienteId) {
      setManualAlerts([]);
      setManualAlertsLoading(false);
      return;
    }
    setManualAlertsLoading(true);
    try {
      const data = await pacienteAlertasManuaisApi.list(pacienteId);
      const lista = normalizeListaAlertasManualApi(data)
        .map(normalizeAlertaManualItem)
        .filter(Boolean);
      setManualAlerts(lista);
    } catch (e) {
      if (e?.status === 404) {
        setManualAlerts([]);
      } else {
        setManualAlerts([]);
        const st = e?.status;
        if (st != null && st !== 401 && st !== 403 && st !== 404) {
          toast.error(e.message || 'Não foi possível carregar alertas manuais.');
        }
      }
    } finally {
      setManualAlertsLoading(false);
    }
  }, [selectedPatient?.id, toast]);

  useEffect(() => {
    reloadManualAlerts();
  }, [reloadManualAlerts]);

  const MANUAL_ALERTA_MAX = { titulo: 200, descricao: 2000 };

  const openManualAlertCreate = () => {
    setManualAlertDraft({ id: null, titulo: '', descricao: '' });
    setManualAlertConfirm(null);
    setManualAlertEditorOpen(true);
  };

  const openManualAlertEdit = (item) => {
    setManualAlertDraft({
      id: item.id,
      titulo: item.titulo || '',
      descricao: item.descricao || '',
    });
    setManualAlertConfirm(null);
    setManualAlertEditorOpen(true);
  };

  const handleSubmitManualAlertEditor = async () => {
    const titulo = String(manualAlertDraft.titulo ?? '').trim().slice(0, MANUAL_ALERTA_MAX.titulo);
    const descricao = String(manualAlertDraft.descricao ?? '').trim().slice(0, MANUAL_ALERTA_MAX.descricao);
    if (!titulo || !descricao) {
      toast.warning('Preencha título e descrição do alerta.');
      return;
    }
    const pacienteId = selectedPatient?.id;
    if (!pacienteId) return;

    if (manualAlertDraft.id) {
      setManualAlertConfirm({ type: 'save-edit' });
      return;
    }

    setManualAlertSaving(true);
    try {
      await pacienteAlertasManuaisApi.create(pacienteId, { titulo, descricao });
      toast.success('Alerta manual criado.');
      setManualAlertEditorOpen(false);
      setManualAlertDraft({ id: null, titulo: '', descricao: '' });
      await reloadManualAlerts();
    } catch (e) {
      toast.error(e.message || 'Erro ao criar alerta manual.');
    } finally {
      setManualAlertSaving(false);
    }
  };

  const executeManualAlertSaveEdit = async () => {
    const pacienteId = selectedPatient?.id;
    const alertaId = manualAlertDraft.id;
    const titulo = String(manualAlertDraft.titulo ?? '').trim().slice(0, MANUAL_ALERTA_MAX.titulo);
    const descricao = String(manualAlertDraft.descricao ?? '').trim().slice(0, MANUAL_ALERTA_MAX.descricao);
    if (!pacienteId || !alertaId || !titulo || !descricao) return;
    setManualAlertSaving(true);
    try {
      await pacienteAlertasManuaisApi.update(pacienteId, alertaId, { titulo, descricao });
      toast.success('Alerta manual atualizado.');
      setManualAlertConfirm(null);
      setManualAlertEditorOpen(false);
      setManualAlertDraft({ id: null, titulo: '', descricao: '' });
      await reloadManualAlerts();
    } catch (e) {
      toast.error(e.message || 'Erro ao atualizar alerta manual.');
    } finally {
      setManualAlertSaving(false);
    }
  };

  const executeManualAlertDelete = async () => {
    const pacienteId = selectedPatient?.id;
    const id = manualAlertConfirm?.id;
    if (!pacienteId || !id) return;
    setManualAlertSaving(true);
    try {
      await pacienteAlertasManuaisApi.remove(pacienteId, id);
      toast.success('Alerta manual excluído.');
      setManualAlertConfirm(null);
      await reloadManualAlerts();
    } catch (e) {
      toast.error(e.message || 'Erro ao excluir alerta manual.');
    } finally {
      setManualAlertSaving(false);
    }
  };

  const capturedPhotos = useMemo(() => {
    const list = Array.isArray(patient.evaluationCapturedPhotos)
      ? patient.evaluationCapturedPhotos
      : [];
    return list
      .filter((p) => p?.url)
      .map((p, idx) => ({
        id: `cap_${idx}`,
        url: p.url,
        source: p?.meta?.source || 'camera',
        capturedAt: p?.meta?.capturedAt,
        fileName: p?.meta?.fileName || `Foto ${idx + 1}`,
        index: idx,
      }));
  }, [patient]);

  const fallbackGalleryPhotos = useMemo(() => {
    const sessions = Array.isArray(patient.galeria) ? patient.galeria : [];
    const flattened = [];
    sessions.forEach((session, sIdx) => {
      (session.fotos || []).forEach((foto, fIdx) => {
        if (!foto?.url) return;
        flattened.push({
          id: `legacy_${sIdx}_${fIdx}`,
          url: foto.url,
          source: 'legacy',
          fileName: `${session.sessao || 'Sessao'} - ${foto.label || 'Foto'}`,
          index: -1,
        });
      });
    });
    return flattened;
  }, [patient]);

  const galleryItemsForGrid = useMemo(() => {
    if (galeriaBackend === 'api') {
      return apiGaleriaItems.map((it) => ({
        id: `api_${it.serverId}`,
        url: it.url,
        fileName: it.fileName,
        legenda: it.legenda,
        dataReferencia: it.dataReferencia,
        serverId: it.serverId,
        source: 'api',
        index: -1,
        categoria: it.categoria,
        descricaoLegenda: it.descricaoLegenda,
        nomeProcedimento: it.nomeProcedimento,
      }));
    }
    return capturedPhotos.length > 0 ? capturedPhotos : fallbackGalleryPhotos;
  }, [galeriaBackend, apiGaleriaItems, capturedPhotos, fallbackGalleryPhotos]);

  const galeriaMesesOpcoes = useMemo(() => {
    const set = new Set();
    (apiGaleriaItems || []).forEach((it) => {
      const m = itemMesReferenciaISO(it);
      if (m) set.add(m);
    });
    return Array.from(set).sort().reverse();
  }, [apiGaleriaItems]);

  const galeriaProcedimentosOpcoes = useMemo(() => {
    const set = new Set();
    (apiGaleriaItems || []).forEach((it) => {
      const n = (it.nomeProcedimento || '').trim();
      if (n) set.add(n);
      const d = (it.descricaoLegenda || '').trim();
      if (d && !n) set.add(d);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [apiGaleriaItems]);

  const galeriaSessionsForView = useMemo(() => {
    if (galeriaBackend !== 'api') return [];
    const filtered = filterGaleriaItemsForUi(apiGaleriaItems, {
      categoria: galeriaFilterCategoria,
      mesAno: galeriaFilterMes,
      procedimentoToken: galeriaFilterProcedimento,
    });
    return groupGaleriaItemsBySession(filtered);
  }, [galeriaBackend, apiGaleriaItems, galeriaFilterCategoria, galeriaFilterMes, galeriaFilterProcedimento]);

  const dismissBirthdayModal = useCallback(() => {
    const cpf = String(patient.cpf || selectedPatient?.id || 'sem-id').trim();
    const todayKey = new Date().toISOString().slice(0, 10);
    try {
      sessionStorage.setItem(birthdayModalStorageKey(cpf, todayKey), '1');
    } catch {
      /* ignore */
    }
    setBirthdayModalOpen(false);
  }, [patient.cpf, selectedPatient?.id]);

  useEffect(() => {
    if (!birthAlert?.isToday) {
      setBirthdayModalOpen(false);
      return;
    }
    const cpf = String(patient.cpf || selectedPatient?.id || 'sem-id').trim();
    const todayKey = new Date().toISOString().slice(0, 10);
    const key = birthdayModalStorageKey(cpf, todayKey);
    try {
      if (sessionStorage.getItem(key) === '1') {
        setBirthdayModalOpen(false);
        return;
      }
    } catch {
      /* ignore */
    }
    setBirthdayModalOpen(true);
  }, [birthAlert?.isToday, patient.cpf, selectedPatient?.id]);

  useEffect(() => {
    const id = selectedPatient?.id;
    if (!id) return undefined;
    let cancelled = false;
    setDetailLoading(true);
    (async () => {
      try {
        const [dtoResult, notasResult, procResult, assinResult] = await Promise.allSettled([
          pacientesApi.get(id),
          notasApi.list(id),
          procedimentosApi.byPaciente(id),
          termoAssinaturaApi.listarPorPaciente(id),
        ]);
        if (cancelled) return;
        const dto = dtoResult.status === 'fulfilled' ? dtoResult.value : null;
        if (dto) {
          mergePatientById?.(id, (prev) => {
            const mapped = mapBackendPatient(dto);
            return {
              ...mapped,
              fotoPerfilUrl: mapped.fotoPerfilUrl ?? prev.fotoPerfilUrl,
              evaluationCapturedPhotos: prev.evaluationCapturedPhotos,
              evaluationSelectedPhotoIndex: prev.evaluationSelectedPhotoIndex,
              evaluationAnnotatedPhotoUrl: prev.evaluationAnnotatedPhotoUrl,
              galeria: prev.galeria,
              notas: prev.notas,
              procedures: prev.procedures,
            };
          });
        }
        const notasList = notasResult.status === 'fulfilled' ? notasResult.value : [];
        const procList = procResult.status === 'fulfilled' ? procResult.value : [];
        const assinRaw = assinResult.status === 'fulfilled' ? assinResult.value : [];
        const assinList = Array.isArray(assinRaw) ? assinRaw : assinRaw?.content ?? [];
        setApiNotes(Array.isArray(notasList) ? notasList : []);
        setApiProcedures(Array.isArray(procList) ? procList : []);
        setAssinaturas(Array.isArray(assinList) ? assinList : []);
      } catch {
        if (!cancelled) {
          setApiNotes([]);
          setApiProcedures([]);
          setAssinaturas([]);
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarregar só ao trocar paciente
  }, [selectedPatient?.id]);

  useEffect(() => {
    const id = selectedPatient?.id;
    if (!id) {
      setProximoAgendaIso(null);
      return undefined;
    }
    let cancelled = false;
    fetchNextAppointmentIsoForPaciente(id, {
      pacienteNome: selectedPatient?.nome,
    }).then((iso) => {
      if (!cancelled) setProximoAgendaIso(iso);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedPatient?.id, selectedPatient?.nome]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('galeriaBackend:', galeriaBackend);
    }
  }, [galeriaBackend]);

  useEffect(() => {
    const id = selectedPatient?.id;
    if (!id) {
      setGaleriaBackend('local');
      setApiGaleriaItems([]);
      return undefined;
    }
    let cancelled = false;
    setGaleriaBackend('loading');
    setApiGaleriaItems([]);
    (async () => {
      try {
        if (import.meta.env.DEV) {
          console.log('listando galeria para pacienteId:', selectedPatient?.id);
        }
        const data = await pacientesGaleriaApi.list(id);
        if (cancelled) return;
        setApiGaleriaItems(normalizePacienteGaleriaResponse(data));
        setGaleriaBackend('api');
      } catch (e) {
        if (cancelled) return;
        setApiGaleriaItems([]);
        setGaleriaBackend('local');
        // 401/403 = sessão/org; 404 = rota inexistente — fallback local sem alarme no console.
        const st = e?.status;
        if (st != null && st !== 401 && st !== 403 && st !== 404) {
          console.warn('[PatientProfileView] Galeria API:', e.message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedPatient?.id]);

  useEffect(() => {
    const pacienteId = selectedPatient?.id;
    setAlertasModalOpen(false);
    if (!pacienteId) {
      setAlertasAnamnese([]);
      setAlertasAlergia([]);
      setAlertasAnamneseLoading(false);
      return undefined;
    }
    let cancelled = false;
    setAlertasAnamneseLoading(true);
    (async () => {
      try {
        const list = await anamneseApi.listPaciente(pacienteId);
        const arr = Array.isArray(list) ? list : [];

        // Manter apenas o preenchimento mais recente por ficha (anamneseId/fichaId)
        const maisRecentePorFicha = new Map();
        for (const an of arr) {
          const fichaId = an.anamneseId ?? an.fichaId ?? an.anamneseFichaId ?? an.id;
          const ts = an.dataHora ? new Date(an.dataHora).getTime() : 0;
          const prev = maisRecentePorFicha.get(String(fichaId));
          if (!prev || ts > (prev.dataHora ? new Date(prev.dataHora).getTime() : 0)) {
            maisRecentePorFicha.set(String(fichaId), an);
          }
        }
        const arrFiltrado = Array.from(maisRecentePorFicha.values());

        const pairs = await Promise.all(
          arrFiltrado.map((an) =>
            anamneseApi
              .getPaciente(pacienteId, an.id)
              .then((det) => ({ an, det }))
              .catch(() => ({ an, det: null }))
          )
        );
        if (cancelled) return;
        const alergiasDetectadas = [];
        const itemsAlergia = [];
        const itemsGeral = [];
        for (const { an, det } of pairs) {
          if (!det || !Array.isArray(det.respostas)) continue;
          const ts = an.dataHora ? new Date(an.dataHora).getTime() : 0;
          const nome = an.anamneseNome || 'Anamnese';
          det.respostas.forEach((resp, rIdx) => {
            if (isRespostaCategoria(resp, 'alergias') && isRespostaPositiva(resp)) {
              const valorAlergia = renderRespostaValue(resp);
              const perguntaTexto = textoPerguntaResposta(resp);
              alergiasDetectadas.push(`${perguntaTexto}: ${valorAlergia}`);
              const pidA = resp.id ?? getPerguntaIdFromResp(resp) ?? rIdx;
              itemsAlergia.push({
                key: `${pidA}`,
                titulo: textoPerguntaResposta(resp),
                valor: renderRespostaValue(resp),
                fichaNome: nome,
                dataHora: an.dataHora,
                ts,
              });
            }
            if (!isRespostaPrioridadeAlerta(resp)) return;
            if (!isRespostaPreocupante(resp)) return;
            const pid = resp.id ?? getPerguntaIdFromResp(resp) ?? rIdx;
            itemsGeral.push({
              key: `${pid}`,
              titulo: textoPerguntaResposta(resp),
              valor: renderRespostaValue(resp),
              fichaNome: nome,
              dataHora: an.dataHora,
              ts,
            });
          });
        }
        itemsAlergia.sort((a, b) => b.ts - a.ts);
        itemsGeral.sort((a, b) => b.ts - a.ts);
        const seen = new Set();
        const merged = [];
        for (const it of [...itemsAlergia, ...itemsGeral]) {
          if (seen.has(it.key)) continue;
          seen.add(it.key);
          merged.push(it);
        }
        merged.sort((a, b) => b.ts - a.ts);
        if (!cancelled) setAlertasAlergia(itemsAlergia);
        if (!cancelled) setAlertasAnamnese(merged);

        if (pacienteId) {
          mergePatientById?.(pacienteId, (prev) => ({
            ...prev,
            ...(alergiasDetectadas.length > 0 ? { alergias: alergiasDetectadas.join(' · ') } : {}),
            alertasClinicosAtivos: merged.map((a) => ({ titulo: a.titulo, valor: a.valor })),
          }));
        }
      } catch {
        if (!cancelled) {
          setAlertasAnamnese([]);
          setAlertasAlergia([]);
        }
      } finally {
        if (!cancelled) setAlertasAnamneseLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedPatient?.id, mergePatientById]);

  const alertasSidebarGeral = useMemo(() => {
    const keys = new Set(alertasAlergia.map((x) => x.key));
    return alertasAnamnese.filter((row) => !keys.has(row.key));
  }, [alertasAnamnese, alertasAlergia]);

  const displayNotes = useMemo(() => {
    const fromApi = (apiNotes || []).map((n) => ({
      id: n.id,
      texto: n.conteudo,
      autor: n.autorNome || 'Equipe',
      data: n.criadoEm ? new Date(n.criadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '',
      _fromApi: true,
    }));
    const local = (selectedPatient?.notas || []).map((n, i) => ({
      ...n,
      id: `loc_${i}`,
      _fromApi: false,
    }));
    return [...fromApi, ...local];
  }, [apiNotes, selectedPatient?.notas]);

  const sortedApiProcedures = useMemo(
    () => sortProcedimentosPorCriadoEmDesc(apiProcedures || []),
    [apiProcedures],
  );

  const prontuarioListMax = 3;
  const prontuarioListTruncated =
    sortedApiProcedures.length > prontuarioListMax && !showAllProntuario;
  const prontuarioProceduresVisible = prontuarioListTruncated
    ? sortedApiProcedures.slice(0, prontuarioListMax)
    : sortedApiProcedures;

  const perfilRecentProcedures = useMemo(
    () => sortedApiProcedures.slice(0, 5),
    [sortedApiProcedures],
  );

  const galeriaItemsForProcedure = useCallback(
    (proc) => {
      const nome = (proc?.procedimentoNome || proc?.nome || '').trim();
      const pid = proc?.id != null && proc?.id !== '' ? String(proc.id) : '';
      return (apiGaleriaItems || []).filter((it) => {
        if (pid && it.procedimentoFeitoId != null && String(it.procedimentoFeitoId) === pid) return true;
        if (nome && it.nomeProcedimento && String(it.nomeProcedimento).trim() === nome) return true;
        return false;
      });
    },
    [apiGaleriaItems],
  );

  const resolveProcedimentoFeitoIdForSessao = useCallback(
    (sess) => {
      const direct = sess?.procedimentoFeitoId;
      if (direct != null && String(direct).trim() !== '') return String(direct);

      const fotoId = Array.isArray(sess?.fotos)
        ? sess.fotos.find((f) => f?.procedimentoFeitoId != null && String(f.procedimentoFeitoId).trim() !== '')
            ?.procedimentoFeitoId
        : null;
      if (fotoId != null && String(fotoId).trim() !== '') return String(fotoId);

      const nomeSessao = (
        sess?.nomeProcedimento ||
        (Array.isArray(sess?.fotos) ? sess.fotos.map((f) => f?.nomeProcedimento).find(Boolean) : '') ||
        ''
      )
        .trim()
        .toLowerCase();
      if (!nomeSessao) return null;

      const match = (apiProcedures || []).find((proc) => {
        const nomeProc = (proc?.procedimentoNome || proc?.nome || '').trim().toLowerCase();
        if (!nomeProc) return false;
        return nomeProc === nomeSessao || nomeProc.includes(nomeSessao) || nomeSessao.includes(nomeProc);
      });

      const matchId = match?.id ?? match?.procedimentoFeitoId ?? match?.procedimentoId ?? null;
      return matchId != null && String(matchId).trim() !== '' ? String(matchId) : null;
    },
    [apiProcedures],
  );

  const handleGaleriaUpload = useCallback(
    async (sess, categoria, file) => {
      const pacienteId = selectedPatient?.id;
      if (!pacienteId || !file) return;
      if (!roleUserId || !/^[0-9a-f-]{36}$/i.test(String(roleUserId))) {
        toast.warning(
          'Selecione o profissional na barra de contexto para enviar fotos à galeria.',
        );
        return;
      }
      const procedimentoFeitoId = resolveProcedimentoFeitoIdForSessao(sess);
      setGaleriaUploadBusy(true);
      try {
        const webp = await convertToWebP(file, 0.85, 1920);
        await pacientesGaleriaApi.upload(pacienteId, webp, {
          roleUserId,
          procedimentoFeitoId: procedimentoFeitoId ?? undefined,
          dataReferencia: sess.dataISO !== 'sem-data' ? sess.dataISO : undefined,
          legenda: formatGaleriaLegendaForUpload(categoria, sess.nomeProcedimento || ''),
        });
        await refreshGaleriaFromApi();
        toast.success('Foto adicionada à galeria.');
      } catch (e) {
        toast.error(formatPacienteGaleriaError(e));
      } finally {
        setGaleriaUploadBusy(false);
      }
    },
    [selectedPatient?.id, roleUserId, resolveProcedimentoFeitoIdForSessao, refreshGaleriaFromApi, toast],
  );

  const galeriaUploadDisabled =
    isNivel1 || galeriaUploadBusy || !roleUserId || !/^[0-9a-f-]{36}$/i.test(String(roleUserId || ''));
  const galeriaUploadDisabledTitle = isNivel1
    ? 'Sem permissão'
    : !roleUserId || !/^[0-9a-f-]{36}$/i.test(String(roleUserId || ''))
      ? 'Selecione o profissional na barra de contexto'
      : galeriaUploadBusy
        ? 'Enviando…'
        : undefined;

  const toggleProntuarioRow = useCallback((rowKey) => {
    setProntuarioExpanded((prev) => ({ ...prev, [rowKey]: !prev[rowKey] }));
  }, []);

  const saveEditProfile = async () => {
    if (!editing || !selectedPatient) return;

    const v = {
      nome: editing.nome,
      dataNascimentoIso: editing.dataNascimentoIso,
      sexo: editing.sexo,
      estadoCivilId: editing.estadoCivilId,
      profissaoId: editing.profissaoId,
      cpf: editing.cpfDisplay,
      telefoneCountryCode: editing.telefoneCountryCode,
      telefoneNumero: editing.telefoneNumero,
      email: editing.email,
    };
    const validationErrors = validatePacienteFormBasics(v, { skipCpf: true });
    const cy = new Date().getFullYear();
    const dnDigits = String(editing.dataNascimentoDisplay ?? '').replace(/\D/g, '');

    if (Object.keys(validationErrors).length > 0) {
      setEditFormErrors(validationErrors);
      let banner = 'Preencha os campos obrigatórios.';
      if (validationErrors.dataNascimento) {
        if (dnDigits.length > 0 && dnDigits.length < 8) {
          banner = birthDateValidationUserMessage('incomplete', cy);
        } else if (dnDigits.length === 8 && !editing.dataNascimentoIso) {
          const r = validateBirthDateDigits8(dnDigits);
          banner = !r.ok ? birthDateValidationUserMessage(r.reason, cy) : banner;
        }
      }
      setProfileSaveError(banner);
      toast.error('Preencha todos os campos obrigatórios antes de salvar.');
      return;
    }

    setEditFormErrors({});
    setProfileSaveError('');

    if (!selectedPatient.id) {
      const rgDigits = String(editing.rg ?? '').replace(/\D/g, '');
      onUpdatePatient?.(selectedPatient.cpf, {
        nome: editing.nome || '',
        email: editing.email || '',
        telefone: formatPhoneForApi(editing.telefoneCountryCode ?? 'BR', editing.telefoneNumero ?? '') || '',
        profissaoId: editing.profissaoId ?? null,
        nomePai: editing.nomePai || '',
        nomeMae: editing.nomeMae || '',
        cep: editing.cep || '',
        enderecoRua: editing.enderecoRua || '',
        enderecoNumero: editing.enderecoNumero || '',
        enderecoComplemento: editing.enderecoComplemento || '',
        enderecoBairro: editing.enderecoBairro || '',
        enderecoCidade: editing.enderecoCidade || '',
        enderecoEstado: editing.enderecoEstado || '',
        endereco: '',
        instagram: editing.instagram || '',
        tiktok: editing.tiktok || '',
        indicacao: editing.indicacao || '',
        sexo: editing.sexo,
        estadoCivilId: editing.estadoCivilId || '',
        genero: editing.genero || '',
        dataNascimento: editing.dataNascimentoIso || '',
        rg: rgDigits || undefined,
      });
      setEditing(null);
      return;
    }

    setProfileSaving(true);
    try {
      const dto = await pacientesApi.get(selectedPatient.id);
      const editingWithTelefone = {
        ...editing,
        nome: editing.nome,
        telefone: formatPhoneForApi(editing?.telefoneCountryCode ?? 'BR', editing?.telefoneNumero ?? '') || editing?.telefone || '',
      };
      const payload = mergePacienteDtoWithEditing(dto, editingWithTelefone);
      await pacientesApi.update(selectedPatient.id, payload);
      const fresh = await pacientesApi.get(selectedPatient.id);
      mergePatientById?.(selectedPatient.id, (prev) => {
        const mapped = mapBackendPatient(fresh);
        return {
          ...mapped,
          fotoPerfilUrl: mapped.fotoPerfilUrl ?? prev.fotoPerfilUrl,
          evaluationCapturedPhotos: prev.evaluationCapturedPhotos,
          evaluationSelectedPhotoIndex: prev.evaluationSelectedPhotoIndex,
          evaluationAnnotatedPhotoUrl: prev.evaluationAnnotatedPhotoUrl,
          galeria: prev.galeria,
        };
      });
      refreshPatients?.();
      setEditing(null);
    } catch (e) {
      setProfileSaveError(e.message || 'Erro ao salvar cadastro.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleRemoveGalleryItem = async (item) => {
    if (item.source === 'api' && item.serverId && selectedPatient?.id) {
      try {
        await pacientesGaleriaApi.remove(selectedPatient.id, item.serverId);
        setApiGaleriaItems((prev) => prev.filter((x) => x.serverId !== item.serverId));
        toast.success('Foto removida da galeria.');
      } catch (e) {
        toast.error(formatPacienteGaleriaError(e));
      }
      return;
    }
    if (typeof item.index === 'number' && item.index >= 0) {
      onDeleteGalleryPhoto?.(selectedPatient.cpf, item.index);
    }
  };

  const handleAddQuickNote = async () => {
    const text = quickNoteText.trim();
    if (!text) return;

    if (selectedPatient?.id) {
      if (!roleUserId || !/^[0-9a-f-]{36}$/i.test(String(roleUserId))) {
        toast.warning(
          'Selecione o profissional na barra de contexto ou faça login com usuário vinculado à equipe para salvar a nota.'
        );
        return;
      }
      try {
        await notasApi.create(selectedPatient.id, {
          roleUserId,
          conteudo: text,
          autorNome: 'Nota rápida',
        });
        const list = await notasApi.list(selectedPatient.id);
        setApiNotes(Array.isArray(list) ? list : []);
        setQuickNoteText('');
      } catch (e) {
        toast.error(e.message || 'Erro ao salvar nota.');
      }
      return;
    }

    const existingNotes = Array.isArray(selectedPatient?.notas) ? selectedPatient.notas : [];
    const now = new Date();
    const newNote = {
      texto: text,
      autor: 'Atendimento',
      data: now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    };
    onUpdatePatient?.(selectedPatient.cpf, {
      notas: [newNote, ...existingNotes],
    });
    setQuickNoteText('');
  };

  const handleDeleteNote = async (id) => {
    if (!selectedPatient?.id) return;
    try {
      await notasApi.remove(id);
      const list = await notasApi.list(selectedPatient.id);
      setApiNotes(Array.isArray(list) ? list : []);
    } catch (e) {
      toast.error(e.message || 'Erro ao excluir nota.');
    }
  };

  const isPerfilAtivo = (patient.status || 'ativo') !== 'inativo';
  /** Mesma regra do perfil antes do redesign: só oculta para papel RECEPCIONISTA. */
  const showInativarPaciente = isPerfilAtivo && String(papel ?? '').trim().toUpperCase() !== 'RECEPCIONISTA';

  const handleConfirmInativar = async () => {
    if (!selectedPatient?.id) return;
    setInativarSenhaErro('');
    if (!String(inativarSenha || '').trim()) {
      setInativarSenhaErro('Senha obrigatória.');
      return;
    }
    setInativarSubmitting(true);
    try {
      await pacientesApi.inativar(selectedPatient.id, {
        senha: String(inativarSenha).trim(),
        motivo: String(inativarMotivo || '').trim() || undefined,
      });
      toast.success('Paciente inativado com sucesso.');
      setInativarModalOpen(false);
      setInativarMotivo('');
      setInativarSenha('');
      setInativarSenhaErro('');
      setPatientView('list');
      setPatientDetailTab('atendimento');
      setSelectedPatientCpf?.(null);
      refreshPatients?.();
    } catch (e) {
      const st = e?.status;
      const detail = getApiErrorDetail(e);
      const pwdWrong =
        st === 401 ||
        st === 403 ||
        /senha|password|credencial|inválid|invalid/i.test(String(detail || ''));
      if (pwdWrong) {
        setInativarSenhaErro(detail || 'Senha incorreta.');
      } else {
        toast.error(detail || e.message || 'Não foi possível inativar o paciente.');
      }
    } finally {
      setInativarSubmitting(false);
    }
  };

  if (!selectedPatient) return null;

  return (
    <div className="flex flex-col gap-5">
      {detailLoading && (
        <div className="flex items-center gap-2 text-[#64748b] text-[13px] font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-[#00a88e]" /> Sincronizando com o servidor...
        </div>
      )}
      {profileSaveError ? (
        <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-[13px] font-bold">
          {profileSaveError}
        </div>
      ) : null}
      <ProfileBreadcrumb
        patientName={selectedPatient.nome}
        onBackToList={() => {
          setPatientView('list');
          setPatientDetailTab('atendimento');
        }}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="mb-2 overflow-hidden rounded-[20px] border border-vivid-teal-700/55 shadow-agenda-glow">
            <ProfileHero
              patient={patient}
              getPatientInitials={getPatientInitials}
              isPerfilAtivo={isPerfilAtivo}
              isNivel1={isNivel1}
              canEditPacientes={canEditPacientes}
              showInativarPaciente={showInativarPaciente}
              profilePhotoInputRef={profilePhotoInputRef}
              profilePhotoBusy={profilePhotoBusy}
              onProfilePhotoClick={handleProfilePhotoFile}
              onStartAttendance={onStartAttendance}
              onAgendar={handleAgendarPacienteClick}
              onEdit={openEditProfile}
              onCadastro={openEditProfile}
              onInativar={() => {
                setInativarMotivo('');
                setInativarSenha('');
                setInativarSenhaErro('');
                setInativarModalOpen(true);
              }}
              onAddAddress={openEditProfile}
              onAddResponsavel={openEditProfile}
              profileNav={profileNav}
              onNavigatePrev={onProfileNavigatePrev}
              onNavigateNext={onProfileNavigateNext}
            />
            <ProfileKpiStrip
              ultimaVisitaDisplay={ultimaVisitaCardDisplay}
              ultimaVisitaMeta={ultimaVisitaMeta}
              proximoRetornoDisplay={proximoRetornoKpiDisplay}
              proximoRetornoMeta={proximoRetornoMeta}
            />
          </div>

            {isEditing && editing ? (
              <div className="fixed inset-0 z-[210] flex items-center justify-center p-4" role="presentation">
                <button
                  type="button"
                  className="absolute inset-0 bg-black/60"
                  onClick={() => {
                    setEditing(null);
                    setEditFormErrors({});
                    setProfileSaveError('');
                  }}
                  aria-label="Fechar"
                />
                <div
                  role="dialog"
                  aria-modal="true"
                  className="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg"
                >
                  <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#00a88e] text-white shadow-sm">
                        <UserIcon className="h-6 w-6" strokeWidth={2.5} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[18px] font-bold text-slate-900 sm:text-[20px]">Editar Cadastro</h3>
                        <p className="text-[13px] font-medium text-slate-500">Atualize os dados pessoais do paciente</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(null);
                        setEditFormErrors({});
                        setProfileSaveError('');
                      }}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                    >
                      <X className="h-5 w-5" strokeWidth={2.25} />
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 bg-[#f8fbfb]">
                    <PatientForm
                      mode="edit"
                      variant="modal"
                      showFormHeading={false}
                      formHeading=""
                      nome={editing.nome}
                  dataNascimentoDisplay={editing.dataNascimentoDisplay}
                  idade={editing.idade}
                  sexo={editing.sexo}
                  estadoCivilId={editing.estadoCivilId}
                  profissaoId={editing.profissaoId}
                  genero={editing.genero}
                  cpf={editing.cpfDisplay}
                  rg={editing.rg}
                  telefoneCountryCode={editing.telefoneCountryCode ?? 'BR'}
                  telefoneNumero={editing.telefoneNumero ?? ''}
                  telefoneTouched={editing.telefoneTouched ?? false}
                  email={editing.email}
                  instagram={editing.instagram}
                  tiktok={editing.tiktok}
                  cep={editing.cep}
                  enderecoRua={editing.enderecoRua}
                  enderecoNumero={editing.enderecoNumero}
                  enderecoComplemento={editing.enderecoComplemento}
                  enderecoBairro={editing.enderecoBairro}
                  enderecoCidade={editing.enderecoCidade}
                  enderecoEstado={editing.enderecoEstado}
                  nomeMae={editing.nomeMae}
                  nomePai={editing.nomePai}
                  indicacao={editing.indicacao}
                  dataNascimentoIso={editing.dataNascimentoIso}
                  errors={editFormErrors}
                  erroBanner={profileSaveError}
                  onNomeChange={(value) => setEditing((p) => p ? { ...p, nome: value } : p)}
                  onDataNascimentoDisplayChange={(raw) => {
                    setEditing((p) => {
                      if (!p) return p;
                      const numeric = raw.replace(/\D/g, '');
                      return { ...p, dataNascimentoDisplay: numeric, dataNascimentoIso: '' };
                    });
                  }}
                  onSexoChange={(value) => setEditing((p) => p ? { ...p, sexo: value } : p)}
                  onEstadoCivilChange={(value) => setEditing((p) => p ? { ...p, estadoCivilId: value } : p)}
                  onProfissaoIdChange={(value) => setEditing((p) => p ? { ...p, profissaoId: value } : p)}
                  onGeneroChange={(value) => setEditing((p) => p ? { ...p, genero: value } : p)}
                  onCpfChange={(value) => setEditing((p) => {
                      if (!p) return p;
                      const next = { ...p, cpfDisplay: value };
                      if (value.length === 14) {
                        const cpfNum = value.replace(/\D/g, '');
                        if (cpfNum && cpfNum !== selectedPatient?.cpf) {
                          // TODO: Implement CPF conflict check if needed
                        } else {
                          setEditFormErrors((prev) => {
                            const n = { ...prev };
                            delete n.cpf;
                            return n;
                          });
                        }
                      } else {
                        setEditFormErrors((prev) => {
                          const n = { ...prev };
                          delete n.cpf;
                          return n;
                        });
                      }
                      return next;
                  })}
                  onRgChange={(value) => setEditing((p) => p ? { ...p, rg: value } : p)}
                  onTelefoneCountryChange={(code) =>
                    setEditing((p) =>
                      p
                        ? { ...p, telefoneCountryCode: code, telefoneNumero: '', telefoneTouched: false }
                        : p,
                    )
                  }
                  onTelefoneNumeroChange={(value) =>
                    setEditing((p) => (p ? { ...p, telefoneNumero: value } : p))
                  }
                  onTelefoneBlur={() => setEditing((p) => (p ? { ...p, telefoneTouched: true } : p))}
                  onEmailChange={(value) => setEditing((p) => (p ? { ...p, email: value } : p))}
                  onInstagramChange={(value) => setEditing((p) => (p ? { ...p, instagram: value } : p))}
                  onTiktokChange={(value) => setEditing((p) => (p ? { ...p, tiktok: value } : p))}
                  onCepChange={(value) => setEditing((p) => (p ? { ...p, cep: value } : p))}
                  onEnderecoRuaChange={(value) => setEditing((p) => (p ? { ...p, enderecoRua: value } : p))}
                  onEnderecoNumeroChange={(value) => setEditing((p) => (p ? { ...p, enderecoNumero: value } : p))}
                  onEnderecoComplementoChange={(value) =>
                    setEditing((p) => (p ? { ...p, enderecoComplemento: value } : p))
                  }
                  onEnderecoBairroChange={(value) => setEditing((p) => (p ? { ...p, enderecoBairro: value } : p))}
                  onEnderecoCidadeChange={(value) => setEditing((p) => (p ? { ...p, enderecoCidade: value } : p))}
                  onEnderecoEstadoChange={(value) => setEditing((p) => (p ? { ...p, enderecoEstado: value } : p))}
                  onNomeMaeChange={(value) => setEditing((p) => (p ? { ...p, nomeMae: value } : p))}
                  onNomePaiChange={(value) => setEditing((p) => (p ? { ...p, nomePai: value } : p))}
                  onIndicacaoChange={(value) => setEditing((p) => (p ? { ...p, indicacao: value } : p))}
                  clearError={clearEditFieldError}
                  submitLabel="Salvar Alterações"
                  onSubmit={(ev) => {
                    ev.preventDefault();
                    saveEditProfile();
                  }}
                  onCancel={() => {
                    setEditing(null);
                    setEditFormErrors({});
                    setProfileSaveError('');
                  }}
                  salvando={profileSaving}
                  cpfInputId="patient-profile-edit-cpf"
                  onManageAlerts={handleScrollToAlertas}
                    />
                  </div>
                </div>
              </div>
            ) : null}

          <div className="overflow-hidden rounded-[18px] border border-[#e2e8f0] bg-white shadow-md">
                <div className="sticky top-0 z-10 flex w-full min-w-0 flex-nowrap items-stretch justify-between gap-0 overflow-x-hidden border-b border-[#e2e8f0] bg-white sm:gap-1">
              {[
                { key: 'atendimento', label: 'Perfil', title: 'Perfil', icon: Play },
                { key: 'prontuario', label: 'Prontuário', title: 'Prontuário Eletrônico', icon: ClipboardList },
                { key: 'anamnese', label: 'Anamnese', title: 'Anamnese', icon: Activity },
                { key: 'galeria', label: 'Galeria', title: 'Galeria', icon: ImageIcon },
              ].map(({ key, label, title, icon }) => {
                const TabIcon = icon;
                const active = patientDetailTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    title={title}
                    aria-label={title}
                    onClick={() => setPatientDetailTab(key)}
                    className={`flex min-h-[44px] min-w-0 flex-1 items-center justify-center gap-0.5 whitespace-nowrap px-2 py-2.5 text-[11px] font-semibold transition-colors sm:gap-1 sm:px-3 sm:text-[12px] ${
                      active
                        ? '-mb-px border-b-2 border-[#00a88e] text-[#00a88e]'
                        : 'border-b-2 border-transparent text-[#64748b] hover:text-[#0f172a]'
                    }`}
                  >
                    <TabIcon className="h-3.5 w-3.5 shrink-0 sm:mr-1" strokeWidth={2.25} aria-hidden />
                    <span className="hidden truncate sm:inline">{label}</span>
                  </button>
                );
              })}
            </div>

            <div className="p-5 sm:p-6">
              {patientDetailTab === 'atendimento' && (
                <div className="space-y-5">
                  {isNivel1 ? (
                    <div className="rounded-xl border border-rose-100/60 bg-rose-50/30 p-4 text-center">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-500 border border-rose-100/60 shadow-sm">
                        <Shield className="h-5 w-5" />
                      </div>
                      <p className="mt-2 text-xs font-semibold text-rose-700">Acesso Limitado</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Seu perfil (Nível 1) não possui permissão para iniciar ou gerenciar atendimentos.
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onStartAttendance?.(selectedPatient)}
                      className="inline-flex h-10 w-full max-w-md items-center justify-center gap-2 rounded-lg bg-[#00a88e] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#00967f]"
                    >
                      <Play className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
                      Iniciar Atendimento
                    </button>
                  )}

                  <div>
                    <h5 className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#94a3b8]">
                      Resumo clínico
                    </h5>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-[#f1f5f9] bg-[#f8fafc] p-3">
                        <div className="text-[11px] font-medium uppercase tracking-wide text-[#94a3b8]">
                          Último procedimento realizado
                        </div>
                        <div
                          className="mt-0.5 truncate text-[14px] font-semibold text-[#0f172a]"
                          title={isNivel1 ? 'Acesso restrito' : (sortedApiProcedures[0]?.procedimentoNome || sortedApiProcedures[0]?.nome)}
                        >
                          {isNivel1 ? 'Acesso restrito' : (sortedApiProcedures[0]?.procedimentoNome || sortedApiProcedures[0]?.nome || '—')}
                        </div>
                      </div>
                      <div className="rounded-lg border border-[#f1f5f9] bg-[#f8fafc] p-3">
                        <div className="text-[11px] font-medium uppercase tracking-wide text-[#94a3b8]">Próximo retorno</div>
                        <div className="mt-0.5 text-[14px] font-semibold text-[#0f172a]">
                          {proximoRetornoResumoDisplay}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 mt-5 flex flex-wrap items-center justify-between gap-2">
                      <h5 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#94a3b8]">
                        Histórico recente
                      </h5>
                      {!isNivel1 && detailLoading ? (
                        <span className="inline-flex items-center gap-2 text-[12px] font-medium text-[#64748b]">
                          <Loader2 className="h-4 w-4 animate-spin text-[#00a88e]" aria-hidden />
                          Carregando…
                        </span>
                      ) : null}
                    </div>
                    {isNivel1 ? (
                      <p className="rounded-lg border border-[#f1f5f9] bg-[#f8fafc] px-4 py-6 text-center text-[13px] font-medium text-[#94a3b8]">
                        Acesso restrito
                      </p>
                    ) : !sortedApiProcedures.length ? (
                      <p className="rounded-lg border border-[#f1f5f9] bg-[#f8fafc] px-4 py-6 text-center text-[13px] font-medium text-[#94a3b8]">
                        Nenhum procedimento registrado ainda.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <ProcedureTimelineRail>
                          {perfilRecentProcedures.map((proc, idx) => {
                            const rowKey =
                              proc.id != null && proc.id !== ''
                                ? String(proc.id)
                                : `perfil-proc-${idx}`;
                            const criado = proc.criadoEm ? new Date(proc.criadoEm) : null;
                            const dateLabel = criado
                              ? criado.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                              : '—';
                            const timeLabel = criado
                              ? criado.toLocaleTimeString('pt-BR', {
                                  timeZone: 'America/Sao_Paulo',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '';
                            const nomeProc = proc.procedimentoNome || proc.nome || 'Procedimento';
                            const isLast = idx === perfilRecentProcedures.length - 1;
                            const showVerMais =
                              isLast && sortedApiProcedures.length > perfilRecentProcedures.length;
                            return (
                              <ProcedureTimelineEntry key={rowKey}>
                                <ProcedureTimelinePreviewCard
                                  dateLabel={dateLabel}
                                  timeLabel={timeLabel}
                                  procedureName={nomeProc}
                                  professionalName={proc.profissionalNome || '—'}
                                  onPress={
                                    showVerMais
                                      ? () => setPatientDetailTab('prontuario')
                                      : undefined
                                  }
                                  fusedVerMais={showVerMais}
                                  verMaisLabel="Ver prontuário completo"
                                />
                              </ProcedureTimelineEntry>
                            );
                          })}
                        </ProcedureTimelineRail>
                        {sortedApiProcedures.length <= perfilRecentProcedures.length ? (
                          <button
                            type="button"
                            onClick={() => setPatientDetailTab('prontuario')}
                            className="flex min-h-[44px] w-full items-center justify-center gap-1 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-[13px] font-semibold text-[#00a88e] transition-colors hover:border-[#cbd5e1] hover:bg-[#f1f5f9]"
                          >
                            Ver prontuário completo
                            <ChevronDown className="h-4 w-4 shrink-0 -rotate-90" strokeWidth={2.25} aria-hidden />
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {patientDetailTab === 'prontuario' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <ProcedureTimelineHeading title="Prontuário eletrônico" />
                    {!isNivel1 && detailLoading ? (
                      <span className="inline-flex items-center gap-2 text-[12px] font-medium text-[#64748b]">
                        <Loader2 className="h-4 w-4 animate-spin text-[#00a88e]" aria-hidden />
                        Carregando procedimentos…
                      </span>
                    ) : null}
                  </div>
                  {isNivel1 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-[#e2e8f0] rounded-[18px]">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-500 mb-4 border border-rose-100/60 shadow-inner">
                        <Shield className="h-6 w-6" />
                      </div>
                      <h3 className="text-base font-bold text-slate-800">Procedimentos Ocultos</h3>
                      <p className="mt-2 text-xs text-slate-500 max-w-sm leading-relaxed">
                        Os procedimentos clínicos e históricos de sessões deste paciente estão ocultos para o seu nível de acesso (Nível 1).
                      </p>
                    </div>
                  ) : (
                    <>
                      {!sortedApiProcedures.length ? (
                    <p className="text-center py-10 text-[#94a3b8] text-[14px] font-medium">Nenhum procedimento registrado ainda.</p>
                  ) : (
                    <ProcedureTimelineRail>
                      {prontuarioProceduresVisible.map((proc, idx) => {
                        const procOrderKey = sortedApiProcedures.indexOf(proc);
                        const rowKey =
                          proc.id != null && proc.id !== ''
                            ? String(proc.id)
                            : `proc-${procOrderKey >= 0 ? procOrderKey : idx}`;
                        const open = Boolean(prontuarioExpanded[rowKey]);
                        const dataLabel = proc.criadoEm
                          ? new Date(proc.criadoEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                          : '—';
                        const nomeProc = proc.procedimentoNome || proc.nome || 'Procedimento';
                        const fotosProc = galeriaItemsForProcedure(proc);
                        const procId = proc.id ?? proc.procedimentoId;
                        const showVerMaisHere = prontuarioListTruncated && idx === prontuarioProceduresVisible.length - 1;
                        const assinaturaVinculada = (assinaturas || []).find(
                          (a) =>
                            a &&
                            a.procedimentoFeitoId != null &&
                            procId != null &&
                            String(a.procedimentoFeitoId) === String(procId),
                        );
                        const tituloTermoAssinado =
                          assinaturaVinculada?.termoTitulo ??
                          assinaturaVinculada?.termo?.titulo ??
                          assinaturaVinculada?.termo?.title ??
                          'Termo';
                        const imgAssinProf =
                          assinaturaVinculada?.assinaturaProfissional ??
                          assinaturaVinculada?.assinatura_profissional;
                        const imgAssinPac =
                          assinaturaVinculada?.assinaturaPaciente ??
                          assinaturaVinculada?.assinatura_paciente;
                        const emAssinProf =
                          assinaturaVinculada?.profissionalAssinouEm ??
                          assinaturaVinculada?.profissional_assinou_em;
                        const emAssinPac =
                          assinaturaVinculada?.pacienteAssinouEm ??
                          assinaturaVinculada?.paciente_assinou_em;
                        return (
                          <ProcedureTimelineEntry key={rowKey}>
                            <div className="overflow-hidden rounded-lg border border-[#e2e8f0] bg-[#f8fafc] shadow-sm">
                              <button
                                type="button"
                                onClick={() => toggleProntuarioRow(rowKey)}
                                className="flex w-full min-h-[44px] items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-[#f1f5f9] sm:gap-3 sm:px-4 sm:py-3"
                                aria-expanded={open}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] font-medium text-[#64748b] sm:text-[13px]">
                                    <Calendar className="h-3.5 w-3.5 shrink-0 text-[#00a88e]" strokeWidth={2} aria-hidden />
                                    <span className="truncate">{dataLabel}</span>
                                  </div>
                                  <p className="mt-1 truncate text-[13px] font-bold leading-snug text-[#0f172a] sm:text-[14px]" title={nomeProc}>
                                    {nomeProc}
                                  </p>
                                  <p
                                    className="mt-0.5 truncate text-[12px] font-medium text-[#64748b]"
                                    title={proc.profissionalNome || undefined}
                                  >
                                    Realizado por {proc.profissionalNome || '—'}
                                  </p>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1.5 self-center">
                                  {proc.statusNome ? (
                                    <span className="shrink-0 rounded-full border border-[#00a88e]/25 bg-[#e6f7f5] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0f766e]">
                                      {proc.statusNome}
                                    </span>
                                  ) : (
                                    <span className="shrink-0 rounded-full border border-[#e2e8f0] bg-[#f1f5f9] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#64748b]">
                                      —
                                    </span>
                                  )}
                                  <ChevronDown
                                    className={`h-4 w-4 shrink-0 text-[#94a3b8] transition-transform ${open ? 'rotate-180' : ''}`}
                                    strokeWidth={2.5}
                                    aria-hidden
                                  />
                                </div>
                              </button>
                              {open ? (
                                <div className="space-y-4 border-t border-[#e2e8f0] bg-[#fafafa] px-3 py-4 sm:px-4">
                                  <div>
                                    <div className="text-[11px] font-bold uppercase tracking-wide text-[#94a3b8]">
                                      Observações do profissional
                                    </div>
                                    <p className="mt-1.5 whitespace-pre-wrap text-[13px] font-medium leading-relaxed text-[#334155]">
                                      {proc.observacao && String(proc.observacao).trim() ? String(proc.observacao).trim() : '—'}
                                    </p>
                                  </div>
                                  {assinaturaVinculada ? (
                                    <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
                                      <div className="mb-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-[13px] font-bold text-[#0f172a]">
                                          <FileText className="h-4 w-4 shrink-0 text-[#00a88e]" strokeWidth={2} aria-hidden />
                                          Termo Assinado
                                        </div>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            import('../../utils/pdfGenerator.js').then(({ generateTermoPdf }) => {
                                              generateTermoPdf({
                                                titulo: tituloTermoAssinado,
                                                conteudo: assinaturaVinculada?.conteudoSnapshot || assinaturaVinculada?.termo?.conteudo || '',
                                                assinaturaPaciente: imgAssinPac,
                                                assinaturaProfissional: imgAssinProf,
                                                metadados: {
                                                  pacienteNome: selectedPatient?.nome,
                                                  profissionalNome: proc?.profissionalNome || '',
                                                  dataHora: formatDataHoraAssinaturaPtBr(emAssinProf || emAssinPac),
                                                  ipAddress: assinaturaVinculada?.ipAddress,
                                                },
                                                fileName: `termo_${selectedPatient?.nome?.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`
                                              });
                                            });
                                          }}
                                          className="flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#0f172a] shadow-sm hover:bg-[#f8fafc] transition-colors"
                                        >
                                          Exportar PDF
                                        </button>
                                      </div>
                                      <p className="mb-2 text-[13px] font-medium text-[#64748b]">
                                        <span className="text-[#0f172a]">&quot;{tituloTermoAssinado}&quot;</span>
                                        {' · '}
                                        {formatDataHoraAssinaturaPtBr(emAssinProf || emAssinPac)}
                                      </p>
                                      {assinaturaVinculada?.ipAddress && (
                                        <p className="mb-4 text-[11px] text-[#64748b] bg-[#f1f5f9] px-2 py-1 rounded w-fit">
                                          IP do Aceite: <span className="font-mono">{assinaturaVinculada.ipAddress}</span>
                                        </p>
                                      )}
                                      <div className="space-y-4">
                                        <div>
                                          <div className="text-[11px] font-bold uppercase tracking-wide text-[#94a3b8]">
                                            Assinatura do Profissional
                                          </div>
                                          {imgAssinProf ? (
                                            <img
                                              src={imgAssinProf}
                                              alt=""
                                              className="mt-2 h-16 max-w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] object-contain"
                                            />
                                          ) : (
                                            <p className="mt-2 text-[13px] text-[#94a3b8]">—</p>
                                          )}
                                          <p className="mt-1.5 text-[12px] font-medium text-[#64748b]">
                                            Assinado em: {formatDataHoraAssinaturaPtBr(emAssinProf)}
                                          </p>
                                        </div>
                                        <div>
                                          <div className="text-[11px] font-bold uppercase tracking-wide text-[#94a3b8]">
                                            Assinatura do Paciente
                                          </div>
                                          {imgAssinPac ? (
                                            <img
                                              src={imgAssinPac}
                                              alt=""
                                              className="mt-2 h-16 max-w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] object-contain"
                                            />
                                          ) : (
                                            <p className="mt-2 text-[13px] text-[#94a3b8]">—</p>
                                          )}
                                          <p className="mt-1.5 text-[12px] font-medium text-[#64748b]">
                                            Assinado em: {formatDataHoraAssinaturaPtBr(emAssinPac)}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  ) : null}
                                  <div className="flex flex-wrap gap-2">
                                    <ModuloFuturoBadge>Cadastro de produtos em breve</ModuloFuturoBadge>
                                    <ModuloFuturoBadge>Módulo financeiro em breve</ModuloFuturoBadge>
                                  </div>
                                  <div>
                                    <div className="text-[11px] font-bold uppercase tracking-wide text-[#94a3b8]">Fotos da sessão</div>
                                    {fotosProc.length ? (
                                      <div className="mt-2 grid grid-cols-4 gap-2">
                                        {fotosProc.map((foto) => (
                                          <button
                                            key={foto.serverId}
                                            type="button"
                                            onClick={() =>
                                              setGalleryPreview({
                                                url: foto.url,
                                                authFetch: true,
                                                caption: foto.legenda || foto.fileName,
                                              })
                                            }
                                            className="aspect-square w-full overflow-hidden rounded-lg border border-[#00a88e]/15 bg-[#e6f7f5]"
                                          >
                                            <GaleriaArquivoImage
                                              url={foto.url}
                                              alt=""
                                              className="h-full w-full"
                                              imgClassName="h-full w-full object-cover"
                                            />
                                          </button>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="mt-2 text-[13px] font-medium text-[#94a3b8]">Nenhuma foto vinculada</p>
                                    )}
                                  </div>
                                </div>
                              ) : null}
                              <ProcedureTimelineProfileVerMaisStrip
                                hidden={!showVerMaisHere}
                                onExpand={() => setShowAllProntuario(true)}
                              />
                            </div>
                          </ProcedureTimelineEntry>
                        );
                      })}
                    </ProcedureTimelineRail>
                  )}
                  </>
                  )}
                </div>
              )}

              {patientDetailTab === 'anamnese' && (
                <AnamneseTab pacienteId={selectedPatient.id} />
              )}

              {patientDetailTab === 'galeria' && (
                <GaleriaTab
                  isNivel1={isNivel1}
                  galeriaBackend={galeriaBackend}
                  selectedPatientId={selectedPatient?.id}
                  galeriaSessionsForView={galeriaSessionsForView}
                  galeriaMesesOpcoes={galeriaMesesOpcoes}
                  galeriaProcedimentosOpcoes={galeriaProcedimentosOpcoes}
                  galeriaFilterCategoria={galeriaFilterCategoria}
                  setGaleriaFilterCategoria={setGaleriaFilterCategoria}
                  galeriaFilterMes={galeriaFilterMes}
                  setGaleriaFilterMes={setGaleriaFilterMes}
                  galeriaFilterProcedimento={galeriaFilterProcedimento}
                  setGaleriaFilterProcedimento={setGaleriaFilterProcedimento}
                  apiGaleriaItemsLength={apiGaleriaItems.length}
                  galleryItemsForGrid={galleryItemsForGrid}
                  sessoesExpandidas={sessoesExpandidas}
                  setSessoesExpandidas={setSessoesExpandidas}
                  categoriasEmEdicao={categoriasEmEdicao}
                  setCategoriasEmEdicao={setCategoriasEmEdicao}
                  modoComparar={modoComparar}
                  setModoComparar={setModoComparar}
                  compararSelecionadas={compararSelecionadas}
                  setCompararSelecionadas={setCompararSelecionadas}
                  compararModalOpen={compararModalOpen}
                  setCompararModalOpen={setCompararModalOpen}
                  onCompararFotoClick={handleCompararFotoClick}
                  onRemoveGalleryItem={handleRemoveGalleryItem}
                  onUploadCategoria={handleGaleriaUpload}
                  resolveProcedimentoFeitoIdForSessao={resolveProcedimentoFeitoIdForSessao}
                  onAcompanhamento={({ procedimentoFeitoId, pacienteId }) =>
                    setRelatoModal({
                      open: true,
                      procedimentoFeitoId,
                      pacienteId,
                    })
                  }
                  onLocalPreview={setGalleryPreview}
                  uploadDisabled={galeriaUploadDisabled}
                  uploadDisabledTitle={galeriaUploadDisabledTitle}
                />
              )}

            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:col-span-1 lg:sticky lg:top-4 lg:self-start">
          <div
            ref={alertasCardRef}
            id="patient-profile-alertas-card"
            className="overflow-hidden rounded-[14px] border border-[#fecaca] shadow-md"
          >
            <div className="flex items-center gap-2 bg-[#fef2f2] px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#dc2626]" strokeWidth={2.5} aria-hidden />
              <h5 className="text-[12px] font-bold text-[#dc2626]">Alertas</h5>
            </div>
            <div className="space-y-2 bg-white p-2.5">
              {/* Alertas manuais (CRUD) — paralelo aos alertas de anamnese */}
              <div className="space-y-1.5 border-b border-slate-100 pb-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#64748b]">
                    Alertas manuais
                  </span>
                  {!isNivel1 && (
                    <button
                      type="button"
                      disabled={!selectedPatient?.id}
                      onClick={openManualAlertCreate}
                      className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-dashed border-[#f87171] bg-white px-2 text-[10px] font-semibold text-[#dc2626] transition hover:border-[#dc2626] hover:bg-[#fef2f2] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Plus className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                      Novo alerta manual
                    </button>
                  )}
                </div>
                {!selectedPatient?.id ? (
                  <p className="text-[11px] leading-snug text-[#64748b]">
                    Salve o paciente no servidor para gerenciar alertas manuais.
                  </p>
                ) : manualAlertsLoading ? (
                  <div className="flex items-center gap-2 text-[11px] font-medium text-[#64748b]">
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#dc2626]" aria-hidden />
                    Carregando alertas manuais…
                  </div>
                ) : manualAlerts.length === 0 ? (
                  <p className="text-[11px] font-medium leading-snug text-[#64748b]">Nenhum alerta manual.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {manualAlerts.map((ma) => (
                      <li
                        key={ma.id}
                        className="rounded-lg border border-red-100/90 bg-[#fef2f2]/70 py-1.5 pl-2 pr-1"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-[11px] font-bold text-[#0f172a]">
                              {ma.titulo || 'Alerta manual'}
                            </p>
                            <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap break-words text-[11px] text-[#475569]">
                              {ma.descricao}
                            </p>
                          </div>
                          {!isNivel1 && (
                            <div className="flex shrink-0 gap-0.5">
                              <button
                                type="button"
                                title="Editar"
                                aria-label="Editar alerta manual"
                                onClick={() => openManualAlertEdit(ma)}
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-[#64748b] hover:border-slate-200 hover:bg-white hover:text-[#0f172a]"
                              >
                                <Pencil className="h-3 w-3" strokeWidth={2.25} />
                              </button>
                              <button
                                type="button"
                                title="Excluir"
                                aria-label="Excluir alerta manual"
                                onClick={() => setManualAlertConfirm({ type: 'delete', id: ma.id })}
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-[#64748b] hover:border-red-200 hover:bg-[#fef2f2] hover:text-red-600"
                              >
                                <Trash2 className="h-3 w-3" strokeWidth={2.25} />
                              </button>
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Alertas da anamnese (somente leitura — mesma lógica de merge que antes) */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#dc2626]">
                  Alertas da anamnese
                </span>
                {alertasAnamneseLoading ? (
                  <div className="flex items-center gap-2 text-[11px] font-medium text-[#64748b]">
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#dc2626]" aria-hidden />
                    Carregando alertas da anamnese…
                  </div>
                ) : alertasAnamnese.length === 0 ? (
                  <p className="text-[11px] font-medium leading-snug text-[#64748b]">
                    Nenhuma pergunta em alerta nas anamneses preenchidas.
                  </p>
                ) : (
                  <>
                    {alertasAlergia.length > 0 ? (
                      <div className="mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-[#dc2626]">
                          Alergias registradas
                        </span>
                        {alertasAlergia.map((item) => (
                          <div
                            key={item.key}
                            className="mt-1 rounded-md border border-[#fecaca] bg-[#fef2f2] px-2 py-1.5"
                          >
                            <p className="line-clamp-2 text-[11px] font-bold text-[#dc2626]">{item.titulo}</p>
                            <p className="line-clamp-3 text-[12px] font-semibold text-[#0f172a]">{item.valor}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {alertasSidebarGeral.slice(0, 3).map((row) => (
                      <div key={row.key} className="rounded-md border border-[#fecaca] bg-[#fef2f2]/80 px-2 py-1.5">
                        <p className="line-clamp-2 text-[11px] font-bold uppercase tracking-wide text-[#dc2626]">
                          {row.titulo}
                        </p>
                        <p className="mt-0.5 line-clamp-3 break-words text-[12px] font-semibold text-[#0f172a]">
                          {row.valor}
                        </p>
                      </div>
                    ))}
                    {alertasAnamnese.length > 3 ? (
                      <button
                        type="button"
                        onClick={() => setAlertasModalOpen(true)}
                        className="mt-1 flex h-7 w-full items-center justify-center rounded-md border border-[#fecaca] text-[11px] font-semibold text-[#dc2626] transition-colors hover:bg-[#fef2f2]"
                      >
                        Ver todos ({alertasAnamnese.length})
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[14px] border border-amber-200/90 shadow-md">
            <div className="bg-amber-50 px-3 py-2">
              <h5 className="text-[12px] font-bold text-[#b45309]">Avisos</h5>
            </div>
            <div className="space-y-1.5 bg-white p-2.5">
              <div className="rounded-md border border-amber-200/80 bg-amber-50/90 px-2.5 py-1.5 text-[12px] font-medium text-[#92400e]">
                {birthAlert ? (
                  <p className="flex items-center gap-1.5">
                    <Bell className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
                    {birthdayAlertSidebarCopy(birthAlert)}
                  </p>
                ) : (
                  <p>Cadastre a data de nascimento para ver quantos dias faltam para o aniversário.</p>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[14px] border border-[#e2e8f0] shadow-md">
            <div className="flex items-center gap-2 bg-[#f8fafc] px-3 py-2">
              <StickyNote className="h-3.5 w-3.5 shrink-0 text-[#00a88e]" strokeWidth={2.25} aria-hidden />
              <h5 className="text-[12px] font-bold text-[#0f172a]">Notas Rápidas</h5>
            </div>
            <div className="space-y-2 bg-white p-2.5">
              {!isNivel1 && (
                <>
                  <textarea
                    value={quickNoteText}
                    onChange={(e) => setQuickNoteText(e.target.value)}
                    rows={2}
                    placeholder="Escreva uma nota rápida..."
                    className="w-full resize-none rounded-lg border border-[#e2e8f0] p-2.5 text-[13px] font-medium text-[#0f172a] outline-none focus:border-[#00a88e]/40 focus:ring-2 focus:ring-[#00a88e]/10"
                  />
                  <button
                    type="button"
                    onClick={handleAddQuickNote}
                    disabled={!quickNoteText.trim()}
                    className="flex h-8 w-full items-center justify-center rounded-lg bg-[#00a88e] text-[12px] font-semibold text-white transition-colors hover:bg-[#00967f] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Adicionar nota rápida
                  </button>
                </>
              )}
              <div className="space-y-1.5 pt-0.5">
                {displayNotes.length ? (
                  displayNotes.map((nota, i) => (
                    <div
                      key={nota.id || i}
                      className={`rounded-lg border p-2 ${
                        i % 2 === 0
                          ? 'border-amber-100/90 bg-amber-50/70'
                          : 'border-emerald-100/90 bg-emerald-50/70'
                      }`}
                    >
                      <p className="text-[13px] text-[#0f172a]">{nota.texto}</p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-[#94a3b8]">
                          {nota.autor}
                          {nota._fromApi ? ' · servidor' : ''}
                        </span>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-[11px] text-[#94a3b8]">{nota.data}</span>
                          {!isNivel1 && nota._fromApi ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteNote(nota.id)}
                              className="text-[#94a3b8] transition-colors hover:text-red-600"
                              aria-label="Excluir nota"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[12px] text-[#94a3b8]">Nenhuma nota registrada</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {manualAlertEditorOpen && selectedPatient?.id ? (
        <div
          className="fixed inset-0 z-[232] flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="manual-alert-editor-title"
          onClick={() => {
            if (!manualAlertSaving) {
              setManualAlertEditorOpen(false);
              setManualAlertDraft({ id: null, titulo: '', descricao: '' });
            }
          }}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              disabled={manualAlertSaving}
              onClick={() => {
                setManualAlertEditorOpen(false);
                setManualAlertDraft({ id: null, titulo: '', descricao: '' });
              }}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-[#64748b] transition-colors hover:border-red-200 hover:text-red-600 disabled:opacity-50"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" strokeWidth={2.5} />
            </button>
            <h3 id="manual-alert-editor-title" className="pr-10 text-[18px] font-bold text-[#0f172a]">
              {manualAlertDraft.id ? 'Editar alerta manual' : 'Novo alerta manual'}
            </h3>
            <p className="mt-1 text-[12px] font-medium text-[#64748b]">
              Título e descrição são obrigatórios. Estes alertas são independentes dos alertas da anamnese.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="manual-alert-titulo" className="block text-[12px] font-semibold text-[#334155]">
                  Título
                </label>
                <input
                  id="manual-alert-titulo"
                  type="text"
                  value={manualAlertDraft.titulo}
                  maxLength={MANUAL_ALERTA_MAX.titulo}
                  onChange={(e) =>
                    setManualAlertDraft((d) => ({ ...d, titulo: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-[13px] font-medium text-[#0f172a] outline-none focus:border-[#00a88e]/40 focus:ring-2 focus:ring-[#00a88e]/10"
                  placeholder="Ex.: Atenção na aplicação"
                  autoComplete="off"
                />
              </div>
              <div>
                <label htmlFor="manual-alert-desc" className="block text-[12px] font-semibold text-[#334155]">
                  Descrição
                </label>
                <textarea
                  id="manual-alert-desc"
                  value={manualAlertDraft.descricao}
                  maxLength={MANUAL_ALERTA_MAX.descricao}
                  onChange={(e) =>
                    setManualAlertDraft((d) => ({ ...d, descricao: e.target.value }))
                  }
                  rows={4}
                  className="mt-1 w-full resize-y rounded-lg border border-[#e2e8f0] px-3 py-2 text-[13px] font-medium text-[#0f172a] outline-none focus:border-[#00a88e]/40 focus:ring-2 focus:ring-[#00a88e]/10"
                  placeholder="Detalhes do alerta…"
                />
              </div>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={manualAlertSaving}
                onClick={() => {
                  setManualAlertEditorOpen(false);
                  setManualAlertDraft({ id: null, titulo: '', descricao: '' });
                }}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-[#64748b] hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={manualAlertSaving}
                onClick={handleSubmitManualAlertEditor}
                className="inline-flex items-center justify-center rounded-xl bg-[#00a88e] px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#00967f] disabled:opacity-60"
              >
                {manualAlertSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Salvando…
                  </>
                ) : manualAlertDraft.id ? (
                  'Salvar alterações'
                ) : (
                  'Criar alerta'
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {inativarModalOpen ? (
        <div
          className="fixed inset-0 z-[246] flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inativar-paciente-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !inativarSubmitting) setInativarModalOpen(false);
          }}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#f1f5f9] p-4 sm:p-5">
              <h3 id="inativar-paciente-title" className="text-[17px] font-bold leading-snug text-[#0f172a]">
                Inativar paciente?
              </h3>
              <button
                type="button"
                onClick={() => {
                  if (!inativarSubmitting) setInativarModalOpen(false);
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#64748b] hover:border-[#cbd5e1]"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
            <div className="flex flex-col gap-3 p-4 sm:p-5">
              <p className="text-[13px] leading-relaxed text-[#64748b]">
                O histórico clínico permanece armazenado. Esta ação pode ser revertida reativando o paciente nas
                configurações quando necessário.
              </p>
              <div>
                <label htmlFor="inativar-motivo" className="mb-1 block text-[12px] font-semibold text-[#475569]">
                  Motivo (opcional)
                </label>
                <textarea
                  id="inativar-motivo"
                  value={inativarMotivo}
                  onChange={(e) => setInativarMotivo(e.target.value)}
                  rows={2}
                  maxLength={500}
                  className="w-full resize-none rounded-lg border border-[#e2e8f0] px-3 py-2 text-[14px] text-[#0f172a] outline-none focus:border-[#00a88e]/40"
                  placeholder="Ex.: solicitado pela paciente…"
                  disabled={inativarSubmitting}
                />
              </div>
              <div>
                <label htmlFor="inativar-senha" className="mb-1 block text-[12px] font-semibold text-[#475569]">
                  Sua senha <span className="text-red-600">*</span>
                </label>
                <input
                  id="inativar-senha"
                  type="password"
                  autoComplete="current-password"
                  value={inativarSenha}
                  onChange={(e) => {
                    setInativarSenha(e.target.value);
                    if (inativarSenhaErro) setInativarSenhaErro('');
                  }}
                  className={`w-full rounded-lg border px-3 py-2 text-[14px] text-[#0f172a] outline-none focus:border-[#00a88e]/40 ${
                    inativarSenhaErro ? 'border-red-400 bg-red-50/40' : 'border-[#e2e8f0]'
                  }`}
                  disabled={inativarSubmitting}
                />
                {inativarSenhaErro ? (
                  <p className="mt-1 text-[12px] font-medium text-red-600">{inativarSenhaErro}</p>
                ) : null}
              </div>
              <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={inativarSubmitting}
                  onClick={() => setInativarModalOpen(false)}
                  className="rounded-lg border border-[#e2e8f0] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#64748b] hover:bg-[#f8fafc] disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={inativarSubmitting}
                  onClick={handleConfirmInativar}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#64748b] px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-[#475569] disabled:opacity-60"
                >
                  {inativarSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : null}
                  Confirmar inativação
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {manualAlertConfirm ? (
        <div
          className="fixed inset-0 z-[245] flex items-center justify-center bg-black/55 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="manual-alert-confirm-title"
          onClick={() => {
            if (!manualAlertSaving) setManualAlertConfirm(null);
          }}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="manual-alert-confirm-title" className="text-[17px] font-bold text-[#0f172a]">
              {manualAlertConfirm.type === 'delete' ? 'Excluir alerta manual?' : 'Confirmar alterações?'}
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[#64748b]">
              {manualAlertConfirm.type === 'delete'
                ? 'Esta ação não pode ser desfeita. O alerta manual será removido permanentemente.'
                : 'As alterações serão salvas no servidor para este paciente.'}
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={manualAlertSaving}
                onClick={() => setManualAlertConfirm(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-[#64748b] hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              {manualAlertConfirm.type === 'delete' ? (
                <button
                  type="button"
                  disabled={manualAlertSaving}
                  onClick={executeManualAlertDelete}
                  className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
                >
                  {manualAlertSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      Excluindo…
                    </>
                  ) : (
                    'Excluir'
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={manualAlertSaving}
                  onClick={executeManualAlertSaveEdit}
                  className="inline-flex items-center justify-center rounded-xl bg-[#00a88e] px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#00967f] disabled:opacity-60"
                >
                  {manualAlertSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      Salvando…
                    </>
                  ) : (
                    'Confirmar'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {alertasModalOpen ? (
        <div
          className="fixed inset-0 z-[230] flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="alertas-modal-title"
          onClick={() => setAlertasModalOpen(false)}
        >
          <div
            className="relative flex max-h-[min(88dvh,720px)] w-full max-w-lg flex-col rounded-2xl border border-red-300 bg-white p-5 shadow-xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setAlertasModalOpen(false)}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-[#64748b] transition-colors hover:border-red-200 hover:text-red-600"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" strokeWidth={2.5} />
            </button>
            <h3 id="alertas-modal-title" className="pr-10 text-[18px] font-bold text-[#0f172a]">
              Todos os alertas
            </h3>
            <p className="mt-1 text-[12px] font-medium text-[#64748b]">
              Perguntas marcadas como alerta nas fichas, com as respostas registradas.
            </p>
            <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 [-webkit-overflow-scrolling:touch]">
              {alertasAnamnese.map((row) => (
                <div
                  key={row.key}
                  className="rounded-xl border-[2px] border-red-200 bg-red-50/60 p-4 shadow-sm"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" strokeWidth={2.5} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold leading-snug text-red-950">{row.titulo}</p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-[14px] font-semibold text-[#0f172a]">
                        {row.valor}
                      </p>
                      {(row.fichaNome || row.dataHora) && (
                        <p className="mt-2 text-[11px] font-medium text-[#64748b]">
                          {row.fichaNome || 'Anamnese'}
                          {row.dataHora
                            ? ` · ${new Date(row.dataHora).toLocaleString('pt-BR', {
                                timeZone: 'America/Sao_Paulo',
                              })}`
                            : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAlertasModalOpen(false)}
              className="mt-5 w-full rounded-xl border-[2px] border-transparent bg-[#00a88e] px-4 py-3 text-[14px] font-bold text-white transition-colors hover:bg-[#00967f]"
            >
              Fechar
            </button>
          </div>
        </div>
      ) : null}

      {birthdayModalOpen && birthAlert?.isToday && (
        <div
          className="fixed inset-0 z-[240] flex items-center justify-center p-4 bg-black/55"
          role="dialog"
          aria-modal="true"
          aria-labelledby="birthday-modal-title"
          onClick={dismissBirthdayModal}
        >
          <div
            className="birthday-modal-pop relative w-full max-w-md rounded-2xl border border-amber-300 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={dismissBirthdayModal}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-[#64748b] transition-colors hover:border-[#00a88e]/30 hover:text-[#00a88e]"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" strokeWidth={2.5} />
            </button>
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-amber-200">
                <Cake className="h-9 w-9 text-amber-600" strokeWidth={2.25} />
              </div>
            </div>
            <h3 id="birthday-modal-title" className="text-center text-[18px] font-bold text-[#0f172a]">
              Aniversário hoje
            </h3>
            <p className="mt-3 text-center text-[15px] leading-relaxed text-[#334155]">
              <span className="font-bold text-[#00a88e]">{patient.nome || 'Paciente'}</span>
              {' '}
              completa
              {' '}
              <span className="font-bold text-amber-700">{birthAlert.turningAge}</span>
              {' '}
              {birthAlert.turningAge === 1 ? 'ano' : 'anos'} hoje.
            </p>
            <button
              type="button"
              onClick={dismissBirthdayModal}
              className="mt-6 w-full rounded-xl border-[2px] border-transparent bg-[#00a88e] px-4 py-3 text-[14px] font-bold text-white transition-colors hover:bg-[#00967f]"
            >
              Entendi
            </button>
          </div>
        </div>
      )}

      {galleryPreview && (
        <div
          className="fixed inset-0 z-[220] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setGalleryPreview(null)}
          role="presentation"
        >
          <div className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setGalleryPreview(null)}
              className="absolute -top-10 right-0 text-white font-bold"
            >
              Fechar
            </button>
            <ZoomableGalleryLightbox
              url={galleryPreview.url}
              alt={galleryPreview.caption || 'Preview da foto'}
              authFetch={Boolean(galleryPreview.authFetch)}
            />
          </div>
        </div>
      )}

      <RelatoAcompanhamentoModal
        isOpen={relatoModal.open}
        onClose={closeRelatoModal}
        procedimentoFeitoId={relatoModal.procedimentoFeitoId}
        pacienteId={relatoModal.pacienteId}
        procedures={sortedApiProcedures}
        onConfirmProsseguir={() => {
          closeRelatoModal();
          onStartAttendance?.(selectedPatient);
        }}
        onAjustarPlano={() => {
          closeRelatoModal();
          setPatientDetailTab('anamnese');
        }}
      />
    </div>
  );
}

