import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Pencil,
  Trash2,
  Plus,
  Loader2,
  Search,
  X,
  Lightbulb,
  MoreVertical,
  Shield,
} from 'lucide-react';
import { termosApi } from '../../services/api';
import { useToast } from '../../contexts/useToast.js';
import { LGPD_TEMPLATE_BRUTO } from '../journey/lgpd/lgpdConsentText';
import { TermoVisualizacao } from './TermoVisualizacao';

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

export function TermosManager() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [autoAssinarProfissional, setAutoAssinarProfissional] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [confirmDeleteRow, setConfirmDeleteRow] = useState(null);
  const [viewingRow, setViewingRow] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null);

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
    setFormErrors({});
    setFormOpen(true);
    setViewingRow(null);
  };

  const openNewWithLgpdTemplate = () => {
    setEditingId(null);
    setTitulo('Termo de Consentimento LGPD');
    setConteudo(LGPD_TEMPLATE_BRUTO);
    setAutoAssinarProfissional(true);
    setFormErrors({});
    setFormOpen(true);
    setViewingRow(null);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setTitulo(row.titulo ?? row.title ?? '');
    setConteudo(row.conteudo ?? row.content ?? '');
    setAutoAssinarProfissional(row.autoAssinarProfissional ?? false);
    setFormErrors({});
    setFormOpen(true);
    setViewingRow(null);
    setMenuOpenId(null);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setTitulo('');
    setConteudo('');
    setAutoAssinarProfissional(false);
    setFormErrors({});
  };

  const handleSave = async () => {
    const t = String(titulo || '').trim();
    const c = String(conteudo || '').trim();
    const fe = {};
    if (!t) fe.titulo = true;
    if (!c) fe.conteudo = true;
    if (Object.keys(fe).length > 0) {
      setFormErrors(fe);
      return;
    }
    setFormErrors({});
    setSaving(true);
    try {
      const body = { titulo: t, conteudo: c, autoAssinarProfissional, ativo: true };
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
  };

  const emptyNoData = items.length === 0;
  const emptyFiltered = !emptyNoData && filteredItems.length === 0;

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
              {/* Ação primária: usar o template LGPD pronto */}
              <button
                type="button"
                onClick={openNewWithLgpdTemplate}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#00a88e] px-5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[#00967f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a88e] focus-visible:ring-offset-2"
              >
                <Shield className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
                Usar Template LGPD
              </button>
              {/* Ação secundária: criar do zero */}
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

              <p className="text-[15px] font-semibold text-[#0f172a]">{row.titulo ?? row.title ?? '—'}</p>
              <p className="mt-1 line-clamp-2 text-[13px] text-[#64748b]">{row.conteudo ?? row.content ?? ''}</p>

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#f1f5f9] pt-4">
                <span className="inline-flex items-center rounded-full border border-[#bbf7d0] bg-[#dcfce7] px-2 py-0.5 text-[11px] font-bold text-[#16a34a]">
                  Ativo
                </span>
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

      {/* Modal criar / editar */}
      {formOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
          onClick={closeForm}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="termo-form-title"
            className="flex max-h-[90dvh] w-full max-w-2xl flex-col rounded-2xl bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#e2e8f0] px-6 py-4">
              <h2 id="termo-form-title" className="text-[18px] font-bold text-[#0f172a]">
                {editingId != null ? 'Editar Termo' : 'Novo Termo'}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#64748b] hover:bg-[#f1f5f9]"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div>
                <label className="block text-[13px] font-semibold text-[#0f172a]">
                  Nome do termo <span className="text-red-500">*</span>
                </label>
                <p className="mt-0.5 text-[12px] text-[#64748b]">
                  Ex: Termo Botox, Termo Preenchimento, Termo Cirurgia
                </p>
                <input
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex: Termo de Consentimento — Toxina Botulínica"
                  className={`mt-2 h-11 w-full rounded-xl border px-4 text-[14px] outline-none focus:border-[#00a88e] focus:ring-2 focus:ring-[#00a88e]/10 ${
                    formErrors.titulo ? 'border-[#dc2626]' : 'border-[#e2e8f0]'
                  }`}
                />
                {formErrors.titulo ? (
                  <p className="mt-1 text-[12px] text-[#dc2626]">Título obrigatório</p>
                ) : null}
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#0f172a]">
                  Conteúdo do termo <span className="text-red-500">*</span>
                </label>
                <p className="mt-0.5 text-[12px] text-[#64748b]">
                  Texto completo que será exibido ao paciente para leitura e assinatura
                </p>
                {/* Banner de atalho para template LGPD — só aparece em novos termos sem conteúdo */}
                {editingId == null && !conteudo && (
                  <div className="mt-2 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTitulo((t) => t || 'Termo de Consentimento LGPD');
                        setConteudo(LGPD_TEMPLATE_BRUTO);
                      }}
                      className="flex w-full items-center gap-2 rounded-xl border border-dashed border-[#00a88e]/50 bg-[#f0fdfa] px-4 py-2.5 text-left text-[13px] font-medium text-[#0f766e] transition-colors hover:bg-[#dcfce7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a88e]"
                    >
                      <Shield className="h-4 w-4 shrink-0 text-[#00a88e]" strokeWidth={2} aria-hidden />
                      Usar Template LGPD pronto — Lei nº 13.709/2018
                    </button>
                    <button
                      type="button"
                      onClick={() => setConteudo((prev) => `Eu, [NOME DO PACIENTE], portador(a) do CPF nº [CPF DO PACIENTE], declaro por meio deste termo...\n\n` + prev)}
                      className="flex w-full items-center gap-2 rounded-xl border border-dashed border-[#3b82f6]/50 bg-[#eff6ff] px-4 py-2.5 text-left text-[13px] font-medium text-[#1d4ed8] transition-colors hover:bg-[#dbeafe] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]"
                    >
                      <Plus className="h-4 w-4 shrink-0 text-[#3b82f6]" strokeWidth={2} aria-hidden />
                      Inserir parágrafo inicial com dados do Paciente
                    </button>
                  </div>
                )}
                <textarea
                  value={conteudo}
                  onChange={(e) => setConteudo(e.target.value)}
                  rows={12}
                  className={`mt-2 w-full resize-none rounded-xl border px-4 py-3 text-[14px] outline-none focus:border-[#00a88e] focus:ring-2 focus:ring-[#00a88e]/10 ${
                    formErrors.conteudo ? 'border-[#dc2626]' : 'border-[#e2e8f0]'
                  }`}
                />
                {formErrors.conteudo ? (
                  <p className="mt-1 text-[12px] text-[#dc2626]">Conteúdo obrigatório</p>
                ) : null}
                <div className="mt-2 flex gap-3 rounded-lg border border-[#99f6e4] bg-[#f0fdfa] p-3">
                  <Lightbulb className="h-4 w-4 shrink-0 text-[#00a88e]" strokeWidth={2} aria-hidden />
                  <div className="text-[12px] leading-relaxed text-[#0f766e] w-full">
                    <p className="font-semibold mb-1">Campos Automáticos (Copie e cole no texto):</p>
                    <ul className="list-disc pl-4 space-y-0.5 mb-3">
                      <li><strong className="font-semibold">{'[NOME DO PACIENTE]'}</strong> - Nome completo</li>
                      <li><strong className="font-semibold">{'[CPF DO PACIENTE]'}</strong> - CPF formatado</li>
                      <li><strong className="font-semibold">{'[NOME DA CLÍNICA]'}</strong> - Razão social ou nome</li>
                      <li><strong className="font-semibold">{'[CNPJ DA CLÍNICA]'}</strong> - CNPJ formatado</li>
                      <li><strong className="font-semibold">{'[NOME DO PROFISSIONAL]'}</strong> - Nome do atendente</li>
                    </ul>
                    
                    <p className="font-semibold mb-2 pt-2 border-t border-[#99f6e4]">Modelos Prontos de Introdução (com dados automáticos):</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const intro = "Eu, [NOME DO PACIENTE], portador(a) do CPF nº [CPF DO PACIENTE], declaro por meio deste documento que compreendo e concordo com as informações aqui descritas:";
                          setConteudo((prev) => (intro + "\n\n" + prev).trim());
                        }}
                        className="inline-flex items-center justify-center rounded-lg border border-[#0f766e] px-3 py-1.5 text-[11px] font-semibold text-[#0f766e] hover:bg-[#ccfbf1] transition-colors"
                      >
                        Inserir Intro Básica
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const intro = "Eu, [NOME DO PACIENTE], portador(a) do CPF nº [CPF DO PACIENTE], declaro por meio deste termo que autorizo a clínica [NOME DA CLÍNICA], inscrita no CNPJ sob o nº [CNPJ DA CLÍNICA], a realizar o tratamento dos meus dados pessoais em conformidade com a LGPD (Lei nº 13.709/2018):";
                          setConteudo((prev) => (intro + "\n\n" + prev).trim());
                        }}
                        className="inline-flex items-center justify-center rounded-lg border border-[#0f766e] px-3 py-1.5 text-[11px] font-semibold text-[#0f766e] hover:bg-[#ccfbf1] transition-colors"
                      >
                        Inserir Intro LGPD
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
                <input
                  type="checkbox"
                  id="autoAssinarProfissional"
                  checked={autoAssinarProfissional}
                  onChange={(e) => setAutoAssinarProfissional(e.target.checked)}
                  className="h-4 w-4 rounded border-[#cbd5e1] text-[#00a88e] focus:ring-[#00a88e]"
                />
                <div>
                  <label htmlFor="autoAssinarProfissional" className="block text-[13px] font-semibold text-[#0f172a] cursor-pointer">
                    Preencher assinatura do profissional automaticamente
                  </label>
                  <p className="mt-0.5 text-[12px] text-[#64748b]">
                    Se o profissional possuir uma Assinatura Padrão configurada no perfil, ela será inserida automaticamente neste termo.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-[#e2e8f0] px-6 py-4">
              <button
                type="button"
                disabled={saving}
                onClick={closeForm}
                className="h-10 rounded-lg border border-[#e2e8f0] px-4 text-[13px] font-medium text-[#0f172a] hover:bg-[#f8fafc] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#00a88e] px-5 text-[13px] font-semibold text-white disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal visualizar */}
      {viewingRow && !formOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setViewingRow(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="flex max-h-[90dvh] w-full max-w-2xl flex-col rounded-2xl bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] px-6 py-4">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <h3 className="truncate text-[18px] font-bold text-[#0f172a]">
                  {viewingRow.titulo ?? viewingRow.title ?? '—'}
                </h3>
                <span className="inline-flex shrink-0 rounded-full border border-[#bbf7d0] bg-[#dcfce7] px-2 py-0.5 text-[11px] font-bold text-[#16a34a]">
                  Ativo
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(viewingRow)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#e2e8f0] px-3 text-[13px] font-medium text-[#0f172a] hover:bg-[#f8fafc]"
                >
                  <Pencil className="h-4 w-4" strokeWidth={2} />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => setViewingRow(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[#64748b] hover:bg-[#f1f5f9]"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" strokeWidth={2} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-[#f8fafc] px-6 py-5">
              <TermoVisualizacao
                titulo={viewingRow.titulo}
                conteudo={viewingRow.conteudo ?? viewingRow.content ?? ''}
              />
            </div>
            <div className="flex flex-col items-center gap-3 border-t border-[#e2e8f0] px-6 py-4 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => setViewingRow(null)}
                className="h-10 w-full rounded-lg border border-[#e2e8f0] px-4 text-[13px] font-medium text-[#0f172a] hover:bg-[#f8fafc] sm:w-auto"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => openEdit(viewingRow)}
                className="h-10 w-full rounded-lg bg-[#00a88e] px-5 text-[13px] font-semibold text-white sm:w-auto"
              >
                Editar termo
              </button>
            </div>
          </div>
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
