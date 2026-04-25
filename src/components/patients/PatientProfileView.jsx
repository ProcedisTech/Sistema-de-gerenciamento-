import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bell,
  Cake,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  ClipboardList,
  Download,
  FileText,
  Filter,
  Image as ImageIcon,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Play,
  Save,
  Sparkles,
  StickyNote,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';
import {
  anamneseApi,
  pacientesApi,
  pacientesGaleriaApi,
  notasApi,
  procedimentosApi,
  termoAssinaturaApi,
} from '../../services/api';
import { useToast } from '../../contexts/useToast.js';
import { mapBackendPatient, mergePacienteDtoWithEditing } from '../../utils/patientMapping';
import { COUNTRY_PHONE_CODES, countrySelectDisplayLabel, getCountryByCode } from '../../data/countryPhoneCodes';
import { formatPhoneAsYouType, getDdi, isPhoneValid, formatPhoneForApi, parsePhoneFromApi } from '../../utils/phoneUtils';
import {
  birthdayModalStorageKey,
  getBirthdayAlertInfo,
  parsePatientBirthDate,
} from '../../utils/birthday.js';
import {
  compressImageFileToJpegDataUrl,
  getPatientProfilePhotoDisplayUrl,
  profilePhotoStorageKey,
  setStoredProfilePhotoDataUrl,
} from '../../utils/patientProfilePhoto.js';
import { PatientAvatar } from './PatientAvatar.jsx';
import {
  formatPacienteGaleriaError,
  normalizePacienteGaleriaItem,
  normalizePacienteGaleriaResponse,
  filterGaleriaItemsForUi,
  groupGaleriaItemsBySession,
  GALERIA_CATEGORIA_LABELS,
  itemMesReferenciaISO,
  formatDataSessaoPtBr,
} from '../../utils/pacienteGaleria.js';
import {
  GaleriaArquivoImage,
  GaleriaArquivoLightbox,
  GaleriaLocalImage,
} from './GaleriaArquivoImage.jsx';
import { RelatoAcompanhamentoModal } from '../journey/RelatoAcompanhamentoModal.jsx';

const ORDEM_CATEGORIAS = ['antes', 'planejamento', 'avaliacao', 'depois', 'outro'];

const GALERIA_SESSAO_CATEGORIA_LABEL_CLASS = {
  antes: 'text-[#f59e0b]',
  planejamento: 'text-[#6366f1]',
  avaliacao: 'text-[#0ea5e9]',
  depois: 'text-[#22c55e]',
  outro: 'text-[#94a3b8]',
};

function formatMesAno(isoDate) {
  if (!isoDate || isoDate === 'sem-data') return 'Data desconhecida';
  const [year, month] = isoDate.split('-');
  const meses = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ];
  return `${meses[parseInt(month, 10) - 1]}/${year}`;
}

function birthdayAlertSidebarCopy(alert) {
  if (!alert) return null;
  if (alert.isToday) return 'Aniversário hoje — celebre com o paciente!';
  if (alert.daysUntil === 1) return 'Aniversário amanhã';
  return `Aniversário em ${alert.daysUntil} dias`;
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
                  {an.profissionalNome && <span>Por: {an.profissionalNome}</span>}
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

function monthsSinceDate(isoOrStr) {
  const d = new Date(isoOrStr);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let m = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) m -= 1;
  return Math.max(1, m);
}

function formatDataHoraPtBr(dataHora) {
  if (!dataHora) return '—';
  const t = new Date(dataHora);
  if (Number.isNaN(t.getTime())) return String(dataHora);
  return t.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
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

export function PatientProfileView({
  selectedPatient,
  patientDetailTab,
  setPatientDetailTab,
  setPatientView,
  getPatientInitials,
  onStartAttendance,
  onUpdatePatient,
  onAddGalleryFiles,
  onDeleteGalleryPhoto,
  mergePatientById,
  refreshPatients,
  roleUserId,
}) {
  const toast = useToast();
  const patient = useMemo(() => selectedPatient || {}, [selectedPatient]);
  const birthParts = useMemo(
    () => parsePatientBirthDate(patient.dataNascimento),
    [patient.dataNascimento],
  );
  const birthAlert = birthParts ? getBirthdayAlertInfo(birthParts) : null;
  const [birthdayModalOpen, setBirthdayModalOpen] = useState(false);
  const [apiNotes, setApiNotes] = useState([]);
  const [apiProcedures, setApiProcedures] = useState([]);
  const [assinaturas, setAssinaturas] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState('');
  const [editing, setEditing] = useState(null);
  /** Preview da galeria: `authFetch` quando a imagem vem da API (precisa X-Org-Id). */
  const [galleryPreview, setGalleryPreview] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [sessoesExpandidas, setSessoesExpandidas] = useState({});
  const [categoriasExpandidas, setCategoriasExpandidas] = useState({});
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
  const [profilePhotoBusy, setProfilePhotoBusy] = useState(false);
  const [alertasAnamnese, setAlertasAnamnese] = useState([]);
  const [alertasAlergia, setAlertasAlergia] = useState([]);
  const [alertasAnamneseLoading, setAlertasAnamneseLoading] = useState(false);
  /** Lista leve de anamneses (mesmo endpoint que AnamneseTab) para decisão na aba Atendimento. */
  const [anamneseListSummary, setAnamneseListSummary] = useState([]);
  const [prontuarioExpanded, setProntuarioExpanded] = useState(() => ({}));
  const [alertasModalOpen, setAlertasModalOpen] = useState(false);
  const [relatoModal, setRelatoModal] = useState({
    open: false,
    procedimentoFeitoId: null,
    pacienteId: null,
  });
  const profilePhotoInputRef = useRef(null);

  const toggleSessao = (key) => {
    setSessoesExpandidas((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleCategoria = (sessKey, cat) => {
    const key = `${sessKey}_${cat}`;
    setCategoriasExpandidas((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCompararFotoClick = (foto) => {
    const cat = foto.categoria || 'outro';
    if (cat === 'antes') {
      setCompararSelecionadas((prev) => ({ ...prev, antes: foto }));
    } else if (cat === 'depois') {
      setCompararSelecionadas((prev) => ({ ...prev, depois: foto }));
    }
  };

  // Abre modal automaticamente quando as duas estão selecionadas
  const compararPronto = compararSelecionadas.antes && compararSelecionadas.depois;

  useEffect(() => {
    if (compararSelecionadas.antes && compararSelecionadas.depois) {
      setCompararModalOpen(true);
    }
  }, [compararSelecionadas]);

  useEffect(() => {
    setGaleriaFilterCategoria('all');
    setGaleriaFilterMes('all');
    setGaleriaFilterProcedimento('all');
    setAnamneseListSummary([]);
    setProntuarioExpanded({});
    setSessoesExpandidas({});
    setCategoriasExpandidas({});
    setCategoriasEmEdicao({});
    setRelatoModal({ open: false, procedimentoFeitoId: null, pacienteId: null });
    setApiProcedures([]);
    setApiNotes([]);
  }, [selectedPatient?.id]);

  const closeRelatoModal = useCallback(() => {
    setRelatoModal({ open: false, procedimentoFeitoId: null, pacienteId: null });
  }, []);

  useEffect(() => {
    if (patientDetailTab === 'timeline') {
      setPatientDetailTab('atendimento');
    }
  }, [patientDetailTab, setPatientDetailTab]);

  const isEditing = Boolean(editing);

  const profilePhotoDisplayUrl = getPatientProfilePhotoDisplayUrl(patient);

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

  const handleRemoveProfilePhoto = async () => {
    if (selectedPatient?.id) {
      setProfilePhotoBusy(true);
      try {
        await pacientesApi.removeFotoPerfil(selectedPatient.id);
        const dto = await pacientesApi.get(selectedPatient.id);
        const key = profilePhotoStorageKey(selectedPatient);
        if (key) setStoredProfilePhotoDataUrl(key, null);
        mergeServerPatientIntoState(dto);
        refreshPatients?.();
        toast.info('Foto de perfil removida.');
      } catch (err) {
        toast.error(err?.message || 'Não foi possível remover a foto.');
      } finally {
        setProfilePhotoBusy(false);
      }
      return;
    }
    applyProfilePhoto('');
    toast.info('Foto de perfil removida.');
  };


  const createEditDraft = () => {
    const { countryCode, nationalNumber } = parsePhoneFromApi(patient.telefone || '', 'BR');
    return {
      nome: patient.nome || '',
      email: patient.email || '',
      telefoneCountryCode: countryCode,
      telefoneNumero: formatPhoneAsYouType(countryCode, nationalNumber),
      telefoneTouched: false,
      profissao: patient.profissao || '',
      endereco: patient.endereco || '',
      alergias: patient.alergias || '',
      condicoesSaude: patient.condicoesSaude || '',
      medicamentos: Array.isArray(patient.medicamentos)
        ? patient.medicamentos.join(', ')
        : '',
    };
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
      setAnamneseListSummary([]);
      setAlertasAnamneseLoading(false);
      return undefined;
    }
    let cancelled = false;
    setAlertasAnamneseLoading(true);
    (async () => {
      try {
        const list = await anamneseApi.listPaciente(pacienteId);
        const arr = Array.isArray(list) ? list : [];
        if (!cancelled) setAnamneseListSummary(arr);

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

  /* Agregação (procedimentos + galeria); mantida — Prontuário usa apiProcedures na UI. */
  // eslint-disable-next-line no-unused-vars -- valor agregado intencionalmente preservado
  const timelineEvents = useMemo(() => {
    const events = [];

    (apiProcedures || []).forEach((proc, pIdx) => {
      events.push({
        id: proc.id || `api_proc_${pIdx}`,
        type: 'procedimento',
        title: proc.procedimentoNome || 'Procedimento',
        meta: `${proc.statusNome || ''} ${proc.criadoEm ? new Date(proc.criadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : ''} ${proc.profissionalNome ? `· ${proc.profissionalNome}` : ''}`,
      });
    });

    (patient.procedures || []).forEach((proc, idx) => {
      events.push({
        id: `proc_local_${idx}`,
        type: 'procedimento',
        title: proc.nome || 'Procedimento',
        meta: `${proc.data || '-'} ${proc.hora ? `- ${proc.hora}` : ''} ${proc.profissional ? `- ${proc.profissional}` : ''}`,
      });
    });

    if (galeriaBackend === 'api') {
      apiGaleriaItems.forEach((it) => {
        const title = it.legenda || it.fileName || 'Foto na galeria de evolução';
        const dataRef = it.dataReferencia ? String(it.dataReferencia) : '';
        const quando = it.createdAt ? new Date(it.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '';
        const meta = [dataRef, quando].filter(Boolean).join(' · ') || it.fileName;
        events.push({
          id: `galeria_api_${it.serverId}`,
          type: 'foto',
          title,
          meta,
        });
      });
    } else {
      capturedPhotos.forEach((photo, idx) => {
        events.push({
          id: `photo_${idx}`,
          type: 'foto',
          title: 'Foto adicionada na galeria',
          meta: photo.capturedAt ? new Date(photo.capturedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : photo.fileName,
        });
      });
    }

    return events;
  }, [patient, capturedPhotos, apiProcedures, galeriaBackend, apiGaleriaItems]);

  const anamneseAtendimentoInfo = useMemo(() => {
    const rows = (Array.isArray(anamneseListSummary) ? [...anamneseListSummary] : []).filter((r) => r?.dataHora);
    rows.sort((a, b) => {
      const ta = new Date(a.dataHora).getTime();
      const tb = new Date(b.dataHora).getTime();
      return tb - ta;
    });
    const latest = rows[0] || null;
    if (!latest?.dataHora) return { status: 'nova', latest: null };
    const t = new Date(latest.dataHora);
    if (Number.isNaN(t.getTime())) return { status: 'nova', latest: null };
    const lim = new Date();
    lim.setMonth(lim.getMonth() - 6);
    if (t >= lim) return { status: 'recente', latest };
    return { status: 'vencida', latest };
  }, [anamneseListSummary]);

  const hasConsultasAnteriores = useMemo(() => {
    if (detailLoading) return false;
    const apiCount = Array.isArray(apiProcedures) ? apiProcedures.length : 0;
    const localCount = Array.isArray(patient.procedures) ? patient.procedures.length : 0;
    return apiCount > 0 || localCount > 0;
  }, [detailLoading, apiProcedures, patient.procedures]);

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

  const toggleProntuarioRow = useCallback((rowKey) => {
    setProntuarioExpanded((prev) => ({ ...prev, [rowKey]: !prev[rowKey] }));
  }, []);

  const saveEditProfile = async () => {
    if (!selectedPatient?.id) {
      const meds = (editing?.medicamentos || '')
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean);
      onUpdatePatient?.(selectedPatient.cpf, {
        nome: editing?.nome || '',
        email: editing?.email || '',
        telefone: formatPhoneForApi(editing?.telefoneCountryCode ?? 'BR', editing?.telefoneNumero ?? '') || '',
        profissao: editing?.profissao || '',
        endereco: editing?.endereco || '',
        alergias: editing?.alergias || '',
        condicoesSaude: editing?.condicoesSaude || '',
        medicamentos: meds,
      });
      setEditing(null);
      return;
    }
    setProfileSaveError('');
    try {
      const dto = await pacientesApi.get(selectedPatient.id);
      const editingWithTelefone = {
        ...editing,
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
          medicamentos: (editing?.medicamentos || '')
            .split(',')
            .map((m) => m.trim())
            .filter(Boolean),
          condicoesSaude: editing?.condicoesSaude ?? prev.condicoesSaude,
          alergias: editing?.alergias ?? prev.alergias,
        };
      });
      refreshPatients?.();
      setEditing(null);
    } catch (e) {
      setProfileSaveError(e.message || 'Erro ao salvar cadastro.');
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
      <button
        type="button"
        onClick={() => {
          setPatientView('list');
          setPatientDetailTab('atendimento');
        }}
        className="mb-3 inline-flex w-fit items-center gap-2 text-[14px] font-bold text-[#00a88e] transition-all hover:text-[#00967f]"
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={2.5} /> Voltar para Pacientes
      </button>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-6 rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
            <div className="flex flex-col items-start gap-4 sm:flex-row">
              <div className="flex shrink-0 flex-col items-center gap-1.5 sm:items-start">
                <input
                  ref={profilePhotoInputRef}
                  type="file"
                  accept={
                    selectedPatient?.id
                      ? 'image/jpeg,image/jpg,image/png,image/webp'
                      : 'image/*'
                  }
                  className="hidden"
                  disabled={profilePhotoBusy}
                  onChange={handleProfilePhotoFile}
                />
                <PatientAvatar
                  patient={patient}
                  getPatientInitials={getPatientInitials}
                  className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-[#e2e8f0] bg-[#e6f7f5] shadow-sm md:h-16 md:w-16"
                  initialsClassName="text-base font-bold text-[#0f766e] md:text-lg"
                  spinnerClassName="h-5 w-5"
                />
                <button
                  type="button"
                  onClick={() => profilePhotoInputRef.current?.click()}
                  disabled={profilePhotoBusy}
                  className="text-[12px] font-medium text-[#00a88e] underline decoration-[#00a88e]/40 underline-offset-2 transition-colors hover:text-[#00967f] disabled:pointer-events-none disabled:opacity-50"
                >
                  {profilePhotoBusy ? 'Enviando…' : 'Trocar foto'}
                </button>
                {profilePhotoDisplayUrl ? (
                  <button
                    type="button"
                    onClick={handleRemoveProfilePhoto}
                    disabled={profilePhotoBusy}
                    className="text-[12px] font-medium text-[#94a3b8] transition-colors hover:text-red-600 disabled:opacity-50"
                  >
                    Remover foto
                  </button>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[17px] font-bold tracking-tight text-[#0f172a] md:text-[20px]">{selectedPatient.nome}</h3>
                  <span className="rounded-full border border-[#86efac] bg-[#dcfce7] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#16a34a]">
                    ATIVO
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-medium text-[#475569]">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-[#94a3b8]" strokeWidth={2} aria-hidden />
                    {selectedPatient.idade != null ? `${selectedPatient.idade} anos` : '—'}
                  </span>
                  <span className="text-[#cbd5e1]" aria-hidden>
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-[#94a3b8]" strokeWidth={2} aria-hidden />
                    {selectedPatient.cpf || '—'}
                  </span>
                  <span className="text-[#cbd5e1]" aria-hidden>
                    ·
                  </span>
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-[#94a3b8]" strokeWidth={2} aria-hidden />
                    <span className="truncate">{selectedPatient.telefone || '—'}</span>
                  </span>
                  <span className="text-[#cbd5e1]" aria-hidden>
                    ·
                  </span>
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-[#94a3b8]" strokeWidth={2} aria-hidden />
                    <span className="truncate">{selectedPatient.email || '—'}</span>
                  </span>
                </div>
                {selectedPatient.endereco ? (
                  <div className="mt-2 flex items-start gap-2 text-[13px] font-normal text-[#64748b]">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#94a3b8]" strokeWidth={2.25} aria-hidden />
                    <span className="min-w-0 break-words">{selectedPatient.endereco}</span>
                  </div>
                ) : null}
              </div>
              <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto">
                <button
                  type="button"
                  onClick={() => onStartAttendance?.(selectedPatient)}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-[#00a88e] px-5 text-[14px] font-semibold text-white transition-colors active:bg-[#00967f] md:min-h-[44px] md:w-auto md:text-[13px] md:hover:bg-[#00967f]"
                >
                  <Play className="inline h-4 w-4" strokeWidth={2.5} aria-hidden /> Iniciar Atendimento
                </button>
                <button
                  type="button"
                  onClick={() => setEditing((prev) => (prev ? null : createEditDraft()))}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-4 text-[14px] font-medium text-[#475569] transition-colors active:border-[#cbd5e1] md:min-h-[44px] md:w-auto md:text-[13px] md:hover:border-[#cbd5e1]"
                >
                  <UserIcon className="inline h-4 w-4" strokeWidth={2.5} aria-hidden /> Editar Cadastro
                </button>
                <button
                  type="button"
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-4 text-[14px] font-medium text-[#475569] transition-colors md:min-h-[44px] md:w-auto md:text-[13px]"
                  disabled
                >
                  <Download className="inline h-4 w-4" strokeWidth={2.5} aria-hidden /> Gerar PDF
                </button>
              </div>
            </div>

            {isEditing && (
              <div className="mt-5 p-4 border border-slate-200 rounded-2xl bg-[#f8fbfb]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input value={editing?.nome || ''} onChange={(e) => setEditing((p) => ({ ...p, nome: e.target.value }))} className="rounded-xl border-[2px] border-[#00a88e]/20 px-3 py-2 text-[16px] sm:text-[14px]" placeholder="Nome" />
                  <input value={editing?.email || ''} onChange={(e) => setEditing((p) => ({ ...p, email: e.target.value }))} className="rounded-xl border-[2px] border-[#00a88e]/20 px-3 py-2 text-[16px] sm:text-[14px]" placeholder="E-mail" />
                  <div className="space-y-1">
                    <div className="flex items-stretch gap-1 rounded-xl border-[2px] border-[#00a88e]/20 bg-white overflow-hidden">
                      <select
                        value={editing?.telefoneCountryCode ?? 'BR'}
                        title={getCountryByCode(editing?.telefoneCountryCode ?? 'BR').name}
                        onChange={(e) => setEditing((p) => ({ ...p, telefoneCountryCode: e.target.value, telefoneNumero: '', telefoneTouched: false }))}
                        className="max-w-[7.25rem] min-w-0 shrink-0 truncate border-0 bg-transparent py-2 pl-2 pr-1 text-[12px] font-medium text-[#475569] outline-none"
                        aria-label="País"
                      >
                        {[
                          COUNTRY_PHONE_CODES.find((c) => c.code === 'BR'),
                          ...COUNTRY_PHONE_CODES.filter((c) => c.code !== 'BR'),
                        ].filter(Boolean).map((c) => (
                          <option key={c.code} value={c.code} title={c.name}>{countrySelectDisplayLabel(c)}</option>
                        ))}
                      </select>
                      <div className="flex min-w-0 flex-1 items-stretch gap-0.5">
                        <span className="flex items-center text-[12px] font-semibold text-[#00a88e] shrink-0 tabular-nums">
                          {getDdi(editing?.telefoneCountryCode ?? 'BR')}
                        </span>
                        <input
                          type="tel"
                          value={editing?.telefoneNumero ?? ''}
                          autoComplete="tel-national"
                          onChange={(e) => {
                            const formatted = formatPhoneAsYouType(editing?.telefoneCountryCode ?? 'BR', e.target.value);
                            setEditing((p) => ({ ...p, telefoneNumero: formatted }));
                          }}
                          onBlur={() => setEditing((p) => ({ ...p, telefoneTouched: true }))}
                          placeholder={(editing?.telefoneCountryCode ?? 'BR') === 'BR' ? '(00) 00000-0000' : 'Número'}
                          className="min-w-0 flex-1 bg-transparent py-2 pr-2 text-[16px] sm:text-[14px] outline-none"
                        />
                      </div>
                    </div>
                    {editing?.telefoneTouched && !isPhoneValid(editing?.telefoneCountryCode ?? 'BR', editing?.telefoneNumero ?? '') && (
                      <p className="text-[11px] font-bold text-red-600">Número inválido para este país</p>
                    )}
                  </div>
                  <input value={editing?.profissao || ''} onChange={(e) => setEditing((p) => ({ ...p, profissao: e.target.value }))} className="rounded-xl border-[2px] border-[#00a88e]/20 px-3 py-2 text-[16px] sm:text-[14px]" placeholder="Profissao" />
                  <div className="md:col-span-2">
                    <label className="text-[12px] font-bold text-[#475569] mb-1 block">Endereço</label>
                    <input
                      type="text"
                      value={editing?.endereco || ''}
                      onChange={(e) => setEditing((d) => ({ ...d, endereco: e.target.value }))}
                      placeholder="Rua, número, bairro, cidade - UF"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2 text-[16px] outline-none focus:border-[#00a88e] sm:text-[13px]"
                    />
                  </div>
                  <input value={editing?.alergias || ''} onChange={(e) => setEditing((p) => ({ ...p, alergias: e.target.value }))} className="rounded-xl border-[2px] border-[#00a88e]/20 px-3 py-2 text-[16px] sm:text-[14px] md:col-span-2" placeholder="Alergias" />
                  <input value={editing?.condicoesSaude || ''} onChange={(e) => setEditing((p) => ({ ...p, condicoesSaude: e.target.value }))} className="rounded-xl border-[2px] border-[#00a88e]/20 px-3 py-2 text-[16px] sm:text-[14px] md:col-span-2" placeholder="Condicoes de saude" />
                  <input value={editing?.medicamentos || ''} onChange={(e) => setEditing((p) => ({ ...p, medicamentos: e.target.value }))} className="rounded-xl border-[2px] border-[#00a88e]/20 px-3 py-2 text-[16px] sm:text-[14px] md:col-span-2" placeholder="Medicamentos (separe por virgula)" />
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button type="button" onClick={saveEditProfile} className="px-4 py-2 rounded-xl bg-[#00a88e] text-white font-bold text-[13px] border-[2px] border-transparent"><Save className="w-4 h-4 inline mr-1" />Salvar</button>
                  <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl bg-white text-[#475569] font-bold text-[13px] border border-slate-200"><X className="w-4 h-4 inline mr-1" />Cancelar</button>
                </div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#f1f5f9] pt-4 max-sm:p-0">
              <div className="rounded-lg border border-[#f1f5f9] bg-[#f8fafc] p-2 sm:p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#94a3b8]">Ultima Visita</div>
                <div className="mt-1 text-[15px] font-bold text-[#0f172a]">{selectedPatient.ultimaVisita || '-'}</div>
              </div>
              <div className="rounded-lg border border-[#f1f5f9] bg-[#f8fafc] p-2 sm:p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#94a3b8]">Proximo Retorno</div>
                <div className="mt-1 text-[15px] font-bold text-[#0f172a]">{selectedPatient.proximoRetorno || '-'}</div>
              </div>
              <div className="rounded-lg border border-[#f1f5f9] bg-[#f8fafc] p-2 sm:p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#94a3b8]">Saldo Devedor</div>
                <div
                  className={`mt-1 text-[15px] font-bold ${selectedPatient.saldoDevedor > 0 ? 'text-[#dc2626]' : 'text-[#0f172a]'}`}
                >
                  {selectedPatient.saldoDevedor > 0
                    ? `R$ ${selectedPatient.saldoDevedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                    : '-'}
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
            <div className="sticky top-0 z-10 flex w-full min-w-0 flex-nowrap items-stretch justify-between gap-0 overflow-x-hidden border-b border-[#e2e8f0] bg-white sm:gap-1">
              {[
                { key: 'atendimento', label: 'Atendimento', title: 'Atendimento', icon: Play },
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

            <div className="p-5">
              {patientDetailTab === 'atendimento' && (
                <div className="space-y-5">
                  {!alertasAnamneseLoading && anamneseAtendimentoInfo.status === 'nova' ? (
                    <div className="rounded-xl border border-[#e2e8f0] border-l-4 border-l-[#6366f1] bg-[#eef2ff] p-4">
                      <div className="flex items-start gap-3">
                        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#6366f1]" strokeWidth={2.25} aria-hidden />
                        <div className="min-w-0">
                          <h4 className="text-[14px] font-bold text-[#0f172a]">Primeira consulta detectada</h4>
                          <p className="mt-1 text-[13px] font-normal leading-snug text-[#64748b]">
                            Recomendamos iniciar com anamnese
                          </p>
                        </div>
                      </div>
                      <div
                        className={`mt-3 flex flex-col gap-2 ${hasConsultasAnteriores ? 'sm:flex-row' : 'items-center justify-center'}`}
                      >
                        <button
                          type="button"
                          onClick={() => onStartAttendance?.(selectedPatient)}
                          className={`flex h-10 items-center justify-center rounded-lg bg-[#00a88e] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#00967f] ${
                            hasConsultasAnteriores ? 'flex-1' : 'w-full max-w-md'
                          }`}
                        >
                          Iniciar com Anamnese
                        </button>
                        {hasConsultasAnteriores ? (
                          <button
                            type="button"
                            onClick={() => onStartAttendance?.(selectedPatient, { initialStep: 2 })}
                            className="flex h-10 flex-1 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white px-4 text-[13px] font-medium text-[#475569] transition-colors hover:border-[#cbd5e1]"
                          >
                            Pular para avaliação
                          </button>
                        ) : null}
                      </div>
                      {hasConsultasAnteriores ? (
                        <p className="mt-1 text-center text-[11px] font-normal text-[#94a3b8]">não recomendado</p>
                      ) : null}
                    </div>
                  ) : null}

                  {anamneseAtendimentoInfo.status === 'recente' ? (
                    <div className="rounded-xl border border-[#e2e8f0] border-l-4 border-l-[#22c55e] bg-[#f0fdf4] p-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#22c55e]" strokeWidth={2.25} aria-hidden />
                        <div className="min-w-0">
                          <h4 className="text-[14px] font-bold text-[#0f172a]">Anamnese em dia</h4>
                          <p className="mt-1 text-[13px] font-normal text-[#64748b]">
                            Última: {formatDataHoraPtBr(anamneseAtendimentoInfo.latest?.dataHora)} ·{' '}
                            {anamneseAtendimentoInfo.latest?.anamneseNome || 'Ficha'}
                          </p>
                        </div>
                      </div>
                      <div
                        className={`mt-3 flex flex-col gap-2 ${hasConsultasAnteriores ? 'sm:flex-row' : 'items-center justify-center'}`}
                      >
                        <button
                          type="button"
                          onClick={() => onStartAttendance?.(selectedPatient)}
                          className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#00a88e] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#00967f] ${
                            hasConsultasAnteriores ? 'flex-1' : 'w-full max-w-md'
                          }`}
                        >
                          <Play className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                          Iniciar Atendimento
                        </button>
                        {hasConsultasAnteriores ? (
                          <button
                            type="button"
                            onClick={() => onStartAttendance?.(selectedPatient, { initialStep: 2 })}
                            className="flex h-10 flex-1 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white px-4 text-[13px] font-medium text-[#475569] transition-colors hover:border-[#cbd5e1]"
                          >
                            Pular para avaliação
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {anamneseAtendimentoInfo.status === 'vencida' ? (
                    <div className="rounded-xl border border-[#e2e8f0] border-l-4 border-l-[#f59e0b] bg-[#fffbeb] p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#f59e0b]" strokeWidth={2.25} aria-hidden />
                        <div className="min-w-0">
                          <h4 className="text-[14px] font-bold text-[#0f172a]">
                            Anamnese vencida (
                            {(() => {
                              const m = monthsSinceDate(anamneseAtendimentoInfo.latest?.dataHora);
                              return m != null ? `${m} meses atrás` : 'há mais de 6 meses';
                            })()}
                            )
                          </h4>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => onStartAttendance?.(selectedPatient)}
                          className="flex h-10 flex-1 items-center justify-center rounded-lg bg-[#00a88e] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#00967f]"
                        >
                          Atualizar Anamnese
                        </button>
                        <button
                          type="button"
                          onClick={() => onStartAttendance?.(selectedPatient)}
                          className="flex h-10 flex-1 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white px-4 text-[13px] font-medium text-[#475569] transition-colors hover:border-[#cbd5e1]"
                        >
                          Iniciar sem atualizar
                        </button>
                      </div>
                    </div>
                  ) : null}

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
                          title={(apiProcedures || [])[0]?.procedimentoNome || (apiProcedures || [])[0]?.nome}
                        >
                          {(apiProcedures || [])[0]?.procedimentoNome || (apiProcedures || [])[0]?.nome || '—'}
                        </div>
                      </div>
                      <div className="rounded-lg border border-[#f1f5f9] bg-[#f8fafc] p-3">
                        <div className="text-[11px] font-medium uppercase tracking-wide text-[#94a3b8]">Próximo retorno</div>
                        <div className="mt-0.5 text-[14px] font-semibold text-[#0f172a]">{selectedPatient.proximoRetorno || '—'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {patientDetailTab === 'prontuario' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h4 className="text-[16px] font-bold text-[#0f172a]">Prontuário eletrônico</h4>
                    {detailLoading ? (
                      <span className="inline-flex items-center gap-2 text-[12px] font-medium text-[#64748b]">
                        <Loader2 className="h-4 w-4 animate-spin text-[#00a88e]" aria-hidden />
                        Carregando procedimentos…
                      </span>
                    ) : null}
                  </div>
                  {!(apiProcedures || []).length ? (
                    <p className="text-center py-10 text-[#94a3b8] text-[14px] font-medium">Nenhum procedimento registrado ainda.</p>
                  ) : (
                    <div className="space-y-3">
                      {(apiProcedures || []).map((proc, idx) => {
                        const rowKey = proc.id != null && proc.id !== '' ? String(proc.id) : `proc-${idx}`;
                        const open = Boolean(prontuarioExpanded[rowKey]);
                        const dataLabel = proc.criadoEm
                          ? new Date(proc.criadoEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                          : '—';
                        const nomeProc = proc.procedimentoNome || proc.nome || 'Procedimento';
                        const fotosProc = galeriaItemsForProcedure(proc);
                        const procId = proc.id ?? proc.procedimentoId;
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
                          <div key={rowKey} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                            <button
                              type="button"
                              onClick={() => toggleProntuarioRow(rowKey)}
                              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#f8fafc]"
                              aria-expanded={open}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2 gap-y-1">
                                  <span className="text-[13px] font-bold text-[#0f172a]">{dataLabel}</span>
                                  <span className="text-[13px] font-bold text-[#0f766e] truncate">{nomeProc}</span>
                                  {proc.profissionalNome ? (
                                    <span className="text-[12px] text-[#64748b] font-medium truncate">· {proc.profissionalNome}</span>
                                  ) : null}
                                </div>
                              </div>
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
                            </button>
                            {open ? (
                              <div className="space-y-4 border-t border-[#e2e8f0] bg-[#fafafa] px-4 py-4">
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
                                    <div className="mb-3 flex items-center gap-2 text-[13px] font-bold text-[#0f172a]">
                                      <FileText className="h-4 w-4 shrink-0 text-[#00a88e]" strokeWidth={2} aria-hidden />
                                      Termo Assinado
                                    </div>
                                    <p className="mb-4 text-[13px] font-medium text-[#64748b]">
                                      <span className="text-[#0f172a]">&quot;{tituloTermoAssinado}&quot;</span>
                                      {' · '}
                                      {formatDataHoraAssinaturaPtBr(emAssinProf || emAssinPac)}
                                    </p>
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
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {patientDetailTab === 'anamnese' && (
                <AnamneseTab pacienteId={selectedPatient.id} />
              )}

              {patientDetailTab === 'galeria' && (
                <div className="space-y-6">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <h4 className="text-[16px] font-bold text-[#0f172a]">Galeria de evolução</h4>
                      {galeriaBackend === 'api' && galeriaSessionsForView.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setModoComparar((prev) => {
                              if (prev) {
                                setCompararSelecionadas({ antes: null, depois: null });
                                setCompararModalOpen(false);
                              }
                              return !prev;
                            });
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[12px] font-bold border-[2px] transition-all ${
                            modoComparar
                              ? 'bg-[#00a88e] text-white border-[#00a88e]'
                              : 'bg-white text-[#00a88e] border-[#00a88e]/40 hover:border-[#00a88e]'
                          }`}
                        >
                          {modoComparar ? '✕ Cancelar comparação' : '⇄ Comparar'}
                        </button>
                      )}
                    </div>
                    {galeriaBackend === 'loading' && selectedPatient?.id ? (
                      <span className="inline-flex items-center gap-2 text-[12px] font-medium text-[#64748b]">
                        <Loader2 className="h-4 w-4 animate-spin text-[#00a88e]" aria-hidden />
                        Sincronizando galeria…
                      </span>
                    ) : galeriaBackend === 'api' ? (
                      <span className="text-[11px] font-bold uppercase tracking-wide text-[#0f766e] bg-[#e6f7f5] border border-[#00a88e]/25 px-2 py-1 rounded-lg w-fit">
                        Galeria no servidor
                      </span>
                    ) : selectedPatient?.id ? (
                      <span className="text-[11px] font-medium text-[#94a3b8] w-fit max-w-md leading-snug">
                        Galeria do servidor indisponível — exibindo fotos locais da jornada, se houver.
                      </span>
                    ) : null}
                  </div>

                  {galeriaBackend === 'api' && selectedPatient?.id && galeriaBackend !== 'loading' ? (
                    <>
                      <div className="rounded-2xl border border-app-border bg-[#f8fbfb] p-4 space-y-3">
                        <div className="flex items-center gap-2 text-[12px] font-bold text-[#0f766e]">
                          <Filter className="w-4 h-4 shrink-0" strokeWidth={2.5} aria-hidden />
                          Filtrar visualização
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                          <label className="flex flex-col gap-1 min-w-[140px] flex-1">
                            <span className="text-[11px] font-bold text-[#64748b]">Categoria</span>
                            <select
                              value={galeriaFilterCategoria}
                              onChange={(e) => setGaleriaFilterCategoria(e.target.value)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-[#0f172a] outline-none focus:border-[#00a88e]"
                            >
                              <option value="all">Todas</option>
                              <option value="antes">{GALERIA_CATEGORIA_LABELS.antes}</option>
                              <option value="planejamento">{GALERIA_CATEGORIA_LABELS.planejamento}</option>
                              <option value="avaliacao">{GALERIA_CATEGORIA_LABELS.avaliacao}</option>
                              <option value="depois">{GALERIA_CATEGORIA_LABELS.depois}</option>
                              <option value="outro">{GALERIA_CATEGORIA_LABELS.outro}</option>
                            </select>
                          </label>
                          <label className="flex flex-col gap-1 min-w-[160px] flex-1">
                            <span className="text-[11px] font-bold text-[#64748b]">Mês</span>
                            <select
                              value={galeriaFilterMes}
                              onChange={(e) => setGaleriaFilterMes(e.target.value)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-[#0f172a] outline-none focus:border-[#00a88e]"
                            >
                              <option value="all">Todos</option>
                              {galeriaMesesOpcoes.map((m) => (
                                <option key={m} value={m}>
                                  {new Date(`${m}-01T12:00:00`).toLocaleDateString('pt-BR', {
                                    month: 'long',
                                    year: 'numeric',
                                  })}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="flex flex-col gap-1 min-w-[180px] flex-[1.2]">
                            <span className="text-[11px] font-bold text-[#64748b]">Procedimento / texto</span>
                            <select
                              value={galeriaFilterProcedimento}
                              onChange={(e) => setGaleriaFilterProcedimento(e.target.value)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-[#0f172a] outline-none focus:border-[#00a88e]"
                            >
                              <option value="all">Todos</option>
                              {galeriaProcedimentosOpcoes.map((p) => (
                                <option key={p} value={p}>
                                  {p.length > 48 ? `${p.slice(0, 48)}…` : p}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    </>
                  ) : null}

                  {modoComparar && (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#fffbeb] border-[2px] border-[#f59e0b]/40 text-[13px] font-medium text-[#b45309]">
                      <span>
                        {!compararSelecionadas.antes && !compararSelecionadas.depois
                          ? 'Clique em uma foto de Antes e uma foto de Depois para comparar.'
                          : !compararSelecionadas.antes
                          ? '✓ Depois selecionado — agora clique em uma foto de Antes.'
                          : !compararSelecionadas.depois
                          ? '✓ Antes selecionado — agora clique em uma foto de Depois.'
                          : 'Abrindo comparação…'}
                      </span>
                    </div>
                  )}

                  {galeriaBackend === 'api' && galeriaSessionsForView.length > 0 ? (
                    <div className="space-y-4">
                      {galeriaSessionsForView.map((sess, idx) => {
                        const procedimentoFeitoIdSessao = resolveProcedimentoFeitoIdForSessao(sess);
                        const expandida = sessoesExpandidas[sess.key] ?? false;
                        return (
                          <div
                            key={sess.key}
                            className="rounded-[20px] border border-slate-200 bg-white shadow-app-card overflow-hidden"
                          >
                            <div
                              className="flex items-center justify-between cursor-pointer select-none p-4 hover:bg-[#f8fafc] transition-colors rounded-xl"
                              onClick={() => toggleSessao(sess.key)}
                            >
                              <div>
                                <div className="text-[14px] font-bold text-[#0f172a]">
                                  Sessão {galeriaSessionsForView.length - idx} — {formatMesAno(sess.dataISO)}
                                </div>
                                <div className="text-[12px] text-[#64748b] mt-0.5">
                                  {sess.nomeProcedimento || 'Procedimento não informado'} · {sess.fotos.length}{' '}
                                  foto(s)
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[11px] font-medium text-[#94a3b8]">
                                  {expandida ? 'Recolher' : 'Ver fotos'}
                                </span>
                                <ChevronDown
                                  className={`w-4 h-4 text-[#94a3b8] transition-transform duration-200 ${
                                    expandida ? 'rotate-180' : ''
                                  }`}
                                  strokeWidth={2}
                                />
                              </div>
                            </div>
                            <div className="flex flex-col gap-2 px-4 pb-3 sm:flex-row sm:items-center sm:justify-between">
                              <span className="text-[12px] font-bold text-[#64748b] tabular-nums">
                                {formatDataSessaoPtBr(sess.dataISO)}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRelatoModal({
                                    open: true,
                                    procedimentoFeitoId: procedimentoFeitoIdSessao,
                                    pacienteId: selectedPatient?.id || null,
                                  });
                                }}
                                disabled={!selectedPatient?.id}
                                className="w-full rounded-lg border-[2px] border-[#00a88e]/30 bg-[#e6f7f5] px-2.5 py-1 text-center text-[11px] font-bold text-[#0f766e] transition-colors hover:bg-[#d2f3ee] sm:w-auto disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Acompanhamento
                              </button>
                            </div>
                            {expandida && (
                              <div className="px-4 pb-4">
                                <div className="space-y-2">
                                  {(() => {
                                    const fotosPorCategoria = {};
                                    sess.fotos.forEach((foto) => {
                                      const cat = foto.categoria || 'outro';
                                      if (!fotosPorCategoria[cat]) fotosPorCategoria[cat] = [];
                                      fotosPorCategoria[cat].push(foto);
                                    });
                                    return ORDEM_CATEGORIAS.map((cat) => {
                                      const fotosCat = fotosPorCategoria[cat];
                                      if (!fotosCat?.length) return null;
                                      const labelText = GALERIA_CATEGORIA_LABELS[cat] || cat;
                                      const labelColorClass =
                                        GALERIA_SESSAO_CATEGORIA_LABEL_CLASS[cat] || 'text-[#94a3b8]';
                                      const catKey = `${sess.key}_${cat}`;
                                      const catExpandida = categoriasExpandidas[catKey] ?? false;
                                      return (
                                        <div
                                          key={cat}
                                          className="rounded-xl border border-slate-200 overflow-hidden"
                                        >
                                          <div className="w-full flex items-center justify-between px-4 py-3 bg-[#f8fafc]">
                                            <button
                                              type="button"
                                              onClick={() => toggleCategoria(sess.key, cat)}
                                              className="flex items-center gap-2 flex-1 text-left hover:opacity-80 transition-opacity"
                                            >
                                              <span className={`text-[12px] font-bold uppercase tracking-wide ${labelColorClass}`}>
                                                {labelText}
                                              </span>
                                              <span className="text-[11px] font-medium text-[#94a3b8]">
                                                {fotosCat.length} foto{fotosCat.length !== 1 ? 's' : ''}
                                              </span>
                                            </button>
                                            <div className="flex items-center gap-2">
                                              {catExpandida && (
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    const editKey = `${sess.key}_${cat}`;
                                                    setCategoriasEmEdicao((prev) => ({
                                                      ...prev,
                                                      [editKey]: !prev[editKey],
                                                    }));
                                                  }}
                                                  className={`p-1.5 rounded-lg border-[2px] transition-all ${
                                                    categoriasEmEdicao[`${sess.key}_${cat}`]
                                                      ? 'bg-red-50 border-red-300 text-red-500'
                                                      : 'bg-white border-[#e2e8f0] text-[#94a3b8] hover:border-[#00a88e] hover:text-[#00a88e]'
                                                  }`}
                                                  title={categoriasEmEdicao[`${sess.key}_${cat}`] ? 'Sair da edição' : 'Editar fotos'}
                                                >
                                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24"
                                                    fill="none" stroke="currentColor" strokeWidth="2.5">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                  </svg>
                                                </button>
                                              )}
                                              <ChevronDown
                                                className={`w-4 h-4 text-[#94a3b8] transition-transform duration-200 ${
                                                  catExpandida ? 'rotate-180' : ''
                                                }`}
                                                strokeWidth={2}
                                                onClick={() => toggleCategoria(sess.key, cat)}
                                              />
                                            </div>
                                          </div>
                                          {catExpandida && (
                                            <div className="p-3">
                                              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
                                                {fotosCat.map((foto) => {
                                                  const gridItem = {
                                                    id: `api_${foto.serverId}`,
                                                    url: foto.url,
                                                    fileName: foto.fileName,
                                                    serverId: foto.serverId,
                                                    source: 'api',
                                                    index: -1,
                                                  };
                                                  return (
                                                    <div key={foto.serverId} className="relative min-w-0">
                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          if (modoComparar) {
                                                            handleCompararFotoClick(foto);
                                                          } else {
                                                            setLightboxUrl(foto.url ?? foto.src ?? foto.presignedUrl);
                                                          }
                                                        }}
                                                        className={`aspect-square w-full rounded-xl overflow-hidden border cursor-pointer flex items-center justify-center transition-all ${
                                                          modoComparar &&
                                                          (compararSelecionadas.antes?.serverId === foto.serverId ||
                                                            compararSelecionadas.depois?.serverId === foto.serverId)
                                                            ? 'border border-[#00a88e] ring-2 ring-[#00a88e]/40'
                                                            : 'border border-[#e2e8f0]'
                                                        }`}
                                                      >
                                                        <GaleriaArquivoImage
                                                          url={foto.url}
                                                          alt=""
                                                          className="h-full w-full"
                                                          imgClassName="h-full w-full object-cover"
                                                        />
                                                      </button>
                                                      {categoriasEmEdicao[`${sess.key}_${cat}`] && (
                                                        <button
                                                          type="button"
                                                          onClick={() => handleRemoveGalleryItem(gridItem)}
                                                          className="absolute -top-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full border-[2px] border-white bg-red-500 text-[11px] font-bold text-white shadow-sm hover:bg-red-600"
                                                          aria-label="Remover foto"
                                                        >
                                                          ×
                                                        </button>
                                                      )}
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    });
                                  })()}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : galeriaBackend === 'api' && apiGaleriaItems.length > 0 && galeriaSessionsForView.length === 0 ? (
                    <p className="text-center py-8 text-[#94a3b8] text-[13px] font-medium px-2">
                      Nenhuma foto com estes filtros. Ajuste categoria, mês ou procedimento.
                    </p>
                  ) : galeriaBackend === 'api' && apiGaleriaItems.length === 0 ? (
                    <p className="text-center py-8 text-[#94a3b8] text-[14px]">Nenhuma foto registrada</p>
                  ) : galleryItemsForGrid.length ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {galleryItemsForGrid.map((item) => {
                        const canDelete =
                          item.source === 'api' || (item.source !== 'legacy' && item.index >= 0);
                        return (
                          <div key={item.id} className="relative">
                            <button
                              type="button"
                              onClick={() =>
                                setGalleryPreview({
                                  url: item.url,
                                  authFetch: item.source === 'api',
                                  caption: item.fileName,
                                })
                              }
                              className="aspect-square rounded-xl bg-[#e6f7f5] border border-app-border flex items-center justify-center overflow-hidden w-full"
                            >
                              {item.source === 'api' ? (
                                <GaleriaArquivoImage
                                  url={item.url}
                                  alt=""
                                  className="w-full h-full"
                                  imgClassName="w-full h-full object-cover"
                                />
                              ) : (
                                <GaleriaLocalImage
                                  url={item.url}
                                  alt=""
                                  imgClassName="w-full h-full object-cover"
                                />
                              )}
                            </button>
                            {canDelete ? (
                              <button
                                type="button"
                                onClick={() => handleRemoveGalleryItem(item)}
                                className="absolute top-1 right-1 w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 text-white border-[2px] border-white text-[11px] font-bold"
                              >
                                x
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-center py-8 text-[#94a3b8] text-[14px]">Nenhuma foto registrada</p>
                  )}

                  {compararModalOpen && compararSelecionadas.antes && compararSelecionadas.depois && (
                    <div
                      className="fixed inset-0 z-[300] bg-black/90 flex flex-col items-center justify-center p-4 gap-4"
                      onClick={() => {
                        setCompararModalOpen(false);
                        setCompararSelecionadas({ antes: null, depois: null });
                        setModoComparar(false);
                      }}
                    >
                      <div
                        className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-5xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                          <span className="text-[12px] font-bold uppercase tracking-wide text-[#00a88e] bg-[#00a88e]/20 px-3 py-1 rounded-full">
                            Antes
                          </span>
                          <img
                            src={compararSelecionadas.antes.url}
                            alt="Antes"
                            className="max-h-[75dvh] max-w-full rounded-xl object-contain"
                          />
                        </div>
                        <div className="w-px h-full bg-white/20 hidden sm:block" />
                        <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                          <span className="text-[12px] font-bold uppercase tracking-wide text-[#f59e0b] bg-[#f59e0b]/20 px-3 py-1 rounded-full">
                            Depois
                          </span>
                          <img
                            src={compararSelecionadas.depois.url}
                            alt="Depois"
                            className="max-h-[75dvh] max-w-full rounded-xl object-contain"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCompararModalOpen(false);
                          setCompararSelecionadas({ antes: null, depois: null });
                          setModoComparar(false);
                        }}
                        className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-[13px] border border-white/20 transition-all"
                      >
                        Fechar comparação
                      </button>
                    </div>
                  )}

                  {lightboxUrl && (
                    <div
                      className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4"
                      onClick={() => setLightboxUrl(null)}
                      role="presentation"
                    >
                      <img
                        src={lightboxUrl}
                        alt=""
                        className="max-h-[90dvh] max-w-full rounded-xl object-contain"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        type="button"
                        onClick={() => setLightboxUrl(null)}
                        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30"
                        aria-label="Fechar"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-1">
          <div className="overflow-hidden rounded-xl border border-[#fecaca] shadow-sm">
            <div className="flex items-center gap-2 bg-[#fef2f2] px-4 py-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-[#dc2626]" strokeWidth={2.5} aria-hidden />
              <h5 className="text-[13px] font-bold text-[#dc2626]">Alertas</h5>
            </div>
            <div className="space-y-2 bg-white p-3">
              {alertasAnamneseLoading ? (
                <div className="flex items-center gap-2 text-[13px] font-medium text-[#64748b]">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#dc2626]" aria-hidden />
                  Carregando alertas da anamnese…
                </div>
              ) : alertasAnamnese.length === 0 ? (
                <p className="text-[13px] font-medium leading-snug text-[#64748b]">
                  Nenhuma pergunta em alerta nas anamneses preenchidas.
                </p>
              ) : (
                <>
                  {alertasAlergia.length > 0 ? (
                    <div className="mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-[#dc2626]">
                        Alergias registradas
                      </span>
                      {alertasAlergia.map((item) => (
                        <div
                          key={item.key}
                          className="mt-1 rounded-lg border border-[#fecaca] bg-[#fef2f2] p-2"
                        >
                          <p className="text-[11px] font-bold text-[#dc2626]">{item.titulo}</p>
                          <p className="text-[13px] font-semibold text-[#0f172a]">{item.valor}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {alertasSidebarGeral.slice(0, 3).map((row) => (
                    <div key={row.key} className="rounded-lg border border-[#fecaca] bg-[#fef2f2]/50 p-2.5">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-[#dc2626]">{row.titulo}</p>
                      <p className="mt-0.5 break-words text-[13px] font-semibold text-[#0f172a]">{row.valor}</p>
                    </div>
                  ))}
                  {alertasAnamnese.length > 3 ? (
                    <button
                      type="button"
                      onClick={() => setAlertasModalOpen(true)}
                      className="mt-2 flex h-8 w-full items-center justify-center rounded-lg border border-[#fecaca] text-[12px] font-semibold text-[#dc2626] transition-colors hover:bg-[#fef2f2]"
                    >
                      Ver todos ({alertasAnamnese.length})
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#fed7aa] shadow-sm">
            <div className="bg-[#fff7ed] px-4 py-2.5">
              <h5 className="text-[13px] font-bold text-[#ea580c]">Avisos</h5>
            </div>
            <div className="space-y-2 bg-white p-3">
              <div className="rounded-lg border border-[#fed7aa] bg-[#fffbeb] p-2.5 text-[13px] font-medium text-[#92400e]">
                {birthAlert ? (
                  <p className="flex items-center gap-1.5">
                    <Bell className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
                    {birthdayAlertSidebarCopy(birthAlert)}
                  </p>
                ) : (
                  <p>Cadastre a data de nascimento para ver quantos dias faltam para o aniversário.</p>
                )}
              </div>
              {selectedPatient.saldoDevedor > 0 ? (
                <div className="rounded-lg border border-[#fed7aa] bg-[#fffbeb] p-2.5 text-[13px] font-medium text-[#92400e]">
                  <p className="flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
                    Parcela vence em 7 dias
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#e2e8f0] shadow-sm">
            <div className="flex items-center gap-2 bg-[#f8fafc] px-4 py-2.5">
              <StickyNote className="h-4 w-4 shrink-0 text-[#00a88e]" strokeWidth={2.25} aria-hidden />
              <h5 className="text-[13px] font-bold text-[#0f172a]">Notas Rápidas</h5>
            </div>
            <div className="space-y-2 bg-white p-3">
              <textarea
                value={quickNoteText}
                onChange={(e) => setQuickNoteText(e.target.value)}
                rows={3}
                placeholder="Escreva uma nota rápida..."
                className="w-full resize-none rounded-lg border border-[#e2e8f0] p-3 text-[13px] font-medium text-[#0f172a] outline-none focus:border-[#00a88e]/40 focus:ring-2 focus:ring-[#00a88e]/10"
              />
              <button
                type="button"
                onClick={handleAddQuickNote}
                disabled={!quickNoteText.trim()}
                className="mt-2 flex h-9 w-full items-center justify-center rounded-lg bg-[#00a88e] text-[13px] font-semibold text-white transition-colors hover:bg-[#00967f] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Adicionar nota rápida
              </button>
              <div className="space-y-2 pt-1">
                {displayNotes.length ? (
                  displayNotes.map((nota, i) => (
                    <div key={nota.id || i} className="rounded-lg border border-[#f1f5f9] bg-[#f8fafc] p-2.5">
                      <p className="text-[13px] text-[#0f172a]">{nota.texto}</p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-[#94a3b8]">
                          {nota.autor}
                          {nota._fromApi ? ' · servidor' : ''}
                        </span>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-[11px] text-[#94a3b8]">{nota.data}</span>
                          {nota._fromApi ? (
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
                  <p className="text-[13px] text-[#94a3b8]">Nenhuma nota registrada</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

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
            {galleryPreview.authFetch ? (
              <GaleriaArquivoLightbox url={galleryPreview.url} alt={galleryPreview.caption || 'Preview da foto'} />
            ) : (
              <img
                src={galleryPreview.url}
                alt={galleryPreview.caption || 'Preview da foto'}
                className="max-w-[90vw] max-h-[85vh] rounded-xl border border-white/30 object-contain"
              />
            )}
          </div>
        </div>
      )}

      <RelatoAcompanhamentoModal
        isOpen={relatoModal.open}
        onClose={closeRelatoModal}
        procedimentoFeitoId={relatoModal.procedimentoFeitoId}
        pacienteId={relatoModal.pacienteId}
        procedures={apiProcedures}
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

