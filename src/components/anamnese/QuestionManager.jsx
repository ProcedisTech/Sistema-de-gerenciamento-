import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, HelpCircle, Loader2, ChevronDown, ChevronUp,
  X, ListChecks, Pencil, Trash2, GripVertical, Check,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { anamneseApi, dimensoesApi, getApiErrorDetail } from '../../services/api';

const TIPOS_COM_ALTERNATIVAS = ['escolha_unica', 'multipla_escolha'];

// ── Sortable alternative row (used in edit modal) ─────────────────────────────

function SortableAlt({ alt, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: alt.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 bg-white border-[2px] border-[#a855f7]/15 rounded-lg px-3 py-2"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-[#94a3b8] hover:text-[#64748b] flex-shrink-0 touch-none"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="w-5 h-5 rounded-full bg-[#a855f7]/10 text-[#a855f7] text-[11px] font-bold flex items-center justify-center flex-shrink-0">
        {alt.ordem}
      </span>
      <span className="flex-1 text-[13px] font-medium text-[#0f172a]">{alt.alternativa}</span>
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(alt.id)}
          className="w-6 h-6 rounded-md hover:bg-red-50 text-red-400 hover:text-red-600 flex items-center justify-center flex-shrink-0"
        >
          <X className="w-3.5 h-3.5" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

// ── Sortable alternative row (card view — read-only drag) ─────────────────────

function SortableAltCard({ alt }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: alt.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 text-[13px] text-[#475569]"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-[#c4b5fd] hover:text-[#a855f7] flex-shrink-0 touch-none"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <ListChecks className="w-3.5 h-3.5 text-[#a855f7] flex-shrink-0" />
      <span>{alt.alternativa}</span>
    </div>
  );
}

// ── Resolve tipoRespostaId from various API shapes ────────────────────────────

function resolveTipoRespostaId(pergunta, tiposResposta) {
  const byId = pergunta.tipoRespostaId || pergunta.tipo_resposta_id;
  if (byId) return String(byId);
  const tipoStr = pergunta.tipoResposta || pergunta.tipo_resposta || '';
  if (tipoStr) {
    const match = tiposResposta.find((tr) => tr.tipo === tipoStr);
    if (match) return String(match.tipo_resposta_id || match.id);
  }
  return '';
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

export function EditModal({ pergunta, categorias, tiposResposta, tipoLabel, onClose, onSaved }) {
  const [categoriaId, setCategoriaId] = useState(String(pergunta.categoriaId || ''));
  const [tipoRespostaId, setTipoRespostaId] = useState(() => resolveTipoRespostaId(pergunta, tiposResposta));
  const [descricao, setDescricao] = useState(pergunta.descricao || '');
  const [alternativas, setAlternativas] = useState(
    Array.isArray(pergunta.alternativas)
      ? pergunta.alternativas.map((a) => ({ ...a })).sort((a, b) => a.ordem - b.ordem)
      : []
  );
  const [novaAlt, setNovaAlt] = useState('');
  const [prioridade, setPrioridade] = useState(() => pergunta.prioridade ?? 'NORMAL');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const tipoStrOriginal = pergunta.tipoResposta || pergunta.tipo_resposta || '';

  const tipoSelecionado = useMemo(() => {
    const t = tiposResposta.find((tr) => String(tr.tipo_resposta_id || tr.id) === String(tipoRespostaId));
    return t?.tipo || '';
  }, [tiposResposta, tipoRespostaId]);

  const mostrarAlternativas =
    TIPOS_COM_ALTERNATIVAS.includes(tipoSelecionado) ||
    TIPOS_COM_ALTERNATIVAS.includes(tipoStrOriginal) ||
    alternativas.length > 0;

  // Always lock the tipo select in edit mode — changing type after creation causes conflicts with existing answers
  const tipoTravado = true;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIdx = alternativas.findIndex((a) => a.id === active.id);
    const newIdx = alternativas.findIndex((a) => a.id === over.id);
    const reordered = arrayMove(alternativas, oldIdx, newIdx).map((a, i) => ({ ...a, ordem: i + 1 }));
    setAlternativas(reordered);
  };

  const handleAdicionarAlt = () => {
    const texto = novaAlt.trim();
    if (!texto) return;
    setAlternativas((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, alternativa: texto, ordem: prev.length + 1 },
    ]);
    setNovaAlt('');
  };

  const handleRemoverAlt = (id) => {
    setAlternativas((prev) => prev.filter((a) => a.id !== id).map((a, i) => ({ ...a, ordem: i + 1 })));
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!categoriaId || !tipoRespostaId || !descricao.trim()) {
      setErro('Preencha categoria, tipo de resposta e descrição.');
      return;
    }
    const tipoEhEscolha =
      TIPOS_COM_ALTERNATIVAS.includes(tipoSelecionado) || TIPOS_COM_ALTERNATIVAS.includes(tipoStrOriginal);
    if (mostrarAlternativas && tipoEhEscolha && alternativas.length < 2) {
      setErro('Adicione pelo menos 2 alternativas para perguntas de escolha.');
      return;
    }
    if (mostrarAlternativas && alternativas.length > 0) {
      const textosNorm = alternativas.map((a) => (a.alternativa || '').trim().toLowerCase());
      if (textosNorm.some((t) => !t)) {
        setErro('Remova alternativas em branco ou preencha o texto.');
        return;
      }
      if (new Set(textosNorm).size !== textosNorm.length) {
        setErro('Não use textos duplicados nas alternativas.');
        return;
      }
    }
    setErro('');
    setSalvando(true);
    try {
      const body = {
        categoriaId,
        tipoRespostaId,
        descricao: descricao.trim(),
        prioridade,
      };
      if (mostrarAlternativas) {
        body.alternativas = alternativas.map((a, i) => {
          const row = { alternativa: (a.alternativa || '').trim(), ordem: i };
          const sid = a.id != null ? String(a.id) : '';
          if (sid && !sid.startsWith('new-')) {
            row.id = sid;
          }
          return row;
        });
      }
      const updated = await anamneseApi.updateHabito(pergunta.id, body);
      onSaved(updated);
    } catch (err) {
      if (err.status === 404) {
        onClose();
        onSaved(null);
      } else {
        setErro(err.message || 'Erro ao salvar pergunta.');
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border-[3px] border-[#00a88e]/20 shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8f0]">
          <h3 className="text-[16px] font-bold text-[#0f172a]">Editar Pergunta</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#64748b] hover:bg-[#f1f5f9]">
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={handleSalvar} className="flex flex-col flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          {erro && (
            <div className="bg-red-50 text-red-600 border-[3px] border-red-200 rounded-xl p-3 text-[13px] font-bold">{erro}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#00a88e] ml-1">Categoria *</label>
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className="w-full px-4 py-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e] appearance-none"
              >
                <option value="">Selecione...</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#00a88e] ml-1">Tipo de Resposta *</label>
              {tipoTravado ? (
                <div className="w-full px-4 py-3 bg-[#f1f5f9] border-[3px] border-[#00a88e]/15 rounded-xl text-[14px] font-medium text-[#475569] flex items-center gap-2">
                  <span>{tipoLabel(tipoStrOriginal || tipoSelecionado)}</span>
                  <span className="text-[11px] text-[#94a3b8] font-normal ml-auto">(não editável)</span>
                </div>
              ) : (
                <select
                  value={tipoRespostaId}
                  onChange={(e) => { setTipoRespostaId(e.target.value); }}
                  className="w-full px-4 py-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e] appearance-none"
                >
                  <option value="">Selecione...</option>
                {tiposResposta.filter((t) => t.ativo !== false).map((t) => (
                  <option key={t.tipo_resposta_id || t.id} value={t.tipo_resposta_id || t.id}>{tipoLabel(t.tipo)}</option>
                ))}
                </select>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-[#00a88e] ml-1">Prioridade</label>
            <select
              value={prioridade}
              onChange={(e) => setPrioridade(e.target.value)}
              className="w-full px-4 py-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e] appearance-none"
            >
              <option value="NORMAL">Normal</option>
              <option value="ALERTA">⚠️ Alerta</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-[#00a88e] ml-1">Pergunta / Descrição *</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e]"
            />
          </div>

          {mostrarAlternativas && (
            <div className="space-y-3 p-4 bg-[#f8fbfb] border-[3px] border-[#a855f7]/20 rounded-xl">
              <label className="text-[13px] font-bold text-[#a855f7] ml-1">Alternativas (arraste para reordenar)</label>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={alternativas.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1.5">
                    {alternativas.map((alt) => (
                      <SortableAlt key={alt.id} alt={alt} onRemove={handleRemoverAlt} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={novaAlt}
                  onChange={(e) => setNovaAlt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdicionarAlt(); } }}
                  placeholder="Nova alternativa..."
                  className="flex-1 px-3 py-2 bg-white border-[2px] border-[#a855f7]/20 rounded-lg text-[13px] font-medium focus:outline-none focus:border-[#a855f7]"
                />
                <button type="button" onClick={handleAdicionarAlt} className="px-3 py-2 rounded-lg bg-[#a855f7] text-white text-[12px] font-bold">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={salvando}
              className="px-5 py-3 rounded-xl font-bold text-[14px] bg-[#00a88e] hover:bg-[#00967f] text-white border-[3px] border-transparent shadow-md disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" strokeWidth={2.5} />}
              Salvar
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-xl font-bold text-[14px] bg-white text-[#64748b] border-[3px] border-[#e2e8f0] hover:border-[#00a88e]/20"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function QuestionManager({
  embeddedInPanel = false,
  lockedCategoryId = null,
  panelTitle = '',
}) {
  const lockedIdStr =
    embeddedInPanel && lockedCategoryId != null && lockedCategoryId !== ''
      ? String(lockedCategoryId)
      : '';

  const [perguntas, setPerguntas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [tiposResposta, setTiposResposta] = useState([]);
  const [fichas, setFichas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState(() => lockedIdStr || '');

  // create form
  const [formAberto, setFormAberto] = useState(false);
  const [categoriaId, setCategoriaId] = useState('');
  const [tipoRespostaId, setTipoRespostaId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [alternativas, setAlternativas] = useState([]);
  const [novaAlternativa, setNovaAlternativa] = useState('');
  const [prioridade, setPrioridade] = useState('NORMAL');
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState('');

  // edit
  const [editingPergunta, setEditingPergunta] = useState(null);

  // delete
  const [deletingId, setDeletingId] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroDelete, setErroDelete] = useState(null);
  const [deleteConflictModal, setDeleteConflictModal] = useState(null);

  // reorder state per card: { [habitoId]: isSaving }
  const [reorderSaving, setReorderSaving] = useState({});

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const tipoSelecionado = useMemo(() => {
    const t = tiposResposta.find((tr) => String(tr.tipo_resposta_id || tr.id) === String(tipoRespostaId));
    return t?.tipo || '';
  }, [tiposResposta, tipoRespostaId]);

  const precisaAlternativas = TIPOS_COM_ALTERNATIVAS.includes(tipoSelecionado);

  // Derive which pergunta ids are in use across all fichas
  const perguntasEmUso = useMemo(() => {
    const ids = new Set();
    fichas.forEach((f) => {
      (f.itens || []).forEach((item) => {
        const id = item.pergunta?.id || item.perguntaId;
        if (id) ids.add(String(id));
      });
    });
    return ids;
  }, [fichas]);

  const fetchDados = async () => {
    setLoading(true);
    const [cats, tipos, pergs, fs] = await Promise.all([
      anamneseApi.listCategorias().catch((e) => { console.warn('Categorias:', e.message); return []; }),
      dimensoesApi.tiposResposta().catch((e) => { console.warn('Tipos resposta:', e.message); return []; }),
      anamneseApi.listAllHabitos().catch((e) => { console.warn('Hábitos:', e.message); return []; }),
      anamneseApi.listFichas().catch((e) => { console.warn('Fichas:', e.message); return []; }),
    ]);
    setCategorias(Array.isArray(cats) ? cats : []);
    setTiposResposta(Array.isArray(tipos) ? tipos : []);
    setPerguntas(Array.isArray(pergs) ? pergs : []);
    setFichas(Array.isArray(fs) ? fs : []);
    setLoading(false);
  };

  useEffect(() => { fetchDados(); }, []);

  useEffect(() => {
    if (lockedIdStr) setFiltroCategoria(lockedIdStr);
  }, [lockedIdStr]);

  const perguntasFiltradas = useMemo(() => {
    if (!filtroCategoria) return perguntas;
    return perguntas.filter((p) => String(p.categoriaId) === String(filtroCategoria));
  }, [perguntas, filtroCategoria]);

  // ── Create form helpers ──

  const handleAdicionarAlternativa = () => {
    const texto = novaAlternativa.trim();
    if (!texto) return;
    setAlternativas((prev) => [...prev, { alternativa: texto, ordem: prev.length + 1 }]);
    setNovaAlternativa('');
  };

  const handleRemoverAlternativa = (idx) => {
    setAlternativas((prev) => prev.filter((_, i) => i !== idx).map((a, i) => ({ ...a, ordem: i + 1 })));
  };

  const resetForm = () => {
    setCategoriaId('');
    setTipoRespostaId('');
    setDescricao('');
    setAlternativas([]);
    setNovaAlternativa('');
    setPrioridade('NORMAL');
    setErro('');
  };

  const handleCriar = async (e) => {
    e.preventDefault();
    if (!categoriaId || !tipoRespostaId || !descricao.trim()) {
      setErro('Preencha categoria, tipo de resposta e descrição.');
      return;
    }
    if (precisaAlternativas && alternativas.length < 2) {
      setErro('Adicione pelo menos 2 alternativas para perguntas de escolha.');
      return;
    }
    setErro('');
    setCriando(true);
    try {
      const habito = await anamneseApi.createHabito({
        categoriaId,
        tipoRespostaId,
        descricao: descricao.trim(),
        prioridade,
      });
      if (precisaAlternativas && alternativas.length > 0) {
        await anamneseApi.addAlternativas(habito.id, alternativas);
      }
      resetForm();
      setFormAberto(false);
      await fetchDados();
    } catch (err) {
      setErro(err.message || 'Erro ao criar pergunta.');
    } finally {
      setCriando(false);
    }
  };

  // ── Edit handlers ──

  const handleEditSaved = async (updated) => {
    setEditingPergunta(null);
    if (updated === null) {
      await fetchDados();
    } else {
      setPerguntas((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    }
  };

  // ── Delete handlers ──

  const handleExcluir = async (id) => {
    setErroDelete(null);
    setExcluindo(true);
    try {
      await anamneseApi.deleteHabito(id);
      setPerguntas((prev) => prev.filter((p) => p.id !== id));
      setDeletingId(null);
    } catch (err) {
      if (err.status === 409) {
        setErroDelete(null);
        setDeletingId(null);
        setDeleteConflictModal(
          getApiErrorDetail(err) ||
            'Essa pergunta está em uso em uma ou mais fichas. Remova-a das fichas antes de excluir.'
        );
      } else {
        setErroDelete({
          id,
          msg: getApiErrorDetail(err) || err.message || 'Erro ao excluir.',
        });
      }
    } finally {
      setExcluindo(false);
    }
  };

  // ── Reorder handlers (card-level drag) ──

  const handleReorderDragEnd = async (habitoId, alts, { active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIdx = alts.findIndex((a) => a.id === active.id);
    const newIdx = alts.findIndex((a) => a.id === over.id);
    const reordered = arrayMove(alts, oldIdx, newIdx).map((a, i) => ({ ...a, ordem: i + 1 }));

    setPerguntas((prev) =>
      prev.map((p) => (p.id === habitoId ? { ...p, alternativas: reordered } : p))
    );

    setReorderSaving((s) => ({ ...s, [habitoId]: true }));
    try {
      const resultado = await anamneseApi.reordenarAlternativas(
        habitoId,
        reordered.map((a) => ({ id: a.id, ordem: a.ordem }))
      );
      if (Array.isArray(resultado)) {
        setPerguntas((prev) =>
          prev.map((p) =>
            p.id === habitoId
              ? { ...p, alternativas: resultado.sort((a, b) => a.ordem - b.ordem) }
              : p
          )
        );
      }
    } catch (err) {
      console.warn('Erro ao reordenar:', err.message);
      await fetchDados();
    } finally {
      setReorderSaving((s) => ({ ...s, [habitoId]: false }));
    }
  };

  // ── Helpers ──

  const tipoLabel = (tipo) => {
    const map = { texto: 'Texto', escolha_unica: 'Escolha Única', multipla_escolha: 'Múltipla Escolha', booleano: 'Sim/Não', numero: 'Número' };
    return map[tipo] || tipo;
  };

  // All type badges use the same blue style
  const tipoBadgeColor = () => 'bg-blue-50 text-blue-700 border-blue-200';

  return (
    <div className="space-y-6">
      {/* Edit modal */}
      {editingPergunta && (
        <EditModal
          key={editingPergunta.id}
          pergunta={editingPergunta}
          categorias={categorias}
          tiposResposta={tiposResposta}
          tipoLabel={tipoLabel}
          onClose={() => setEditingPergunta(null)}
          onSaved={handleEditSaved}
        />
      )}

      {deleteConflictModal != null && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-conflict-title"
            className="bg-white rounded-2xl border-[3px] border-[#00a88e]/20 shadow-2xl w-full max-w-md flex flex-col"
          >
            <div className="px-6 py-4 border-b border-[#e2e8f0]">
              <h3 id="delete-conflict-title" className="text-[16px] font-bold text-[#0f172a]">
                Não foi possível excluir
              </h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-[14px] font-medium text-[#475569] leading-relaxed whitespace-pre-wrap break-words">
                {deleteConflictModal}
              </p>
            </div>
            <div className="px-6 pb-6 flex justify-end">
              <button
                type="button"
                onClick={() => setDeleteConflictModal(null)}
                className="px-5 py-3 rounded-xl font-bold text-[14px] bg-[#00a88e] hover:bg-[#00967f] text-white border-[3px] border-transparent shadow-md"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {lockedIdStr ? (
            <>
              <span className="text-[13px] font-bold text-[#64748b] flex-shrink-0">Categoria:</span>
              <span className="text-[13px] font-bold text-[#0f172a] truncate" title={panelTitle || categorias.find((c) => String(c.id) === lockedIdStr)?.nome}>
                {panelTitle || categorias.find((c) => String(c.id) === lockedIdStr)?.nome || '…'}
              </span>
            </>
          ) : (
            <>
              <label className="text-[13px] font-bold text-[#64748b]">Filtrar por categoria:</label>
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="px-3 py-2 bg-[#f8fbfb] border-[3px] border-[#00a88e]/20 rounded-xl text-[13px] font-medium focus:outline-none focus:border-[#00a88e] appearance-none"
              >
                <option value="">Todas</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            if (formAberto) {
              setFormAberto(false);
            } else {
              resetForm();
              if (lockedIdStr) setCategoriaId(lockedIdStr);
              setFormAberto(true);
            }
          }}
          className="px-5 py-3 rounded-xl font-bold text-[14px] transition-all shadow-md bg-[#00a88e] hover:bg-[#00967f] text-white border-[3px] border-transparent flex items-center gap-2"
        >
          {formAberto ? <ChevronUp className="w-4 h-4" /> : <Plus className="w-4 h-4" strokeWidth={2.5} />}
          {formAberto ? 'Fechar' : 'Nova Pergunta'}
        </button>
      </div>

      {/* Create form */}
      {formAberto && (
        <form onSubmit={handleCriar} className="bg-[#f8fbfb] border-[3px] border-[#00a88e]/20 rounded-2xl p-6 space-y-4">
          <h4 className="text-[16px] font-bold text-[#0f172a]">Criar Pergunta</h4>

          {erro && (
            <div className="bg-red-50 text-red-600 border-[3px] border-red-200 rounded-xl p-3 text-[13px] font-bold">{erro}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#00a88e] ml-1">Categoria *</label>
              {lockedIdStr ? (
                <div className="w-full px-4 py-3 bg-[#f1f5f9] border-[3px] border-[#00a88e]/15 rounded-xl text-[14px] font-medium text-[#475569]">
                  {panelTitle || categorias.find((c) => String(c.id) === lockedIdStr)?.nome || '—'}
                </div>
              ) : (
                <select
                  value={categoriaId}
                  onChange={(e) => setCategoriaId(e.target.value)}
                  className="w-full px-4 py-3 bg-white border-[3px] border-[#00a88e]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e] appearance-none"
                >
                  <option value="">Selecione...</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#00a88e] ml-1">Tipo de Resposta *</label>
              <select
                value={tipoRespostaId}
                onChange={(e) => { setTipoRespostaId(e.target.value); setAlternativas([]); }}
                className="w-full px-4 py-3 bg-white border-[3px] border-[#00a88e]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e] appearance-none"
              >
                <option value="">Selecione...</option>
                {tiposResposta.filter((t) => t.ativo !== false).map((t) => (
                  <option key={t.tipo_resposta_id || t.id} value={t.tipo_resposta_id || t.id}>{tipoLabel(t.tipo)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-[#00a88e] ml-1">Prioridade</label>
            <select
              value={prioridade}
              onChange={(e) => setPrioridade(e.target.value)}
              className="w-full px-4 py-3 bg-white border-[3px] border-[#00a88e]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e] appearance-none"
            >
              <option value="NORMAL">Normal</option>
              <option value="ALERTA">⚠️ Alerta</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-[#00a88e] ml-1">Pergunta / Descrição *</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              placeholder="Ex: O paciente faz uso de medicamentos controlados?"
              className="w-full px-4 py-3 bg-white border-[3px] border-[#00a88e]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e]"
            />
          </div>

          {/* Preview in create form for non-choice types */}
          {tipoSelecionado === 'texto' && (
            <div className="pl-3 border-l-[3px] border-blue-200">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide mb-1">Pré-visualização</p>
              <input
                disabled
                placeholder="Resposta do paciente"
                className="w-full px-3 py-2 bg-slate-50 border-[2px] border-dashed border-slate-300 rounded-lg text-[12px] text-slate-400 cursor-not-allowed"
              />
            </div>
          )}

          {tipoSelecionado === 'booleano' && (
            <div className="pl-3 border-l-[3px] border-emerald-200">
              <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wide mb-1.5">Pré-visualização</p>
              <div className="flex gap-2">
                <span className="px-4 py-1.5 rounded-lg border-[2px] border-emerald-300 bg-emerald-50 text-emerald-700 text-[12px] font-bold select-none">
                  Sim
                </span>
                <span className="px-4 py-1.5 rounded-lg border-[2px] border-slate-200 bg-slate-50 text-slate-500 text-[12px] font-bold select-none">
                  Não
                </span>
              </div>
            </div>
          )}

          {tipoSelecionado === 'numero' && (
            <div className="pl-3 border-l-[3px] border-cyan-200">
              <p className="text-[10px] font-bold text-cyan-500 uppercase tracking-wide mb-1">Pré-visualização</p>
              <input
                type="number"
                disabled
                placeholder="Resposta do paciente"
                className="w-32 px-3 py-2 bg-slate-50 border-[2px] border-dashed border-slate-300 rounded-lg text-[12px] text-slate-400 cursor-not-allowed"
              />
            </div>
          )}

          {precisaAlternativas && (
            <div className="space-y-3 p-4 bg-white border-[3px] border-[#a855f7]/20 rounded-xl">
              <label className="text-[13px] font-bold text-[#a855f7] ml-1">Alternativas *</label>

              {alternativas.map((alt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#a855f7]/10 text-[#a855f7] text-[11px] font-bold flex items-center justify-center flex-shrink-0">{alt.ordem}</span>
                  <span className="flex-1 text-[14px] font-medium text-[#0f172a]">{alt.alternativa}</span>
                  <button type="button" onClick={() => handleRemoverAlternativa(idx)} className="w-7 h-7 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 flex items-center justify-center">
                    <X className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                </div>
              ))}

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={novaAlternativa}
                  onChange={(e) => setNovaAlternativa(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdicionarAlternativa(); } }}
                  placeholder="Digitar alternativa e pressionar Enter..."
                  className="flex-1 px-3 py-2 bg-[#f8fbfb] border-[2px] border-[#a855f7]/20 rounded-lg text-[13px] font-medium focus:outline-none focus:border-[#a855f7]"
                />
                <button type="button" onClick={handleAdicionarAlternativa} className="px-3 py-2 rounded-lg bg-[#a855f7] text-white text-[12px] font-bold">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={criando}
              className="px-5 py-3 rounded-xl font-bold text-[14px] bg-[#00a88e] hover:bg-[#00967f] text-white border-[3px] border-transparent shadow-md disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {criando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Salvar Pergunta
            </button>
            <button type="button" onClick={() => { setFormAberto(false); resetForm(); }} className="px-5 py-3 rounded-xl font-bold text-[14px] bg-white text-[#64748b] border-[3px] border-[#e2e8f0] hover:border-[#00a88e]/20">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Questions list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#00a88e]" />
          <span className="ml-2 text-[#64748b] text-[13px] font-medium">Carregando perguntas...</span>
        </div>
      ) : perguntasFiltradas.length === 0 ? (
        <div className="text-center py-12 text-[#94a3b8]">
          <HelpCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-[14px] font-medium">
            {lockedIdStr ? 'Nenhuma pergunta nesta categoria' : 'Nenhuma pergunta cadastrada'}
          </p>
          <p className="text-[12px] mt-1">
            {lockedIdStr ? 'Use "Nova Pergunta" acima para adicionar à categoria' : 'Crie perguntas para montar fichas de anamnese'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 lg:gap-4">
          {perguntasFiltradas.map((p) => {
            const hasAlts = TIPOS_COM_ALTERNATIVAS.includes(p.tipoResposta) && Array.isArray(p.alternativas) && p.alternativas.length > 0;
            const alts = hasAlts ? [...p.alternativas].sort((a, b) => a.ordem - b.ordem) : [];
            const isDeleting = deletingId === p.id;
            const cardErro = erroDelete?.id === p.id ? erroDelete.msg : null;
            const isSavingReorder = !!reorderSaving[p.id];
            const emUso = perguntasEmUso.has(String(p.id));
            const prioridadePergunta = p.prioridade === 'ALERTA' ? 'ALERTA' : 'NORMAL';

            return (
              <div
                key={p.id}
                onClick={() => { if (!isDeleting) setEditingPergunta(p); }}
                className={`p-4 rounded-xl border-[3px] transition-all flex flex-col shadow-sm cursor-pointer ${
                  prioridadePergunta === 'ALERTA'
                    ? 'border-red-300 bg-red-50/80 hover:border-red-400'
                    : 'border-[#00a88e]/15 bg-white hover:border-[#00a88e]/30'
                }`}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-[#0f172a] break-words [overflow-wrap:anywhere]">{p.descricao}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#e6f7f5] text-[#0f766e] border-[2px] border-[#00a88e]/15">
                        {p.categoriaNome || 'Sem categoria'}
                      </span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border-[2px] ${tipoBadgeColor(p.tipoResposta)}`}>
                        {tipoLabel(p.tipoResposta)}
                      </span>
                      {prioridadePergunta === 'ALERTA' ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md border-[2px] border-red-600 bg-red-700 text-white">
                          ⚠️ Alerta
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md border-[2px] border-slate-200 bg-slate-100 text-slate-700">
                          Normal
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Badge above action buttons (or badge only while confirming delete) */}
                  {(emUso || !isDeleting) && (
                    <div className="flex flex-col items-end gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      {emUso && (
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap"
                          title="Usada em uma ou mais fichas"
                        >
                          Em uso
                        </span>
                      )}
                      {!isDeleting && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingPergunta(p)}
                            title="Editar"
                            className="p-1.5 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#00a88e] transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
                          </button>
                          <button
                            onClick={() => { setErroDelete(null); setDeletingId(p.id); }}
                            title="Excluir"
                            className="p-1.5 rounded-lg text-[#64748b] hover:bg-red-50 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Delete confirmation */}
                {isDeleting && (
                  <div className="mt-3 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[12px] font-bold text-[#475569] break-words [overflow-wrap:anywhere]">Remover esta pergunta?</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleExcluir(p.id)}
                        disabled={excluindo}
                        className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-[12px] font-bold hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 flex-shrink-0"
                      >
                        {excluindo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" strokeWidth={2.5} />}
                        Confirmar
                      </button>
                      <button
                        onClick={() => { setDeletingId(null); setErroDelete(null); }}
                        className="px-3 py-1.5 rounded-lg bg-[#f1f5f9] text-[#64748b] text-[12px] font-bold hover:bg-[#e2e8f0] transition-colors flex-shrink-0"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Inline error */}
                {cardErro && (
                  <div className="mt-2 text-[12px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    {cardErro}
                  </div>
                )}

                {/* Alternatives with drag-to-reorder (escolha_unica / multipla_escolha) */}
                {hasAlts && (
                  <div className="mt-3 pl-3 border-l-[3px] border-[#a855f7]/20 space-y-1" onClick={(e) => e.stopPropagation()}>
                    {isSavingReorder && (
                      <div className="flex items-center gap-1.5 text-[11px] text-[#a855f7] font-medium pb-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Salvando ordem...
                      </div>
                    )}
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event) => handleReorderDragEnd(p.id, alts, event)}
                    >
                      <SortableContext items={alts.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                        {alts.map((alt) => (
                          <SortableAltCard key={alt.id} alt={alt} />
                        ))}
                      </SortableContext>
                    </DndContext>
                  </div>
                )}

                {/* Preview for non-choice types */}
                {p.tipoResposta === 'texto' && (
                  <div className="mt-3 pl-3 border-l-[3px] border-blue-200">
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide mb-1">Pré-visualização</p>
                    <input
                      disabled
                      placeholder="Resposta do paciente"
                      className="w-full px-3 py-2 bg-slate-50 border-[2px] border-dashed border-slate-300 rounded-lg text-[12px] text-slate-400 cursor-not-allowed"
                    />
                  </div>
                )}

                {p.tipoResposta === 'booleano' && (
                  <div className="mt-3 pl-3 border-l-[3px] border-emerald-200">
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wide mb-1.5">Pré-visualização</p>
                    <div className="flex gap-2">
                      <span className="px-4 py-1.5 rounded-lg border-[2px] border-emerald-300 bg-emerald-50 text-emerald-700 text-[12px] font-bold select-none">
                        Sim
                      </span>
                      <span className="px-4 py-1.5 rounded-lg border-[2px] border-slate-200 bg-slate-50 text-slate-500 text-[12px] font-bold select-none">
                        Não
                      </span>
                    </div>
                  </div>
                )}

                {p.tipoResposta === 'numero' && (
                  <div className="mt-3 pl-3 border-l-[3px] border-cyan-200">
                    <p className="text-[10px] font-bold text-cyan-500 uppercase tracking-wide mb-1">Pré-visualização</p>
                    <input
                      type="number"
                      disabled
                      placeholder="Resposta do paciente"
                      className="w-32 px-3 py-2 bg-slate-50 border-[2px] border-dashed border-slate-300 rounded-lg text-[12px] text-slate-400 cursor-not-allowed"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
