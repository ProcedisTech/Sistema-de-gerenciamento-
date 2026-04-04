import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bell,
  Camera,
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
  Phone,
  Play,
  Save,
  Shield,
  StickyNote,
  User as UserIcon,
  X,
} from 'lucide-react';
import { anamneseApi, pacientesApi, notasApi, procedimentosApi } from '../../services/api';
import { mapBackendPatient, mergePacienteDtoWithEditing } from '../../utils/patientMapping';

function renderRespostaValue(resp) {
  if (resp.opcaoSelecionada) return resp.opcaoSelecionada;
  if (resp.respostaTexto) return resp.respostaTexto;
  if (resp.respostaNumero !== null && resp.respostaNumero !== undefined) return String(resp.respostaNumero);
  if (resp.respostaBoolean === true) return 'Sim';
  if (resp.respostaBoolean === false) return 'Não';
  return '-';
}

function AnamneseTab({ pacienteId }) {
  const [anamneses, setAnamneses] = useState([]);
  const [detalhes, setDetalhes] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

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
                  {an.dataHora && <span>{new Date(an.dataHora).toLocaleDateString('pt-BR')} {new Date(an.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
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
                {detalhe.observacoes && (
                  <div className="p-3 rounded-xl bg-[#fffbeb] border-[2px] border-[#f59e0b]/20">
                    <span className="text-[12px] font-bold text-[#b45309]">Observações</span>
                    <p className="text-[13px] text-[#0f172a] mt-1">{detalhe.observacoes}</p>
                  </div>
                )}

                {respostas.length > 0 ? (
                  <div className="space-y-2">
                    {respostas.map((resp) => (
                      <div key={resp.id} className="p-4 rounded-xl bg-[#f8fbfb] border-[2px] border-[#e2e8f0]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <span className="text-[12px] text-[#64748b] font-medium">{resp.perguntaDescricao || 'Pergunta'}</span>
                            {resp.tipoResposta && (
                              <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#e6f7f5] text-[#0f766e]">
                                {resp.tipoResposta}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-[14px] font-bold text-[#0f172a] mt-1.5">{renderRespostaValue(resp)}</p>
                      </div>
                    ))}
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
  const patient = useMemo(() => selectedPatient || {}, [selectedPatient]);
  const [apiNotes, setApiNotes] = useState([]);
  const [apiProcedures, setApiProcedures] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState('');
  const [editing, setEditing] = useState(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);
  const [quickNoteText, setQuickNoteText] = useState('');
  const [galleryCameraOpen, setGalleryCameraOpen] = useState(false);
  const [galleryCameraError, setGalleryCameraError] = useState('');
  const [galleryCameraStarting, setGalleryCameraStarting] = useState(false);
  const [galleryVideoReady, setGalleryVideoReady] = useState(false);
  const galleryVideoRef = useRef(null);
  const galleryStreamRef = useRef(null);

  const isEditing = Boolean(editing);

  const createEditDraft = () => ({
    nome: patient.nome || '',
    email: patient.email || '',
    telefone: patient.telefone || '',
    profissao: patient.profissao || '',
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

  const galleryItems = capturedPhotos.length > 0 ? capturedPhotos : fallbackGalleryPhotos;

  const consentTerms = useMemo(() => {
    const terms = [];
    if (patient.lgpdAssinado || patient.lgpdInicial) {
      terms.push('LGPD inicial aceito');
    }
    if (patient.termoLido) terms.push('Leitura do termo LGPD confirmada');
    if (patient.termoAssinado) terms.push('Assinatura do termo LGPD confirmada');
    if (patient.orientacoes) terms.push('Orientacoes pos-procedimento confirmadas');
    if (patient.satisfacao) terms.push('Satisfacao com resultado confirmada');
    return terms;
  }, [patient]);

  useEffect(() => {
    const id = selectedPatient?.id;
    if (!id) return undefined;
    let cancelled = false;
    setDetailLoading(true);
    (async () => {
      try {
        const [dto, notasList, procList] = await Promise.all([
          pacientesApi.get(id).catch(() => null),
          notasApi.list(id).catch(() => []),
          procedimentosApi.byPaciente(id).catch(() => []),
        ]);
        if (cancelled) return;
        if (dto) {
          mergePatientById?.(id, (prev) => ({
            ...mapBackendPatient(dto),
            evaluationCapturedPhotos: prev.evaluationCapturedPhotos,
            evaluationSelectedPhotoIndex: prev.evaluationSelectedPhotoIndex,
            evaluationAnnotatedPhotoUrl: prev.evaluationAnnotatedPhotoUrl,
            galeria: prev.galeria,
            documentos: prev.documentos,
            notas: prev.notas,
            procedures: prev.procedures,
          }));
        }
        setApiNotes(Array.isArray(notasList) ? notasList : []);
        setApiProcedures(Array.isArray(procList) ? procList : []);
      } catch {
        if (!cancelled) {
          setApiNotes([]);
          setApiProcedures([]);
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarregar só ao trocar paciente
  }, [selectedPatient?.id]);

  const displayNotes = useMemo(() => {
    const fromApi = (apiNotes || []).map((n) => ({
      id: n.id,
      texto: n.conteudo,
      autor: n.autorNome || 'Equipe',
      data: n.criadoEm ? new Date(n.criadoEm).toLocaleString('pt-BR') : '',
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
        meta: `${proc.statusNome || ''} ${proc.criadoEm ? new Date(proc.criadoEm).toLocaleString('pt-BR') : ''} ${proc.profissionalNome ? `· ${proc.profissionalNome}` : ''}`,
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

    (patient.documentos || []).forEach((doc, idx) => {
      events.push({
        id: `doc_${idx}`,
        type: 'documento',
        title: doc.nome || 'Documento',
        meta: `${doc.data || '-'} ${doc.hora ? `- ${doc.hora}` : ''}`,
      });
    });

    capturedPhotos.forEach((photo, idx) => {
      events.push({
        id: `photo_${idx}`,
        type: 'foto',
        title: 'Foto adicionada na galeria',
        meta: photo.capturedAt ? new Date(photo.capturedAt).toLocaleString('pt-BR') : photo.fileName,
      });
    });

    return events;
  }, [patient, capturedPhotos, apiProcedures]);

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
      mergePatientById?.(selectedPatient.id, (prev) => ({
        ...mapBackendPatient(fresh),
        evaluationCapturedPhotos: prev.evaluationCapturedPhotos,
        evaluationSelectedPhotoIndex: prev.evaluationSelectedPhotoIndex,
        galeria: prev.galeria,
        documentos: prev.documentos,
        medicamentos: (editing?.medicamentos || '')
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean),
        condicoesSaude: editing?.condicoesSaude ?? prev.condicoesSaude,
        alergias: editing?.alergias ?? prev.alergias,
      }));
      refreshPatients?.();
      setEditing(null);
    } catch (e) {
      setProfileSaveError(e.message || 'Erro ao salvar cadastro.');
    }
  };

  const handleUploadGalleryFiles = (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    onAddGalleryFiles?.(selectedPatient.cpf, files);
    event.target.value = '';
  };

  const handleAddQuickNote = async () => {
    const text = quickNoteText.trim();
    if (!text) return;

    if (selectedPatient?.id) {
      try {
        await notasApi.create(selectedPatient.id, {
          roleUserId: roleUserId || 'a0a00000-0000-0000-0000-000000000001',
          conteudo: text,
          autorNome: 'Nota rápida',
        });
        const list = await notasApi.list(selectedPatient.id);
        setApiNotes(Array.isArray(list) ? list : []);
        setQuickNoteText('');
      } catch (e) {
        alert(e.message || 'Erro ao salvar nota.');
      }
      return;
    }

    const existingNotes = Array.isArray(selectedPatient?.notas) ? selectedPatient.notas : [];
    const now = new Date();
    const newNote = {
      texto: text,
      autor: 'Atendimento',
      data: now.toLocaleDateString('pt-BR'),
    };
    onUpdatePatient?.(selectedPatient.cpf, {
      notas: [newNote, ...existingNotes],
    });
    setQuickNoteText('');
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
              <div className="w-20 h-20 rounded-full bg-[#00a88e] flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
                {getPatientInitials(selectedPatient.nome)}
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
                { key: 'documentos', label: 'Documentos', icon: FileText },
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
                  <h4 className="text-[16px] font-bold text-[#0f172a] mb-4">Historico Completo</h4>
                  <div className="space-y-3">
                    {timelineEvents.length ? timelineEvents.map((evt) => (
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
                    )) : <p className="text-center py-8 text-[#94a3b8] text-[14px]">Nenhum evento registrado</p>}
                  </div>
                </div>
              )}

              {patientDetailTab === 'anamnese' && (
                <AnamneseTab pacienteId={selectedPatient.id} />
              )}

              {patientDetailTab === 'galeria' && (
                <div className="space-y-6">
                  <h4 className="text-[16px] font-bold text-[#0f172a]">Galeria de Evolucao</h4>
                  <div className="flex items-center gap-2">
                    <label className="px-3 py-2 rounded-xl bg-[#00a88e] text-white font-bold text-[12px] border-[2px] border-transparent cursor-pointer">
                      <ImageIcon className="w-4 h-4 inline mr-1" /> Upload
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleUploadGalleryFiles} />
                    </label>
                    <button
                      type="button"
                      onClick={openGalleryCamera}
                      className="px-3 py-2 rounded-xl bg-white text-[#00a88e] font-bold text-[12px] border-[2px] border-[#00a88e]/25"
                    >
                      <Camera className="w-4 h-4 inline mr-1" /> Tirar na hora
                    </button>
                  </div>

                  {galleryItems.length ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {galleryItems.map((item) => (
                        <div key={item.id} className="relative">
                          <button type="button" onClick={() => setPreviewPhotoUrl(item.url)} className="aspect-square rounded-xl bg-[#e6f7f5] border-[2px] border-[#00a88e]/15 flex items-center justify-center overflow-hidden w-full">
                            <img src={item.url} alt={item.fileName} className="w-full h-full object-cover" />
                          </button>
                          {item.source !== 'legacy' && (
                            <button
                              type="button"
                              onClick={() => onDeleteGalleryPhoto?.(selectedPatient.cpf, item.index)}
                              className="absolute top-1 right-1 w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 text-white border-[2px] border-white text-[11px] font-bold"
                            >
                              x
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-center py-8 text-[#94a3b8] text-[14px]">Nenhuma foto registrada</p>}
                </div>
              )}

              {patientDetailTab === 'documentos' && (
                <div className="space-y-4">
                  <h4 className="text-[16px] font-bold text-[#0f172a] mb-4">Documentos e Consentimentos LGPD</h4>

                  <div className="flex flex-wrap gap-2 mb-2">
                    {consentTerms.length ? consentTerms.map((term) => (
                      <span key={term} className="px-2 py-1 rounded-lg bg-[#e6f7f5] text-[#0f766e] border-[2px] border-[#00a88e]/20 text-[12px] font-bold">{term}</span>
                    )) : (
                      <span className="text-[12px] text-[#94a3b8]">Nenhum termo de consentimento confirmado.</span>
                    )}
                  </div>

                  {selectedPatient.documentos?.length ? selectedPatient.documentos.map((doc, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 rounded-xl border-[2px] border-[#e2e8f0] bg-[#f8fbfb] hover:border-[#00a88e]/30 transition-all">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-[#e6f7f5] flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-[#00a88e]" strokeWidth={2.5} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-bold text-[#0f766e]">{doc.nome}</div>
                          <div className="text-[12px] text-[#64748b]">{doc.data} - {doc.hora} - {doc.tipo}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                        <span className="px-2 py-1 bg-[#dcfce7] text-[#16a34a] rounded-lg text-[11px] font-bold">{doc.status}</span>
                        <button type="button" className="w-8 h-8 rounded-lg border-[2px] border-[#e2e8f0] flex items-center justify-center text-[#64748b] hover:text-[#00a88e] hover:border-[#00a88e]/30 transition-all flex-shrink-0">
                          <Download className="w-4 h-4" strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  )) : <p className="text-center py-8 text-[#94a3b8] text-[14px]">Nenhum documento registrado</p>}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="bg-amber-50 rounded-2xl border-[3px] border-amber-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-5 h-5 text-amber-500" strokeWidth={2.5} />
              <h5 className="text-[14px] font-bold text-[#0f172a]">Alertas</h5>
            </div>
            <div className="space-y-2">
              <div className="bg-white border-[2px] border-amber-200 rounded-lg p-3">
                <p className="text-[12px] font-bold text-amber-700 flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5" /> Aniversario em 67 dias
                </p>
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
                  <div className="flex items-center justify-between mt-1">
                    <span className={`text-[11px] font-medium ${i % 2 === 0 ? 'text-yellow-600' : 'text-green-600'}`}>{nota.autor}{nota._fromApi ? ' · servidor' : ''}</span>
                    <span className={`text-[11px] ${i % 2 === 0 ? 'text-yellow-500' : 'text-green-500'}`}>{nota.data}</span>
                  </div>
                </div>
              )) : <p className="text-[12px] text-[#94a3b8]">Nenhuma nota registrada</p>}
            </div>
          </div>

          <div className="bg-[#00a88e] rounded-2xl p-4 shadow-sm text-white">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5" strokeWidth={2.5} />
              <h5 className="text-[14px] font-bold">LGPD</h5>
            </div>
            <p className="text-[12px] font-medium">Todos os termos vigentes e atualizados</p>
            {selectedPatient.lgpdRenovacao && (
              <p className="text-[12px] mt-1">Renovacao: {selectedPatient.lgpdRenovacao}</p>
            )}
          </div>
        </div>
      </div>

      {previewPhotoUrl && (
        <div className="fixed inset-0 z-[220] bg-black/70 flex items-center justify-center p-4" onClick={() => setPreviewPhotoUrl(null)}>
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setPreviewPhotoUrl(null)} className="absolute -top-10 right-0 text-white font-bold">Fechar</button>
            <img src={previewPhotoUrl} alt="Preview da foto" className="max-w-[90vw] max-h-[85vh] rounded-xl border-[3px] border-white/30" />
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

