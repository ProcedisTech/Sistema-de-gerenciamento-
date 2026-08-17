import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  ArrowLeft,
  GripVertical,
  Loader2,
  Plus,
  Save,
  Trash2,
  Layers,
  LayoutTemplate,
  HelpCircle,
  Eye,
  Smartphone,
  Monitor,
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
import { anamneseApi, clinicaApi, dimensoesApi } from '../../services/api';
import { useToast } from '../../contexts/useToast';
import { tipoLabel } from './anamneseTipoLabels';
import {
  computeCounts,
  groupItensToSecoes,
  needsCompartilhamentoModal,
  secoesToDocumentoPayload,
  shouldDestacarBeforeSave,
} from './editorDocumentoState.js';
import {
  EDITOR_ACTIONS,
  createInitialEditorState,
  editorDocumentoReducer,
} from './editorDocumentoReducer.js';
import { AnamneseCompartilhamentoModal } from './AnamneseCompartilhamentoModal.jsx';
import { AnamneseFillLayout } from './AnamneseFillLayout.jsx';

const PRIORIDADES = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'ALERTA', label: 'Alerta' },
  { value: 'CRITICA', label: 'Crítica' },
];

function SortableSecaoShell({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="rounded-xl border border-app-border bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        <button
          type="button"
          className="cursor-grab touch-none text-[#94a3b8] hover:text-[#00a88e] active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label="Reordenar seção"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

function fichaToPreviewItens(secoes) {
  const itens = [];
  for (const sec of secoes) {
    for (const q of sec.perguntas) {
      itens.push({
        id: q.clientKey,
        ordem: q.ordem,
        obrigatorio: q.obrigatorio,
        pergunta: {
          id: q.clientKey,
          descricao: q.descricao || 'Pergunta',
          tipoResposta: q.tipoRespostaCodigo,
          prioridade: q.prioridade,
          alternativas: q.alternativas || [],
        },
      });
    }
  }
  return itens;
}

export function AnamneseDocumentoEditor({ fichaId, onBack, onFichaNomeChange, onSaved }) {
  const toast = useToast();
  const [state, dispatch] = useReducer(editorDocumentoReducer, undefined, createInitialEditorState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [especialidades, setEspecialidades] = useState([]);
  const [tiposResposta, setTiposResposta] = useState([]);
  const [starters, setStarters] = useState([]);
  const [bancoPerguntas, setBancoPerguntas] = useState([]);
  const [clinica, setClinica] = useState(null);
  const [railTab, setRailTab] = useState('secoes');
  const [previewTab, setPreviewTab] = useState(null);
  const [padraoLoading, setPadraoLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const saveTimer = useRef(null);
  const skipAutosave = useRef(true);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const counts = useMemo(() => computeCounts(state.secoes), [state.secoes]);
  const isPadrao = clinica?.anamnesePadraoId && String(clinica.anamnesePadraoId) === String(fichaId);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ficha, esps, tipos, starterList, habitos, clinicaData] = await Promise.all([
        anamneseApi.getFicha(fichaId),
        dimensoesApi.especialidades().catch(() => []),
        dimensoesApi.tiposResposta().catch(() => []),
        anamneseApi.listStarters().catch(() => []),
        anamneseApi.listAllHabitos().catch(() => []),
        clinicaApi.buscar().catch(() => null),
      ]);
      dispatch({ type: EDITOR_ACTIONS.LOAD, ficha });
      onFichaNomeChange?.(ficha.nome || 'Ficha');
      setEspecialidades(Array.isArray(esps) ? esps : []);
      setTiposResposta(Array.isArray(tipos) ? tipos : []);
      setStarters(Array.isArray(starterList) ? starterList : []);
      setBancoPerguntas(Array.isArray(habitos) ? habitos : []);
      setClinica(clinicaData);
      skipAutosave.current = true;
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar ficha.');
    } finally {
      setLoading(false);
    }
  }, [fichaId, toast, onFichaNomeChange]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    onFichaNomeChange?.(state.nome || 'Ficha');
  }, [state.nome, onFichaNomeChange]);

  const doSave = useCallback(async (opts = {}) => {
    if (!state.fichaId || !state.editavel) return null;
    setSaving(true);
    try {
      const payload = secoesToDocumentoPayload({
        nome: state.nome,
        especialidadeId: state.especialidadeId || null,
        textoDeclaracao: state.textoDeclaracao,
        secoes: state.secoes,
        allowEmpty: opts.allowEmpty ?? false,
      });
      const updated = await anamneseApi.salvarDocumento(state.fichaId, payload);
      dispatch({ type: EDITOR_ACTIONS.REPLACE_FROM_API, ficha: updated });
      dispatch({ type: EDITOR_ACTIONS.MARK_CLEAN });
      onSaved?.(updated);
      return updated;
    } catch (err) {
      if (!opts.silent) toast.error(err.message || 'Erro ao salvar documento.');
      return null;
    } finally {
      setSaving(false);
    }
  }, [state, toast, onSaved]);

  useEffect(() => {
    if (!state.loaded || !state.dirty || !state.editavel) return;
    if (skipAutosave.current) {
      skipAutosave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void doSave({ silent: true, allowEmpty: true });
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, doSave]);

  const handlePerguntaBlur = useCallback((pergunta, patch) => {
    if (!needsCompartilhamentoModal(pergunta)) return;
    const changed = Object.keys(patch).some((k) => patch[k] !== pergunta[k]);
    if (!changed) return;
    setModal({ pergunta, patch, pending: true });
  }, []);

  const resolveModal = useCallback(async (action) => {
    if (!modal?.pergunta) return;
    setModal((m) => ({ ...m, loading: true }));
    try {
      if (shouldDestacarBeforeSave(action)) {
        const destacada = await anamneseApi.destacarPergunta(state.fichaId, modal.pergunta.id);
        dispatch({
          type: EDITOR_ACTIONS.UPDATE_PERGUNTA,
          clientKey: modal.pergunta.clientKey,
          patch: {
            ...modal.patch,
            id: destacada.pergunta?.id ?? destacada.perguntaId,
            outrasFichasCount: 0,
          },
        });
      } else {
        dispatch({
          type: EDITOR_ACTIONS.UPDATE_PERGUNTA,
          clientKey: modal.pergunta.clientKey,
          patch: modal.patch,
        });
      }
      setModal(null);
      skipAutosave.current = false;
    } catch (err) {
      toast.error(err.message || 'Erro ao processar pergunta compartilhada.');
      setModal((m) => ({ ...m, loading: false }));
    }
  }, [modal, state.fichaId, toast]);

  const handleKeyDown = useCallback((e, focusKey) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      dispatch({ type: EDITOR_ACTIONS.KEY_ENTER, focusKey });
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      dispatch({ type: EDITOR_ACTIONS.KEY_TAB, focusKey });
    } else if (e.key === 'Escape') {
      dispatch({ type: EDITOR_ACTIONS.KEY_ESC });
    }
  }, []);

  const handleTogglePadrao = async () => {
    if (!clinica) return;
    setPadraoLoading(true);
    try {
      const nextId = isPadrao ? null : fichaId;
      await clinicaApi.atualizar({ anamnesePadraoId: nextId });
      const refreshed = await clinicaApi.buscar();
      setClinica(refreshed);
      toast.success(isPadrao ? 'Ficha removida dos novos atendimentos.' : 'Ficha definida para novos atendimentos.');
    } catch (err) {
      toast.error(err.message || 'Erro ao atualizar ficha padrão.');
    } finally {
      setPadraoLoading(false);
    }
  };

  const handleAddStarterSecao = async (codigo) => {
    try {
      const temp = await anamneseApi.fromStarter(codigo);
      const secoes = groupItensToSecoes(temp);
      dispatch({ type: EDITOR_ACTIONS.APPEND_SECOES, secoes });
      if (temp.id && temp.id !== fichaId) {
        await anamneseApi.removeFicha(temp.id).catch(() => {});
      }
      toast.success('Seção adicionada.');
    } catch (err) {
      toast.error(err.message || 'Erro ao importar seção.');
    }
  };

  const handleAddBancoPergunta = (p, secaoKey) => {
    dispatch({
      type: EDITOR_ACTIONS.ADD_PERGUNTA,
      secaoKey,
      tipoRespostaCodigo: p.tipoResposta || 'texto',
      initialPatch: {
        id: p.id,
        descricao: p.descricao,
        tipoRespostaCodigo: p.tipoResposta,
        prioridade: p.prioridade || 'NORMAL',
        outrasFichasCount: 1,
      },
    });
  };

  const handleSecaoDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = state.secoes.map((s) => s.clientKey);
    const oldIndex = ids.indexOf(active.id);
    const newIndex = ids.indexOf(over.id);
    dispatch({ type: EDITOR_ACTIONS.REORDER_SECOES, secoes: arrayMove(state.secoes, oldIndex, newIndex) });
  };

  const fichaStarters = starters.filter((s) => s.tipo === 'FICHA');
  const secaoStarters = starters.filter((s) => s.tipo === 'SECAO');
  const previewItens = fichaToPreviewItens(state.secoes);
  const activeSecaoKey = state.secoes[0]?.clientKey;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#00a88e]" />
        <span className="ml-2 text-[13px] text-[#64748b]">Carregando editor...</span>
      </div>
    );
  }

  return (
    <>
      <AnamneseCompartilhamentoModal
        open={Boolean(modal?.pending)}
        perguntaDescricao={modal?.pergunta?.descricao}
        outrasFichasCount={modal?.pergunta?.outrasFichasCount}
        loading={modal?.loading}
        onAlterarTodas={() => resolveModal('global')}
        onUsarSoNesta={() => resolveModal('destacar')}
        onCancel={() => setModal(null)}
      />

      <div className="flex min-h-0 flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-bold text-[#64748b] hover:border-[#00a88e]/20"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <div className="flex items-center gap-2">
              {saving && (
                <span className="inline-flex items-center gap-1 text-[12px] text-[#64748b]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...
                </span>
              )}
              {!state.dirty && state.loaded && (
                <span className="text-[12px] font-medium text-emerald-600">Salvo</span>
              )}
              <button
                type="button"
                onClick={() => doSave({ allowEmpty: true })}
                disabled={saving || !state.editavel}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#00a88e] px-4 py-2 text-[13px] font-bold text-white shadow-md hover:bg-[#00967f] disabled:opacity-60"
              >
                <Save className="h-4 w-4" /> Salvar
              </button>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-app-border bg-[#f8fbfb] p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="ml-1 text-[13px] font-bold text-[#00a88e]">Nome da ficha</label>
                <input
                  type="text"
                  value={state.nome}
                  onChange={(e) => dispatch({ type: EDITOR_ACTIONS.SET_META, patch: { nome: e.target.value } })}
                  disabled={!state.editavel}
                  className="w-full rounded-xl border border-app-border bg-white px-4 py-3 text-[14px] font-medium outline-none focus:border-[#00a88e] focus:ring-4 focus:ring-[#00a88e]/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="ml-1 text-[13px] font-bold text-[#00a88e]">Especialidade</label>
                <select
                  value={state.especialidadeId}
                  onChange={(e) => dispatch({ type: EDITOR_ACTIONS.SET_META, patch: { especialidadeId: e.target.value } })}
                  disabled={!state.editavel}
                  className="w-full appearance-none rounded-xl border border-app-border bg-white px-4 py-3 text-[14px] font-medium outline-none focus:border-[#00a88e] focus:ring-4 focus:ring-[#00a88e]/20"
                >
                  <option value="">Geral</option>
                  {especialidades.map((e) => (
                    <option key={e.especialidade_id || e.id} value={e.especialidade_id || e.id}>
                      {e.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={Boolean(isPadrao)}
                onChange={handleTogglePadrao}
                disabled={padraoLoading}
                className="h-4 w-4 rounded border-slate-300 text-[#00a88e] focus:ring-[#00a88e]"
              />
              <span className="text-[13px] font-semibold text-[#0f172a]">Usar nos novos atendimentos</span>
            </label>

            <div className="space-y-1.5">
              <label className="ml-1 text-[13px] font-bold text-[#00a88e]">Texto de declaração</label>
              <textarea
                value={state.textoDeclaracao}
                onChange={(e) => dispatch({ type: EDITOR_ACTIONS.SET_META, patch: { textoDeclaracao: e.target.value } })}
                rows={3}
                disabled={!state.editavel}
                placeholder="Declaro que as informações prestadas são verdadeiras..."
                className="w-full rounded-xl border border-app-border bg-white px-4 py-3 text-[14px] outline-none focus:border-[#00a88e] focus:ring-4 focus:ring-[#00a88e]/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Perguntas', value: counts.totalPerguntas },
              { label: 'Críticas', value: counts.criticas },
              { label: 'Alertas', value: counts.alertas },
              { label: 'Prontuário', value: counts.alimentamProntuario },
            ].map((c) => (
              <div key={c.label} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center">
                <p className="text-[18px] font-bold tabular-nums text-[#0f172a]">{c.value}</p>
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#64748b]">{c.label}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            {[
              { id: 'wide', icon: Monitor, label: 'Desktop' },
              { id: 'mobile', icon: Smartphone, label: 'Mobile' },
              { id: 'readonly', icon: Eye, label: 'Leitura' },
            ].map(({ id, icon: _Icon, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setPreviewTab(previewTab === id ? null : id)}
                className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-bold ${
                  previewTab === id ? 'bg-[#00a88e] text-white' : 'bg-slate-100 text-[#64748b]'
                }`}
              >
                <_Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>

          {previewTab && (
            <div className="rounded-xl border border-dashed border-[#00a88e]/30 bg-[#f0fdfa]/40 p-4">
              <AnamneseFillLayout
                itens={previewItens}
                respostas={{}}
                readOnly={previewTab === 'readonly'}
                layout={previewTab === 'mobile' ? 'mobile' : 'wide'}
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <h4 className="text-[15px] font-bold text-[#0f172a]">Seções e perguntas</h4>
            <button
              type="button"
              onClick={() => dispatch({ type: EDITOR_ACTIONS.ADD_SECAO })}
              disabled={!state.editavel}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-bold text-[#00a88e] hover:bg-[#f0fdfa]"
            >
              <Plus className="h-3.5 w-3.5" /> Seção
            </button>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSecaoDragEnd}>
            <SortableContext items={state.secoes.map((s) => s.clientKey)} strategy={verticalListSortingStrategy}>
              <div className="space-y-4">
                {state.secoes.map((secao) => (
                  <SortableSecaoShell key={secao.clientKey} id={secao.clientKey}>
                    <div className="min-w-0 flex-1 space-y-3 p-3 pt-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={secao.nome}
                          onChange={(e) =>
                            dispatch({ type: EDITOR_ACTIONS.RENAME_SECAO, secaoKey: secao.clientKey, nome: e.target.value })
                          }
                          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[14px] font-bold text-[#0f172a] outline-none focus:border-[#00a88e]"
                        />
                        <select
                          value={secao.sexoAplicavel || ''}
                          onChange={(e) =>
                            dispatch({
                              type: EDITOR_ACTIONS.SET_SECAO_SEXO,
                              secaoKey: secao.clientKey,
                              sexoAplicavel: e.target.value || null,
                            })
                          }
                          className="rounded-lg border border-slate-200 px-2 py-1.5 text-[12px]"
                        >
                          <option value="">Todos</option>
                          <option value="FEMININO">Feminino</option>
                          <option value="MASCULINO">Masculino</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => dispatch({ type: EDITOR_ACTIONS.REMOVE_SECAO, secaoKey: secao.clientKey })}
                          className="rounded-lg p-1.5 text-red-400 hover:bg-red-50"
                          title="Remover seção"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="space-y-2">
                        {secao.perguntas.map((q) => (
                          <div
                            key={q.clientKey}
                            className={`rounded-lg border p-3 ${
                              state.focusKey === q.clientKey
                                ? 'border-[#00a88e] bg-[#f0fdfa]'
                                : 'border-slate-200 bg-[#f8fbfb]'
                            } ${q.perguntaPaiClientKey ? 'ml-4 border-l-4 border-l-violet-300' : ''}`}
                          >
                            <div className="mb-2 flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#00a88e] text-[11px] font-bold text-white">
                                {q.ordem}
                              </span>
                              {q.outrasFichasCount > 0 && (
                                <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                  Compartilhada ({q.outrasFichasCount})
                                </span>
                              )}
                              {q.perguntaPaiClientKey && (
                                <span className="text-[10px] font-bold text-violet-600">↳ condicional</span>
                              )}
                            </div>
                            <textarea
                              value={q.descricao}
                              onFocus={() =>
                                dispatch({ type: EDITOR_ACTIONS.SET_FOCUS, focusKey: q.clientKey })
                              }
                              onKeyDown={(e) => handleKeyDown(e, q.clientKey)}
                              onChange={(e) =>
                                dispatch({
                                  type: EDITOR_ACTIONS.UPDATE_PERGUNTA,
                                  clientKey: q.clientKey,
                                  patch: { descricao: e.target.value },
                                })
                              }
                              onBlur={() => handlePerguntaBlur(q, { descricao: q.descricao })}
                              rows={2}
                              placeholder="Digite a pergunta..."
                              className="mb-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-[#00a88e]"
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                value={q.tipoRespostaCodigo}
                                onChange={(e) => {
                                  dispatch({ type: EDITOR_ACTIONS.SET_STICKY_TIPO, tipo: e.target.value });
                                  dispatch({
                                    type: EDITOR_ACTIONS.UPDATE_PERGUNTA,
                                    clientKey: q.clientKey,
                                    patch: { tipoRespostaCodigo: e.target.value },
                                  });
                                }}
                                className="rounded-lg border border-slate-200 px-2 py-1 text-[12px]"
                              >
                                {tiposResposta.map((t) => (
                                  <option key={t.id || t.tipo} value={t.tipo || t.codigo}>
                                    {tipoLabel(t.tipo || t.codigo)}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={q.prioridade}
                                onChange={(e) =>
                                  dispatch({
                                    type: EDITOR_ACTIONS.UPDATE_PERGUNTA,
                                    clientKey: q.clientKey,
                                    patch: { prioridade: e.target.value },
                                  })
                                }
                                className="rounded-lg border border-slate-200 px-2 py-1 text-[12px]"
                              >
                                {PRIORIDADES.map((p) => (
                                  <option key={p.value} value={p.value}>{p.label}</option>
                                ))}
                              </select>
                              <label className="inline-flex items-center gap-1 text-[11px] font-bold text-[#64748b]">
                                <input
                                  type="checkbox"
                                  checked={q.obrigatorio}
                                  onChange={(e) =>
                                    dispatch({
                                      type: EDITOR_ACTIONS.UPDATE_PERGUNTA,
                                      clientKey: q.clientKey,
                                      patch: { obrigatorio: e.target.checked },
                                    })
                                  }
                                />
                                Obrigatório
                              </label>
                              <button
                                type="button"
                                onClick={() =>
                                  dispatch({ type: EDITOR_ACTIONS.REMOVE_PERGUNTA, clientKey: q.clientKey })
                                }
                                className="ml-auto rounded p-1 text-red-400 hover:bg-red-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          dispatch({ type: EDITOR_ACTIONS.ADD_PERGUNTA, secaoKey: secao.clientKey })
                        }
                        className="inline-flex items-center gap-1 text-[12px] font-bold text-[#00a88e]"
                      >
                        <Plus className="h-3.5 w-3.5" /> Pergunta
                      </button>
                    </div>
                  </SortableSecaoShell>
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {state.tabPaiMode && (
            <p className="text-[12px] font-medium text-violet-600">
              Modo pai ativo — Tab vinculou a pergunta anterior como condicional. Esc para sair.
            </p>
          )}
        </div>

        <aside className="w-full shrink-0 space-y-3 lg:w-72">
          <div className="flex rounded-xl border border-slate-200 bg-[#f8fbfb] p-1">
            {[
              { id: 'fichas', icon: LayoutTemplate, label: 'Fichas' },
              { id: 'secoes', icon: Layers, label: 'Seções' },
              { id: 'perguntas', icon: HelpCircle, label: 'Perguntas' },
            ].map(({ id, icon: _Icon, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setRailTab(id)}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg py-2 text-[10px] font-bold ${
                  railTab === id ? 'bg-white text-[#00a88e] shadow-sm' : 'text-[#64748b]'
                }`}
              >
                <_Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="custom-scrollbar max-h-[min(520px,calc(100vh-14rem))] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
            {railTab === 'fichas' && (
              <div className="space-y-2">
                {fichaStarters.map((s) => (
                  <div key={s.codigo} className="rounded-lg border border-slate-100 p-2">
                    <p className="text-[12px] font-bold text-[#0f172a]">{s.nome}</p>
                    <p className="text-[11px] text-[#64748b]">{s.contagemPerguntas} perguntas</p>
                    <p className="mt-1 text-[10px] text-[#94a3b8]">Use na tela inicial</p>
                  </div>
                ))}
              </div>
            )}
            {railTab === 'secoes' && (
              <div className="space-y-2">
                {secaoStarters.map((s) => (
                  <button
                    key={s.codigo}
                    type="button"
                    onClick={() => handleAddStarterSecao(s.codigo)}
                    className="w-full rounded-lg border border-slate-100 p-2 text-left hover:border-[#00a88e]/30 hover:bg-[#f0fdfa]"
                  >
                    <p className="text-[12px] font-bold text-[#0f766e]">{s.nome}</p>
                    <p className="text-[11px] text-[#64748b]">{s.contagemPerguntas} perguntas</p>
                  </button>
                ))}
              </div>
            )}
            {railTab === 'perguntas' && (
              <div className="space-y-2">
                {bancoPerguntas.slice(0, 40).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleAddBancoPergunta(p, activeSecaoKey)}
                    className="w-full rounded-lg border border-slate-100 p-2 text-left hover:border-[#00a88e]/30"
                  >
                    <p className="text-[12px] font-bold text-[#0f172a]">{p.descricao}</p>
                    <p className="text-[10px] text-[#64748b]">{p.categoriaNome}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
