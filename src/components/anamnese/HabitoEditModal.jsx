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
import { PerguntaMoldeExtraFields } from './PerguntaMoldeExtraFields';
import {
  HabitoModalShell,
  HABITO_INPUT_CLASS,
  HABITO_READONLY_CLASS,
  HABITO_MODAL_CANCEL_CLASS,
  HABITO_MODAL_SUBMIT_CLASS,
  PrioridadeSegmented,
} from './HabitoModalShell';

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
export function HabitoEditModal({ pergunta, categorias, tiposResposta, tiposAntecedente = [], perguntasPai = [], tipoLabel: tipoLabelProp, onClose, onSaved }) {
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
  const [tipoAntecedentePessoalId, setTipoAntecedentePessoalId] = useState(pergunta.tipoAntecedentePessoalId || null);
  const [antecedenteCatalogoId, setAntecedenteCatalogoId] = useState(pergunta.antecedenteCatalogoId || null);
  const [antecedenteCatalogoNome, setAntecedenteCatalogoNome] = useState('');
  const [perguntaPaiId, setPerguntaPaiId] = useState(pergunta.perguntaPaiId || null);
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
        tipoAntecedentePessoalId: tipoAntecedentePessoalId || null,
        antecedenteCatalogoId: antecedenteCatalogoId || null,
        perguntaPaiId: perguntaPaiId || null,
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

  const catNome = categorias.find((c) => String(c.id) === String(categoriaId))?.nome;

  return (
    <HabitoModalShell
      title="Editar Pergunta"
      subtitle={catNome ? `Categoria: ${catNome}` : null}
      icon={Pencil}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={HABITO_MODAL_CANCEL_CLASS}>
            Cancelar
          </button>
          <button
            type="submit"
            form="edit-habito-form"
            disabled={salvando}
            className={HABITO_MODAL_SUBMIT_CLASS}
          >
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />}
            Salvar
          </button>
        </>
      }
    >
      <form
        id="edit-habito-form"
        onSubmit={handleSalvar}
        className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4"
      >
          {erro ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] font-bold text-red-600">{erro}</div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="ml-1 text-[13px] font-bold text-[#00a88e]">Categoria *</label>
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className={HABITO_INPUT_CLASS}
              >
                <option value="">Selecione...</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="ml-1 text-[13px] font-bold text-[#00a88e]">Tipo de Resposta *</label>
              <div className={`${HABITO_READONLY_CLASS} flex items-center gap-2`}>
                <span>{resolveTipo(tipoStrOriginal || tipoSelecionado)}</span>
                <span className="ml-auto text-[11px] font-normal text-[#94a3b8]">(não editável)</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="ml-1 text-[13px] font-bold text-[#00a88e]">Prioridade</label>
            <PrioridadeSegmented value={prioridade} onChange={setPrioridade} />
          </div>

          <div className="space-y-1.5">
            <div className="ml-1 flex items-baseline justify-between gap-2">
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
              className={HABITO_INPUT_CLASS}
            />
          </div>

          <PerguntaMoldeExtraFields
            tipoSelecionado={tipoSelecionado || tipoStrOriginal}
            tipoAntecedentePessoalId={tipoAntecedentePessoalId}
            onTipoAntecedenteChange={setTipoAntecedentePessoalId}
            antecedenteCatalogoId={antecedenteCatalogoId}
            antecedenteCatalogoNome={antecedenteCatalogoNome}
            onAntecedenteCatalogoChange={(id, nome) => {
              setAntecedenteCatalogoId(id);
              setAntecedenteCatalogoNome(nome || '');
            }}
            perguntaPaiId={perguntaPaiId}
            onPerguntaPaiChange={setPerguntaPaiId}
            tiposAntecedente={tiposAntecedente}
            perguntasPai={perguntasPai}
          />

          {mostrarAlternativas ? (() => {
            const editDupeIndices = findDuplicateIndices(alternativas);
            return (
              <div className="space-y-3 rounded-xl border border-fuchsia-200 bg-[#f8fbfb] p-4">
                <label className="ml-1 text-[13px] font-bold text-[#a855f7]">Alternativas (arraste para reordenar)</label>

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
                    className={`flex-1 rounded-lg border-[2px] bg-white px-3 py-2 text-[13px] font-medium focus:outline-none ${
                      dupWarning ? 'border-red-400 focus:border-red-500' : 'border-[#a855f7]/20 focus:border-[#a855f7]'
                    }`}
                  />
                  <button type="button" onClick={handleAdicionarAlt} className="rounded-lg bg-[#a855f7] px-3 py-2 text-[12px] font-bold text-white">
                    <Plus className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                {dupWarning ? (
                  <p className="ml-1 flex items-center gap-1.5 text-[12px] font-bold text-red-600">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {dupWarning}
                  </p>
                ) : null}
              </div>
            );
          })() : null}
      </form>
    </HabitoModalShell>
  );
}
