import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bell,
  Camera,
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
} from '../../services/api';
import { useToast } from '../../contexts/useToast.js';
import { mapBackendPatient, mergePacienteDtoWithEditing } from '../../utils/patientMapping';
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
  formatGaleriaLegendaForUpload,
  filterGaleriaItemsForUi,
  groupGaleriaItemsBySession,
  GALERIA_CATEGORIA_LABELS,
  GALERIA_CATEGORIA,
  itemMesReferenciaISO,
  formatDataSessaoPtBr,
  formatMesAnoCurtoPt,
} from '../../utils/pacienteGaleria.js';
import {
  GaleriaArquivoImage,
  GaleriaArquivoLightbox,
  GaleriaLocalImage,
} from './GaleriaArquivoImage.jsx';
import { RelatoAcompanhamentoModal } from '../journey/RelatoAcompanhamentoModal.jsx';

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
  if (resp.respostaBoolean === true) return true;
  if (resp.respostaTexto && resp.respostaTexto.trim() !== '') return true;
  if (resp.perguntaOpcaoId) return true;
  if (Array.isArray(resp.opcoesSelecionadas) && resp.opcoesSelecionadas.length > 0) return true;
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
          <div className="p-4 rounded-xl bg-[#f8fbfb] border-[2px] border-[#e2e8f0]">
            <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wide">Queixa principal</span>
            <p className="text-[13px] text-[#0f172a] mt-1.5 whitespace-pre-wrap">{parsed.queixa}</p>
          </div>
          <div className="p-4 rounded-xl bg-[#f8fbfb] border-[2px] border-[#e2e8f0]">
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
          <div key={an.id} className="border-[3px] border-[#00a88e]/15 rounded-xl overflow-hidden">
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
              <div className="p-4 border-t-[3px] border-[#00a88e]/10 space-y-3">
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
  const [detailLoading, setDetailLoading] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState('');
  const [editing, setEditing] = useState(null);
  /** Preview da galeria: `authFetch` quando a imagem vem da API (precisa X-Org-Id). */
  const [galleryPreview, setGalleryPreview] = useState(null);
  const [quickNoteText, setQuickNoteText] = useState('');
  const [galleryCameraOpen, setGalleryCameraOpen] = useState(false);
  const [galleryCameraError, setGalleryCameraError] = useState('');
  const [galleryCameraStarting, setGalleryCameraStarting] = useState(false);
  const [galleryVideoReady, setGalleryVideoReady] = useState(false);
  /** 'loading' | 'api' = lista no servidor; 'local' = fallback (fotos da jornada / legado). */
  const [galeriaBackend, setGaleriaBackend] = useState('loading');
  const [apiGaleriaItems, setApiGaleriaItems] = useState([]);
  const [galeriaFilterCategoria, setGaleriaFilterCategoria] = useState('all');
  const [galeriaFilterMes, setGaleriaFilterMes] = useState('all');
  const [galeriaFilterProcedimento, setGaleriaFilterProcedimento] = useState('all');
  const [galeriaUploadCategoria, setGaleriaUploadCategoria] = useState(GALERIA_CATEGORIA.ANTES);
  const [galeriaUploadDataRef, setGaleriaUploadDataRef] = useState(() => new Date().toISOString().slice(0, 10));
  const [galeriaUploadProcedimentoId, setGaleriaUploadProcedimentoId] = useState('');
  const [galeriaUploadDescricao, setGaleriaUploadDescricao] = useState('');
  /** Painel de metadados do upload: só abre ao iniciar envio (galeria API). */
  const [galeriaUploadMetaOpen, setGaleriaUploadMetaOpen] = useState(false);
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
  const galleryVideoRef = useRef(null);
  const galleryStreamRef = useRef(null);
  const profilePhotoInputRef = useRef(null);

  useEffect(() => {
    setGaleriaFilterCategoria('all');
    setGaleriaFilterMes('all');
    setGaleriaFilterProcedimento('all');
    setGaleriaUploadCategoria(GALERIA_CATEGORIA.ANTES);
    setGaleriaUploadDataRef(new Date().toISOString().slice(0, 10));
    setGaleriaUploadProcedimentoId('');
    setGaleriaUploadDescricao('');
    setGaleriaUploadMetaOpen(false);
    setAnamneseListSummary([]);
    setProntuarioExpanded({});
    setRelatoModal({ open: false, procedimentoFeitoId: null, pacienteId: null });
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


  const createEditDraft = () => ({
    nome: patient.nome || '',
    email: patient.email || '',
    telefone: patient.telefone || '',
    profissao: patient.profissao || '',
    endereco: patient.endereco || '',
    alergias: patient.alergias || '',
    condicoesSaude: patient.condicoesSaude || '',
    medicamentos: Array.isArray(patient.medicamentos)
      ? patient.medicamentos.join(', ')
      : '',
  });

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

  const buildGaleriaUploadApiOptions = useCallback(() => {
    const opt = {
      roleUserId,
      dataReferencia: galeriaUploadDataRef || undefined,
      legenda: formatGaleriaLegendaForUpload(galeriaUploadCategoria, galeriaUploadDescricao),
    };
    const procId = String(galeriaUploadProcedimentoId || '').trim();
    if (procId) opt.procedimentoFeitoId = procId;
    return opt;
  }, [roleUserId, galeriaUploadDataRef, galeriaUploadCategoria, galeriaUploadDescricao, galeriaUploadProcedimentoId]);

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
        const [dtoResult, notasResult, procResult] = await Promise.allSettled([
          pacientesApi.get(id),
          notasApi.list(id),
          procedimentosApi.byPaciente(id),
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
        setApiNotes(Array.isArray(notasList) ? notasList : []);
        setApiProcedures(Array.isArray(procList) ? procList : []);
      } catch {
        if (!cancelled) {
          setApiNotes([]);
          setApiProcedures([]);
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
        const pairs = await Promise.all(
          arr.map((an) =>
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
                key: `${an.id}-${pidA}`,
                titulo: textoPerguntaResposta(resp),
                valor: renderRespostaValue(resp),
                fichaNome: nome,
                dataHora: an.dataHora,
                ts,
              });
            }
            if (!isRespostaPrioridadeAlerta(resp)) return;
            const pid = resp.id ?? getPerguntaIdFromResp(resp) ?? rIdx;
            itemsGeral.push({
              key: `${an.id}-${pid}`,
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
        if (alergiasDetectadas.length > 0 && pacienteId) {
          const alergiasTexto = alergiasDetectadas.join(' · ');
          mergePatientById?.(pacienteId, (prev) => ({
            ...prev,
            alergias: alergiasTexto,
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
        telefone: editing?.telefone || '',
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
      const payload = mergePacienteDtoWithEditing(dto, editing);
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

  const handleUploadGalleryFiles = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const fileArr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    event.target.value = '';
    if (fileArr.length === 0) return;

    if (selectedPatient?.id && galeriaBackend === 'api') {
      try {
        const slice = fileArr.slice(0, 30);
        let mergedSingle = false;
        for (const file of slice) {
          const created = await pacientesGaleriaApi.upload(selectedPatient.id, file, buildGaleriaUploadApiOptions());
          if (slice.length === 1) {
            const one = normalizePacienteGaleriaItem(created);
            if (one) {
              setApiGaleriaItems((prev) => [one, ...prev.filter((x) => x.serverId !== one.serverId)]);
              mergedSingle = true;
            }
          }
        }
        if (!mergedSingle) {
          if (import.meta.env.DEV) {
            console.log('listando galeria para pacienteId:', selectedPatient?.id);
          }
          const data = await pacientesGaleriaApi.list(selectedPatient.id);
          setApiGaleriaItems(normalizePacienteGaleriaResponse(data));
        }
        toast.success(
          fileArr.length === 1 ? 'Foto enviada para a galeria.' : 'Fotos enviadas para a galeria.',
        );
        setGaleriaUploadMetaOpen(false);
      } catch (e) {
        toast.error(formatPacienteGaleriaError(e));
      }
      return;
    }

    onAddGalleryFiles?.(selectedPatient.cpf, fileArr);
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

  const stopGalleryCamera = () => {
    try {
      const stream = galleryStreamRef.current;
      if (stream) stream.getTracks().forEach((track) => track.stop());
    } catch {
      // ignore
    } finally {
      galleryStreamRef.current = null;
      setGalleryVideoReady(false);
      if (galleryVideoRef.current) {
        galleryVideoRef.current.srcObject = null;
      }
    }
  };

  const startGalleryCamera = async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      setGalleryCameraError('Seu navegador não suporta câmera.');
      return;
    }

    setGalleryCameraError('');
    setGalleryCameraStarting(true);
    stopGalleryCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      galleryStreamRef.current = stream;
      if (galleryVideoRef.current) {
        galleryVideoRef.current.srcObject = stream;
        await galleryVideoRef.current.play();
      }
      setGalleryVideoReady(true);
    } catch (error) {
      setGalleryCameraError(
        error?.name === 'NotAllowedError'
          ? 'Permissão da câmera negada. Libere o acesso no navegador.'
          : 'Não foi possível iniciar a câmera.'
      );
    } finally {
      setGalleryCameraStarting(false);
    }
  };

  const openGalleryCamera = () => {
    setGalleryCameraOpen(true);
  };

  const closeGalleryCamera = () => {
    setGalleryCameraOpen(false);
    setGalleryCameraError('');
    stopGalleryCamera();
  };

  const captureGalleryPhoto = async () => {
    const video = galleryVideoRef.current;
    if (!video || !galleryVideoReady) return;

    const canvas = document.createElement('canvas');
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    const blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92));
    if (!blob) return;

    const file = new File([blob], `galeria_${Date.now()}.jpg`, { type: 'image/jpeg' });

    if (selectedPatient?.id && galeriaBackend === 'api') {
      try {
        const created = await pacientesGaleriaApi.upload(selectedPatient.id, file, buildGaleriaUploadApiOptions());
        const one = normalizePacienteGaleriaItem(created);
        if (one) {
          setApiGaleriaItems((prev) => [one, ...prev.filter((x) => x.serverId !== one.serverId)]);
        } else {
          if (import.meta.env.DEV) {
            console.log('listando galeria para pacienteId:', selectedPatient?.id);
          }
          const data = await pacientesGaleriaApi.list(selectedPatient.id);
          setApiGaleriaItems(normalizePacienteGaleriaResponse(data));
        }
        toast.success('Foto adicionada à galeria.');
      } catch (e) {
        toast.error(formatPacienteGaleriaError(e));
      }
      closeGalleryCamera();
      return;
    }

    onAddGalleryFiles?.(selectedPatient.cpf, [file]);
    closeGalleryCamera();
  };

  useEffect(() => {
    if (!galleryCameraOpen) return;
    startGalleryCamera().catch(() => {});
    return () => {
      stopGalleryCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galleryCameraOpen]);

  if (!selectedPatient) return null;

  return (
    <div className="flex flex-col gap-5">
      {detailLoading && (
        <div className="flex items-center gap-2 text-[#64748b] text-[13px] font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-[#00a88e]" /> Sincronizando com o servidor...
        </div>
      )}
      {profileSaveError ? (
        <div className="p-3 rounded-xl border-[3px] border-red-200 bg-red-50 text-red-700 text-[13px] font-bold">
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
              <div className="mt-5 p-4 border-[3px] border-[#00a88e]/20 rounded-2xl bg-[#f8fbfb]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input value={editing?.nome || ''} onChange={(e) => setEditing((p) => ({ ...p, nome: e.target.value }))} className="rounded-xl border-[2px] border-[#00a88e]/20 px-3 py-2 text-[16px] sm:text-[14px]" placeholder="Nome" />
                  <input value={editing?.email || ''} onChange={(e) => setEditing((p) => ({ ...p, email: e.target.value }))} className="rounded-xl border-[2px] border-[#00a88e]/20 px-3 py-2 text-[16px] sm:text-[14px]" placeholder="E-mail" />
                  <input value={editing?.telefone || ''} onChange={(e) => setEditing((p) => ({ ...p, telefone: e.target.value }))} className="rounded-xl border-[2px] border-[#00a88e]/20 px-3 py-2 text-[16px] sm:text-[14px]" placeholder="Telefone" />
                  <input value={editing?.profissao || ''} onChange={(e) => setEditing((p) => ({ ...p, profissao: e.target.value }))} className="rounded-xl border-[2px] border-[#00a88e]/20 px-3 py-2 text-[16px] sm:text-[14px]" placeholder="Profissao" />
                  <div className="md:col-span-2">
                    <label className="text-[12px] font-bold text-[#475569] mb-1 block">Endereço</label>
                    <input
                      type="text"
                      value={editing?.endereco || ''}
                      onChange={(e) => setEditing((d) => ({ ...d, endereco: e.target.value }))}
                      placeholder="Rua, número, bairro, cidade - UF"
                      className="w-full rounded-xl border-[2px] border-[#e2e8f0] px-4 py-2 text-[16px] outline-none focus:border-[#00a88e] sm:text-[13px]"
                    />
                  </div>
                  <input value={editing?.alergias || ''} onChange={(e) => setEditing((p) => ({ ...p, alergias: e.target.value }))} className="rounded-xl border-[2px] border-[#00a88e]/20 px-3 py-2 text-[16px] sm:text-[14px] md:col-span-2" placeholder="Alergias" />
                  <input value={editing?.condicoesSaude || ''} onChange={(e) => setEditing((p) => ({ ...p, condicoesSaude: e.target.value }))} className="rounded-xl border-[2px] border-[#00a88e]/20 px-3 py-2 text-[16px] sm:text-[14px] md:col-span-2" placeholder="Condicoes de saude" />
                  <input value={editing?.medicamentos || ''} onChange={(e) => setEditing((p) => ({ ...p, medicamentos: e.target.value }))} className="rounded-xl border-[2px] border-[#00a88e]/20 px-3 py-2 text-[16px] sm:text-[14px] md:col-span-2" placeholder="Medicamentos (separe por virgula)" />
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button type="button" onClick={saveEditProfile} className="px-4 py-2 rounded-xl bg-[#00a88e] text-white font-bold text-[13px] border-[2px] border-transparent"><Save className="w-4 h-4 inline mr-1" />Salvar</button>
                  <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl bg-white text-[#475569] font-bold text-[13px] border-[2px] border-[#e2e8f0]"><X className="w-4 h-4 inline mr-1" />Cancelar</button>
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
                  {anamneseAtendimentoInfo.status === 'nova' ? (
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
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => setPatientDetailTab('anamnese')}
                          className="flex h-10 flex-1 items-center justify-center rounded-lg bg-[#00a88e] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#00967f]"
                        >
                          Iniciar com Anamnese
                        </button>
                        <button
                          type="button"
                          onClick={() => onStartAttendance?.(selectedPatient)}
                          className="flex h-10 flex-1 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white px-4 text-[13px] font-medium text-[#475569] transition-colors hover:border-[#cbd5e1]"
                        >
                          Pular e ir para Execução
                        </button>
                      </div>
                      <p className="mt-1 text-center text-[11px] font-normal text-[#94a3b8]">não recomendado</p>
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
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => onStartAttendance?.(selectedPatient)}
                          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#00a88e] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#00967f]"
                        >
                          <Play className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                          Iniciar Atendimento
                        </button>
                        <button
                          type="button"
                          onClick={() => setPatientDetailTab('anamnese')}
                          className="flex h-10 flex-1 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white px-4 text-[13px] font-medium text-[#475569] transition-colors hover:border-[#cbd5e1]"
                        >
                          Ver/Atualizar Anamnese
                        </button>
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
                          onClick={() => setPatientDetailTab('anamnese')}
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
                    <h5 className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">Alertas ativos</h5>
                    <div className="flex flex-col gap-2">
                      {String(selectedPatient.alergias || '').trim() ? (
                        <div className="flex items-center gap-2 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] font-medium text-[#dc2626]">
                          Alergias: {String(selectedPatient.alergias).trim()}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 rounded-lg border border-[#f1f5f9] bg-[#f8fafc] px-3 py-2 text-[13px] font-medium text-[#94a3b8]">
                          Nenhuma alergia registrada
                        </div>
                      )}
                      {String(selectedPatient.condicoesSaude || '').trim() ? (
                        <div className="flex items-center gap-2 rounded-lg border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-[13px] font-medium text-[#ea580c]">
                          Condições de saúde: {String(selectedPatient.condicoesSaude).trim()}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 rounded-lg border border-[#f1f5f9] bg-[#f8fafc] px-3 py-2 text-[13px] font-medium text-[#94a3b8]">
                          Nenhuma condição registrada
                        </div>
                      )}
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
                        return (
                          <div key={rowKey} className="rounded-xl border-[2px] border-[#e2e8f0] bg-white overflow-hidden shadow-sm">
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
                                <div className="flex flex-wrap gap-2">
                                  <ModuloFuturoBadge>Cadastro de produtos em breve</ModuloFuturoBadge>
                                  <ModuloFuturoBadge>Módulo de assinaturas em breve</ModuloFuturoBadge>
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
                    <h4 className="text-[16px] font-bold text-[#0f172a]">Galeria de evolução</h4>
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
                      <div className="rounded-2xl border-[3px] border-[#00a88e]/15 bg-[#f8fbfb] p-4 space-y-3">
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
                              className="rounded-xl border-[2px] border-[#e2e8f0] bg-white px-3 py-2 text-[13px] font-medium text-[#0f172a] outline-none focus:border-[#00a88e]"
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
                              className="rounded-xl border-[2px] border-[#e2e8f0] bg-white px-3 py-2 text-[13px] font-medium text-[#0f172a] outline-none focus:border-[#00a88e]"
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
                              className="rounded-xl border-[2px] border-[#e2e8f0] bg-white px-3 py-2 text-[13px] font-medium text-[#0f172a] outline-none focus:border-[#00a88e]"
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

                      {galeriaUploadMetaOpen ? (
                        <div className="rounded-2xl border-[3px] border-[#00a88e]/20 bg-white p-4 space-y-3 shadow-sm animate-in fade-in duration-200">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="text-[12px] font-bold text-[#0f172a]">Enviar fotos para a galeria</div>
                              <p className="text-[11px] text-[#64748b] leading-snug mt-0.5">
                                Ajuste categoria, data e procedimento; em seguida escolha as imagens.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setGaleriaUploadMetaOpen(false)}
                              className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
                            >
                              Fechar
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <label className="flex flex-col gap-1">
                              <span className="text-[11px] font-bold text-[#64748b]">Categoria</span>
                              <select
                                value={galeriaUploadCategoria}
                                onChange={(e) => setGaleriaUploadCategoria(e.target.value)}
                                className="rounded-xl border-[2px] border-[#e2e8f0] px-3 py-2 text-[13px] font-medium outline-none focus:border-[#00a88e]"
                              >
                                <option value={GALERIA_CATEGORIA.ANTES}>{GALERIA_CATEGORIA_LABELS.antes}</option>
                                <option value={GALERIA_CATEGORIA.PLANEJAMENTO}>{GALERIA_CATEGORIA_LABELS.planejamento}</option>
                                <option value={GALERIA_CATEGORIA.AVALIACAO}>{GALERIA_CATEGORIA_LABELS.avaliacao}</option>
                                <option value={GALERIA_CATEGORIA.DEPOIS}>{GALERIA_CATEGORIA_LABELS.depois}</option>
                                <option value={GALERIA_CATEGORIA.OUTRO}>{GALERIA_CATEGORIA_LABELS.outro}</option>
                              </select>
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-[11px] font-bold text-[#64748b]">Data da sessão</span>
                              <input
                                type="date"
                                value={galeriaUploadDataRef}
                                onChange={(e) => setGaleriaUploadDataRef(e.target.value)}
                                className="rounded-xl border-[2px] border-[#e2e8f0] px-3 py-2 text-[13px] font-medium outline-none focus:border-[#00a88e]"
                              />
                            </label>
                            <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-2">
                              <span className="text-[11px] font-bold text-[#64748b]">Vincular a procedimento (opcional)</span>
                              <select
                                value={galeriaUploadProcedimentoId}
                                onChange={(e) => setGaleriaUploadProcedimentoId(e.target.value)}
                                className="rounded-xl border-[2px] border-[#e2e8f0] px-3 py-2 text-[13px] font-medium outline-none focus:border-[#00a88e]"
                              >
                                <option value="">Nenhum</option>
                                {(apiProcedures || []).map((proc) => (
                                  <option key={proc.id ?? proc.procedimentoId} value={proc.id ?? proc.procedimentoId}>
                                    {proc.procedimentoNome || proc.nome || 'Procedimento'}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-4">
                              <span className="text-[11px] font-bold text-[#64748b]">Descrição (ex.: nome do procedimento)</span>
                              <input
                                type="text"
                                value={galeriaUploadDescricao}
                                onChange={(e) => setGaleriaUploadDescricao(e.target.value)}
                                placeholder="Ex.: Botox + preenchimento"
                                className="rounded-xl border-[2px] border-[#e2e8f0] px-3 py-2 text-[13px] outline-none focus:border-[#00a88e]"
                              />
                            </label>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <label
                              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#00a88e] px-4 py-2.5 text-[13px] font-bold text-white border-[2px] border-transparent shadow-sm hover:bg-[#00967f]`}
                            >
                              <ImageIcon className="w-4 h-4 shrink-0" />
                              Escolher imagens
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                disabled={galeriaBackend === 'loading' && Boolean(selectedPatient?.id)}
                                onChange={handleUploadGalleryFiles}
                              />
                            </label>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2">
                    {galeriaBackend === 'api' && selectedPatient?.id ? (
                      <button
                        type="button"
                        onClick={() => setGaleriaUploadMetaOpen(true)}
                        disabled={galeriaBackend === 'loading' && Boolean(selectedPatient?.id)}
                        className={`px-3 py-2 rounded-xl bg-[#00a88e] text-white font-bold text-[12px] border-[2px] border-transparent inline-flex items-center gap-1.5 ${
                          galeriaBackend === 'loading' && selectedPatient?.id
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:bg-[#00967f]'
                        }`}
                      >
                        <ImageIcon className="w-4 h-4" /> Upload
                      </button>
                    ) : (
                      <label
                        className={`px-3 py-2 rounded-xl bg-[#00a88e] text-white font-bold text-[12px] border-[2px] border-transparent ${
                          galeriaBackend === 'loading' && selectedPatient?.id ? 'opacity-50 pointer-events-none' : 'cursor-pointer'
                        }`}
                      >
                        <ImageIcon className="w-4 h-4 inline mr-1" /> Upload
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          disabled={galeriaBackend === 'loading' && Boolean(selectedPatient?.id)}
                          onChange={handleUploadGalleryFiles}
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      onClick={openGalleryCamera}
                      disabled={galeriaBackend === 'loading' && Boolean(selectedPatient?.id)}
                      className="px-3 py-2 rounded-xl bg-white text-[#00a88e] font-bold text-[12px] border-[2px] border-[#00a88e]/25 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Camera className="w-4 h-4 inline mr-1" /> Tirar na hora
                    </button>
                  </div>

                  {galeriaBackend === 'api' && galeriaSessionsForView.length > 0 ? (
                    <div className="space-y-4">
                      {galeriaSessionsForView.map((sess) => {
                        const procedimentoFeitoIdSessao = resolveProcedimentoFeitoIdForSessao(sess);
                        const mesTitulo =
                          sess.dataISO === 'sem-data' ? 'Sem data' : formatMesAnoCurtoPt(sess.dataISO);
                        const subtitulo =
                          sess.nomeProcedimento ||
                          sess.fotos.map((f) => f.descricaoLegenda).find(Boolean) ||
                          'Procedimento não informado';
                        return (
                          <div
                            key={sess.key}
                            className="rounded-[20px] border-[3px] border-[#e2e8f0] bg-white p-4 sm:p-5 shadow-md shadow-[#00a88e]/[0.06]"
                          >
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4 mb-4">
                              <div className="min-w-0">
                                <h5 className="text-[15px] font-bold text-[#0f172a]">
                                  Sessão {sess.sessionNumber}
                                  {mesTitulo ? ` — ${mesTitulo}` : ''}
                                </h5>
                                <p className="text-[13px] font-medium text-[#64748b] mt-0.5 line-clamp-2">{subtitulo}</p>
                              </div>
                              <div className="flex w-full min-w-0 items-start gap-2 sm:w-auto sm:shrink-0 sm:flex-col sm:items-end">
                                <span className="text-[12px] font-bold text-[#64748b] tabular-nums sm:pt-0.5">
                                  {formatDataSessaoPtBr(sess.dataISO)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setRelatoModal({
                                      open: true,
                                      procedimentoFeitoId: procedimentoFeitoIdSessao,
                                      pacienteId: selectedPatient?.id || null,
                                    })
                                  }
                                  disabled={!selectedPatient?.id}
                                  className="w-full rounded-lg border-[2px] border-[#00a88e]/30 bg-[#e6f7f5] px-2.5 py-1 text-center text-[11px] font-bold text-[#0f766e] transition-colors hover:bg-[#d2f3ee] sm:w-auto disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Acompanhamento
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-5">
                              {sess.fotos.map((foto) => {
                                const gridItem = {
                                  id: `api_${foto.serverId}`,
                                  url: foto.url,
                                  fileName: foto.fileName,
                                  serverId: foto.serverId,
                                  source: 'api',
                                  index: -1,
                                };
                                const catLabel = GALERIA_CATEGORIA_LABELS[foto.categoria] || foto.categoria;
                                return (
                                  <div key={foto.serverId} className="flex w-[92px] sm:w-[108px] flex-col items-center gap-2">
                                    <div className="relative w-full">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setGalleryPreview({
                                            url: foto.url,
                                            authFetch: true,
                                            caption: foto.legenda || foto.fileName,
                                          })
                                        }
                                        className="aspect-square w-full rounded-xl bg-[#e6f7f5] border-[2px] border-[#00a88e]/15 overflow-hidden flex items-center justify-center"
                                      >
                                        <GaleriaArquivoImage
                                          url={foto.url}
                                          alt=""
                                          className="w-full h-full"
                                          imgClassName="w-full h-full object-cover"
                                        />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveGalleryItem(gridItem)}
                                        className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 text-white border-[2px] border-white text-[11px] font-bold shadow-sm"
                                        aria-label="Remover foto"
                                      >
                                        ×
                                      </button>
                                    </div>
                                    <span className="text-[11px] font-bold text-[#0f766e] text-center leading-tight px-0.5">
                                      {catLabel}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
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
                              className="aspect-square rounded-xl bg-[#e6f7f5] border-[2px] border-[#00a88e]/15 flex items-center justify-center overflow-hidden w-full"
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
            className="relative flex max-h-[min(88dvh,720px)] w-full max-w-lg flex-col rounded-2xl border-[3px] border-red-300 bg-white p-5 shadow-xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setAlertasModalOpen(false)}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl border-[2px] border-[#e2e8f0] text-[#64748b] transition-colors hover:border-red-200 hover:text-red-600"
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
            className="birthday-modal-pop relative w-full max-w-md rounded-2xl border-[3px] border-amber-300 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={dismissBirthdayModal}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl border-[2px] border-[#e2e8f0] text-[#64748b] transition-colors hover:border-[#00a88e]/30 hover:text-[#00a88e]"
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
                className="max-w-[90vw] max-h-[85vh] rounded-xl border-[3px] border-white/30 object-contain"
              />
            )}
          </div>
        </div>
      )}

      {galleryCameraOpen && (
        <div className="fixed inset-0 z-[230] bg-black/70 flex items-center justify-center p-4" onClick={closeGalleryCamera}>
          <div className="relative w-full max-w-[920px] bg-white rounded-2xl border-[3px] border-[#00a88e]/25 shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 flex items-center justify-between border-b-[3px] border-[#00a88e]/15">
              <div className="text-[16px] font-bold text-[#0f172a]">Tirar foto para galeria</div>
              <button type="button" onClick={closeGalleryCamera} className="w-10 h-10 rounded-xl border-[3px] border-transparent hover:bg-[#f8fbfb] text-[#64748b] hover:text-[#00a88e]">
                <X className="w-5 h-5 mx-auto" />
              </button>
            </div>

            <div className="p-4">
              <div className="relative rounded-[16px] overflow-hidden border-[3px] border-[#00a88e]/20 bg-black">
                <video ref={galleryVideoRef} playsInline className="w-full max-h-[70vh] object-contain" />

                {!galleryVideoReady && (
                  <div className="absolute inset-0 flex items-center justify-center text-white text-[14px] font-bold bg-black/35">
                    {galleryCameraStarting ? 'Abrindo câmera...' : 'Carregando câmera...'}
                  </div>
                )}
              </div>

              {galleryCameraError && (
                <div className="mt-3 bg-red-50 text-red-600 border-[3px] border-red-200 rounded-xl p-3 text-[13px] font-bold">
                  {galleryCameraError}
                </div>
              )}

              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={captureGalleryPhoto}
                  disabled={!galleryVideoReady || galleryCameraStarting}
                  className="px-5 py-3 rounded-xl font-bold text-white bg-[#00a88e] disabled:opacity-60 disabled:cursor-not-allowed hover:bg-[#00967f] transition-all border-[3px] border-transparent"
                >
                  <Camera className="w-4 h-4 inline mr-1" /> Capturar e salvar
                </button>

                <button
                  type="button"
                  onClick={closeGalleryCamera}
                  className="px-5 py-3 rounded-xl font-bold text-[#64748b] bg-white hover:bg-[#f8fbfb] transition-all border-[3px] border-[#94a3b8]/30"
                >
                  Cancelar
                </button>
              </div>
            </div>
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

