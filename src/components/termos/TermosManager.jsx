import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CalendarClock,
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
} from 'lucide-react';
import { termosApi } from '../../services/api';
import { useToast } from '../../contexts/useToast.js';
import { useProcedimentosOptions } from '../../hooks/useProcedimentosOptions';
import { LGPD_TEMPLATE_BRUTO } from '../journey/lgpd/lgpdConsentText';
import { TermoFolha } from './TermoFolha';

const MODO_EXPIRACAO_PLANO = 'PLANO';
const MODO_EXPIRACAO_PROCEDIMENTO = 'PROCEDIMENTO';

function stripHtml(html) {
  if (!html) return '';
  const tmp = document.createElement('DIV');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

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
  { token: '[NOME DA CLÍNICA]', desc: 'Razão social ou nome' },
  { token: '[CNPJ DA CLÍNICA]', desc: 'CNPJ formatado' },
  { token: '[NOME DO PROFISSIONAL]', desc: 'Nome do atendente' },
];

const INTRO_BASICA =
  '<p>Eu, [NOME DO PACIENTE], portador(a) do CPF nº [CPF DO PACIENTE], declaro por meio deste documento que compreendo e concordo com as informações aqui descritas:</p>';

const INTRO_LGPD =
  '<p>Eu, [NOME DO PACIENTE], portador(a) do CPF nº [CPF DO PACIENTE], declaro por meio deste termo que autorizo a clínica [NOME DA CLÍNICA], inscrita no CNPJ sob o nº [CNPJ DA CLÍNICA], a realizar o tratamento dos meus dados pessoais em conformidade com a LGPD (Lei nº 13.709/2018):</p>';

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
  const [obrigatorio, setObrigatorio] = useState(false);
  const [modoExpiracao, setModoExpiracao] = useState(MODO_EXPIRACAO_PLANO);
  const [diasExpiracaoProcedimento, setDiasExpiracaoProcedimento] = useState('');
  const [procedimentosVinculados, setProcedimentosVinculados] = useState([]);
  const { options: procedimentoOptions, loading: procedimentoOptionsLoading } = useProcedimentosOptions();
  const [formErrors, setFormErrors] = useState({});
  const [confirmDeleteRow, setConfirmDeleteRow] = useState(null);
  const [viewingRow, setViewingRow] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null);
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

  const openNew = () => {
    setEditingId(null);
    setTitulo('');
    setConteudo('');
    setAutoAssinarProfissional(false);
    setObrigatorio(false);
    setModoExpiracao(MODO_EXPIRACAO_PLANO);
    setDiasExpiracaoProcedimento('');
    setProcedimentosVinculados([]);
    setFormErrors({});
    setViewingRow(null);
    setModo('edit');
  };

  const openNewWithLgpdTemplate = () => {
    setEditingId(null);
    setTitulo('Termo de Consentimento LGPD');
    const html = LGPD_TEMPLATE_BRUTO.split('\n')
      .map((p) => (p.trim() ? `<p>${p}</p>` : ''))
      .join('');
    setConteudo(html);
    setAutoAssinarProfissional(true);
    setObrigatorio(true);
    setModoExpiracao(MODO_EXPIRACAO_PLANO);
    setDiasExpiracaoProcedimento('');
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
    setObrigatorio(row.obrigatorio ?? false);
    setModoExpiracao(row.modoExpiracao ?? MODO_EXPIRACAO_PLANO);
    setDiasExpiracaoProcedimento(
      row.diasExpiracaoProcedimento != null ? String(row.diasExpiracaoProcedimento) : ''
    );
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
    setObrigatorio(false);
    setModoExpiracao(MODO_EXPIRACAO_PLANO);
    setDiasExpiracaoProcedimento('');
    setProcedimentosVinculados([]);
    setFormErrors({});
  };

  const handleSave = async () => {
    const t = String(titulo || '').trim();
    const c = String(conteudo || '').trim();
    const dias = diasExpiracaoProcedimento === '' ? null : Number(diasExpiracaoProcedimento);
    const fe = {};
    if (!t) fe.titulo = true;
    if (!c) fe.conteudo = true;
    if (modoExpiracao === MODO_EXPIRACAO_PROCEDIMENTO && (dias == null || Number.isNaN(dias) || dias < 0)) {
      fe.diasExpiracaoProcedimento = true;
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
        obrigatorio,
        ativo: true,
        modoExpiracao,
        diasExpiracaoProcedimento: modoExpiracao === MODO_EXPIRACAO_PROCEDIMENTO ? dias : null,
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
              title="Um termo obrigatório é sempre exigido do paciente, independente de quantos outros termos ativos existam, e é adicionado automaticamente à tela de assinatura quando pendente."
            >
              <input
                type="checkbox"
                id="obrigatorio"
                checked={obrigatorio}
                onChange={(e) => setObrigatorio(e.target.checked)}
                className="h-4 w-4 rounded border-[#cbd5e1] text-[#00a88e] focus:ring-[#00a88e]"
              />
              <span className="text-[12px] font-medium text-[#0f172a]">Termo obrigatório</span>
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
              obrigatorio={obrigatorio}
              onChangeObrigatorio={setObrigatorio}
            />
          </div>
        </div>

        <TermoExpiracaoConfig
          modoExpiracao={modoExpiracao}
          onChangeModoExpiracao={setModoExpiracao}
          diasExpiracaoProcedimento={diasExpiracaoProcedimento}
          onChangeDiasExpiracaoProcedimento={setDiasExpiracaoProcedimento}
          diasError={!!formErrors.diasExpiracaoProcedimento}
          procedimentoOptions={procedimentoOptions}
          procedimentoOptionsLoading={procedimentoOptionsLoading}
          procedimentosVinculados={procedimentosVinculados}
          onChangeProcedimentosVinculados={setProcedimentosVinculados}
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
          <button
            type="button"
            onClick={openNewWithLgpdTemplate}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[#00a88e] bg-white px-4 text-[13px] font-semibold text-[#00a88e] transition-colors hover:bg-[#f0fdfa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a88e] focus-visible:ring-offset-1"
            title="Usar Template LGPD pré-preenchido"
          >
            <Shield className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            Template LGPD
          </button>
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
                <CalendarClock className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                {row.modoExpiracao === MODO_EXPIRACAO_PROCEDIMENTO
                  ? `Expira ${row.diasExpiracaoProcedimento ?? '?'} dia(s) após o procedimento`
                  : 'Expira com o plano de tratamento'}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#f1f5f9] pt-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center rounded-full border border-[#bbf7d0] bg-[#dcfce7] px-2 py-0.5 text-[11px] font-bold text-[#16a34a]">
                    Ativo
                  </span>
                  {row.obrigatorio ? (
                    <span className="inline-flex items-center rounded-full border border-[#fde68a] bg-[#fef9c3] px-2 py-0.5 text-[11px] font-bold text-[#92400e]">
                      Obrigatório
                    </span>
                  ) : null}
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
  obrigatorio,
  onChangeObrigatorio,
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
            <input
              type="checkbox"
              id="obrigatorioPanel"
              checked={obrigatorio}
              onChange={(e) => onChangeObrigatorio(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[#cbd5e1] text-[#00a88e] focus:ring-[#00a88e]"
            />
            <label htmlFor="obrigatorioPanel" className="cursor-pointer">
              <span className="block font-semibold">Termo obrigatório</span>
              <span className="mt-0.5 block text-[11px] text-[#0f766e]/80">
                Sempre exigido do paciente, independente de quantos outros termos ativos existam,
                e adicionado automaticamente à tela de assinatura quando pendente.
              </span>
            </label>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

/**
 * Configuração de expiração do termo: quando ele deixa de valer (junto com o
 * plano de tratamento, ou N dias após o procedimento vinculado ser finalizado)
 * e a quais procedimentos ativos da clínica ele está vinculado.
 */
function TermoExpiracaoConfig({
  modoExpiracao,
  onChangeModoExpiracao,
  diasExpiracaoProcedimento,
  onChangeDiasExpiracaoProcedimento,
  diasError,
  procedimentoOptions,
  procedimentoOptionsLoading,
  procedimentosVinculados,
  onChangeProcedimentosVinculados,
}) {
  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-[#00a88e]" strokeWidth={2} aria-hidden />
        <h3 className="text-[13px] font-bold text-[#0f172a]">Expiração do termo</h3>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label
          className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors ${
            modoExpiracao === MODO_EXPIRACAO_PLANO
              ? 'border-[#00a88e] bg-[#f0fdfa]'
              : 'border-[#e2e8f0] hover:bg-[#f8fafc]'
          }`}
        >
          <input
            type="radio"
            name="modoExpiracao"
            checked={modoExpiracao === MODO_EXPIRACAO_PLANO}
            onChange={() => onChangeModoExpiracao(MODO_EXPIRACAO_PLANO)}
            className="mt-0.5 h-4 w-4 shrink-0 border-[#cbd5e1] text-[#00a88e] focus:ring-[#00a88e]"
          />
          <span>
            <span className="block text-[13px] font-semibold text-[#0f172a]">
              Vale durante todo o plano
            </span>
            <span className="mt-0.5 block text-[11px] text-[#64748b]">
              Expira quando o plano de tratamento é concluído ou encerrado. Se o procedimento
              vinculado não fizer parte de nenhum plano, expira assim que ele for finalizado.
            </span>
          </span>
        </label>

        <label
          className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors ${
            modoExpiracao === MODO_EXPIRACAO_PROCEDIMENTO
              ? 'border-[#00a88e] bg-[#f0fdfa]'
              : 'border-[#e2e8f0] hover:bg-[#f8fafc]'
          }`}
        >
          <input
            type="radio"
            name="modoExpiracao"
            checked={modoExpiracao === MODO_EXPIRACAO_PROCEDIMENTO}
            onChange={() => onChangeModoExpiracao(MODO_EXPIRACAO_PROCEDIMENTO)}
            className="mt-0.5 h-4 w-4 shrink-0 border-[#cbd5e1] text-[#00a88e] focus:ring-[#00a88e]"
          />
          <span>
            <span className="block text-[13px] font-semibold text-[#0f172a]">
              Expira após o procedimento
            </span>
            <span className="mt-0.5 block text-[11px] text-[#64748b]">
              Expira N dias após o procedimento vinculado ser finalizado — vale também para
              procedimentos avulsos, sem plano.
            </span>
          </span>
        </label>
      </div>

      {modoExpiracao === MODO_EXPIRACAO_PROCEDIMENTO ? (
        <div className="mt-3">
          <label htmlFor="diasExpiracaoProcedimento" className="block text-[12px] font-semibold text-[#0f172a]">
            Dias após a finalização do procedimento <span className="text-red-500">*</span>
          </label>
          <input
            id="diasExpiracaoProcedimento"
            type="number"
            min={0}
            step={1}
            value={diasExpiracaoProcedimento}
            onChange={(e) => onChangeDiasExpiracaoProcedimento(e.target.value)}
            placeholder="Ex.: 30"
            className={`mt-1 h-9 w-32 rounded-lg border px-3 text-[13px] outline-none transition-colors focus:ring-2 ${
              diasError
                ? 'border-[#dc2626] focus:border-[#dc2626] focus:ring-[#dc2626]/10'
                : 'border-[#e2e8f0] focus:border-[#00a88e] focus:ring-[#00a88e]/10'
            }`}
          />
          {diasError ? (
            <p className="mt-1 text-[12px] text-[#dc2626]">Informe um número de dias (0 ou mais)</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 border-t border-[#f1f5f9] pt-3">
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
      </div>
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
