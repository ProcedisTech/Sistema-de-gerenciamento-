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
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Play,
  Plus,
  Save,
  StickyNote,
  Trash2,
  Upload,
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
} from '../../utils/pacienteGaleria.js';
import {
  GaleriaArquivoImage,
  GaleriaArquivoLightbox,
  GaleriaLocalImage,
} from './GaleriaArquivoImage.jsx';

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
  const [timelineLoading, setTimelineLoading] = useState(false);
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
  const [profilePhotoBusy, setProfilePhotoBusy] = useState(false);
  const [modalProcedimento, setModalProcedimento] = useState(false);
  const [nomeProcedimento, setNomeProcedimento] = useState('');
  const [observacaoProcedimento, setObservacaoProcedimento] = useState('');
  const [salvandoProcedimento, setSalvandoProcedimento] = useState(false);
  const [alertasAnamnese, setAlertasAnamnese] = useState([]);
  const [alertasAnamneseLoading, setAlertasAnamneseLoading] = useState(false);
  const [alertasModalOpen, setAlertasModalOpen] = useState(false);
  const galleryVideoRef = useRef(null);
  const galleryStreamRef = useRef(null);
  const profilePhotoInputRef = useRef(null);

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
      }));
    }
    return capturedPhotos.length > 0 ? capturedPhotos : fallbackGalleryPhotos;
  }, [galeriaBackend, apiGaleriaItems, capturedPhotos, fallbackGalleryPhotos]);

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
    setTimelineLoading(true);
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
          setTimelineLoading(false);
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
      setGaleriaBackend('local');
      setApiGaleriaItems([]);
      return undefined;
    }
    let cancelled = false;
    setGaleriaBackend('loading');
    setApiGaleriaItems([]);
    (async () => {
      try {
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
      setAlertasAnamneseLoading(false);
      return undefined;
    }
    let cancelled = false;
    setAlertasAnamneseLoading(true);
    (async () => {
      try {
        const list = await anamneseApi.listPaciente(pacienteId);
        const arr = Array.isArray(list) ? list : [];
        const pairs = await Promise.all(
          arr.map((an) =>
            anamneseApi
              .getPaciente(pacienteId, an.id)
              .then((det) => ({ an, det }))
              .catch(() => ({ an, det: null }))
          )
        );
        if (cancelled) return;
        const items = [];
        for (const { an, det } of pairs) {
          if (!det || !Array.isArray(det.respostas)) continue;
          const ts = an.dataHora ? new Date(an.dataHora).getTime() : 0;
          const nome = an.anamneseNome || 'Anamnese';
          det.respostas.forEach((resp, rIdx) => {
            if (!isRespostaPrioridadeAlerta(resp)) return;
            const pid = resp.id ?? getPerguntaIdFromResp(resp) ?? rIdx;
            items.push({
              key: `${an.id}-${pid}`,
              titulo: textoPerguntaResposta(resp),
              valor: renderRespostaValue(resp),
              fichaNome: nome,
              dataHora: an.dataHora,
              ts,
            });
          });
        }
        items.sort((a, b) => b.ts - a.ts);
        setAlertasAnamnese(items);
      } catch {
        if (!cancelled) setAlertasAnamnese([]);
      } finally {
        if (!cancelled) setAlertasAnamneseLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedPatient?.id]);

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
          const created = await pacientesGaleriaApi.upload(selectedPatient.id, file, { roleUserId });
          if (slice.length === 1) {
            const one = normalizePacienteGaleriaItem(created);
            if (one) {
              setApiGaleriaItems((prev) => [one, ...prev.filter((x) => x.serverId !== one.serverId)]);
              mergedSingle = true;
            }
          }
        }
        if (!mergedSingle) {
          const data = await pacientesGaleriaApi.list(selectedPatient.id);
          setApiGaleriaItems(normalizePacienteGaleriaResponse(data));
        }
        toast.success(
          fileArr.length === 1 ? 'Foto enviada para a galeria.' : 'Fotos enviadas para a galeria.',
        );
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

  const handleRegistrarProcedimento = async () => {
    if (!nomeProcedimento.trim() || !selectedPatient?.id) return;
    if (!roleUserId || !/^[0-9a-f-]{36}$/i.test(String(roleUserId))) {
      toast.warning(
        'Selecione o profissional na barra de contexto ou faça login com usuário vinculado à equipe para registrar o procedimento.',
      );
      return;
    }
    setSalvandoProcedimento(true);
    try {
      await procedimentosApi.registrarManual(selectedPatient.id, {
        nome: nomeProcedimento.trim(),
        roleUserId,
        observacao: observacaoProcedimento.trim() || null,
      });
      const procList = await procedimentosApi.byPaciente(selectedPatient.id);
      setApiProcedures(Array.isArray(procList) ? procList : []);
      setModalProcedimento(false);
      setNomeProcedimento('');
      setObservacaoProcedimento('');
      toast.success('Procedimento registrado com sucesso.');
    } catch (e) {
      toast.error(e.message || 'Erro ao registrar procedimento.');
    } finally {
      setSalvandoProcedimento(false);
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
        const created = await pacientesGaleriaApi.upload(selectedPatient.id, file, { roleUserId });
        const one = normalizePacienteGaleriaItem(created);
        if (one) {
          setApiGaleriaItems((prev) => [one, ...prev.filter((x) => x.serverId !== one.serverId)]);
        } else {
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
    <div className="flex flex-col gap-6">
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
          setPatientDetailTab('timeline');
        }}
        className="inline-flex items-center gap-2 text-[#00a88e] hover:text-[#00967f] font-bold text-[14px] transition-all w-fit"
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={2.5} /> Voltar para Pacientes
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border-[3px] border-[#00a88e]/20 p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="flex flex-col items-center sm:items-start gap-2 flex-shrink-0">
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
                  className="relative w-[88px] h-[88px] rounded-full border-[3px] border-[#00a88e]/25 bg-[#e6f7f5] overflow-hidden flex items-center justify-center shadow-sm"
                  initialsClassName="text-2xl font-bold"
                  spinnerClassName="w-7 h-7"
                />
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-1 max-w-[120px] sm:max-w-none">
                  <button
                    type="button"
                    onClick={() => profilePhotoInputRef.current?.click()}
                    disabled={profilePhotoBusy}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#00a88e] hover:text-[#00967f] transition-colors disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {profilePhotoBusy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.5} aria-hidden />
                    ) : (
                      <Upload className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden />
                    )}
                    {profilePhotoBusy ? 'Enviando…' : 'Enviar foto'}
                  </button>
                  {profilePhotoDisplayUrl ? (
                    <button
                      type="button"
                      onClick={handleRemoveProfilePhoto}
                      disabled={profilePhotoBusy}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#94a3b8] hover:text-red-600 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden />
                      Remover
                    </button>
                  ) : null}
                </div>
                <p className="text-[10px] text-[#94a3b8] text-center sm:text-left leading-snug max-w-[200px] sm:max-w-[220px]">
                  {selectedPatient?.id
                    ? 'Servidor: JPEG/PNG/WebP até 50 MB; imagem autenticada (cookie). CORS deve incluir a origem do front.'
                    : 'Referência só neste aparelho até o paciente existir na API.'}
                </p>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-[20px] font-bold text-[#0f172a]">{selectedPatient.nome}</h3>
                  <span className="px-3 py-1 bg-[#dcfce7] text-[#16a34a] rounded-full text-[11px] font-bold border-[2px] border-[#16a34a]/20">
                    ATIVO
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 text-[13px] text-[#64748b] font-medium">
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {selectedPatient.idade} anos</span>
                  <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {selectedPatient.cpf}</span>
                  <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {selectedPatient.telefone}</span>
                  <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {selectedPatient.email}</span>
                </div>
                {selectedPatient.endereco ? (
                  <div className="flex items-start gap-2 text-[13px] text-[#64748b] mt-2">
                    <MapPin className="w-4 h-4 text-[#00a88e] shrink-0 mt-0.5" strokeWidth={2.25} aria-hidden />
                    <span className="min-w-0 break-words">{selectedPatient.endereco}</span>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => onStartAttendance?.(selectedPatient)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-[#00a88e] hover:bg-[#00967f] text-white rounded-xl font-bold text-[13px] transition-all border-[3px] border-transparent shadow-md"
                >
                  <Play className="w-4 h-4 inline mr-1.5" strokeWidth={2.5} /> Iniciar Atendimento
                </button>
                <button
                  type="button"
                  onClick={() => setEditing((prev) => (prev ? null : createEditDraft()))}
                  className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-[#f0fdfa] text-[#0f172a] rounded-xl font-bold text-[13px] border-[3px] border-[#e2e8f0] hover:border-[#00a88e]/30 transition-all"
                >
                  <UserIcon className="w-4 h-4 inline mr-1.5" strokeWidth={2.5} /> Editar Cadastro
                </button>
                <button type="button" className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-[#f0fdfa] text-[#0f172a] rounded-xl font-bold text-[13px] border-[3px] border-[#e2e8f0] hover:border-[#00a88e]/30 transition-all" disabled>
                  <Download className="w-4 h-4 inline mr-1.5" strokeWidth={2.5} /> Gerar PDF
                </button>
              </div>
            </div>

            {isEditing && (
              <div className="mt-5 p-4 border-[3px] border-[#00a88e]/20 rounded-2xl bg-[#f8fbfb]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input value={editing?.nome || ''} onChange={(e) => setEditing((p) => ({ ...p, nome: e.target.value }))} className="px-3 py-2 rounded-xl border-[2px] border-[#00a88e]/20" placeholder="Nome" />
                  <input value={editing?.email || ''} onChange={(e) => setEditing((p) => ({ ...p, email: e.target.value }))} className="px-3 py-2 rounded-xl border-[2px] border-[#00a88e]/20" placeholder="E-mail" />
                  <input value={editing?.telefone || ''} onChange={(e) => setEditing((p) => ({ ...p, telefone: e.target.value }))} className="px-3 py-2 rounded-xl border-[2px] border-[#00a88e]/20" placeholder="Telefone" />
                  <input value={editing?.profissao || ''} onChange={(e) => setEditing((p) => ({ ...p, profissao: e.target.value }))} className="px-3 py-2 rounded-xl border-[2px] border-[#00a88e]/20" placeholder="Profissao" />
                  <div className="md:col-span-2">
                    <label className="text-[12px] font-bold text-[#475569] mb-1 block">Endereço</label>
                    <input
                      type="text"
                      value={editing?.endereco || ''}
                      onChange={(e) => setEditing((d) => ({ ...d, endereco: e.target.value }))}
                      placeholder="Rua, número, bairro, cidade - UF"
                      className="w-full border-[2px] border-[#e2e8f0] rounded-xl px-4 py-2 text-[13px] focus:border-[#00a88e] outline-none"
                    />
                  </div>
                  <input value={editing?.alergias || ''} onChange={(e) => setEditing((p) => ({ ...p, alergias: e.target.value }))} className="px-3 py-2 rounded-xl border-[2px] border-[#00a88e]/20 md:col-span-2" placeholder="Alergias" />
                  <input value={editing?.condicoesSaude || ''} onChange={(e) => setEditing((p) => ({ ...p, condicoesSaude: e.target.value }))} className="px-3 py-2 rounded-xl border-[2px] border-[#00a88e]/20 md:col-span-2" placeholder="Condicoes de saude" />
                  <input value={editing?.medicamentos || ''} onChange={(e) => setEditing((p) => ({ ...p, medicamentos: e.target.value }))} className="px-3 py-2 rounded-xl border-[2px] border-[#00a88e]/20 md:col-span-2" placeholder="Medicamentos (separe por virgula)" />
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button type="button" onClick={saveEditProfile} className="px-4 py-2 rounded-xl bg-[#00a88e] text-white font-bold text-[13px] border-[2px] border-transparent"><Save className="w-4 h-4 inline mr-1" />Salvar</button>
                  <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl bg-white text-[#475569] font-bold text-[13px] border-[2px] border-[#e2e8f0]"><X className="w-4 h-4 inline mr-1" />Cancelar</button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t-[3px] border-[#00a88e]/10">
              <div className="bg-[#f0fdfa] rounded-xl p-3 border-[2px] border-[#00a88e]/20">
                <div className="text-[12px] text-[#64748b] font-medium">Ultima Visita</div>
                <div className="text-[14px] font-bold text-[#00a88e] mt-1">{selectedPatient.ultimaVisita || '-'}</div>
              </div>
              <div className="bg-[#f0fdfa] rounded-xl p-3 border-[2px] border-[#00a88e]/20">
                <div className="text-[12px] text-[#64748b] font-medium">Proximo Retorno</div>
                <div className="text-[14px] font-bold text-[#00a88e] mt-1">{selectedPatient.proximoRetorno || '-'}</div>
              </div>
              <div className={`rounded-xl p-3 border-[2px] ${selectedPatient.saldoDevedor > 0 ? 'bg-red-50 border-red-200' : 'bg-[#f0fdfa] border-[#00a88e]/20'}`}>
                <div className={`text-[12px] font-medium ${selectedPatient.saldoDevedor > 0 ? 'text-red-700' : 'text-[#64748b]'}`}>Saldo Devedor</div>
                <div className={`text-[14px] font-bold mt-1 ${selectedPatient.saldoDevedor > 0 ? 'text-red-600' : 'text-[#00a88e]'}`}>
                  {selectedPatient.saldoDevedor > 0
                    ? `R$ ${selectedPatient.saldoDevedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                    : '-'}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border-[3px] border-[#00a88e]/20 overflow-hidden">
            <div className="flex border-b-[3px] border-[#00a88e]/10 overflow-x-auto">
              {[
                { key: 'timeline', label: 'Linha do Tempo', icon: Calendar },
                { key: 'anamnese', label: 'Anamnese', icon: Activity },
                { key: 'galeria', label: 'Galeria', icon: ImageIcon },
              ].map(({ key, label, icon }) => {
                const TabIcon = icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPatientDetailTab(key)}
                    className={`flex items-center gap-2 px-5 py-4 font-bold text-[13px] whitespace-nowrap transition-all border-b-[3px] -mb-[3px] ${
                      patientDetailTab === key
                        ? 'text-[#00a88e] border-[#00a88e] bg-[#f0fdfa]'
                        : 'text-[#64748b] border-transparent hover:text-[#00a88e] hover:bg-[#f8fbfb]'
                    }`}
                  >
                    <TabIcon className="w-4 h-4" /> {label}
                  </button>
                );
              })}
            </div>

            <div className="p-6">
              {patientDetailTab === 'timeline' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                    <h4 className="text-[16px] font-bold text-[#0f172a]">Historico Completo</h4>
                    <button
                      type="button"
                      onClick={() => setModalProcedimento(true)}
                      disabled={!selectedPatient?.id}
                      className="flex items-center gap-2 px-3 py-2 bg-[#00a88e] text-white rounded-xl text-[13px] font-bold hover:bg-[#0f766e] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" /> Registrar Procedimento
                    </button>
                  </div>
                  <div className="space-y-3">
                    {timelineLoading ? (
                      <div className="flex items-center justify-center py-8 text-[#64748b] text-[13px] font-medium gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-[#00a88e]" /> Carregando linha do tempo...
                      </div>
                    ) : timelineEvents.length ? timelineEvents.map((evt) => (
                      <div key={evt.id} className="flex gap-4 p-4 rounded-xl border-[2px] border-[#e2e8f0] hover:border-[#00a88e]/30 transition-all bg-white">
                        <div className="w-12 h-12 rounded-full bg-[#e6f7f5] flex items-center justify-center flex-shrink-0 border-[2px] border-[#00a88e]/20">
                          <CheckCircle2 className="w-6 h-6 text-[#00a88e]" strokeWidth={2.5} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[14px] font-bold text-[#0f766e]">{evt.title}</div>
                          <div className="text-[12px] text-[#64748b] mt-1">{evt.meta}</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#94a3b8] flex-shrink-0 mt-1" />
                      </div>
                    )) : <p className="text-center py-8 text-[#94a3b8] text-[14px]">Nenhum procedimento registrado ainda.</p>}
                  </div>

                  {modalProcedimento && (
                    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
                      <div
                        className="bg-white rounded-2xl border-[3px] border-[#00a88e] max-w-[500px] w-full p-6"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="modal-procedimento-title"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <h3 id="modal-procedimento-title" className="text-[16px] font-bold text-[#0f172a] mb-4">Registrar Procedimento</h3>
                        <div className="space-y-3">
                          <input
                            type="text"
                            placeholder="Nome do procedimento *"
                            value={nomeProcedimento}
                            onChange={(e) => setNomeProcedimento(e.target.value)}
                            className="w-full border-[2px] border-[#e2e8f0] rounded-xl px-4 py-3 text-[14px] focus:border-[#00a88e] outline-none"
                          />
                          <textarea
                            placeholder="Observações (opcional)"
                            value={observacaoProcedimento}
                            onChange={(e) => setObservacaoProcedimento(e.target.value)}
                            rows={4}
                            className="w-full border-[2px] border-[#e2e8f0] rounded-xl px-4 py-3 text-[14px] focus:border-[#00a88e] outline-none resize-none"
                          />
                        </div>
                        <div className="flex gap-3 mt-4">
                          <button
                            type="button"
                            onClick={() => setModalProcedimento(false)}
                            className="flex-1 py-3 rounded-xl border-[2px] border-[#e2e8f0] text-[#64748b] font-bold text-[14px]"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={handleRegistrarProcedimento}
                            disabled={!nomeProcedimento.trim() || salvandoProcedimento}
                            className="flex-1 py-3 rounded-xl bg-[#00a88e] text-white font-bold text-[14px] hover:bg-[#0f766e] disabled:opacity-50 transition-all"
                          >
                            {salvandoProcedimento ? 'Salvando...' : 'Salvar'}
                          </button>
                        </div>
                      </div>
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
                    <h4 className="text-[16px] font-bold text-[#0f172a]">Galeria de Evolucao</h4>
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
                  <div className="flex flex-wrap items-center gap-2">
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
                    <button
                      type="button"
                      onClick={openGalleryCamera}
                      disabled={galeriaBackend === 'loading' && Boolean(selectedPatient?.id)}
                      className="px-3 py-2 rounded-xl bg-white text-[#00a88e] font-bold text-[12px] border-[2px] border-[#00a88e]/25 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Camera className="w-4 h-4 inline mr-1" /> Tirar na hora
                    </button>
                  </div>

                  {galleryItemsForGrid.length ? (
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

        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="rounded-2xl border-[3px] border-red-300 bg-red-50 p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" strokeWidth={2.5} aria-hidden />
              <h5 className="text-[14px] font-bold text-[#0f172a]">Alertas</h5>
            </div>
            {alertasAnamneseLoading ? (
              <div className="flex items-center gap-2 text-[12px] font-medium text-red-900/80">
                <Loader2 className="h-4 w-4 animate-spin shrink-0 text-red-600" aria-hidden />
                Carregando alertas da anamnese…
              </div>
            ) : alertasAnamnese.length === 0 ? (
              <p className="text-[12px] font-medium leading-snug text-red-900/85">
                Nenhuma pergunta em alerta nas anamneses preenchidas.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  {alertasAnamnese.slice(0, 3).map((row) => (
                    <div
                      key={row.key}
                      className="rounded-lg border-[2px] border-red-200 bg-white p-3 shadow-sm"
                    >
                      <p className="text-[11px] font-bold uppercase tracking-wide text-red-800 line-clamp-3">
                        {row.titulo}
                      </p>
                      <p className="mt-1 break-words text-[12px] font-semibold text-[#0f172a]">{row.valor}</p>
                    </div>
                  ))}
                </div>
                {alertasAnamnese.length > 3 ? (
                  <button
                    type="button"
                    onClick={() => setAlertasModalOpen(true)}
                    className="mt-3 w-full rounded-xl border-[2px] border-red-400 bg-white py-2.5 text-[12px] font-bold text-red-700 shadow-sm transition-colors hover:bg-red-100/90"
                  >
                    Visualizar todos os alertas ({alertasAnamnese.length})
                  </button>
                ) : null}
              </>
            )}
          </div>

          <div className="bg-amber-50 rounded-2xl border-[3px] border-amber-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-5 h-5 text-amber-500" strokeWidth={2.5} />
              <h5 className="text-[14px] font-bold text-[#0f172a]">Avisos</h5>
            </div>
            <div className="space-y-2">
              <div
                className={`rounded-lg p-3 border-[2px] ${
                  birthAlert?.isToday
                    ? 'bg-amber-100 border-amber-400 shadow-sm ring-2 ring-amber-300/50'
                    : 'bg-white border-amber-200'
                }`}
              >
                {birthAlert ? (
                  <p
                    className={`text-[12px] flex items-center gap-1.5 ${
                      birthAlert.isToday
                        ? 'font-bold text-amber-900'
                        : 'font-bold text-amber-700'
                    }`}
                  >
                    <Bell className="w-3.5 h-3.5 flex-shrink-0" />
                    {birthdayAlertSidebarCopy(birthAlert)}
                  </p>
                ) : (
                  <p className="text-[12px] font-medium text-amber-800/90">
                    Cadastre a data de nascimento para ver quantos dias faltam para o aniversário.
                  </p>
                )}
              </div>
              {selectedPatient.saldoDevedor > 0 && (
                <div className="bg-red-100 border-[2px] border-red-300 rounded-lg p-3">
                  <p className="text-[12px] font-bold text-red-700 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Parcela vence em 7 dias
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border-[3px] border-[#00a88e]/15 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <StickyNote className="w-5 h-5 text-[#00a88e]" strokeWidth={2.5} />
              <h5 className="text-[14px] font-bold text-[#0f172a]">Notas Rapidas</h5>
            </div>
            <div className="mb-3 space-y-2">
              <textarea
                value={quickNoteText}
                onChange={(e) => setQuickNoteText(e.target.value)}
                rows={2}
                placeholder="Escreva uma nota rápida..."
                className="w-full p-3 rounded-xl border-[2px] border-[#00a88e]/20 bg-white text-[12px] text-[#0f172a] font-medium focus:outline-none focus:border-[#00a88e]/40 focus:ring-2 focus:ring-[#00a88e]/10"
              />
              <button
                type="button"
                onClick={handleAddQuickNote}
                disabled={!quickNoteText.trim()}
                className="w-full px-3 py-2 rounded-xl bg-[#00a88e] hover:bg-[#00967f] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-[12px] border-[2px] border-transparent"
              >
                Adicionar nota rápida
              </button>
            </div>
            <div className="space-y-2">
              {displayNotes.length ? displayNotes.map((nota, i) => (
                <div key={nota.id || i} className={`p-3 rounded-lg border-[2px] ${i % 2 === 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
                  <p className={`text-[12px] font-medium ${i % 2 === 0 ? 'text-yellow-800' : 'text-green-800'}`}>{nota.texto}</p>
                  <div className="flex items-center justify-between mt-1 gap-2">
                    <span className={`text-[11px] font-medium ${i % 2 === 0 ? 'text-yellow-600' : 'text-green-600'}`}>{nota.autor}{nota._fromApi ? ' · servidor' : ''}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[11px] ${i % 2 === 0 ? 'text-yellow-500' : 'text-green-500'}`}>{nota.data}</span>
                      {nota._fromApi && (
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(nota.id)}
                          className="text-red-400 hover:text-red-600 transition-colors"
                          aria-label="Excluir nota"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )) : <p className="text-[12px] text-[#94a3b8]">Nenhuma nota registrada</p>}
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
    </div>
  );
}

