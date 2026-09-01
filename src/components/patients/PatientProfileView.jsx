import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  BookOpen,
  Cake,
  Calendar,
  ChevronDown,
  Clock,
  ClipboardList,
  FileText,
  Image as ImageIcon,
  Layers,
  Loader2,
  Sparkles,
  Stethoscope,
  StickyNote,
  Syringe,
  Trash2,
  Pencil,
  Plus,
  User as UserIcon,
  X,
} from 'lucide-react';
import {
  anamneseApi,
  pacientesApi,
  pacienteAlertasManuaisApi,
  pacientesGaleriaApi,
  perfilClinicoApi,
  notasApi,
  procedimentosApi,
  termoAssinaturaApi,
  getApiErrorDetail,
  organizacaoApi,
  listarRelatosPorPaciente,
  // mapasApi, — reativar junto com a região aplicada na Ficha (ver handleGerarPdf)
  planejamentosApi,
} from '../../services/api';
import { useToast } from '../../contexts/useToast.js';
import { useOrg } from '../../contexts/OrgContext';
import { usePapel } from '../../hooks/usePapel';
import { mapBackendPatient, mergePacienteDtoWithEditing } from '../../utils/patientMapping';
import { formatDateBR } from '../../utils/replaceTermVariables';
import { convertToWebP } from '../../utils/imageUtils.js';
import {
  fetchNextAppointmentIsoForPaciente,
  latestProcedureOccurredInstantIso,
  procedureOccurredInstantIso,
} from '../../utils/patientProfileDerivedDates.js';
import { validatePacienteFormBasics } from '../../utils/patientFormValidation';
import { PACIENTE_FIELD_MAX } from '../../utils/patientFieldMaxLength';
import {
  maskCPF,
  maskRG,
  validateBirthDateDigits8,
  birthDateValidationUserMessage,
  formatBirthDigitsBR,
  sanitizeBirthDateDigits,
  calculateAgeFromISODate,
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
} from '../../utils/patientProfilePhoto.js';
import { ProfileBreadcrumb } from './ProfileBreadcrumb.jsx';
import { ProfileHero } from './ProfileHero.jsx';
import { ProfileKpiStrip } from './ProfileKpiStrip.jsx';
import { formatDiasAtrasPtBr, formatCreatedAtPtBr } from './profileDisplayUtils.js';
import { calcSessoesPlano } from '../../utils/planejamentoProfileMetrics.js';
import {
  ProcedureTimelineHeading,
  ProcedureTimelineRail,
  ProcedureTimelineEntry,
  ProcedureTimelineProfileVerMaisStrip,
  ProcedureTimelinePreviewCard,
  RetornoTimelineBadge,
} from './ProcedureTimelineBlock.jsx';
import {
  sortProcedimentosPorCriadoEmDesc,
  nestProcedimentosTimeline,
  flattenNestedTimelineRoots,
} from './procedureTimelineUtils.js';
import {
  formatPacienteGaleriaError,
  normalizePacienteGaleriaResponse,
  filterGaleriaItemsForUi,
  groupGaleriaItemsBySession,
  formatGaleriaLegendaForUpload,
  itemMesReferenciaISO,
  formatDataSessaoPtBr,
  GALERIA_CATEGORIA,
  GALERIA_CATEGORIA_LABELS,
} from '../../utils/pacienteGaleria.js';
import {
  GaleriaArquivoImage,
  GaleriaLocalImage,
} from './GaleriaArquivoImage.jsx';
import { ZoomableGalleryLightbox } from './ZoomableGalleryLightbox.jsx';
import { GaleriaMapaThumb } from './galeria/GaleriaMapaThumb.jsx';
import { RelatoAcompanhamentoModal } from '../journey/RelatoAcompanhamentoModal.jsx';
import { GaleriaTab } from './galeria/GaleriaTab.jsx';
import { DocumentosAssinadosTab } from './documentos/DocumentosAssinadosTab.jsx';
import { PlanosTab } from '../planos/PlanosTab.jsx';
import { AnamneseDocumentoView } from '../anamnese/AnamneseDocumentoAssinadoView.jsx';
import { DynamicQuestion } from '../anamnese/DynamicQuestion.jsx';
import {
  mergeApiRespostasToMap,
  buildPerguntaTipoById,
  buildRespostaApiRows,
  sortFichaItens,
  groupItensByCategoria,
  isFullWidthItem,
} from '../anamnese/anamneseFichaUtils.js';
import { aplicarMudancaResposta, perguntaFilhaVisivel } from '../anamnese/anamneseCondicional.js';
import { searchCatalogoHub } from '../anamnese/anamneseCatalogoSearch.js';
import { mapGetToState as mapPerfilClinicoResponseToState } from '../../hooks/usePerfilClinico';
import { useAlertasClinicos } from '../../hooks/useAlertasClinicos';
import { AlertasClinicosPanel, AlertasGroupCards } from './AlertasClinicosPanel.jsx';
import { buildGroupedChips } from './alertaGrouping.js';

function resolveProcedimentoFeitoIdForUpload(sess, categoria) {
  const fotos = Array.isArray(sess?.fotos) ? sess.fotos : [];
  const inCat = fotos.filter((f) => (f.categoria || 'outro') === categoria);
  const fromCat = inCat.find((f) => f?.procedimentoFeitoId)?.procedimentoFeitoId;
  if (fromCat) return String(fromCat).trim();
  const any = fotos.find((f) => f?.procedimentoFeitoId)?.procedimentoFeitoId;
  return any != null ? String(any).trim() : null;
}

function resolveNomeProcedimentoForUpload(sess, categoria) {
  const fotos = Array.isArray(sess?.fotos) ? sess.fotos : [];
  const inCat = fotos.filter((f) => (f.categoria || 'outro') === categoria);
  const nomeCat = inCat.map((f) => (f.nomeProcedimento || '').trim()).find(Boolean);
  if (nomeCat) return nomeCat;
  return (fotos.map((f) => (f.nomeProcedimento || '').trim()).find(Boolean)) || '';
}

function birthdayAlertSidebarCopy(alert) {
  if (!alert) return null;
  if (alert.isToday) return 'Aniversário hoje — celebre com o paciente!';
  if (alert.daysUntil === 1) return 'Aniversário amanhã';
  return `Aniversário em ${alert.daysUntil} dias`;
}

/** ISO `YYYY-MM-DD` → exibição DD/MM/AAAA para o campo de data (usa o mesmo parser de
 *  replaceTermVariables.js — fonte única de conversão de data pro app inteiro). */
function isoDateToBrazilianDisplay(iso) {
  if (!iso || typeof iso !== 'string') return '';
  const formatted = formatDateBR(iso);
  return /^\d{2}\/\d{2}\/\d{4}$/.test(formatted) ? formatted : '';
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

const SEXO_DISPLAY_LABELS = { F: 'Feminino', M: 'Masculino', N: 'Prefiro não dizer' };

/** Endereço completo em uma linha, pra Seção 2 da Ficha Clínica em PDF. */
function buildEnderecoDisplayForFicha(p) {
  const linha1Base = [p.enderecoRua, p.enderecoNumero].filter((v) => String(v ?? '').trim()).join(', ');
  const linha1 = p.enderecoComplemento ? `${linha1Base} - ${p.enderecoComplemento}` : linha1Base;
  const cidadeUf = [p.enderecoCidade, p.enderecoEstado].filter((v) => String(v ?? '').trim()).join('/');
  const linha2 = [p.enderecoBairro, cidadeUf].filter((v) => String(v ?? '').trim()).join(', ');
  const cepPart = p.cep ? `CEP ${p.cep}` : '';
  return [linha1, linha2, cepPart].filter((v) => String(v ?? '').trim()).join(' — ');
}

/** snake_case/código de catálogo → texto legível ("perfil_direito" → "Perfil Direito"). */
function humanizeCode(code) {
  const s = String(code || '').trim();
  if (!s) return '';
  return s
    .replace(/^ant_|^sub_/, '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Responsável legal para a Ficha em PDF: só faz sentido pra paciente menor de idade —
 * usa nomeMae com fallback nomePai (não existe campo próprio "responsável legal" hoje).
 */
function resolveResponsavelLegalDisplay(p) {
  const idade = p.idade != null ? Number(p.idade) : Number(calculateAgeFromISODate(p.dataNascimento) || NaN);
  if (!Number.isFinite(idade) || idade >= 18) return '';
  return String(p.nomeMae ?? '').trim() || String(p.nomePai ?? '').trim() || '';
}

/** Identificação/contato do paciente já como texto pronto para exibição, pra `generateFichaPacientePdf`. */
function buildPacienteCtxForFicha(p) {
  const cpfDigits = String(p.cpf ?? '').replace(/\D/g, '');
  const rgStr = p.rg != null ? String(p.rg) : '';
  const sexoCodigo = sexoForPatientFormSelect(p.sexo);
  const idadeCalculada = calculateAgeFromISODate(p.dataNascimento);
  const cidadeUf = [p.enderecoCidade, p.enderecoEstado].filter((v) => String(v ?? '').trim()).join('/');
  return {
    nome: p.nome,
    // Nome social, contato de emergência e convênio não existem no cadastro hoje —
    // ficam undefined de propósito (o gerador de PDF já trata como "—").
    nomeSocialDisplay: undefined,
    contatoEmergenciaDisplay: undefined,
    convenioDisplay: undefined,
    responsavelLegalDisplay: resolveResponsavelLegalDisplay(p) || undefined,
    origemIndicacaoDisplay: p.indicacao,
    cpfDisplay: cpfDigits ? maskCPF(cpfDigits) : '',
    rgDisplay: rgStr ? maskRG(rgStr) : '',
    nascimentoDisplay: p.dataNascimento ? isoDateToBrazilianDisplay(p.dataNascimento) : '',
    idadeDisplay: p.idade != null ? `${p.idade} anos` : (idadeCalculada !== '' ? `${idadeCalculada} anos` : ''),
    sexoDisplay: sexoCodigo ? SEXO_DISPLAY_LABELS[sexoCodigo] : '',
    estadoCivilDisplay: p.estadoCivil,
    profissaoDisplay: p.profissaoNome,
    telefoneDisplay: p.telefone,
    emailDisplay: p.email,
    instagramDisplay: p.instagram,
    tiktokDisplay: p.tiktok,
    enderecoDisplay: buildEnderecoDisplayForFicha(p),
    cidadeUfDisplay: cidadeUf || undefined,
    logradouroDisplay: p.enderecoRua,
    numeroDisplay: p.enderecoNumero,
    bairroDisplay: p.enderecoBairro,
    cidadeDisplay: p.enderecoCidade,
    ufDisplay: p.enderecoEstado,
    cepDisplay: p.cep,
  };
}

/** Texto de perguntas da anamnese estética seedada (V34) usadas na Ficha em PDF. */
const ANAMNESE_ESTETICA_QUESTOES = {
  queixaPrincipal: 'Qual sua queixa estética principal?',
  expectativa: 'Qual resultado você espera alcançar?',
  tabagismo: 'Qual sua relação com tabaco?',
  fotoprotetor: 'Frequência de exposição solar sem proteção?',
  atividadeFisica: 'Pratica atividade física regularmente?',
  procedimentosPrevios: 'Já realizou procedimentos estéticos antes? Quais?',
};

function extractRespostaTexto(r) {
  if (!r) return '';
  if (r.opcaoSelecionada != null && String(r.opcaoSelecionada).trim()) return String(r.opcaoSelecionada).trim();
  if (r.respostaTexto != null && String(r.respostaTexto).trim()) return String(r.respostaTexto).trim();
  if (r.respostaBoolean != null) return r.respostaBoolean ? 'Sim' : 'Não';
  return '';
}

/** Casa as respostas da anamnese preenchida mais recente com as perguntas conhecidas da Seção 02. */
function buildAnamneseEsteticaFromRespostas(respostas) {
  const byDescricao = {};
  (Array.isArray(respostas) ? respostas : []).forEach((r) => {
    const desc = String(r?.perguntaDescricao ?? '').trim();
    if (desc) byDescricao[desc] = r;
  });
  const out = {};
  Object.entries(ANAMNESE_ESTETICA_QUESTOES).forEach(([key, questionText]) => {
    const val = extractRespostaTexto(byDescricao[questionText]);
    if (val) out[key] = val;
  });
  return out;
}

// TODO V127 — remapear para códigos CID após revisão dos nomes (Z34, Z391, N951, L910, Z721)
const ANTECEDENTE_CODIGOS_GESTACAO_LACTACAO = ['ant_gestacao', 'ant_amamentacao', 'ant_menopausa'];
const ANTECEDENTE_CODIGOS_CICATRIZACAO = ['ant_cicatriz_queloide', 'ant_queloides'];
const ANTECEDENTE_CODIGOS_ETILISMO = ['ant_etilismo'];

function filterAntecedentesPorCodigo(antecedentes, codigos) {
  return (Array.isArray(antecedentes) ? antecedentes : []).filter((a) => codigos.includes(a?.codigo));
}

/** `procedimentoFeitoId` → texto de intercorrência, a partir dos relatos de acompanhamento do paciente. */
function buildIntercorrenciaMapFromRelatos(relatos) {
  const map = {};
  (Array.isArray(relatos) ? relatos : []).forEach((r) => {
    const pid = r?.procedimentoFeitoId;
    if (!pid) return;
    const texto = String(r.reacoes ?? '').trim() || String(r.observacoes ?? '').trim();
    if (!texto) return;
    map[pid] = map[pid] ? `${map[pid]}; ${texto}` : texto;
  });
  return map;
}

function ProntuarioSessionPhotos({ fotosProc, onPreviewPhoto, selectedPatientId }) {
  const [selectedStage, setSelectedStage] = useState('todas');

  const grouped = useMemo(() => {
    const list = Array.isArray(fotosProc) ? fotosProc : [];
    return {
      todas: list,
      avaliacao: list.filter((f) => f.categoria === GALERIA_CATEGORIA.AVALIACAO),
      antes: list.filter((f) => f.categoria === GALERIA_CATEGORIA.ANTES),
      mapa: list.filter((f) => f.categoria === GALERIA_CATEGORIA.MAPA || Boolean(f?.mapaOverlay?.marcacoes?.length)),
      depois: list.filter((f) => f.categoria === GALERIA_CATEGORIA.DEPOIS || f.categoria === 'pos_imediato'),
      outro: list.filter(
        (f) =>
          f.categoria !== GALERIA_CATEGORIA.AVALIACAO &&
          f.categoria !== GALERIA_CATEGORIA.ANTES &&
          f.categoria !== GALERIA_CATEGORIA.MAPA &&
          !f?.mapaOverlay?.marcacoes?.length &&
          f.categoria !== GALERIA_CATEGORIA.DEPOIS &&
          f.categoria !== 'pos_imediato',
      ),
    };
  }, [fotosProc]);

  const activePhotos = grouped[selectedStage] || grouped.todas;
  const visiblePhotos = activePhotos.slice(0, 4);
  const remainingCount = Math.max(0, activePhotos.length - 4);

  const stageTabs = [
    { id: 'todas', label: 'Todas', count: grouped.todas.length },
    { id: 'avaliacao', label: 'Avaliação', count: grouped.avaliacao.length },
    { id: 'antes', label: 'Pré / Antes', count: grouped.antes.length },
    { id: 'mapa', label: 'Mapa', count: grouped.mapa.length },
    { id: 'depois', label: 'Pós / Depois', count: grouped.depois.length },
    { id: 'outro', label: 'Outras', count: grouped.outro.length },
  ].filter((t) => t.id === 'todas' || t.count > 0);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-bold uppercase tracking-wide text-[#94a3b8]">
          Fotos e Registros Visuais da Sessão ({fotosProc.length})
        </div>
      </div>

      {fotosProc.length === 0 ? (
        <p className="text-[13px] font-medium text-[#94a3b8]">Nenhuma foto vinculada a este procedimento.</p>
      ) : (
        <>
          {stageTabs.length > 2 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {stageTabs.map((tab) => {
                const active = selectedStage === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedStage(tab.id);
                    }}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                      active
                        ? 'bg-[#00a88e] text-white shadow-2xs'
                        : 'border border-[#e2e8f0] bg-white text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                        active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {visiblePhotos.map((foto, idx) => {
              const showMapa =
                Boolean(foto?.mapaOverlay?.marcacoes?.length) ||
                foto?.categoria === GALERIA_CATEGORIA.MAPA;
              const isLastWithOverflow = idx === 3 && remainingCount > 0;

              return (
                <button
                  key={foto.serverId || `foto-${idx}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPreviewPhoto(foto);
                  }}
                  className="group relative aspect-square w-full overflow-hidden rounded-xl border border-[#00a88e]/15 bg-[#e6f7f5] text-left transition-transform hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-[#00a88e]"
                >
                  {showMapa ? (
                    <GaleriaMapaThumb
                      url={foto.url}
                      mapaOverlay={foto.mapaOverlay}
                      alt=""
                      className="h-full w-full"
                      density="thumb"
                      pacienteId={selectedPatientId}
                      fotoId={foto.serverId}
                    />
                  ) : (
                    <GaleriaArquivoImage
                      url={foto.url}
                      alt=""
                      className="h-full w-full"
                      imgClassName="h-full w-full object-cover"
                      pacienteId={selectedPatientId}
                      fotoId={foto.serverId}
                    />
                  )}

                  {foto.categoria && (
                    <span className="absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur-xs">
                      {GALERIA_CATEGORIA_LABELS[foto.categoria] || foto.categoria}
                    </span>
                  )}

                  {isLastWithOverflow && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/65 text-white backdrop-blur-xs transition-opacity group-hover:bg-black/75">
                      <span className="text-[18px] font-black leading-none">+{remainingCount + 1}</span>
                      <span className="mt-1 text-[11px] font-bold">Ver todas</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
//   if (!mapa || !Array.isArray(mapa.marcacoes) || mapa.marcacoes.length === 0) return '';
//   const angulos = [...new Set(mapa.marcacoes.map((m) => humanizeCode(m.anguloFotoCodigo)).filter(Boolean))];
//   return angulos.join(', ');
// }

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

function resolveFichaTemplateId(detalhe, an) {
  const v =
    detalhe?.anamneseId
    ?? detalhe?.fichaId
    ?? detalhe?.anamneseFichaId
    ?? an?.anamneseId
    ?? an?.fichaId
    ?? an?.anamneseFichaId;
  return v != null && v !== '' ? String(v) : null;
}

function AnamneseTab({
  pacienteId,
  pacienteSexo = null,
  pacienteTelefone = '',
  roleUserId,
}) {
  const toast = useToast();
  const [anamneses, setAnamneses] = useState([]);
  const [detalhes, setDetalhes] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [fichaByAnId, setFichaByAnId] = useState({});

  const [editingAnamneseId, setEditingAnamneseId] = useState(null);
  const [editingRespostas, setEditingRespostas] = useState({});
  const [editingObservacoes, setEditingObservacoes] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [errosObrigatorias, setErrosObrigatorias] = useState(new Set());

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

        if (list.length > 0) setSelectedId(list[0].id);
      })
      .catch((err) => console.warn('Erro ao buscar anamneses:', err.message))
      .finally(() => setLoading(false));
  }, [pacienteId]);

  useEffect(() => {
    if (!selectedId) return;

    const targetId = selectedId;
    if (fichaByAnId[targetId]) return;

    const detalhe = detalhes[targetId];
    const an = anamneses.find((a) => a.id === targetId);
    const fichaTemplateId = resolveFichaTemplateId(detalhe, an);
    if (!fichaTemplateId) return;

    let cancelled = false;
    anamneseApi
      .getFicha(fichaTemplateId)
      .then((ficha) => {
        if (cancelled || !ficha) return;
        setFichaByAnId((prev) => ({ ...prev, [targetId]: ficha }));
      })
      .catch((err) => {
        console.warn('Erro ao carregar ficha da anamnese:', err?.message);
        toast.error('Não foi possível carregar o template da ficha. O botão Editar ficará indisponível.');
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId, detalhes, anamneses, fichaByAnId, toast]);

  const handleStartEditAnamnese = useCallback((anId, detalhe) => {
    const ficha = fichaByAnId[anId];
    if (!ficha) return;

    setEditingAnamneseId(anId);
    setEditingObservacoes(detalhe.observacoes || '');

    const mapTipos = buildPerguntaTipoById(ficha);
    const carregadas = mergeApiRespostasToMap(detalhe.respostas, mapTipos);
    setEditingRespostas(carregadas);
    setErrosObrigatorias(new Set());
  }, [fichaByAnId]);

  const handleCancelEdit = useCallback(() => {
    setEditingAnamneseId(null);
    setEditingRespostas({});
    setEditingObservacoes('');
    setErrosObrigatorias(new Set());
  }, []);

  const handleRespostaChange = useCallback((resposta) => {
    const key = String(resposta.perguntaId);
    setEditingRespostas((prev) => {
      const ficha = fichaByAnId[editingAnamneseId];
      const perguntas = (ficha?.itens || []).map((i) => i.pergunta).filter(Boolean);
      return aplicarMudancaResposta(prev, perguntas, { ...resposta, perguntaId: resposta.perguntaId });
    });
    setErrosObrigatorias((prev) => {
      if (!prev.has(key)) return prev;
      const cleared = new Set(prev);
      cleared.delete(key);
      return cleared;
    });
  }, [fichaByAnId, editingAnamneseId]);

  const handleSaveEdit = useCallback(async () => {
    const ficha = fichaByAnId[editingAnamneseId];
    if (!ficha || !roleUserId) {
      toast.error('Não é possível salvar: roleUserId ausente ou ficha não carregada.');
      return;
    }

    const orderedItens = sortFichaItens(ficha);
    const errors = new Set();
    const rowsApi = [];

    for (const item of orderedItens) {
      const pid = item.pergunta?.id;
      if (!pid) continue;
      if (!perguntaFilhaVisivel(item.pergunta, editingRespostas)) continue;
      const r = editingRespostas[pid] ?? editingRespostas[String(pid)];
      const rows = buildRespostaApiRows(item.pergunta, r);
      if (rows.length) {
        rowsApi.push(...rows);
      } else if (item.obrigatorio) {
        errors.add(String(pid));
      }
    }

    if (errors.size > 0) {
      setErrosObrigatorias(errors);
      toast.error('Preencha todas as perguntas obrigatórias.');
      return;
    }

    try {
      setEditSaving(true);
      const payload = { respostas: rowsApi, observacoes: editingObservacoes };
      const updated = await anamneseApi.editPaciente(pacienteId, editingAnamneseId, roleUserId, payload);

      setDetalhes((prev) => ({ ...prev, [editingAnamneseId]: updated }));
      setAnamneses((prev) => prev.map((a) => (a.id === editingAnamneseId ? updated : a)));

      toast.success('Anamnese atualizada com sucesso!');
      handleCancelEdit();
    } catch (e) {
      toast.error(e.message || 'Erro ao salvar anamnese.');
    } finally {
      setEditSaving(false);
    }
  }, [editingAnamneseId, fichaByAnId, roleUserId, editingRespostas, editingObservacoes, toast, handleCancelEdit, pacienteId]);

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

  const selected = anamneses.find((a) => a.id === selectedId) || anamneses[0];
  const detalhe = detalhes[selected.id] || selected;
  const rotuloPreenchimento = (an) => {
    const data = an.dataHora
      ? new Date(an.dataHora).toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'sem data';
    const estado = an.assinaturaPaciente ? 'Assinada' : 'Aguardando assinatura';
    return `${data} · ${an.anamneseNome || 'Anamnese'} · ${estado}`;
  };

  if (editingAnamneseId === selected.id) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-[16px] font-bold text-[#0f172a]">Modificar anamnese</h4>
          <button type="button" onClick={handleCancelEdit} className="text-[12px] font-semibold text-slate-500 hover:text-slate-700">
            Cancelar
          </button>
        </div>
        <div>
          <label className="text-[12px] font-bold text-slate-700">Observações da Anamnese</label>
          <textarea
            value={editingObservacoes}
            onChange={(e) => setEditingObservacoes(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#00a88e] focus:ring-2 focus:ring-[#00a88e]/15"
            placeholder="Observações ou queixa principal..."
          />
        </div>
        {groupItensByCategoria(sortFichaItens(fichaByAnId[selected.id])).map(({ categoriaNome, itens }, secIdx) => (
          <div key={categoriaNome || `sec-${secIdx}`} className={secIdx > 0 ? 'mt-6' : ''}>
            {categoriaNome ? (
              <div className="mb-3 border-b border-slate-100 pb-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{categoriaNome}</p>
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
              {itens.map((item) => {
                if (!perguntaFilhaVisivel(item.pergunta, editingRespostas)) return null;
                const isAlerta = item.pergunta?.prioridade === 'ALERTA';
                const pid = item.pergunta?.id;
                const hasErr = pid && errosObrigatorias.has(String(pid));
                return (
                  <div key={item.id} className={`min-w-0 ${isFullWidthItem(item) ? 'md:col-span-2' : ''} ${hasErr ? 'rounded-lg p-2 ring-1 ring-red-300' : ''}`}>
                    <DynamicQuestion
                      numero={item.ordem}
                      pergunta={item.pergunta}
                      resposta={editingRespostas[pid] ?? editingRespostas[String(pid)]}
                      onChange={handleRespostaChange}
                      alerta={isAlerta}
                      obrigatorio={item.obrigatorio}
                      searchFn={searchCatalogoHub(item.pergunta?.tipoResposta, {
                        sexo: pacienteSexo,
                        tipoAntecedenteCodigo: item.pergunta?.tipoAntecedenteCodigo,
                      })}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button type="button" onClick={handleCancelEdit} disabled={editSaving} className="rounded-lg px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200">
            Cancelar
          </button>
          <button type="button" onClick={handleSaveEdit} disabled={editSaving} className="rounded-lg bg-[#00a88e] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#00967f] disabled:opacity-50">
            {editSaving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <label className="block min-w-0">
        <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Preenchimentos</span>
        <select
          value={selected.id}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full max-w-xl rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-[#00a88e]"
        >
          {anamneses.map((an) => (
            <option key={an.id} value={an.id}>{rotuloPreenchimento(an)}</option>
          ))}
        </select>
      </label>
      <AnamneseDocumentoView
        pacienteId={pacienteId}
        preenchimentoId={selected.id}
        pacienteTelefone={pacienteTelefone}
        anamneseId={resolveFichaTemplateId(detalhe, selected)}
        onModificar={
          !selected.preenchidoPorPaciente && fichaByAnId[selected.id]
            ? () => handleStartEditAnamnese(selected.id, detalhe)
            : undefined
        }
      />
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

export function PatientProfileView({
  selectedPatient,
  patientDetailTab,
  setPatientDetailTab,
  setPatientView,
  setSelectedPatientCpf,
  getPatientInitials,
  onStartAttendance,
  onAgendarPaciente,
  onReagendarPlanoItem,
  onPlanoConcluido,
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
  clinicaInfo,
  perfilInfo,
  patientListBump,
}) {
  const toast = useToast();
  const { isNivel1, canEditPacientes, papel, canStartAnamnese, canSeeProntuario, canCreateNotaPaciente, canSeeGaleria, canSeeDocumentos } = usePapel();
  const { orgId } = useOrg();
  const patient = useMemo(() => selectedPatient || {}, [selectedPatient]);
  const alertasClinicos = useAlertasClinicos(selectedPatient?.id, {
    sexoPaciente: patient.sexo,
    refreshKey: patientListBump,
    onAlergiasResumo: (texto) => {
      mergePatientById?.(selectedPatient?.id, (prev) => ({ ...prev, alergias: texto }));
    },
  });
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
  const [cadastroReadOnly, setCadastroReadOnly] = useState(true);
  /** Preview da galeria: `authFetch` quando a imagem vem da API (precisa X-Org-Id). */
  const [galleryPreview, setGalleryPreview] = useState(null);
  const [sessoesExpandidas, setSessoesExpandidas] = useState({});
  const [categoriasEmEdicao, setCategoriasEmEdicao] = useState({});
  const [modoComparar, setModoComparar] = useState(false);
  const [compararSelecionadas, setCompararSelecionadas] = useState({
    avaliacao: null,
    posImediato: null,
    retorno: null,
  });
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
  const [gerarPdfBusy, setGerarPdfBusy] = useState(false);
  const gerarPdfInFlightRef = useRef(false);
  const [prontuarioExpanded, setProntuarioExpanded] = useState(() => ({}));
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
    if (foto._isRetornoSession) {
      setCompararSelecionadas((prev) => ({ ...prev, retorno: foto }));
      return;
    }
    const cat = foto.categoria || 'outro';
    if (cat === 'antes' || cat === 'avaliacao') {
      setCompararSelecionadas((prev) => ({ ...prev, avaliacao: foto }));
    } else if (cat === 'depois') {
      setCompararSelecionadas((prev) => ({ ...prev, posImediato: foto }));
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
    const preenchidos = [
      compararSelecionadas.avaliacao,
      compararSelecionadas.posImediato,
      compararSelecionadas.retorno,
    ].filter(Boolean).length;
    if (preenchidos >= 2) {
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
    setProntuarioVisibleCount(PRONTUARIO_PAGE_SIZE);
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

  const handleGerarPdf = useCallback(async () => {
    // Guarda de duplo-clique via ref (síncrono) — state é assíncrono e um clique
    // duplo rápido pode disparar esta função duas vezes antes do primeiro
    // setGerarPdfBusy(true) re-renderizar o botão como disabled.
    if (gerarPdfInFlightRef.current) return;
    gerarPdfInFlightRef.current = true;
    setGerarPdfBusy(true);

    try {
      if (!selectedPatient?.id) {
        toast.error('Paciente não carregado. Tente novamente.');
        return;
      }

      // 1. BLOQUEANTE: nenhum dado clínico é buscado antes da auditoria confirmar sucesso.
      try {
        await pacientesApi.registrarDownloadFicha(selectedPatient.id);
      } catch (auditErr) {
        toast.error(getApiErrorDetail(auditErr) || 'Não foi possível registrar a auditoria. PDF não gerado.');
        return;
      }

      // 2. Só busca dado clínico se o usuário tiver permissão, e só depois da auditoria.
      //    perfilClinico continua bloqueante (decisão já tomada); as buscas extras abaixo
      //    (anamnese estética, relatos de acompanhamento, mapas por procedimento, orientações)
      //    são best-effort — uma falha isolada degrada aquele campo pra "—", nunca aborta o PDF.
      let perfilClinico = null;
      let historicoProcedimentos = [];
      let manutencaoDisplay;
      let anamneseEstetica = {};
      if (canSeeProntuario) {
        try {
          const raw = await perfilClinicoApi.get(selectedPatient.id);
          perfilClinico = mapPerfilClinicoResponseToState(raw);
        } catch (perfilErr) {
          // Decisão do produto: aborta tudo, mesmo com o download já registrado na auditoria.
          toast.error(getApiErrorDetail(perfilErr) || 'Não foi possível carregar o perfil clínico. PDF não gerado.');
          return;
        }

        perfilClinico = {
          ...perfilClinico,
          gestacaoLactacao: filterAntecedentesPorCodigo(perfilClinico?.antecedentes, ANTECEDENTE_CODIGOS_GESTACAO_LACTACAO),
          cicatrizacao: filterAntecedentesPorCodigo(perfilClinico?.antecedentes, ANTECEDENTE_CODIGOS_CICATRIZACAO),
        };
        const etilismoChips = filterAntecedentesPorCodigo(perfilClinico?.antecedentes, ANTECEDENTE_CODIGOS_ETILISMO);

        const [anamneseListResult, relatosResult] = await Promise.allSettled([
          anamneseApi.listPaciente(selectedPatient.id),
          listarRelatosPorPaciente(selectedPatient.id),
        ]);

        if (anamneseListResult.status === 'fulfilled') {
          const list = Array.isArray(anamneseListResult.value) ? anamneseListResult.value : [];
          const maisRecente = [...list].sort((a, b) => new Date(b.dataHora || 0) - new Date(a.dataHora || 0))[0];
          if (maisRecente) {
            try {
              const detalhe = await anamneseApi.getPaciente(selectedPatient.id, maisRecente.id);
              anamneseEstetica = buildAnamneseEsteticaFromRespostas(detalhe?.respostas);
              if (detalhe?.dataHora) {
                anamneseEstetica.dataAtualizacaoDisplay = new Date(detalhe.dataHora).toLocaleDateString('pt-BR', {
                  timeZone: 'America/Sao_Paulo',
                });
              }
            } catch {
              // Sem anamnese estética disponível — Seção 02 sai só com "—", não bloqueia o PDF.
            }
          }
        }
        if (etilismoChips.length > 0) {
          anamneseEstetica.etilismo = etilismoChips.map((c) => c.nome).join('; ');
        }

        const relatos = relatosResult.status === 'fulfilled' ? relatosResult.value : [];
        const intercorrenciaMap = buildIntercorrenciaMapFromRelatos(relatos);

        const procedimentosParaFicha = sortedApiProceduresEarly;

        // Região aplicada (coluna "Região e técnica") desativada: nem o sufixo "Nome — Região"
        // do catálogo nem o mapa de aplicação (que guarda ângulo de foto, não região anatômica)
        // são um campo de região de verdade no sistema hoje. Lógica comentada pra reativar
        // quando existir um campo estruturado de região em tb_procedimento_feito.
        // const [mapasResults, orientacoesResults] = await Promise.all([
        //   Promise.allSettled(procedimentosParaFicha.map((proc) => mapasApi.buscarPorProcedimento(proc.id))),
        //   Promise.allSettled(procedimentosParaFicha.map((proc) => orientacoesApi.listar(proc.id))),
        // ]);
        // const mapaByProcId = new Map(
        //   procedimentosParaFicha.map((proc, idx) => [
        //     String(proc.id),
        //     mapasResults[idx]?.status === 'fulfilled' ? mapasResults[idx].value : null,
        //   ]),
        // );
        // const splitNomeRegiao = (nomeCompleto) => {
        //   const [procNome, ...resto] = String(nomeCompleto || '').split(' — ');
        //   return { procNome: procNome.trim(), regiaoDoNome: resto.join(' — ').trim() };
        // };

        // Mesmo agrupamento pai → retorno já usado na timeline do prontuário (nestProcedimentosTimeline):
        // cada retorno aparece logo abaixo do procedimento de origem, não misturado na mesma linha.
        const arvore = nestProcedimentosTimeline(procedimentosParaFicha);
        const linhasComProfundidade = flattenNestedTimelineRoots(arvore);

        historicoProcedimentos = linhasComProfundidade.map(({ proc, depth }) => {
          const dataDisplay = proc.criadoEm
            ? new Date(proc.criadoEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
            : '';
          if (depth > 0) {
            return {
              dataDisplay,
              nome: `• Retorno — ${proc.isRetoque ? 'retoque' : 'avaliação'}`,
              profissional: proc.profissionalNome,
              regiaoDisplay: '',
              intercorrenciaDisplay: intercorrenciaMap[proc.id],
            };
          }
          return {
            dataDisplay,
            nome: proc.procedimentoNome || proc.nome || 'Procedimento',
            profissional: proc.profissionalNome,
            regiaoDisplay: '',
            intercorrenciaDisplay: intercorrenciaMap[proc.id],
          };
        });

        // Manutenção = o que foi feito no retorno mais recente (retoque com produto vs. só avaliação),
        // não a data do próximo retorno agendado.
        const retornosOrdenados = procedimentosParaFicha
          .filter((p) => p.procedimentoFeitoOrigemId != null && String(p.procedimentoFeitoOrigemId).trim() !== '')
          .sort((a, b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0));
        const ultimoRetorno = retornosOrdenados[0];
        manutencaoDisplay = ultimoRetorno
          ? ultimoRetorno.isRetoque
            ? 'Retoque necessário'
            : 'Sem retoque (avaliação)'
          : undefined;
      }

      // 2b. Buscas independentes de canSeeProntuario, também best-effort e em paralelo.
      const [orgsResult, documentosResult, galeriaResult, planosResult] = await Promise.allSettled([
        organizacaoApi.getMinhas(),
        canSeeDocumentos ? pacientesApi.getDocumentosAssinados(selectedPatient.id) : Promise.resolve(null),
        canSeeGaleria ? pacientesGaleriaApi.list(selectedPatient.id) : Promise.resolve(null),
        planejamentosApi.listarPorPaciente(selectedPatient.id),
      ]);

      let responsavelTecnicoNome;
      let responsavelTecnicoRegistro;
      if (orgsResult.status === 'fulfilled') {
        const orgs = Array.isArray(orgsResult.value) ? orgsResult.value : [];
        const orgAtual = orgs.find((o) => String(o.id) === String(orgId));
        responsavelTecnicoNome = orgAtual?.responsavelTecnicoNome;
        responsavelTecnicoRegistro = orgAtual?.responsavelTecnicoRegistro;
      }

      let documentos = [];
      if (canSeeDocumentos && documentosResult.status === 'fulfilled' && documentosResult.value) {
        const list = Array.isArray(documentosResult.value) ? documentosResult.value : [];
        documentos = list.map((d) => ({
          dataDisplay: d.dataAssinatura
            ? new Date(d.dataAssinatura).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
            : '',
          titulo: d.titulo,
          tipo: 'Termo',
          situacao: d.statusCodigo === 'RECUSADO' || d.recusadoEm ? 'Recusado' : 'Assinado',
        }));
      }

      let planoAtivo = null;
      if (planosResult.status === 'fulfilled') {
        const planos = Array.isArray(planosResult.value) ? planosResult.value : [];
        const ativo = planos.find((p) => p.statusCodigo === 'ativo');
        if (ativo) {
          const { feitas, total } = calcSessoesPlano(ativo.itens);
          planoAtivo = {
            nomeDisplay: 'Plano de tratamento',
            dataCriacaoDisplay: formatCreatedAtPtBr(ativo.criadoEm),
            sessoesFeitas: feitas,
            sessoesTotal: total,
            percentualDisplay: total > 0 ? `${Math.round((feitas / total) * 100)}%` : '0%',
            manutencaoSugeridaDisplay: manutencaoDisplay,
          };
        }
      }

      let fotos = [];
      if (canSeeGaleria && galeriaResult.status === 'fulfilled' && galeriaResult.value) {
        const itensNorm = normalizePacienteGaleriaResponse(galeriaResult.value);
        const sessoes = groupGaleriaItemsBySession(itensNorm);
        fotos = (sessoes || []).map((s) => ({
          rotulo: s.nomeProcedimento || `Sessão ${s.sessionNumber ?? ''}`.trim(),
          dataDisplay: s.dataISO ? formatDataSessaoPtBr(s.dataISO) : '',
          itens: (s.fotos || []).map((f) => ({
            anguloDisplay: [GALERIA_CATEGORIA_LABELS?.[f.categoria], f.tipoFotoCodigo ? humanizeCode(f.tipoFotoCodigo) : '']
              .filter(Boolean)
              .join(' — '),
          })),
        }));
      }

      // 3. Geração do PDF em try/catch próprio — erro aqui não pode travar o botão em
      //    "Gerando..." pra sempre, e a mensagem deve ser específica.
      try {
        const { generateFichaPacientePdf } = await import('../../utils/pdfGenerator.js');
        generateFichaPacientePdf({
          clinicaCtx: {
            nome: clinicaInfo?.nome,
            endereco: clinicaInfo?.endereco,
            telefone: clinicaInfo?.telefone,
            cnpj: clinicaInfo?.cnpj,
          },
          pacienteCtx: buildPacienteCtxForFicha(patient),
          numeroProntuario: patient.cpf ? maskCPF(String(patient.cpf).replace(/\D/g, '')) : '',
          dataCadastroDisplay: formatCreatedAtPtBr(patient.createdAt),
          statusLabel: (patient.status || 'ativo') !== 'inativo' ? 'Ativo' : 'Inativo',
          estatisticas: {
            ultimaVisitaDisplay: ultimaVisitaCardDisplay,
            proximoRetornoDisplay: proximoRetornoKpiDisplay,
            totalAtendimentos: sortedApiProceduresEarly.length,
            responsavelTecnicoNome,
            responsavelTecnicoRegistro,
          },
          canSeeProntuario,
          canSeeDocumentos,
          canSeeGaleria,
          perfilClinico,
          anamneseEstetica,
          historico: { procedimentos: historicoProcedimentos, planoAtivo: planoAtivo || {} },
          documentos,
          fotos,
        });
      } catch (pdfErr) {
        console.error('[handleGerarPdf] falha ao gerar PDF', pdfErr);
        toast.error('Não foi possível gerar o PDF. Tente novamente.');
        return;
      }
    } finally {
      // Sempre libera o botão — sucesso, qualquer abort, ou crash do jsPDF.
      setGerarPdfBusy(false);
      gerarPdfInFlightRef.current = false;
    }
  }, [
    selectedPatient,
    canSeeProntuario,
    canSeeDocumentos,
    canSeeGaleria,
    sortedApiProceduresEarly,
    proximoRetornoKpiDisplay,
    ultimaVisitaCardDisplay,
    clinicaInfo,
    patient,
    orgId,
    toast,
  ]);

  useEffect(() => {
    if (
      patientDetailTab === 'timeline' ||
      patientDetailTab === 'cadastro' ||
      patientDetailTab === 'atendimento'
    ) {
      setPatientDetailTab('planos');
    }
  }, [patientDetailTab, setPatientDetailTab]);

  const isEditing = Boolean(editing);

  const applyProfilePhoto = useCallback(
    (dataUrl) => {
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

      const previousPhotoUrl = selectedPatient.fotoPerfilUrl;
      const volatileUrl = URL.createObjectURL(file);
      mergePatientById?.(selectedPatient.id, (prev) => ({ ...prev, fotoPerfilUrl: volatileUrl }));

      setProfilePhotoBusy(true);
      try {
        const updated = await pacientesApi.uploadFotoPerfil(selectedPatient.id, file);
        const sameId =
          updated &&
          typeof updated === 'object' &&
          String(updated.id) === String(selectedPatient.id);
        const dto = sameId ? updated : await pacientesApi.get(selectedPatient.id);
        mergeServerPatientIntoState(dto);
        URL.revokeObjectURL(volatileUrl);
        refreshPatients?.();
        toast.success('Foto de perfil salva no servidor.');
      } catch (err) {
        mergePatientById?.(selectedPatient.id, (prev) => ({ ...prev, fotoPerfilUrl: previousPhotoUrl }));
        URL.revokeObjectURL(volatileUrl);
        toast.error(err?.message || 'Não foi possível enviar a foto.');
      } finally {
        setProfilePhotoBusy(false);
      }
      return;
    }

    try {
      const dataUrl = await compressImageFileToJpegDataUrl(file, 480, 0.86);
      applyProfilePhoto(dataUrl);
      toast.success('Foto de perfil atualizada (será enviada ao salvar o cadastro).');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível usar esta imagem.');
    }
  };


  const openEditProfile = useCallback(() => {
    setEditFormErrors({});
    setProfileSaveError('');
    setCadastroReadOnly(true);
    const { countryCode, nationalNumber } = parsePhoneFromApi(patient.telefone || '', 'BR');
    const cpfRaw = String(patient.cpf || '').replace(/\D/g, '');
    const rgStr = patient.rg != null ? String(patient.rg) : '';
    setEditing({
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
      dataNascimentoIso: patient.dataNascimento || '',
      dataNascimentoDisplay: isoDateToBrazilianDisplay(patient.dataNascimento || ''),
      idade: patient.idade ?? '',
    });
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

  const proceduresById = useMemo(() => {
    const map = new Map();
    (apiProcedures || []).forEach((p) => {
      if (p?.id != null) map.set(String(p.id), p);
    });
    return map;
  }, [apiProcedures]);

  const galeriaSessionsForView = useMemo(() => {
    if (galeriaBackend !== 'api') return [];
    const filtered = filterGaleriaItemsForUi(apiGaleriaItems, {
      categoria: galeriaFilterCategoria,
      mesAno: galeriaFilterMes,
      procedimentoToken: galeriaFilterProcedimento,
    });
    const sessions = groupGaleriaItemsBySession(filtered);
    return sessions.map((sess) => {
      const proc = proceduresById.get(String(sess.fotos[0]?.procedimentoFeitoId));
      const origemId = proc?.procedimentoFeitoOrigemId ?? proc?.procedimento_feito_origem_id;
      const origem = origemId != null ? proceduresById.get(String(origemId)) : null;
      const isRetorno = Boolean(origem);
      const origemDataIso = origem ? procedureOccurredInstantIso(origem) : null;
      const fotos = isRetorno
        ? sess.fotos.map((f) => ({ ...f, _isRetornoSession: true }))
        : sess.fotos;
      return {
        ...sess,
        fotos,
        isRetorno,
        origemProcedimentoNome: origem?.procedimentoNome || null,
        origemDataLabel: origemDataIso ? formatDataSessaoPtBr(origemDataIso.slice(0, 10)) : null,
      };
    });
  }, [galeriaBackend, apiGaleriaItems, galeriaFilterCategoria, galeriaFilterMes, galeriaFilterProcedimento, proceduresById]);

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
  }, [selectedPatient?.id, patientListBump]);

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
  }, [selectedPatient?.id, patientListBump]);

  // Refresh silencioso da galeria a cada 45 minutos (2700000ms)
  // Evita que URLs pré-assinadas com TTL de 1 hora expirem durante uso prolongado
  useEffect(() => {
    if (!selectedPatient?.id) return;
    const intervalId = setInterval(() => {
      refreshGaleriaFromApi();
    }, 45 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [selectedPatient?.id, refreshGaleriaFromApi]);


  useEffect(() => {
    setAlertasModalOpen(false);
  }, [selectedPatient?.id]);

  const { alertasAnamnese, alertasAlergia, alertasPerfil, isLoading: alertasClinicosLoading } = alertasClinicos;

  useEffect(() => {
    const pacienteId = selectedPatient?.id;
    if (!pacienteId) return;
    mergePatientById?.(pacienteId, (prev) => ({
      ...prev,
      alertasClinicosAtivos: [
        ...alertasPerfil.map((a) => ({ titulo: a.titulo, valor: a.valor, origem: 'perfil' })),
        ...alertasAnamnese.map((a) => ({ titulo: a.titulo, valor: a.valor, origem: 'anamnese' })),
      ],
    }));
  }, [alertasPerfil, alertasAnamnese, selectedPatient?.id, mergePatientById]);

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

  const nestedApiProcedures = useMemo(
    () => nestProcedimentosTimeline(apiProcedures || []),
    [apiProcedures],
  );

  const perfilRecentMax = 3;
  const perfilRecentRoots = useMemo(
    () => nestedApiProcedures.slice(0, perfilRecentMax),
    [nestedApiProcedures],
  );

  const [prontuarioFilter, setProntuarioFilter] = useState('todos');
  const [expandedProntuarioRetornosMap, setExpandedProntuarioRetornosMap] = useState({});
  const PRONTUARIO_PAGE_SIZE = 15;
  const [prontuarioVisibleCount, setProntuarioVisibleCount] = useState(PRONTUARIO_PAGE_SIZE);

  const toggleProntuarioRetornos = useCallback((rootId) => {
    setExpandedProntuarioRetornosMap((prev) => ({
      ...prev,
      [rootId]: !prev[rootId],
    }));
  }, []);

  const filteredProntuarioRoots = useMemo(() => {
    if (prontuarioFilter === 'todos') return nestedApiProcedures;
    if (prontuarioFilter === 'procedimentos') {
      return nestedApiProcedures.filter(
        (p) =>
          String(p.tipoProcedimentoCodigo || '').toLowerCase() !== 'retorno' &&
          String(p.tipoProcedimentoCodigo || '').toLowerCase() !== 'consulta',
      );
    }
    if (prontuarioFilter === 'consultas') {
      return nestedApiProcedures.filter(
        (p) => String(p.tipoProcedimentoCodigo || '').toLowerCase() === 'consulta',
      );
    }
    if (prontuarioFilter === 'retornos') {
      return nestedApiProcedures.filter(
        (p) =>
          String(p.tipoProcedimentoCodigo || '').toLowerCase() === 'retorno' ||
          Boolean(p.isRetoque) ||
          (Array.isArray(p.retornos) && p.retornos.length > 0),
      );
    }
    return nestedApiProcedures;
  }, [nestedApiProcedures, prontuarioFilter]);

  const hasMoreProntuario = prontuarioVisibleCount < filteredProntuarioRoots.length;
  const prontuarioRootsVisible = hasMoreProntuario
    ? filteredProntuarioRoots.slice(0, prontuarioVisibleCount)
    : filteredProntuarioRoots;

  const flatProntuarioVisible = useMemo(() => {
    const out = [];
    for (const root of prontuarioRootsVisible) {
      out.push({ proc: root, depth: 0, rootId: root.id });
      const isRetornosOpen = Boolean(expandedProntuarioRetornosMap[root.id]);
      if (isRetornosOpen && Array.isArray(root.retornos)) {
        for (const child of root.retornos) {
          out.push({ proc: child, depth: 1, rootId: root.id });
        }
      }
    }
    return out;
  }, [prontuarioRootsVisible, expandedProntuarioRetornosMap]);

  const galeriaItemsForProcedure = useCallback(
    (proc) => {
      const nome = (proc?.procedimentoNome || proc?.nome || '').trim();
      const pid = proc?.id != null && proc?.id !== '' ? String(proc.id) : '';
      return (apiGaleriaItems || []).filter((it) => {
        const feitoId = it.procedimentoFeitoId != null ? String(it.procedimentoFeitoId) : null;
        if (pid && feitoId === pid) return true;
        if (
          nome &&
          (it.procedimentoFeitoId == null || String(it.procedimentoFeitoId).trim() === '') &&
          it.nomeProcedimento &&
          String(it.nomeProcedimento).trim() === nome
        ) {
          return true;
        }
        return false;
      });
    },
    [apiGaleriaItems],
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
      const procedimentoFeitoId = resolveProcedimentoFeitoIdForUpload(sess, categoria);
      setGaleriaUploadBusy(true);
      try {
        const webp = await convertToWebP(file, 0.85, 1920);
        const tipoFotoCodigo =
          categoria === GALERIA_CATEGORIA.ANTES
            ? 'ANTES'
            : categoria === GALERIA_CATEGORIA.PLANEJAMENTO
              ? 'PLANEJAMENTO'
              : categoria === GALERIA_CATEGORIA.AVALIACAO
                ? 'AVALIACAO'
                : categoria === GALERIA_CATEGORIA.MAPA
                  ? 'MAPA'
                  : categoria === GALERIA_CATEGORIA.DEPOIS
                    ? 'DEPOIS'
                    : null;
        const uploadOpts = {
          roleUserId,
          procedimentoFeitoId: procedimentoFeitoId ?? undefined,
          dataReferencia: sess.dataISO !== 'sem-data' ? sess.dataISO : undefined,
          legenda: formatGaleriaLegendaForUpload(
            categoria,
            resolveNomeProcedimentoForUpload(sess, categoria),
          ),
        };
        if (tipoFotoCodigo) uploadOpts.tipoFotoCodigo = tipoFotoCodigo;
        await pacientesGaleriaApi.upload(pacienteId, webp, uploadOpts);
        await refreshGaleriaFromApi();
        toast.success('Foto adicionada à galeria.');
      } catch (e) {
        toast.error(formatPacienteGaleriaError(e));
      } finally {
        setGaleriaUploadBusy(false);
      }
    },
    [selectedPatient?.id, roleUserId, refreshGaleriaFromApi, toast],
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
      setPatientDetailTab('planos');
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
          setPatientDetailTab('planos');
        }}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="mb-2 overflow-hidden rounded-[20px] border border-vivid-teal-700/55 shadow-agenda-glow">
            <ProfileHero
              patient={patient}
              getPatientInitials={getPatientInitials}
              isPerfilAtivo={isPerfilAtivo}
              canEditPacientes={canEditPacientes}
              canStartAnamnese={canStartAnamnese}
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
              onGerarPdf={handleGerarPdf}
              gerarPdfBusy={gerarPdfBusy}
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
                className="relative flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg"
              >
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#00a88e] text-white shadow-sm">
                      <UserIcon className="h-6 w-6" strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-[18px] font-bold text-slate-900 sm:text-[20px]">
                        {cadastroReadOnly ? 'Cadastro do Paciente' : 'Editar Cadastro'}
                      </h3>
                      <p className="text-[13px] font-medium text-slate-500">
                        {cadastroReadOnly ? 'Visualização dos dados cadastrais' : 'Atualize os dados pessoais do paciente'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {cadastroReadOnly && (
                      <button
                        type="button"
                        onClick={() => setCadastroReadOnly(false)}
                        className="flex items-center gap-1.5 rounded-lg border border-[#00a88e] bg-[#e6f7f5] px-3.5 py-2 text-[13px] font-bold text-[#00a88e] transition hover:bg-[#00a88e] hover:text-white shadow-sm"
                      >
                        <Pencil className="h-4 w-4" strokeWidth={2.25} />
                        <span>Editar</span>
                      </button>
                    )}
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
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 bg-[#f8fbfb]">
                  <PatientForm
                    mode="edit"
                    variant="modal"
                    readOnly={cadastroReadOnly}
                    showFormHeading={false}
                    formHeading=""
                    nome={editing.nome}
                    dataNascimentoDisplay={editing.dataNascimentoDisplay}
                    idade={editing.idade}
                    sexo={editing.sexo}
                    estadoCivilId={editing.estadoCivilId}
                    profissaoId={editing.profissaoId}
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
                        const digits = sanitizeBirthDateDigits(raw);
                        const display = formatBirthDigitsBR(digits);
                        let iso = '';
                        let age = p.idade;
                        if (digits.length === 8) {
                          const r = validateBirthDateDigits8(digits);
                          if (r.ok) {
                            iso = r.iso;
                            const calculatedAge = calculateAgeFromISODate(r.iso);
                            if (calculatedAge !== '') age = calculatedAge;
                          }
                        }
                        return { ...p, dataNascimentoDisplay: display, dataNascimentoIso: iso, idade: age };
                      });
                    }}
                    onSexoChange={(value) => setEditing((p) => p ? { ...p, sexo: value } : p)}
                    onEstadoCivilChange={(value) => setEditing((p) => p ? { ...p, estadoCivilId: value } : p)}
                    onProfissaoIdChange={(value) => setEditing((p) => p ? { ...p, profissaoId: value } : p)}
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
                { key: 'planos', label: 'Planos', title: 'Planos de tratamento', icon: BookOpen },
                canSeeProntuario && { key: 'prontuario', label: 'Prontuário', title: 'Prontuário Eletrônico', icon: ClipboardList },
                canStartAnamnese && { key: 'anamnese', label: 'Anamnese', title: 'Anamnese', icon: Activity },
                canSeeGaleria && { key: 'galeria', label: 'Galeria', title: 'Galeria', icon: ImageIcon },
                canSeeDocumentos && { key: 'documentos', label: 'Documentos', title: 'Documentos Assinados', icon: FileText },
              ].filter(Boolean).map(({ key, label, title, icon }) => {
                const TabIcon = icon;
                const active = patientDetailTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    title={title}
                    aria-label={title}
                    onClick={() => setPatientDetailTab(key)}
                    className={`flex min-h-[44px] min-w-0 flex-1 items-center justify-center gap-0.5 whitespace-nowrap px-2 py-2.5 text-[11px] font-semibold transition-colors sm:gap-1 sm:px-3 sm:text-[12px] ${active
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
                  {!canStartAnamnese ? (
                    <div className="rounded-xl border border-rose-100/60 bg-rose-50/30 p-4 text-center">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-500 border border-rose-100/60 shadow-sm">
                        <Shield className="h-5 w-5" />
                      </div>
                      <p className="mt-2 text-xs font-semibold text-rose-700">Acesso Limitado</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Seu perfil não possui permissão para iniciar atendimentos.
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
                          title={!canSeeProntuario ? 'Acesso restrito' : (sortedApiProcedures[0]?.procedimentoNome || sortedApiProcedures[0]?.nome)}
                        >
                          {!canSeeProntuario ? 'Acesso restrito' : (sortedApiProcedures[0]?.procedimentoNome || sortedApiProcedures[0]?.nome || '—')}
                        </div>
                      </div>
                      <div className="rounded-lg border border-[#f1f5f9] bg-[#f8fafc] p-3">
                        <div className="text-[11px] font-medium uppercase tracking-wide text-[#94a3b8]">Próximo retorno</div>
                        <div className="mt-0.5 text-[14px] font-semibold text-[#0f172a]">
                          {selectedPatient?.proximoRetorno || selectedPatient?.proximo_retorno || '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 mt-5 flex flex-wrap items-center justify-between gap-2">
                      <h5 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#94a3b8]">
                        Histórico recente
                      </h5>
                      {canSeeProntuario && detailLoading ? (
                        <span className="inline-flex items-center gap-2 text-[12px] font-medium text-[#64748b]">
                          <Loader2 className="h-4 w-4 animate-spin text-[#00a88e]" aria-hidden />
                          Carregando…
                        </span>
                      ) : null}
                    </div>
                    {!canSeeProntuario ? (
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
                          {perfilRecentRoots.map((root, idx) => {
                            const proc = root;
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
                            const retornoCount = (root.retornos || []).length;
                            const fotosProc = galeriaItemsForProcedure(proc);
                            const assinaturaVinculada = (assinaturas || []).find(
                              (a) =>
                                a &&
                                a.procedimentoFeitoId != null &&
                                proc.id != null &&
                                String(a.procedimentoFeitoId) === String(proc.id),
                            );
                            const hasObservacao = Boolean(proc.observacao && String(proc.observacao).trim());
                            const isExpanded = Boolean(expandedProntuarioRetornosMap[root.id]);

                            return (
                              <React.Fragment key={rowKey}>
                                <ProcedureTimelineEntry>
                                  <ProcedureTimelinePreviewCard
                                    dateLabel={dateLabel}
                                    timeLabel={timeLabel}
                                    procedureName={nomeProc}
                                    professionalName={proc.profissionalNome || '—'}
                                    retornoCount={retornoCount}
                                    statusNome={proc.statusNome || ''}
                                    fotosCount={fotosProc.length}
                                    hasTermo={Boolean(assinaturaVinculada)}
                                    hasObservacao={hasObservacao}
                                    onToggleRetornos={() => toggleProntuarioRetornos(root.id)}
                                    isRetornosExpanded={isExpanded}
                                    onPress={() => setPatientDetailTab('prontuario')}
                                  />
                                </ProcedureTimelineEntry>
                                {isExpanded &&
                                  Array.isArray(root.retornos) &&
                                  root.retornos.map((child, cIdx) => {
                                    const childCriado = child.criadoEm ? new Date(child.criadoEm) : null;
                                    const childDateLabel = childCriado
                                      ? childCriado.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                                      : '—';
                                    const childTimeLabel = childCriado
                                      ? childCriado.toLocaleTimeString('pt-BR', {
                                          timeZone: 'America/Sao_Paulo',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })
                                      : '';
                                    const childNomeProc = child.procedimentoNome || child.nome || 'Procedimento';
                                    const childFotos = galeriaItemsForProcedure(child);
                                    const childAssinatura = (assinaturas || []).find(
                                      (a) =>
                                        a &&
                                        a.procedimentoFeitoId != null &&
                                        child.id != null &&
                                        String(a.procedimentoFeitoId) === String(child.id),
                                    );
                                    return (
                                      <ProcedureTimelineEntry key={child.id || `child-${cIdx}`} depth={1}>
                                        <ProcedureTimelinePreviewCard
                                          dateLabel={childDateLabel}
                                          timeLabel={childTimeLabel}
                                          procedureName={childNomeProc}
                                          professionalName={child.profissionalNome || '—'}
                                          depth={1}
                                          isRetoque={Boolean(child.isRetoque)}
                                          statusNome={child.statusNome || ''}
                                          fotosCount={childFotos.length}
                                          hasTermo={Boolean(childAssinatura)}
                                          hasObservacao={Boolean(child.observacao && String(child.observacao).trim())}
                                          onPress={() => setPatientDetailTab('prontuario')}
                                        />
                                      </ProcedureTimelineEntry>
                                    );
                                  })}
                              </React.Fragment>
                            );
                          })}
                        </ProcedureTimelineRail>
                        {nestedApiProcedures.length > 0 && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => setPatientDetailTab('prontuario')}
                              className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-white px-4 py-2.5 text-[13px] font-bold text-[#00a88e] shadow-2xs transition-all hover:border-[#cbd5e1] hover:bg-[#f8fafc]"
                            >
                              <span>Ver prontuário completo ({nestedApiProcedures.length} {nestedApiProcedures.length === 1 ? 'procedimento' : 'procedimentos'})</span>
                              <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {patientDetailTab === 'prontuario' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <ProcedureTimelineHeading title="Prontuário eletrônico" />
                    {canSeeProntuario && detailLoading ? (
                      <span className="inline-flex items-center gap-2 text-[12px] font-medium text-[#64748b]">
                        <Loader2 className="h-4 w-4 animate-spin text-[#00a88e]" aria-hidden />
                        Carregando procedimentos…
                      </span>
                    ) : null}
                  </div>

                  {canSeeProntuario && nestedApiProcedures.length >= 3 && (
                    <div className="flex flex-wrap items-center gap-1.5 pb-1">
                      {[
                        { id: 'todos', label: 'Todos', count: nestedApiProcedures.length },
                        {
                          id: 'procedimentos',
                          label: 'Procedimentos',
                          count: nestedApiProcedures.filter(
                            (p) =>
                              String(p.tipoProcedimentoCodigo || '').toLowerCase() !== 'retorno' &&
                              String(p.tipoProcedimentoCodigo || '').toLowerCase() !== 'consulta',
                          ).length,
                        },
                        {
                          id: 'consultas',
                          label: 'Consultas',
                          count: nestedApiProcedures.filter(
                            (p) => String(p.tipoProcedimentoCodigo || '').toLowerCase() === 'consulta',
                          ).length,
                        },
                        {
                          id: 'retornos',
                          label: 'Retornos',
                          count: nestedApiProcedures.filter(
                            (p) =>
                              String(p.tipoProcedimentoCodigo || '').toLowerCase() === 'retorno' ||
                              Boolean(p.isRetoque) ||
                              (Array.isArray(p.retornos) && p.retornos.length > 0),
                          ).length,
                        },
                      ]
                        .filter((f) => f.id === 'todos' || f.count > 0)
                        .map((f) => {
                          const active = prontuarioFilter === f.id;
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => {
                                setProntuarioFilter(f.id);
                                setProntuarioVisibleCount(PRONTUARIO_PAGE_SIZE);
                              }}
                              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                                active
                                  ? 'bg-[#00a88e] text-white shadow-2xs'
                                  : 'border border-[#e2e8f0] bg-white text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]'
                              }`}
                            >
                              <span>{f.label}</span>
                              <span
                                className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                                  active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {f.count}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  )}
                  {!canSeeProntuario ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-[#e2e8f0] rounded-[18px]">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-500 mb-4 border border-rose-100/60 shadow-inner">
                        <Shield className="h-6 w-6" />
                      </div>
                      <h3 className="text-base font-bold text-slate-800">Procedimentos Ocultos</h3>
                      <p className="mt-2 text-xs text-slate-500 max-w-sm leading-relaxed">
                        Os procedimentos clínicos e históricos de sessões deste paciente estão ocultos devido à sua permissão de acesso.
                      </p>
                    </div>
                  ) : (
                    !sortedApiProcedures.length ? (
                      <p className="text-center py-10 text-[#94a3b8] text-[14px] font-medium">Nenhum procedimento registrado ainda.</p>
                    ) : (
                        <>
                          <ProcedureTimelineRail>
                          {flatProntuarioVisible.map(({ proc, depth }, idx) => {
                            const rowKey =
                              proc.id != null && proc.id !== ''
                                ? String(proc.id)
                                : `proc-${idx}`;
                            const open = Boolean(prontuarioExpanded[rowKey]);
                            const dataLabel = proc.criadoEm
                              ? new Date(proc.criadoEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) +
                                ' · ' +
                                new Date(proc.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
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
                              <ProcedureTimelineEntry key={rowKey} depth={depth}>
                                <div
                                  className={`overflow-hidden rounded-xl border transition-all ${
                                    depth > 0
                                      ? 'border-sky-200/80 border-l-4 border-l-sky-500 bg-[#f0f9ff]/40 shadow-2xs hover:shadow-xs'
                                      : 'border-[#e2e8f0] border-l-4 border-l-[#00a88e] bg-white shadow-xs hover:shadow-sm'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => toggleProntuarioRow(rowKey)}
                                    className={`flex w-full min-h-[44px] items-start gap-2.5 px-3.5 py-3 text-left transition-colors sm:gap-3.5 sm:px-4 sm:py-3.5 ${
                                      depth > 0 ? 'hover:bg-sky-50/50' : 'hover:bg-[#f8fafc]'
                                    }`}
                                    aria-expanded={open}
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-medium text-[#64748b] sm:text-[13px]">
                                        <Calendar className="h-3.5 w-3.5 shrink-0 text-[#00a88e]" strokeWidth={2} aria-hidden />
                                        <span className="truncate">{dataLabel}</span>
                                        {depth === 0 && Array.isArray(proc.retornos) && proc.retornos.length > 0 && (
                                          <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50/80 px-2 py-0.2 text-[10px] font-bold text-sky-800">
                                            <span>🔄</span>
                                            <span>
                                              {proc.retornos.length}{' '}
                                              {proc.retornos.length === 1 ? 'retorno' : 'retornos'}
                                            </span>
                                          </span>
                                        )}
                                      </div>
                                      <p className="mt-1 truncate text-[14px] font-bold leading-snug text-[#0f172a] sm:text-[15px]" title={nomeProc}>
                                        {nomeProc}
                                      </p>
                                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-[#64748b]">
                                        <p className="flex items-center gap-1.5 truncate font-medium" title={proc.profissionalNome || undefined}>
                                          <Stethoscope className="h-3.5 w-3.5 shrink-0 text-[#94a3b8]" strokeWidth={2} aria-hidden />
                                          <span className="truncate">Realizado por {proc.profissionalNome || '—'}</span>
                                        </p>
                                        {fotosProc.length > 0 && (
                                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                                            <ImageIcon className="h-3 w-3 text-slate-400" />
                                            {fotosProc.length} {fotosProc.length === 1 ? 'foto' : 'fotos'}
                                          </span>
                                        )}
                                        {assinaturaVinculada && (
                                          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200/80 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                                            <FileText className="h-3 w-3 text-emerald-600" />
                                            Termo assinado
                                          </span>
                                        )}
                                        {proc.observacao && String(proc.observacao).trim() && (
                                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                                            <StickyNote className="h-3 w-3 text-slate-400" />
                                            Obs
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex shrink-0 flex-col items-end gap-1.5 self-center">
                                      {depth > 0 ? (
                                        <RetornoTimelineBadge isRetoque={Boolean(proc.isRetoque)} />
                                      ) : null}
                                      {proc.statusNome ? (
                                        <span className="shrink-0 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
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

                                  {/* Botão de expansão/recolhimento explícito de retornos (paleta azul claro com bom contraste) */}
                                  {depth === 0 && Array.isArray(proc.retornos) && proc.retornos.length > 0 && (
                                    <div className="border-t border-sky-200/80 bg-[#f0f9ff]/50 px-3.5 py-2 sm:px-4">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleProntuarioRetornos(proc.id);
                                        }}
                                        className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all ${
                                          expandedProntuarioRetornosMap[proc.id]
                                            ? 'border-2 border-sky-400 bg-sky-100 text-sky-950 shadow-xs'
                                            : 'border-2 border-sky-300/90 bg-sky-50/90 text-sky-950 shadow-2xs hover:border-sky-400 hover:bg-sky-100'
                                        }`}
                                      >
                                        <span className="flex items-center gap-1.5">
                                          <span>🔄</span>
                                          <span>
                                            {expandedProntuarioRetornosMap[proc.id]
                                              ? `Ocultar ${proc.retornos.length} ${
                                                  proc.retornos.length === 1 ? 'retorno vinculado' : 'retornos vinculados'
                                                }`
                                              : `Ver ${proc.retornos.length} ${
                                                  proc.retornos.length === 1 ? 'retorno vinculado' : 'retornos vinculados'
                                                }`}
                                          </span>
                                        </span>
                                        <span className="flex items-center gap-1 text-[10px] font-bold text-sky-800">
                                          <span>{expandedProntuarioRetornosMap[proc.id] ? 'Recolher' : 'Expandir'}</span>
                                          <ChevronDown
                                            className={`h-3.5 w-3.5 transition-transform duration-200 ${
                                              expandedProntuarioRetornosMap[proc.id] ? 'rotate-180' : ''
                                            }`}
                                            strokeWidth={2.5}
                                          />
                                        </span>
                                      </button>
                                    </div>
                                  )}

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
                                              {assinaturaVinculada?.statusCodigo === 'RECUSADO' || assinaturaVinculada?.recusadoEm ? (
                                                <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">
                                                  <AlertTriangle className="h-4 w-4" strokeWidth={2} />
                                                  Recusado pelo paciente
                                                </div>
                                              ) : imgAssinPac ? (
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
                                      <div className="rounded-xl border border-[#e2e8f0] bg-white p-3.5 shadow-2xs">
                                        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#0f766e]">
                                          <Syringe className="h-3.5 w-3.5 text-[#00a88e]" />
                                          Substâncias e Doses Aplicadas
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] font-semibold text-[#0f172a]">
                                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#00a88e]/20 bg-[#e6f7f5]/40 px-2.5 py-1 text-[12px] font-semibold text-[#0f766e]">
                                            {nomeProc}
                                          </span>
                                          <span className="text-[12px] font-medium text-[#64748b]">
                                            🏷️ Lote / Validade: <span className="font-normal text-[#94a3b8]">—</span>
                                          </span>
                                        </div>
                                      </div>

                                      <ProntuarioSessionPhotos
                                        fotosProc={fotosProc}
                                        selectedPatientId={selectedPatient?.id}
                                        onPreviewPhoto={(foto) =>
                                          setGalleryPreview({
                                            url: foto.url,
                                            authFetch: true,
                                            caption: foto.legenda || foto.fileName,
                                            mapaOverlay: foto.mapaOverlay || null,
                                            categoria: foto.categoria || null,
                                            serverId: foto.serverId || null,
                                          })
                                        }
                                      />
                                    </div>
                                  ) : null}
                                </div>
                              </ProcedureTimelineEntry>
                            );
                          })}
                        </ProcedureTimelineRail>
                        {hasMoreProntuario && (
                          <div className="pt-3">
                            <ProcedureTimelineProfileVerMaisStrip
                              onExpand={() =>
                                setProntuarioVisibleCount((prev) => prev + PRONTUARIO_PAGE_SIZE)
                              }
                              label={`Carregar mais procedimentos (+${Math.min(
                                PRONTUARIO_PAGE_SIZE,
                                filteredProntuarioRoots.length - prontuarioRootsVisible.length,
                              )}) · Exibindo ${prontuarioRootsVisible.length} de ${
                                filteredProntuarioRoots.length
                              }`}
                            />
                          </div>
                        )}
                      </>
                    ))}
                  </div>
                )}

              {patientDetailTab === 'anamnese' && (
                <AnamneseTab
                  pacienteId={selectedPatient.id}
                  pacienteSexo={selectedPatient.sexo}
                  pacienteTelefone={selectedPatient.telefone || selectedPatient.celular || ''}
                  roleUserId={roleUserId}
                />
              )}

              {patientDetailTab === 'planos' && (
                <PlanosTab
                  variant="profile"
                  pacienteId={selectedPatient?.id ?? null}
                  roleUserId={roleUserId ?? null}
                  onReagendarItem={(item, plano, onSaved) =>
                    onReagendarPlanoItem?.(selectedPatient, item, plano, onSaved)
                  }
                  onPlanoConcluido={() => onPlanoConcluido?.(selectedPatient)}
                />
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
                  onLocalPreview={setGalleryPreview}
                  uploadDisabled={galeriaUploadDisabled}
                  uploadDisabledTitle={galeriaUploadDisabledTitle}
                />
              )}

              {patientDetailTab === 'documentos' && (
                <DocumentosAssinadosTab
                  paciente={selectedPatient}
                  pacienteId={selectedPatient?.id}
                  clinicaInfo={clinicaInfo}
                  perfilInfo={perfilInfo}
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
                  {canCreateNotaPaciente && (
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
                          {canCreateNotaPaciente && (
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

              <AlertasClinicosPanel
                alertasPerfil={alertasPerfil}
                alertasAnamnese={alertasAnamnese}
                alertasAlergia={alertasAlergia}
                isLoading={alertasClinicosLoading}
                variant="sidebar"
                onVerTodos={() => setAlertasModalOpen(true)}
              />
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
              {canCreateNotaPaciente && (
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
                      className={`rounded-lg border p-2 ${i % 2 === 0
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
                          {canCreateNotaPaciente && nota._fromApi ? (
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
                  className={`w-full rounded-lg border px-3 py-2 text-[14px] text-[#0f172a] outline-none focus:border-[#00a88e]/40 ${inativarSenhaErro ? 'border-red-400 bg-red-50/40' : 'border-[#e2e8f0]'
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
              Todos os alertas clínicos
            </h3>
            <p className="mt-1 text-[12px] font-medium text-[#64748b]">
              Itens do perfil clínico e perguntas em alerta nas fichas de anamnese.
            </p>
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1 [-webkit-overflow-scrolling:touch]">
              <AlertasGroupCards
                groups={buildGroupedChips(alertasPerfil, alertasAnamnese)}
                columns="grid-cols-1 sm:grid-cols-2"
              />
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
            {Boolean(galleryPreview.mapaOverlay?.marcacoes?.length) ||
              galleryPreview.categoria === GALERIA_CATEGORIA.MAPA ? (
              <div className="aspect-square w-[min(90vw,85vh)] overflow-hidden rounded-xl border border-white/30 bg-slate-900">
                <GaleriaMapaThumb
                  url={galleryPreview.url}
                  mapaOverlay={galleryPreview.mapaOverlay}
                  alt={galleryPreview.caption || 'Preview da foto'}
                  className="h-full w-full"
                  density="full"
                  pacienteId={selectedPatient?.id}
                  fotoId={galleryPreview.serverId}
                />
              </div>
            ) : (
              <ZoomableGalleryLightbox
                url={galleryPreview.url}
                alt={galleryPreview.caption || 'Preview da foto'}
                authFetch={Boolean(galleryPreview.authFetch)}
                pacienteId={selectedPatient?.id}
                fotoId={galleryPreview.serverId}
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

