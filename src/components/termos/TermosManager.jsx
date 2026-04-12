import React, { useCallback, useEffect, useState } from 'react';
import { FileText, Pencil, Trash2, Plus, Loader2 } from 'lucide-react';
import { termosApi } from '../../services/api';
import { useToast } from '../../contexts/useToast.js';

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

  const openNew = () => {
    setEditingId(null);
    setTitulo('');
    setConteudo('');
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setTitulo(row.titulo ?? row.title ?? '');
    setConteudo(row.conteudo ?? row.content ?? '');
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setTitulo('');
    setConteudo('');
  };

  const handleSave = async () => {
    const t = String(titulo || '').trim();
    const c = String(conteudo || '').trim();
    if (!t || !c) {
      toastError('Preencha título e conteúdo.');
      return;
    }
    setSaving(true);
    try {
      const body = { titulo: t, conteudo: c, ativo: true };
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

  const handleRemove = async (row) => {
    const id = row?.id;
    if (id == null) return;
    if (!window.confirm('Excluir este termo?')) return;
    try {
      await termosApi.remove(id);
      toastSuccess('Termo removido.');
      await load();
    } catch (e) {
      toastError(e?.message || 'Erro ao excluir.');
    }
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="bg-[#e6f7f5] p-3 rounded-2xl text-[#00a88e] border-[3px] border-[#00a88e]/25">
            <FileText className="w-7 h-7" strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-[20px] font-bold text-[#0f172a]">Termos LGPD</h3>
            <p className="text-[#64748b] text-[14px] font-medium">Texto exibido na etapa de consentimento da jornada</p>
          </div>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center justify-center gap-2 rounded-xl border-[3px] border-transparent bg-[#00a88e] px-5 py-2.5 text-[13px] font-bold text-white shadow-sm transition-all hover:bg-[#00967f]"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          Novo termo
        </button>
      </div>

      {formOpen && (
        <div className="mb-6 rounded-2xl border-[3px] border-[#00a88e]/25 bg-[#f8fbfb] p-4 sm:p-6 shadow-inner">
          <h4 className="text-[15px] font-bold text-[#0f172a] mb-4">
            {editingId != null ? 'Editar termo' : 'Novo termo'}
          </h4>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-[#64748b]">Título</label>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Termo de consentimento"
                className="w-full rounded-xl border-[2px] border-[#e2e8f0] px-4 py-3 text-[14px] outline-none focus:border-[#00a88e]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-[#64748b]">Conteúdo</label>
              <textarea
                value={conteudo}
                onChange={(e) => setConteudo(e.target.value)}
                placeholder="Texto completo do termo..."
                rows={8}
                className="w-full resize-y rounded-xl border-[2px] border-[#e2e8f0] px-4 py-3 text-[14px] outline-none focus:border-[#00a88e] min-h-[160px]"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="inline-flex items-center gap-2 rounded-xl border-[3px] border-transparent bg-[#00a88e] px-5 py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={closeForm}
                className="rounded-xl border-[3px] border-[#00a88e]/25 bg-white px-5 py-2.5 text-[13px] font-bold text-[#00a88e]"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border-[3px] border-[#00a88e]/25 bg-white overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[#00a88e] font-bold">
            <Loader2 className="h-6 w-6 animate-spin" />
            Carregando…
          </div>
        ) : items.length === 0 ? (
          <div className="py-14 px-4 text-center text-[#64748b] text-[14px] font-medium">
            Nenhum termo ativo. Clique em &quot;Novo termo&quot; para cadastrar.
          </div>
        ) : (
          <ul className="divide-y divide-[#00a88e]/10">
            {items.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[#0f172a] text-[15px] truncate">{row.titulo ?? row.title ?? '—'}</p>
                  <p className="mt-1 text-[12px] text-[#64748b] line-clamp-2 whitespace-pre-wrap">
                    {row.conteudo ?? row.content ?? ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
                    className="inline-flex items-center gap-1.5 rounded-xl border-[3px] border-[#00a88e]/25 bg-white px-3 py-2 text-[12px] font-bold text-[#00a88e] hover:bg-[#e6f7f5]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(row)}
                    className="inline-flex items-center gap-1.5 rounded-xl border-[3px] border-red-100 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-600 hover:bg-red-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
