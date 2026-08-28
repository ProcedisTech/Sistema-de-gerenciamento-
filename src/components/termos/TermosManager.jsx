import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileText,
  Pencil,
  Trash2,
  Plus,
  Loader2,
  Search,
  Lightbulb,
  MoreVertical,
  Shield,
  Stethoscope,
  Syringe,
  Droplet,
  Camera,
} from 'lucide-react';
import { termosApi } from '../../services/api';
import { useToast } from '../../contexts/useToast.js';
import { useProcedimentosOptions } from '../../hooks/useProcedimentosOptions';
import { LGPD_TEMPLATE_BRUTO } from '../journey/lgpd/lgpdConsentText';
import { TermoFolha } from './TermoFolha';
import { stripHtml } from '../../utils/stripHtml.js';

const NATUREZA_PROCEDIMENTO = 'PROCEDIMENTO';
const NATUREZA_INSTITUCIONAL = 'INSTITUCIONAL';

function normalizeList(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.content)) return raw.content;
  return [];
}

function isAtivo(row) {
  if (!row || typeof row !== 'object') return false;
  if (row.ativo === false || row.active === false) return false;
  if (row.ativo === true || row.active === true) return true;
  const s = String(row.status || '').toUpperCase();
  if (s === 'INATIVO' || s === 'INACTIVE') return false;
  return true;
}

const CAMPOS_AUTOMATICOS = [
  { token: '[NOME DO PACIENTE]', desc: 'Nome completo' },
  { token: '[CPF DO PACIENTE]', desc: 'CPF formatado' },
  { token: '[DATA DE NASCIMENTO DO PACIENTE]', desc: 'Data de nascimento (DD/MM/AAAA)' },
  { token: '[TELEFONE DO PACIENTE]', desc: 'Telefone / WhatsApp' },
  { token: '[NOME DA CLÍNICA]', desc: 'Razão social ou nome' },
  { token: '[CNPJ DA CLÍNICA]', desc: 'CNPJ formatado' },
  { token: '[NOME DO PROFISSIONAL]', desc: 'Nome do atendente' },
  { token: '[NOME DO PROCEDIMENTO]', desc: 'Nome do procedimento' },
];

const INTRO_BASICA =
  '<p>Eu, [NOME DO PACIENTE], portador(a) do CPF nº [CPF DO PACIENTE], declaro por meio deste documento que compreendo e concordo com as informações aqui descritas:</p>';

const INTRO_LGPD =
  '<p>Eu, [NOME DO PACIENTE], portador(a) do CPF nº [CPF DO PACIENTE], declaro por meio deste termo que autorizo a clínica [NOME DA CLÍNICA], inscrita no CNPJ sob o nº [CNPJ DA CLÍNICA], a realizar o tratamento dos meus dados pessoais em conformidade com a LGPD (Lei nº 13.709/2018):</p>';

/** Converte texto puro (linhas separadas por \n) num HTML semântico com <p> e <ul><li> para itens com marcador. */
function paragraphizeTemplate(bruto) {
  if (!bruto) return '';
  const lines = String(bruto).split('\n');
  const result = [];
  let currentList = [];

  const flushList = () => {
    if (currentList.length > 0) {
      result.push(`<ul>${currentList.map((item) => `<li>${item}</li>`).join('')}</ul>`);
      currentList = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      result.push('<p><br></p>');
      continue;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      currentList.push(trimmed.replace(/^[-•]\s*/, ''));
    } else {
      flushList();
      result.push(`<p>${trimmed}</p>`);
    }
  }

  flushList();
  return result.join('');
}

const TCLE_TOXINA_TEMPLATE_BRUTO = `TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO — TOXINA BOTULÍNICA

Eu, [NOME DO PACIENTE], portador(a) do CPF [CPF DO PACIENTE], declaro ter sido informado(a) e bem orientado(a) pelo(a) Dr.(a) [NOME DO PROFISSIONAL] sobre a ação da Toxina Botulínica do tipo A (que remove o relaxamento dos músculos), suas indicações e contraindicações, e que o efeito da mesma inicia-se cerca de 48 a 72 horas após a aplicação, e tem efeito máximo em torno de 15 dias após a aplicação. A indicação do tratamento com a Toxina Botulínica é preconizada para o relaxamento do músculo e diminuição da contração excessiva, e a mesma é transitória, geralmente por um período de 1 a 3 meses. Esse período depende de diferentes fatores associados ao paciente, à sua musculatura, ao tipo da patologia, bem como outros elementos.

Os efeitos indesejáveis são raros e temporários e dependem, dentre outros fatores, da musculatura de cada paciente e da região aplicada, podendo ocasionar:
- Equimoses ou hematomas (manchamento no local da aplicação, transitório de 5 a 7 dias) e sangramento e/ou dor durante a injeção;
- Reação alérgica na pele, hipersensibilidade e/ou dor no local aplicado por horas ou dias, a depender da região aplicada;
- Sensação de franqueza ao mastigar e/ou diminuição na amplitude do sorriso;
- Diminuição na largura da face em pacientes com os músculos masseteres e/ou temporais hipertrofiados;
- Assimetria;
- Queda das pálpebras e/ou sobrancelhas (ptose), e/ou sensação de pálpebras inchadas;
- Alargamento da área entre as sobrancelhas.

Fui também claramente informado(a) a respeito das seguintes contraindicações e da previsibilidade dos tratamentos:
- O tratamento não está indicado em caso de gravidez e/ou amamentação.

Estou ciente de que o grau efetivo de melhora não pode ser previsto ou garantido pelo profissional, pois isso depende da reação fisiológica de cada paciente, podendo, inclusive, haver necessidade de uma nova avaliação.

Declaro minha concordância em me submeter à aplicação de Toxina Botulínica, assumindo a responsabilidade e os riscos pelos eventuais efeitos indesejáveis, e autorizo o(a) Dr.(a) [NOME DO PROFISSIONAL] a aplicá-la. Declaro ter recebido todas as orientações necessárias sobre os cuidados que devo ter após a aplicação da Toxina Botulínica, bem como uma receita para controle de eventuais dores pós-aplicação.

[NOME DA CLÍNICA] — CNPJ [CNPJ DA CLÍNICA]

Paciente: [NOME DO PACIENTE]     Data de nascimento: [DATA DE NASCIMENTO DO PACIENTE]     Contato: [TELEFONE DO PACIENTE]`;

const TCLE_PREENCHIMENTO_TEMPLATE_BRUTO = `TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO — PREENCHIMENTO COM ÁCIDO HIALURÔNICO

Eu, [NOME DO PACIENTE], portador do CPF [CPF DO PACIENTE], declaro ter sido informado(a) e bem orientado(a) pelo(a) Dr.(a) [NOME DO PROFISSIONAL] sobre o procedimento de preenchimento orofacial com Ácido Hialurônico, suas indicações e contraindicações. O procedimento está indicado para correções de assimetria facial, bem como perda de tecido e/ou flacidez. Os biomateriais de preenchimento à base de ácido hialurônico apresentam durabilidade média de 6 meses a 1 ano e meio, dependendo das características do produto e de cada paciente.

Os efeitos indesejáveis são raros e temporários e dependem, dentre outros fatores, das características de cada paciente e da região aplicada, podendo ocasionar:
- Equimoses ou hematomas (manchamento no local da aplicação, transitório de 7 a 15 dias) e sangramento e/ou dor durante a injeção do material;
- Inflamação, que vai diminuindo entre 48 e 72 horas, sendo mínima a partir da primeira semana;
- Reação alérgica na pele, hipersensibilidade e/ou dor no local aplicado por horas ou dias, a depender da região aplicada;
- O implante de biomaterial reabsorvível pode reabsorver de forma prematura;
- Formação de nódulos e/ou fibrocimento na região de aplicação;
- Possível assimetria;
- Em caso de preenchimento de papilas, possível isquemia e hematoma.

Fui também claramente informado(a) a respeito das seguintes contraindicações e da previsibilidade dos tratamentos:
- O tratamento não está indicado em caso de gravidez e/ou amamentação;
- Em caso de alergias pregressas, o procedimento não está indicado.

Estou ciente de que o grau efetivo de melhora não pode ser previsto ou garantido pelo profissional, pois isso depende da reação fisiológica de cada paciente, podendo, inclusive, haver necessidade de nova aplicação.

Declaro minha concordância em me submeter à aplicação de biomaterial preenchedor de Ácido Hialurônico, assumindo a responsabilidade e os riscos pelos eventuais efeitos indesejáveis, e autorizo o(a) Dr.(a) [NOME DO PROFISSIONAL] a aplicá-lo. Declaro ter recebido todas as orientações necessárias sobre os cuidados que devo ter após a aplicação do biomaterial preenchedor, bem como uma receita para controle de eventuais dores pós-aplicação.

[NOME DA CLÍNICA] — CNPJ [CNPJ DA CLÍNICA]

Paciente: [NOME DO PACIENTE]     Data de nascimento: [DATA DE NASCIMENTO DO PACIENTE]     Contato: [TELEFONE DO PACIENTE]`;

const TERMO_IMAGEM_TEMPLATE_BRUTO = `TERMO DE CONSENTIMENTO DE USO DE IMAGEM

Nome do Paciente: [NOME DO PACIENTE]
CPF: [CPF DO PACIENTE]     Data de nascimento: [DATA DE NASCIMENTO DO PACIENTE]
Contato: [TELEFONE DO PACIENTE]

Autorizo a divulgação de fotos, imagens e vídeos dos procedimentos realizados em mim por [NOME DA CLÍNICA] (CNPJ [CNPJ DA CLÍNICA]). Estou ciente de que o resultado leva, em média, de 7 a 14 dias para se estabilizar, podendo haver edema, hematomas ou infecção, com necessidade de cuidados e uso dos medicamentos prescritos no pós-operatório. A revisão será feita em data agendada, podendo ou não haver necessidade de retoque.

Profissional: [NOME DO PROFISSIONAL]`;

/**
 * Localiza automaticamente os IDs de procedimentos ativos da clínica correspondentes ao template selecionado.
 * Suporta correspondência flexível e normalizada (sem acentos).
 */
function findMatchingProcedimentoIds(templateType, options) {
  if (!Array.isArray(options) || options.length === 0) return [];
  const normalize = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  if (templateType === 'TOXINA') {
    return options
      .filter((o) => {
        const n = normalize(o.nomeProcedimento);
        return n.includes('toxina') || n.includes('botul') || n.includes('botox');
      })
      .map((o) => String(o.id));
  }

  if (templateType === 'PREENCHIMENTO') {
    return options
      .filter((o) => {
        const n = normalize(o.nomeProcedimento);
        return n.includes('preenchimento') || n.includes('hialuron');
      })
      .map((o) => String(o.id));
  }

  return [];
}

export function TermosManager() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modo, setModo] = useState('lista');
  const [editingId, setEditingId] = useState(null);
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [autoAssinarProfissional, setAutoAssinarProfissional] = useState(false);
  const [naturezaCodigo, setNaturezaCodigo] = useState(NATUREZA_INSTITUCIONAL);
  const [procedimentosVinculados, setProcedimentosVinculados] = useState([]);
  const { options: procedimentoOptions, loading: procedimentoOptionsLoading } = useProcedimentosOptions();
  const [formErrors, setFormErrors] = useState({});
  const [confirmDeleteRow, setConfirmDeleteRow] = useState(null);
  const [viewingRow, setViewingRow] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const templateMenuRef = useRef(null);

  useEffect(() => {
    if (!templateMenuOpen) return undefined;
    const onPointerDown = (e) => {
      if (templateMenuRef.current && !templateMenuRef.current.contains(e.target)) {
        setTemplateMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [templateMenuOpen]);
  // Painel de ajuda do editor: aberto por padrão em telas lg+, recolhido abaixo disso.
  const [helpOpen, setHelpOpen] = useState(
    () => typeof window === 'undefined' || window.matchMedia('(min-width: 1024px)').matches
  );
  const quillRef = useRef(null);

  /** Insere um placeholder na posição do cursor do Quill (fim do doc se nunca focado). */
  const insertToken = (token) => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    // getSelection(true) pode retornar null se o Quill nunca teve foco — fallback: fim.
    const range = quill.getSelection(true) || { index: quill.getLength() };
    quill.insertText(range.index, token, 'user');
    quill.setSelection(range.index + token.length);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await termosApi.list();
      const all = normalizeList(raw);
      setItems(all.filter(isAtivo));
    } catch (e) {
      toastError(e?.message || 'Não foi possível carregar os termos.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredItems = useMemo(
    () =>
      items.filter((item) =>
        String(item.titulo ?? item.title ?? '')
          .toLowerCase()
          .includes(searchQuery.trim().toLowerCase())
      ),
    [items, searchQuery]
  );

  const procedimentosSemVinculo = useMemo(() => {
    const linked = new Set();
    for (const t of items) {
      for (const p of t.procedimentosVinculados || []) {
        const id = String(p.catalogoProcedimentoSaudeId ?? p.id ?? '').trim();
        if (id) linked.add(id);
      }
    }
    return procedimentoOptions.filter((o) => o.id && !linked.has(String(o.id)));
  }, [items, procedimentoOptions]);

  const openNew = () => {
    setEditingId(null);
    setTitulo('');
    setConteudo('');
    setAutoAssinarProfissional(false);
    setNaturezaCodigo(NATUREZA_INSTITUCIONAL);
    setProcedimentosVinculados([]);
    setFormErrors({});
    setViewingRow(null);
    setModo('edit');
  };

  const openNewWithLgpdTemplate = () => {
    setEditingId(null);
    setTitulo('Termo de Consentimento LGPD');
    setConteudo(paragraphizeTemplate(LGPD_TEMPLATE_BRUTO));
    setAutoAssinarProfissional(true);
    setNaturezaCodigo(NATUREZA_INSTITUCIONAL);
    setProcedimentosVinculados([]);
    setFormErrors({});
    setViewingRow(null);
    setModo('edit');
  };

  const openNewWithTcleToxinaTemplate = () => {
    const matchingIds = findMatchingProcedimentoIds('TOXINA', procedimentoOptions);
    setEditingId(null);
    setTitulo('TCLE - Toxina Botulínica');
    setConteudo(paragraphizeTemplate(TCLE_TOXINA_TEMPLATE_BRUTO));
    setAutoAssinarProfissional(true);
    setNaturezaCodigo(NATUREZA_PROCEDIMENTO);
    setProcedimentosVinculados(matchingIds);
    setFormErrors({});
    setViewingRow(null);
    setModo('edit');
    if (matchingIds.length > 0) {
      toastSuccess(`Template carregado com ${matchingIds.length} procedimento(s) vinculado(s) automaticamente.`);
    }
  };

  const openNewWithTclePreenchimentoTemplate = () => {
    const matchingIds = findMatchingProcedimentoIds('PREENCHIMENTO', procedimentoOptions);
    setEditingId(null);
    setTitulo('TCLE - Preenchimento com Ácido Hialurônico');
    setConteudo(paragraphizeTemplate(TCLE_PREENCHIMENTO_TEMPLATE_BRUTO));
    setAutoAssinarProfissional(true);
    setNaturezaCodigo(NATUREZA_PROCEDIMENTO);
    setProcedimentosVinculados(matchingIds);
    setFormErrors({});
    setViewingRow(null);
    setModo('edit');
    if (matchingIds.length > 0) {
      toastSuccess(`Template carregado com ${matchingIds.length} procedimento(s) vinculado(s) automaticamente.`);
    }
  };

  const openNewWithTermoImagemTemplate = () => {
    setEditingId(null);
    setTitulo('Termo de Consentimento de Uso de Imagem');
    setConteudo(paragraphizeTemplate(TERMO_IMAGEM_TEMPLATE_BRUTO));
    setAutoAssinarProfissional(true);
    setNaturezaCodigo(NATUREZA_INSTITUCIONAL);
    setProcedimentosVinculados([]);
    setFormErrors({});
    setViewingRow(null);
    setModo('edit');
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setTitulo(row.titulo ?? row.title ?? '');
    setConteudo(row.conteudo ?? row.content ?? '');
    setAutoAssinarProfissional(row.autoAssinarProfissional ?? false);
    setNaturezaCodigo(row.naturezaCodigo ?? NATUREZA_INSTITUCIONAL);
    setProcedimentosVinculados(
      (row.procedimentosVinculados ?? []).map((p) => String(p.catalogoProcedimentoSaudeId))
    );
    setFormErrors({});
    setViewingRow(null);
    setMenuOpenId(null);
    setModo('edit');
  };

  const closeForm = () => {
    setModo('lista');
    setEditingId(null);
    setTitulo('');
    setConteudo('');
    setAutoAssinarProfissional(false);
    setNaturezaCodigo(NATUREZA_INSTITUCIONAL);
    setProcedimentosVinculados([]);
    setFormErrors({});
  };

  const handleSave = async () => {
    const t = String(titulo || '').trim();
    const c = String(conteudo || '').trim();
    const fe = {};
    if (!t) fe.titulo = true;
    if (!c) fe.conteudo = true;
    if (naturezaCodigo !== NATUREZA_PROCEDIMENTO && naturezaCodigo !== NATUREZA_INSTITUCIONAL) {
      fe.naturezaCodigo = true;
    }
    if (Object.keys(fe).length > 0) {
      setFormErrors(fe);
      return;
    }
    setFormErrors({});
    setSaving(true);
    try {
      const body = {
        titulo: t,
        conteudo: c,
        autoAssinarProfissional,
        naturezaCodigo,
        ativo: true,
        catalogoProcedimentoSaudeIds: procedimentosVinculados,
      };
      if (editingId != null) {
        await termosApi.update(editingId, body);
        toastSuccess('Termo atualizado.');
      } else {
        await termosApi.create(body);
        toastSuccess('Termo criado.');
      }
      closeForm();
      await load();
    } catch (e) {
      toastError(e?.message || 'Erro ao salvar o termo.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveClick = (row) => {
    setConfirmDeleteRow(row);
    setMenuOpenId(null);
    setViewingRow(null);
  };

  const handleRemoveConfirm = async () => {
    const id = confirmDeleteRow?.id;
    setConfirmDeleteRow(null);
    if (id == null) return;
    try {
      await termosApi.remove(id);
      toastSuccess('Termo removido.');
      await load();
    } catch (e) {
      toastError(e?.message || 'Erro ao excluir.');
    }
  };

  const openView = (row) => {
    setViewingRow(row);
    setMenuOpenId(null);
    setModo('view');
  };

  const voltarDaView = () => {
    setModo('lista');
    setViewingRow(null);
  };

  const emptyNoData = items.length === 0;
  const emptyFiltered = !emptyNoData && filteredItems.length === 0;

  if (modo === 'view' && viewingRow) {
    return (
      <div className="animate-in fade-in duration-300">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={voltarDaView}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#e2e8f0] px-3 text-[13px] font-medium text-[#0f172a] hover:bg-[#f8fafc]"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
              Voltar
            </button>
            <h3 className="truncate text-[16px] font-bold text-[#0f172a]">
              {viewingRow.titulo ?? viewingRow.title ?? '—'}
            </h3>
            <span className="inline-flex shrink-0 rounded-full border border-[#bbf7d0] bg-[#dcfce7] px-2 py-0.5 text-[11px] font-bold text-[#16a34a]">
              Ativo
            </span>
          </div>
          <button
            type="button"
            onClick={() => openEdit(viewingRow)}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#00a88e] px-4 text-[13px] font-semibold text-white"
          >
            <Pencil className="h-4 w-4" strokeWidth={2} />
            Editar
          </button>
        </div>

        <TermoFolha
          editavel={false}
          titulo={viewingRow.titulo ?? viewingRow.title}
          conteudo={viewingRow.conteudo ?? viewingRow.content ?? ''}
        />
      </div>
    );
  }

  if (modo === 'edit') {
    return (
      <div className="animate-in fade-in flex flex-col gap-3 duration-300">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={closeForm}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#e2e8f0] px-3 text-[13px] font-medium text-[#0f172a] hover:bg-[#f8fafc]"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
              Voltar
            </button>
            <h2 className="truncate text-[16px] font-bold text-[#0f172a]">
              {editingId != null ? 'Editar Termo' : 'Novo Termo'}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <label
              className="hidden h-9 cursor-pointer items-center gap-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 sm:inline-flex"
              title="PROCEDIMENTO é exigido automaticamente na assinatura; INSTITUCIONAL (ex.: LGPD) é opcional até o profissional selecionar."
            >
              <span className="text-[12px] font-medium text-[#64748b]">Natureza</span>
              <select
                id="naturezaCodigo"
                value={naturezaCodigo}
                onChange={(e) => setNaturezaCodigo(e.target.value)}
                className="h-7 rounded border-0 bg-transparent text-[12px] font-medium text-[#0f172a] focus:ring-0"
              >
                <option value={NATUREZA_INSTITUCIONAL}>Institucional</option>
                <option value={NATUREZA_PROCEDIMENTO}>Procedimento</option>
              </select>
            </label>
            <label
              className="hidden h-9 cursor-pointer items-center gap-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 sm:inline-flex"
              title="Se o profissional possuir uma Assinatura Padrão configurada no perfil, ela será inserida automaticamente neste termo."
            >
              <input
                type="checkbox"
                id="autoAssinarProfissional"
                checked={autoAssinarProfissional}
                onChange={(e) => setAutoAssinarProfissional(e.target.checked)}
                className="h-4 w-4 rounded border-[#cbd5e1] text-[#00a88e] focus:ring-[#00a88e]"
              />
              <span className="text-[12px] font-medium text-[#0f172a]">Assinatura automática</span>
            </label>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[#00a88e] px-4 text-[13px] font-semibold text-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Salvar
            </button>
          </div>
        </div>

        <div>
          <label className="block shrink-0 text-[13px] font-semibold text-[#0f172a]">
            Conteúdo do termo <span className="text-red-500">*</span>
          </label>
          <div className="mt-1.5 flex min-h-0 flex-col gap-3 lg:flex-row lg:items-stretch">
            <div className="min-w-0 flex-1">
              <div
                id="termo-editor-wrapper"
                className={`relative flex max-h-[min(640px,calc(100vh-26rem))] min-h-[420px] flex-col overflow-hidden rounded-xl border ${
                  formErrors.conteudo
                    ? 'border-[#dc2626]'
                    : 'border-[#e2e8f0] transition-colors hover:border-[#00a88e]/30 focus-within:border-[#00a88e] focus-within:ring-2 focus-within:ring-[#00a88e]/10'
                }`}
              >
                <TermoFolha
                  editavel
                  titulo={titulo}
                  conteudo={conteudo}
                  onChangeConteudo={setConteudo}
                  onChangeTitulo={setTitulo}
                  tituloError={!!formErrors.titulo}
                  quillRef={quillRef}
                />
              </div>
              {formErrors.conteudo ? (
                <p className="mt-1 text-[12px] text-[#dc2626]">Conteúdo obrigatório</p>
              ) : null}
            </div>
            <TermoHelpPanel
              open={helpOpen}
              onToggle={() => setHelpOpen((v) => !v)}
              onInsertToken={insertToken}
              onInsertIntro={(intro) => setConteudo((prev) => intro + prev)}
              showTemplateLgpd={editingId == null && !conteudo}
              onUseLgpdTemplate={() => {
                setTitulo((t) => t || 'Termo de Consentimento LGPD');
                const html = LGPD_TEMPLATE_BRUTO.split('\n')
                  .map((p) => (p.trim() ? `<p>${p}</p>` : ''))
                  .join('');
                setConteudo(html);
              }}
              autoAssinar={autoAssinarProfissional}
              onChangeAutoAssinar={setAutoAssinarProfissional}
              naturezaCodigo={naturezaCodigo}
              onChangeNaturezaCodigo={setNaturezaCodigo}
            />
          </div>
        </div>

        <TermoVinculosConfig
          procedimentoOptions={procedimentoOptions}
          procedimentoOptionsLoading={procedimentoOptionsLoading}
          procedimentosVinculados={procedimentosVinculados}
          onChangeProcedimentosVinculados={setProcedimentosVinculados}
          naturezaCodigo={naturezaCodigo}
        />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300">
      {/* Toolbar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]"
            strokeWidth={2}
            aria-hidden
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar termos..."
            className="h-10 w-full rounded-lg border border-[#e2e8f0] py-2 pl-9 pr-3 text-[14px] outline-none transition-colors focus:border-[#00a88e] focus:ring-2 focus:ring-[#00a88e]/10"
            aria-label="Buscar termos"
          />
        </div>
        <div className="ml-auto flex shrink-0 gap-2">
          <div className="relative shrink-0" ref={templateMenuRef}>
            <button
              type="button"
              onClick={() => setTemplateMenuOpen((v) => !v)}
              aria-expanded={templateMenuOpen}
              aria-haspopup="menu"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[#00a88e] bg-white px-4 text-[13px] font-semibold text-[#00a88e] transition-colors hover:bg-[#f0fdfa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a88e] focus-visible:ring-offset-1"
              title="Começar a partir de um modelo pronto"
            >
              <Lightbulb className="h-4 w-4" strokeWidth={2.5} aria-hidden />
              Usar Template
              <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
            </button>
            {templateMenuOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-full z-10 mt-1 w-64 rounded-lg border border-[#e2e8f0] bg-white py-1 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-[#0f172a] hover:bg-[#f8fafc]"
                  onClick={() => {
                    setTemplateMenuOpen(false);
                    openNewWithLgpdTemplate();
                  }}
                >
                  <Shield className="h-4 w-4 shrink-0 text-[#00a88e]" strokeWidth={2} aria-hidden />
                  Template LGPD
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-[#0f172a] hover:bg-[#f8fafc]"
                  onClick={() => {
                    setTemplateMenuOpen(false);
                    openNewWithTcleToxinaTemplate();
                  }}
                >
                  <Syringe className="h-4 w-4 shrink-0 text-[#00a88e]" strokeWidth={2} aria-hidden />
                  TCLE Toxina Botulínica
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-[#0f172a] hover:bg-[#f8fafc]"
                  onClick={() => {
                    setTemplateMenuOpen(false);
                    openNewWithTclePreenchimentoTemplate();
                  }}
                >
                  <Droplet className="h-4 w-4 shrink-0 text-[#00a88e]" strokeWidth={2} aria-hidden />
                  TCLE Preenchimento
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-[#0f172a] hover:bg-[#f8fafc]"
                  onClick={() => {
                    setTemplateMenuOpen(false);
                    openNewWithTermoImagemTemplate();
                  }}
                >
                  <Camera className="h-4 w-4 shrink-0 text-[#00a88e]" strokeWidth={2} aria-hidden />
                  Consentimento de Imagem
                </button>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#00a88e] px-4 text-[13px] font-semibold text-white"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            Novo Termo
          </button>
        </div>
      </div>

      {!loading && procedimentosSemVinculo.length > 0 ? (
        <div className="mb-6 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
          <p className="text-[12px] font-bold uppercase tracking-wide text-[#64748b]">Cobertura</p>
          <p className="mt-1 text-[13px] text-[#475569]">
            Procedimentos do catálogo sem termo vinculado — não exigem termo na execução:
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {procedimentosSemVinculo.map((o) => (
              <li
                key={o.id}
                className="rounded-full border border-[#e2e8f0] bg-white px-2.5 py-0.5 text-[12px] text-[#64748b]"
              >
                {o.nomeProcedimento}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Loading */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((k) => (
            <div key={k} className="h-[160px] animate-pulse rounded-xl bg-[#f1f5f9]" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="mx-auto mb-4 h-12 w-12 text-[#cbd5e1]" strokeWidth={1.5} aria-hidden />
          <p className="text-[16px] font-semibold text-[#64748b]">
            {emptyFiltered ? 'Nenhum termo encontrado' : 'Nenhum termo cadastrado'}
          </p>
          <p className="mt-1 max-w-md text-[13px] text-[#94a3b8]">
            {emptyFiltered
              ? 'Tente outro termo na busca.'
              : 'Crie termos de consentimento para cada procedimento que realiza'}
          </p>
          {emptyNoData ? (
            <div className="mt-5 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={openNewWithLgpdTemplate}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#00a88e] px-5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[#00967f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a88e] focus-visible:ring-offset-2"
              >
                <Shield className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
                Usar Template LGPD
              </button>
              <button
                type="button"
                onClick={openNew}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-white px-4 text-[13px] font-medium text-[#475569] transition-colors hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a88e] focus-visible:ring-offset-2"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                Criar do zero
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((row) => (
            <div
              key={row.id}
              role="button"
              tabIndex={0}
              onClick={() => openView(row)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openView(row);
                }
              }}
              className="relative cursor-pointer rounded-xl border border-[#e2e8f0] bg-white p-5 text-left transition-all hover:border-[#00a88e]/30 hover:shadow-sm"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f0fdfa]">
                  <FileText className="h-5 w-5 text-[#00a88e]" strokeWidth={2} aria-hidden />
                </div>
                <div className="relative shrink-0">
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[#64748b] hover:bg-[#f1f5f9]"
                    aria-label="Menu do termo"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId((id) => (id === row.id ? null : row.id));
                    }}
                  >
                    <MoreVertical className="h-4 w-4" strokeWidth={2} />
                  </button>
                  {menuOpenId === row.id ? (
                    <div
                      className="absolute right-0 top-full z-10 mt-1 w-40 rounded-lg border border-[#e2e8f0] bg-white py-1 shadow-lg"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#0f172a] hover:bg-[#f8fafc]"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(null);
                          openEdit(row);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                        Editar
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-red-600 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveClick(row);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                        Excluir
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              <p className="text-[15px] font-semibold text-[#0f172a]">
                {row.titulo ?? row.title ?? '—'}
              </p>
              <p className="mt-1 line-clamp-2 text-[13px] text-[#64748b]">
                {stripHtml(row.conteudo ?? row.content)}
              </p>

              <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-[#64748b]">
                {row.naturezaCodigo === NATUREZA_PROCEDIMENTO ? (
                  <>
                    <Stethoscope className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                    Vinculado a procedimento
                  </>
                ) : (
                  <>
                    <Shield className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                    Institucional
                  </>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#f1f5f9] pt-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center rounded-full border border-[#bbf7d0] bg-[#dcfce7] px-2 py-0.5 text-[11px] font-bold text-[#16a34a]">
                    Ativo
                  </span>
                  {row.naturezaCodigo === NATUREZA_PROCEDIMENTO ? (
                    <span className="inline-flex items-center rounded-full border border-[#fde68a] bg-[#fef9c3] px-2 py-0.5 text-[11px] font-bold text-[#92400e]">
                      Procedimento
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-2 py-0.5 text-[11px] font-bold text-[#64748b]">
                      Institucional
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#00a88e]"
                    aria-label="Editar"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(row);
                    }}
                  >
                    <Pencil className="h-4 w-4" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#dc2626]"
                    aria-label="Excluir"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveClick(row);
                    }}
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmar exclusão */}
      {confirmDeleteRow && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-2xl bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#fef2f2]">
              <Trash2 className="h-6 w-6 text-[#dc2626]" strokeWidth={2} aria-hidden />
            </div>
            <h3 className="mt-4 text-center text-[17px] font-bold text-[#0f172a]">Excluir termo?</h3>
            <p className="mt-2 text-center text-[13px] text-[#64748b]">
              Esta ação não pode ser desfeita. O termo será removido permanentemente.
            </p>
            <p className="mt-3 text-center text-[14px] font-semibold text-[#0f172a]">
              {confirmDeleteRow.titulo ?? confirmDeleteRow.title ?? '—'}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteRow(null)}
                className="h-11 flex-1 rounded-xl border border-[#e2e8f0] text-[14px] font-medium text-[#0f172a] hover:bg-[#f8fafc]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRemoveConfirm}
                className="h-11 flex-1 rounded-xl bg-[#dc2626] text-[14px] font-semibold text-white hover:bg-[#b91c1c]"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Painel lateral recolhível de ajuda do editor de termos.
 * lg+: coluna à direita da folha (expandido 260px / recolhido 44px).
 * <lg: acordeão full-width acima da folha (order-first).
 */
function TermoHelpPanel({
  open,
  onToggle,
  onInsertToken,
  onInsertIntro,
  showTemplateLgpd,
  onUseLgpdTemplate,
  autoAssinar,
  onChangeAutoAssinar,
  naturezaCodigo,
  onChangeNaturezaCodigo,
}) {
  return (
    <aside
      className={`order-first flex shrink-0 flex-col self-start overflow-hidden rounded-xl border border-[#99f6e4] bg-[#f0fdfa] transition-[width] duration-200 lg:order-none lg:self-stretch ${
        open ? 'w-full lg:w-[260px]' : 'w-full lg:w-[44px]'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        title={open ? 'Recolher ajuda' : 'Expandir ajuda'}
        className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-semibold text-[#0f766e] transition-colors hover:bg-[#ccfbf1]/60 ${
          open ? '' : 'lg:h-auto lg:flex-1 lg:flex-col lg:justify-start lg:gap-2 lg:px-0 lg:py-3'
        }`}
      >
        <Lightbulb className="h-4 w-4 shrink-0 text-[#00a88e]" strokeWidth={2} aria-hidden />
        {open ? (
          <>
            <span className="flex-1 truncate">Ajuda do editor</span>
            {/* <lg (acordeão): seta pra cima = fechar; lg+ (painel lateral): seta pra direita = recolher */}
            <ChevronUp className="h-4 w-4 shrink-0 lg:hidden" strokeWidth={2} aria-hidden />
            <ChevronRight className="hidden h-4 w-4 shrink-0 lg:block" strokeWidth={2} aria-hidden />
          </>
        ) : (
          <>
            {/* <lg: barra horizontal, seta pra baixo = abrir */}
            <span className="flex-1 truncate lg:hidden">Ajuda do editor</span>
            <ChevronDown className="h-4 w-4 shrink-0 lg:hidden" strokeWidth={2} aria-hidden />
            {/* lg+: texto vertical + seta pra esquerda = expandir */}
            <span className="hidden text-[12px] tracking-wide lg:block lg:[writing-mode:vertical-rl]">
              Ajuda
            </span>
            <ChevronLeft className="hidden h-4 w-4 shrink-0 lg:block" strokeWidth={2} aria-hidden />
          </>
        )}
      </button>

      {open ? (
        <div className="max-h-[min(640px,calc(100vh-26rem))] overflow-y-auto border-t border-[#99f6e4] px-3 py-3 text-[12px] leading-relaxed text-[#0f766e]">
          {showTemplateLgpd ? (
            <div className="mb-3 border-b border-[#99f6e4] pb-3">
              <p className="mb-2 font-semibold">Começar com modelo:</p>
              <button
                type="button"
                onClick={onUseLgpdTemplate}
                className="flex w-full items-center gap-2 rounded-lg border border-dashed border-[#00a88e]/50 bg-white px-3 py-2 text-left text-[12px] font-medium text-[#0f766e] transition-colors hover:bg-[#dcfce7]"
              >
                <Shield className="h-4 w-4 shrink-0 text-[#00a88e]" strokeWidth={2} aria-hidden />
                Usar Template LGPD — Lei nº 13.709/2018
              </button>
            </div>
          ) : null}

          <p className="mb-1.5 font-semibold">Campos Automáticos (clique para inserir):</p>
          <div className="mb-3 flex flex-wrap gap-1.5 lg:flex-col lg:flex-nowrap">
            {CAMPOS_AUTOMATICOS.map(({ token, desc }) => (
              <button
                key={token}
                type="button"
                onClick={() => onInsertToken(token)}
                title={`Clique para inserir no texto — ${desc}`}
                className="group rounded-lg border border-[#99f6e4] bg-white px-2.5 py-1.5 text-left transition-colors hover:border-[#0f766e] hover:bg-[#ccfbf1]"
              >
                <span className="block font-mono text-[11px] font-semibold text-[#0f766e]">
                  {token}
                </span>
                <span className="block text-[10px] text-[#0f766e]/70">{desc}</span>
              </button>
            ))}
          </div>

          <p className="mb-2 border-t border-[#99f6e4] pt-2 font-semibold">
            Modelos Prontos de Introdução (com dados automáticos):
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => onInsertIntro(INTRO_BASICA)}
              className="inline-flex items-center justify-center rounded-lg border border-[#0f766e] px-3 py-1.5 text-[11px] font-semibold text-[#0f766e] transition-colors hover:bg-[#ccfbf1]"
            >
              Inserir Intro Básica
            </button>
            <button
              type="button"
              onClick={() => onInsertIntro(INTRO_LGPD)}
              className="inline-flex items-center justify-center rounded-lg border border-[#0f766e] px-3 py-1.5 text-[11px] font-semibold text-[#0f766e] transition-colors hover:bg-[#ccfbf1]"
            >
              Inserir Intro LGPD
            </button>
          </div>

          {/* Fallback mobile: o toggle compacto da barra de ação some abaixo de sm */}
          <div className="mt-3 flex items-start gap-2 border-t border-[#99f6e4] pt-3 sm:hidden">
            <input
              type="checkbox"
              id="autoAssinarProfissionalPanel"
              checked={autoAssinar}
              onChange={(e) => onChangeAutoAssinar(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[#cbd5e1] text-[#00a88e] focus:ring-[#00a88e]"
            />
            <label htmlFor="autoAssinarProfissionalPanel" className="cursor-pointer">
              <span className="block font-semibold">
                Preencher assinatura do profissional automaticamente
              </span>
              <span className="mt-0.5 block text-[11px] text-[#0f766e]/80">
                Se o profissional possuir uma Assinatura Padrão configurada no perfil, ela será
                inserida automaticamente neste termo.
              </span>
            </label>
          </div>

          <div className="mt-3 flex items-start gap-2 border-t border-[#99f6e4] pt-3 sm:hidden">
            <div className="w-full">
              <label htmlFor="naturezaCodigoPanel" className="block font-semibold">
                Natureza do termo
              </label>
              <select
                id="naturezaCodigoPanel"
                value={naturezaCodigo}
                onChange={(e) => onChangeNaturezaCodigo(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-[#99f6e4] bg-white px-2 text-[12px] font-medium text-[#0f766e]"
              >
                <option value={NATUREZA_INSTITUCIONAL}>Institucional (ex.: LGPD)</option>
                <option value={NATUREZA_PROCEDIMENTO}>Procedimento (exigido na assinatura)</option>
              </select>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

/**
 * Vínculo do termo a procedimentos ativos da clínica.
 */
function TermoVinculosConfig({
  procedimentoOptions,
  procedimentoOptionsLoading,
  procedimentosVinculados,
  onChangeProcedimentosVinculados,
  naturezaCodigo,
}) {
  const semVinculo = naturezaCodigo === NATUREZA_PROCEDIMENTO && procedimentosVinculados.length === 0;
  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <Stethoscope className="h-3.5 w-3.5 text-[#64748b]" strokeWidth={2} aria-hidden />
        <p className="text-[12px] font-semibold text-[#0f172a]">
          Vincular a procedimentos ativos da clínica
        </p>
      </div>
      <ProcedimentosVinculadosPicker
        options={procedimentoOptions}
        loading={procedimentoOptionsLoading}
        selectedIds={procedimentosVinculados}
        onChange={onChangeProcedimentosVinculados}
      />
      {semVinculo ? (
        <p className="mt-2 text-[12px] text-amber-700">
          Sem procedimento vinculado, este termo não vai exigir assinatura em nenhum atendimento.
          Selecione ao menos um procedimento acima antes de salvar.
        </p>
      ) : null}
    </div>
  );
}

/** Multi-select em dropdown dos procedimentos ativos da clínica (mesma fonte que os selects de planejamento). */
function ProcedimentosVinculadosPicker({ options, loading, selectedIds, onChange }) {
  const [open, setOpen] = useState(false);
  const [filtro, setFiltro] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const filteredOptions = useMemo(
    () =>
      options.filter((o) => o.nomeProcedimento.toLowerCase().includes(filtro.trim().toLowerCase())),
    [options, filtro]
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedOptions = useMemo(
    () => options.filter((o) => selectedSet.has(o.id)),
    [options, selectedSet]
  );

  const toggle = (id) => {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((v) => v !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full items-center justify-between rounded-lg border border-[#e2e8f0] px-3 text-left text-[13px] text-[#0f172a] hover:border-[#00a88e]/30 sm:w-80"
      >
        <span className="truncate text-[#64748b]">
          {selectedOptions.length === 0
            ? 'Nenhum procedimento vinculado'
            : `${selectedOptions.length} procedimento(s) selecionado(s)`}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#94a3b8]" strokeWidth={2} aria-hidden />
      </button>

      {selectedOptions.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {selectedOptions.map((o) => (
            <span
              key={o.id}
              className="inline-flex items-center gap-1 rounded-full border border-[#99f6e4] bg-[#f0fdfa] px-2 py-0.5 text-[11px] font-medium text-[#0f766e]"
            >
              {o.nomeProcedimento}
              <button
                type="button"
                onClick={() => toggle(o.id)}
                className="ml-0.5 leading-none text-[#0f766e]/70 hover:text-[#0f766e]"
                aria-label={`Remover ${o.nomeProcedimento}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {open ? (
        <div className="absolute left-0 top-full z-20 mt-1.5 w-full min-w-[260px] rounded-lg border border-[#e2e8f0] bg-white p-2 shadow-lg sm:w-80">
          <div className="relative mb-2">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94a3b8]"
              strokeWidth={2}
              aria-hidden
            />
            <input
              type="search"
              autoFocus
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Buscar procedimento..."
              className="h-8 w-full rounded-md border border-[#e2e8f0] py-1 pl-8 pr-2 text-[12px] outline-none focus:border-[#00a88e]"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {loading ? (
              <p className="px-2 py-3 text-[12px] text-[#94a3b8]">Carregando procedimentos...</p>
            ) : filteredOptions.length === 0 ? (
              <p className="px-2 py-3 text-[12px] text-[#94a3b8]">
                Nenhum procedimento ativo encontrado.
              </p>
            ) : (
              filteredOptions.map((o) => (
                <label
                  key={o.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-[#0f172a] hover:bg-[#f8fafc]"
                >
                  <input
                    type="checkbox"
                    checked={selectedSet.has(o.id)}
                    onChange={() => toggle(o.id)}
                    className="h-3.5 w-3.5 rounded border-[#cbd5e1] text-[#00a88e] focus:ring-[#00a88e]"
                  />
                  {o.nomeProcedimento}
                </label>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
