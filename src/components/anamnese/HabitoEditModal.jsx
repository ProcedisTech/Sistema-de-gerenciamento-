import React, { useState, useMemo } from 'react';
import {
  Plus, Loader2, ChevronDown,
  X, ListChecks, Pencil, Trash2, GripVertical, Check, AlertTriangle,
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
import { anamneseApi } from '../../services/api';
import { tipoLabel } from './anamneseTipoLabels';

const TIPOS_COM_ALTERNATIVAS = ['escolha_unica', 'multipla_escolha'];
const DESCRICAO_MAX_CHARS = 300;

// ── Duplicate detection helpers ───────────────────────────────────────────────

function hasDuplicateAlt(text, existingAlts) {
  const norm = (text || '').trim().toLowerCase();
  if (!norm) return { isDuplicate: false, duplicateId: null };
  for (const alt of existingAlts) {
    const altNorm = (alt.alternativa || '').trim().toLowerCase();
    if (altNorm === norm) return { isDuplicate: true, duplicateId: alt.id ?? null };
  }
  return { isDuplicate: false, duplicateId: null };
}

function findDuplicateIndices(alts) {
  const seen = new Map();
  const dupes = new Set();
  alts.forEach((a, i) => {
    const norm = (a.alternativa || '').trim().toLowerCase();
    if (!norm) return;
    if (seen.has(norm)) {
      dupes.add(seen.get(norm));
      dupes.add(i);
    } else {
      seen.set(norm, i);
    }
  });
  return dupes;
}

// ── Sortable alternative row (inside edit modal) ──────────────────────────────

function SortableAlt({ alt, onRemove, isDuplicate, isShaking }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: alt.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 bg-white border-[2px] rounded-lg px-3 py-2 transition-colors ${
        isDuplicate ? 'border-red-400 bg-red-50' : 'border-[#a855f7]/15'
      } ${isShaking ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}
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
      {isDuplicate && (
        <span title="Alternativa duplicada" className="flex-shrink-0 text-red-500">
          <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2.5} />
        </span>
      )}
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

// ── Resolve tipoRespostaId from various API shapes ─────────────────────────────

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

// ── HabitoEditModal ───────────────────────────────────────────────────────────

/**
 * Modal para editar uma pergunta (hábito) de anamnese.
 *
 * @param {object} props
 * @param {object} props.pergunta       — HabitoDTO completo
 * @param {Array}  props.categorias     — lista de CategoriaAnamneseDTO
 * @param {Array}  props.tiposResposta  — lista de TipoResposta (com id/tipo_resposta_id e tipo)
 * @param {(tipo: string) => string} [props.tipoLabel] — sobrescreve o label padrão de tipo
 * @param {() => void} props.onClose
 * @param {(updated: object | null) => void} props.onSaved — null = refetch completo
 */
export function HabitoEditModal({ pergunta, categorias, tiposResposta, tipoLabel: tipoLabelProp, onClose, onSaved }) {
  const resolveTipo = tipoLabelProp || tipoLabel;

  const [categoriaId, setCategoriaId] = useState(String(pergunta.categoriaId || ''));
  const [tipoRespostaId] = useState(() => resolveTipoRespostaId(pergunta, tiposResposta));
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
  const [dupWarning, setDupWarning] = useState('');
  const [shakingAltId, setShakingAltId] = useState(null);

  const tipoStrOriginal = pergunta.tipoResposta || pergunta.tipo_resposta || '';

  const tipoSelecionado = useMemo(() => {
    const t = tiposResposta.find((tr) => String(tr.tipo_resposta_id || tr.id) === String(tipoRespostaId));
    return t?.tipo || '';
  }, [tiposResposta, tipoRespostaId]);

  const mostrarAlternativas =
    TIPOS_COM_ALTERNATIVAS.includes(tipoSelecionado) ||
    TIPOS_COM_ALTERNATIVAS.includes(tipoStrOriginal) ||
    alternativas.length > 0;

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
    const { isDuplicate, duplicateId } = hasDuplicateAlt(texto, alternativas);
    if (isDuplicate) {
      setDupWarning('Essa alternativa já existe.');
      if (duplicateId != null) {
        setShakingAltId(duplicateId);
        setTimeout(() => setShakingAltId(null), 450);
      }
      setTimeout(() => setDupWarning(''), 3000);
      return;
    }
    setDupWarning('');
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
        descricao: descricao.trim().slice(0, DESCRICAO_MAX_CHARS),
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
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8f0]">
          <h3 className="text-[16px] font-bold text-[#0f172a]">Editar Pergunta</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#64748b] hover:bg-[#f1f5f9]">
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={handleSalvar} className="flex flex-col flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          {erro && (
            <div className="bg-red-50 text-red-600 border border-red-200 rounded-xl p-3 text-[13px] font-bold">{erro}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#00a88e] ml-1">Categoria *</label>
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className="w-full px-4 py-3 bg-[#f8fbfb] border border-app-border rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e] appearance-none"
              >
                <option value="">Selecione...</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#00a88e] ml-1">Tipo de Resposta *</label>
              <div className="w-full px-4 py-3 bg-[#f1f5f9] border border-app-border rounded-xl text-[14px] font-medium text-[#475569] flex items-center gap-2">
                <span>{resolveTipo(tipoStrOriginal || tipoSelecionado)}</span>
                <span className="text-[11px] text-[#94a3b8] font-normal ml-auto">(não editável)</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-[#00a88e] ml-1">Prioridade</label>
            <select
              value={prioridade}
              onChange={(e) => setPrioridade(e.target.value)}
              className="w-full px-4 py-3 bg-[#f8fbfb] border border-app-border rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e] appearance-none"
            >
              <option value="NORMAL">Normal</option>
              <option value="ALERTA">⚠️ Alerta</option>
              <option value="CRITICA">🔴 Crítica</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2 ml-1">
              <label className="text-[13px] font-bold text-[#00a88e]">Pergunta / Descrição *</label>
              <span className={`text-[11px] font-medium tabular-nums ${descricao.length >= DESCRICAO_MAX_CHARS ? 'text-red-600' : 'text-[#94a3b8]'}`}>
                {descricao.length}/{DESCRICAO_MAX_CHARS}
              </span>
            </div>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value.slice(0, DESCRICAO_MAX_CHARS))}
              rows={3}
              maxLength={DESCRICAO_MAX_CHARS}
              className="w-full px-4 py-3 bg-[#f8fbfb] border border-app-border rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e]"
            />
          </div>

          {mostrarAlternativas && (() => {
            const editDupeIndices = findDuplicateIndices(alternativas);
            return (
              <div className="space-y-3 p-4 bg-[#f8fbfb] border border-fuchsia-200 rounded-xl">
                <label className="text-[13px] font-bold text-[#a855f7] ml-1">Alternativas (arraste para reordenar)</label>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={alternativas.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-1.5">
                      {alternativas.map((alt, idx) => (
                        <SortableAlt
                          key={alt.id}
                          alt={alt}
                          onRemove={handleRemoverAlt}
                          isDuplicate={editDupeIndices.has(idx)}
                          isShaking={shakingAltId === alt.id}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={novaAlt}
                    onChange={(e) => { setNovaAlt(e.target.value); setDupWarning(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdicionarAlt(); } }}
                    placeholder="Nova alternativa..."
                    className={`flex-1 px-3 py-2 bg-white border-[2px] rounded-lg text-[13px] font-medium focus:outline-none ${
                      dupWarning ? 'border-red-400 focus:border-red-500' : 'border-[#a855f7]/20 focus:border-[#a855f7]'
                    }`}
                  />
                  <button type="button" onClick={handleAdicionarAlt} className="px-3 py-2 rounded-lg bg-[#a855f7] text-white text-[12px] font-bold">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {dupWarning && (
                  <p className="text-[12px] font-bold text-red-600 flex items-center gap-1.5 ml-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    {dupWarning}
                  </p>
                )}
              </div>
            );
          })()}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={salvando}
              className="px-5 py-3 rounded-xl font-bold text-[14px] bg-[#00a88e] hover:bg-[#00967f] text-white border border-transparent shadow-md disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" strokeWidth={2.5} />}
              Salvar
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-xl font-bold text-[14px] bg-white text-[#64748b] border border-slate-200 hover:border-[#00a88e]/20"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
