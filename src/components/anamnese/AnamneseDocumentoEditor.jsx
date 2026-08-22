import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { anamneseApi, clinicaApi, dimensoesApi, getApiErrorToastMessage } from '../../services/api';
import { useToast } from '../../contexts/useToast';
import {
  COMPOSE_PENDENTE_TOAST,
  ESCOLHA_INCOMPLETA_TOAST,
  NOME_VAZIO_TOAST,
  SEM_PERGUNTAS_TOAST,
  cloneSecoesFromDocumento,
  composeHasPending,
  countPerguntas,
  findEscolhaSemAlternativas,
  isNomeVazio,
  isSaveGenerationCurrent,
  needsCompartilhamentoModal,
  planPadraoSync,
  secoesToDocumentoPayload,
  shouldDestacarBeforeSave,
  usarFichaNeedsConfirm,
} from './editorDocumentoState.js';
import {
  EDITOR_ACTIONS,
  createInitialEditorState,
  editorDocumentoReducer,
} from './editorDocumentoReducer.js';
import { loadBiblioteca, moduloToAppendSecoes } from './editorDocumentoBiblioteca.js';
import { ViewportDialog } from '../shared/ViewportDialog.jsx';
import { DOC, BTN, BTN_PRIMARY } from './editorDocumentoTokens.js';
import { AnamneseCompartilhamentoModal } from './AnamneseCompartilhamentoModal.jsx';
import { AnamneseDocHead } from './AnamneseDocHead.jsx';
import { AnamneseDocSaveBar } from './AnamneseDocSaveBar.jsx';
import { AnamneseDocRail } from './AnamneseDocRail.jsx';
import { AnamneseDocRailSheet } from './AnamneseDocRailSheet.jsx';
import { AnamneseDocPreviewOverlay } from './AnamneseDocPreviewOverlay.jsx';
import { AnamneseDocStartScreen } from './AnamneseDocStartScreen.jsx';
import { AnamneseDocUnsavedModal } from './AnamneseDocUnsavedModal.jsx';
import { SortableDocSecao } from './AnamneseDocSecao.jsx';
import { AnamneseDocAddSec } from './AnamneseDocCompose.jsx';

const RAIL_SIDE_MIN_PX = 800;

function ReplaceConfirmModal({ open, onConfirm, onCancel }) {
  return (
    <ViewportDialog open={open} onDismiss={onCancel} titleId="replace-ficha-title">
      <div className="border-b border-[#f1f5f9] bg-[#fbfefe] px-5 py-4">
        <b id="replace-ficha-title" className="block text-[13px] font-semibold text-[#0f172a]">
          Substituir ficha?
        </b>
        <span className="mt-1.5 block text-[13px] leading-relaxed text-[#64748b]">
          Isso substitui a ficha que está aberta. Continuar?
        </span>
      </div>
      <div className="flex justify-end gap-2 px-5 py-4">
        <button type="button" data-dialog-initial-focus className={BTN} onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className={BTN_PRIMARY} onClick={onConfirm}>
          Continuar
        </button>
      </div>
    </ViewportDialog>
  );
}

function findSecaoOfPergunta(secoes, clientKey) {
  return (secoes || []).find((s) => s.perguntas.some((q) => q.clientKey === clientKey));
}

export function AnamneseDocumentoEditor({
  fichaId,
  onBack,
  onFichaNomeChange,
  onSaved,
  onDirtyChange,
}) {
  const toast = useToast();
  const [state, dispatch] = useReducer(editorDocumentoReducer, undefined, createInitialEditorState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [especialidades, setEspecialidades] = useState([]);
  const [biblioteca, setBiblioteca] = useState({ FICHAS: [], MODULOS: [], BANCO: [] });
  const [clinica, setClinica] = useState(null);
  const [railTab, setRailTab] = useState('fichas');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewGhost, setPreviewGhost] = useState(null);
  const [modal, setModal] = useState(null);
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [replaceDoc, setReplaceDoc] = useState(null);
  const [railSheetOpen, setRailSheetOpen] = useState(false);
  const [railBeside, setRailBeside] = useState(false);
  const saveGen = useRef(0);
  const pendingBack = useRef(false);
  const editorShellRef = useRef(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const isEmptyDoc = (state.secoes?.length || 0) === 0;
  const previewState = previewGhost || state;

  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;

  useEffect(() => {
    onDirtyChangeRef.current?.(Boolean(state.dirty));
  }, [state.dirty]);

  useEffect(() => () => onDirtyChangeRef.current?.(false), []);

  useEffect(() => {
    if (!state.dirty) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state.dirty]);

  useEffect(() => {
    if (!state.focusSecaoKey) return;
    const nodes = document.querySelectorAll('.secname');
    nodes[nodes.length - 1]?.focus();
    dispatch({ type: EDITOR_ACTIONS.SET_FOCUS, focusSecaoKey: null });
  }, [state.focusSecaoKey]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [esps, clinicaData, biblio] = await Promise.all([
        dimensoesApi.especialidades().catch(() => []),
        clinicaApi.buscar().catch(() => null),
        loadBiblioteca({
          listStarters: () => anamneseApi.listStarters(),
          getStarterDocumento: (codigo) => anamneseApi.getStarterDocumento(codigo),
        }).catch(() => ({ FICHAS: [], MODULOS: [], BANCO: [] })),
      ]);
      setEspecialidades(Array.isArray(esps) ? esps : []);
      setClinica(clinicaData);
      setBiblioteca(biblio);
      if (fichaId) {
        const ficha = await anamneseApi.getFicha(fichaId);
        const padrao =
          Boolean(clinicaData?.anamnesePadraoId) &&
          String(clinicaData.anamnesePadraoId) === String(ficha.id);
        dispatch({ type: EDITOR_ACTIONS.LOAD, ficha, padrao });
        onFichaNomeChange?.(ficha.nome || 'Ficha');
        setLastSavedAt(new Date());
      } else {
        dispatch({ type: EDITOR_ACTIONS.INIT_BLANK });
        onFichaNomeChange?.('Nova ficha');
        setLastSavedAt(null);
      }
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
    onFichaNomeChange?.(state.nome || (state.fichaId ? 'Ficha' : 'Nova ficha'));
  }, [state.nome, state.fichaId, onFichaNomeChange]);

  useEffect(() => {
    if (loading) return undefined;
    const el = editorShellRef.current;
    if (!el) return undefined;
    const apply = (width) => {
      const beside = width >= RAIL_SIDE_MIN_PX;
      setRailBeside(beside);
      if (beside) setRailSheetOpen(false);
    };
    apply(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (typeof w === 'number') apply(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading]);

  useEffect(() => {
    if (isEmptyDoc) setRailSheetOpen(false);
  }, [isEmptyDoc]);

  const syncPadraoAfterSave = useCallback(
    async (savedFichaId, padrao) => {
      const patch = planPadraoSync({
        padrao,
        fichaId: savedFichaId,
        clinicaPadraoId: clinica?.anamnesePadraoId,
      });
      if (!patch) return;
      try {
        await clinicaApi.atualizar(patch);
        const refreshed = await clinicaApi.buscar().catch(() => null);
        if (refreshed) setClinica(refreshed);
      } catch (err) {
        toast.error(getApiErrorToastMessage(err, 'Erro ao atualizar ficha padrão da clínica.'));
      }
    },
    [clinica?.anamnesePadraoId, toast]
  );

  const doSave = useCallback(
    async (opts = {}) => {
      if (!state.editavel) return null;
      const notify = (msg) => {
        if (!opts.silent) toast.error(msg);
      };
      if (isNomeVazio(state.nome)) {
        notify(NOME_VAZIO_TOAST);
        return null;
      }
      if (composeHasPending(state.compose)) {
        notify(COMPOSE_PENDENTE_TOAST);
        return null;
      }
      if (countPerguntas(state.secoes) < 1) {
        notify(SEM_PERGUNTAS_TOAST);
        return null;
      }
      const escolhaIncompleta = findEscolhaSemAlternativas(state.secoes);
      if (escolhaIncompleta) {
        notify(ESCOLHA_INCOMPLETA_TOAST);
        return null;
      }
      const gen = ++saveGen.current;
      setSaving(true);
      try {
        let id = state.fichaId;
        if (!id) {
          const shell = await anamneseApi.createFicha({
            nome: state.nome.trim(),
            especialidadeId: state.especialidadeId || null,
            itens: [],
            textoDeclaracao: state.textoDeclaracao,
          });
          id = shell.id;
          dispatch({ type: EDITOR_ACTIONS.SET_FICHA_ID, fichaId: id });
        }
        const payload = secoesToDocumentoPayload({
          nome: state.nome,
          especialidadeId: state.especialidadeId || null,
          textoDeclaracao: state.textoDeclaracao,
          secoes: state.secoes,
          allowEmpty: false,
        });
        const updated = await anamneseApi.salvarDocumento(id, payload);
        if (!isSaveGenerationCurrent(gen, saveGen.current)) return null;
        dispatch({ type: EDITOR_ACTIONS.SAVE_SUCCESS, ficha: updated });
        setLastSavedAt(new Date());
        onSaved?.(updated);
        await syncPadraoAfterSave(id, state.padrao);
        if (!opts.silent) toast.success('Ficha salva');
        return updated;
      } catch (err) {
        if (isSaveGenerationCurrent(gen, saveGen.current) && !opts.silent) {
          if (err?.status === 409) {
            toast.error(
              (err.body && typeof err.body.error === 'string' && err.body.error) ||
                'Já existe uma ficha com esse nome nesta organização'
            );
          } else {
            toast.error(getApiErrorToastMessage(err, 'Erro ao salvar documento.'));
          }
        }
        return null;
      } finally {
        if (isSaveGenerationCurrent(gen, saveGen.current)) setSaving(false);
      }
    },
    [state, toast, onSaved, syncPadraoAfterSave]
  );

  const handlePerguntaBlur = useCallback((pergunta) => {
    if (!needsCompartilhamentoModal(pergunta)) return;
    setModal({ pergunta, patch: { descricao: pergunta.descricao }, pending: true });
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
    } catch (err) {
      toast.error(err.message || 'Erro ao processar pergunta compartilhada.');
      setModal((m) => ({ ...m, loading: false }));
    }
  }, [modal, state.fichaId, toast]);

  const handleKeyDown = useCallback((e, focusKey, pergunta) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const secao = findSecaoOfPergunta(state.secoes, focusKey);
      if (secao) {
        dispatch({
          type: EDITOR_ACTIONS.OPEN_COMPOSE,
          secKey: secao.clientKey,
          afterKey: focusKey,
        });
      }
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const secao = findSecaoOfPergunta(state.secoes, focusKey);
      const isFirst = secao?.perguntas?.[0]?.clientKey === focusKey;
      if (isFirst && !pergunta?.perguntaPaiClientKey) {
        toast.info('A primeira pergunta da seção não pode depender de outra');
        return;
      }
      dispatch({ type: EDITOR_ACTIONS.KEY_TAB, focusKey });
    } else if (e.key === 'Escape') {
      dispatch({ type: EDITOR_ACTIONS.KEY_ESC });
    }
  }, [state.secoes, toast]);

  const handleTogglePadrao = () => {
    const next = !state.padrao;
    dispatch({ type: EDITOR_ACTIONS.SET_PADRAO, padrao: next });
    toast.success(
      next
        ? 'Passa a ser usada por padrão nos atendimentos'
        : 'Deixou de ser a ficha padrão'
    );
  };

  const applyReplace = (ficha) => {
    dispatch({ type: EDITOR_ACTIONS.REPLACE_DOCUMENTO, documento: ficha });
    const n = ficha.secoes?.length || 0;
    const m = countPerguntas(ficha.secoes);
    toast.success(`${ficha.nome} carregada: ${n} seções e ${m} perguntas. Edite o que quiser.`);
  };

  const handleUseFicha = (ficha) => {
    if (usarFichaNeedsConfirm(state.secoes)) {
      setReplaceDoc(ficha);
      return;
    }
    applyReplace(ficha);
  };

  const handleAppendModulo = (modulo) => {
    dispatch({ type: EDITOR_ACTIONS.APPEND_SECOES, secoes: moduloToAppendSecoes(modulo) });
    toast.success(`"${modulo.nome}" adicionada — ${modulo.nPerguntas} perguntas`);
  };

  const handleAddBank = (p) => {
    const lastNome = state.secoes[state.secoes.length - 1]?.nome;
    dispatch({
      type: EDITOR_ACTIONS.ADD_BANK,
      patch: {
        descricao: p.descricao,
        tipoRespostaCodigo: p.tipoRespostaCodigo || 'texto',
        prioridade: p.prioridade || 'NORMAL',
        alternativas: p.alternativas,
      },
    });
    toast.success(`Adicionada em "${lastNome || 'seção'}"`);
  };

  const handleEspiar = (ficha) => {
    setPreviewGhost({
      nome: ficha.nome,
      textoDeclaracao: ficha.textoDeclaracao,
      secoes: cloneSecoesFromDocumento(ficha.secoes),
    });
    setPreviewOpen(true);
  };

  const handleSecaoDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = state.secoes.map((s) => s.clientKey);
    const oldIndex = ids.indexOf(active.id);
    const newIndex = ids.indexOf(over.id);
    dispatch({ type: EDITOR_ACTIONS.REORDER_SECOES, secoes: arrayMove(state.secoes, oldIndex, newIndex) });
  };

  const handleMoveSecao = (index, dir) => {
    const j = index + dir;
    if (j < 0 || j >= state.secoes.length) return;
    dispatch({ type: EDITOR_ACTIONS.REORDER_SECOES, secoes: arrayMove(state.secoes, index, j) });
  };

  const closeRailSheet = useCallback(() => setRailSheetOpen(false), []);

  const railProps = {
    railTab,
    onRailTabChange: setRailTab,
    fichas: biblioteca.FICHAS,
    modulos: biblioteca.MODULOS,
    banco: biblioteca.BANCO,
    onUseFicha: (f) => {
      handleUseFicha(f);
      closeRailSheet();
    },
    onAddModulo: (m) => {
      handleAppendModulo(m);
      closeRailSheet();
    },
    onAddBank: (p) => {
      handleAddBank(p);
      closeRailSheet();
    },
    onEspiar: handleEspiar,
  };

  const requestBack = useCallback(() => {
    if (state.dirty) {
      pendingBack.current = true;
      setUnsavedOpen(true);
      return;
    }
    onBack?.();
  }, [state.dirty, onBack]);

  const handleSaveAndLeave = async () => {
    const saved = await doSave();
    if (!saved) return;
    setUnsavedOpen(false);
    if (pendingBack.current) {
      pendingBack.current = false;
      onBack?.();
    }
  };

  const handleDiscardLeave = () => {
    setUnsavedOpen(false);
    pendingBack.current = false;
    onBack?.();
  };

  const sortableIds = useMemo(() => state.secoes.map((s) => s.clientKey), [state.secoes]);

  if (loading) {
    return (
      <div className="anamnese-sora flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
        <span className="ml-2 text-[13px] text-[#64748b]">Carregando editor...</span>
      </div>
    );
  }

  return (
    <div className="anamnese-sora">
      <AnamneseCompartilhamentoModal
        open={Boolean(modal?.pending)}
        perguntaDescricao={modal?.pergunta?.descricao}
        outrasFichasCount={modal?.pergunta?.outrasFichasCount}
        loading={modal?.loading}
        onAlterarTodas={() => resolveModal('global')}
        onUsarSoNesta={() => resolveModal('destacar')}
        onCancel={() => setModal(null)}
      />

      <AnamneseDocUnsavedModal
        open={unsavedOpen}
        saving={saving}
        onSaveAndLeave={handleSaveAndLeave}
        onDiscard={handleDiscardLeave}
        onCancel={() => {
          setUnsavedOpen(false);
          pendingBack.current = false;
        }}
      />

      <ReplaceConfirmModal
        open={Boolean(replaceDoc)}
        onCancel={() => setReplaceDoc(null)}
        onConfirm={() => {
          const doc = replaceDoc;
          setReplaceDoc(null);
          if (doc) applyReplace(doc);
        }}
      />

      <AnamneseDocPreviewOverlay
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewGhost(null);
        }}
        state={previewState}
      />

      <div
        ref={editorShellRef}
        className={`mx-auto grid min-h-0 min-w-0 w-full max-w-[1440px] items-stretch gap-5 ${
          railBeside && !isEmptyDoc ? 'grid-cols-[minmax(0,1fr)_300px]' : 'grid-cols-1'
        }`}
      >
        <div className={`relative min-w-0 w-full ${DOC}`}>
          <AnamneseDocHead
            state={state}
            dispatch={dispatch}
            editavel={state.editavel}
            onTogglePadrao={handleTogglePadrao}
            onBack={requestBack}
            especialidades={especialidades}
            onOpenBiblioteca={!railBeside && !isEmptyDoc ? () => setRailSheetOpen(true) : undefined}
          />

          <div className="body min-h-[200px] min-w-0 pb-24">
            {isEmptyDoc ? (
              <AnamneseDocStartScreen
                fichas={biblioteca.FICHAS}
                modulos={biblioteca.MODULOS}
                dispatch={dispatch}
                onUseFicha={handleUseFicha}
                onAppendModulo={handleAppendModulo}
                onEspiar={handleEspiar}
              />
            ) : (
              <>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSecaoDragEnd}>
                  <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                    {state.secoes.map((secao, i) => (
                      <SortableDocSecao
                        key={secao.clientKey}
                        secao={secao}
                        secaoIndex={i}
                        secoesCount={state.secoes.length}
                        editavel={state.editavel}
                        dispatch={dispatch}
                        onPerguntaBlur={handlePerguntaBlur}
                        onKeyDown={handleKeyDown}
                        compose={state.compose}
                        stickyTipo={state.stickyTipo}
                        onMoveSecao={handleMoveSecao}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
                <AnamneseDocAddSec
                  onClick={() => dispatch({ type: EDITOR_ACTIONS.ADD_SECAO })}
                  disabled={!state.editavel}
                />
              </>
            )}
          </div>

          {!isEmptyDoc ? (
            <AnamneseDocSaveBar
              dirty={state.dirty}
              saving={saving}
              lastSavedAt={lastSavedAt}
              editavel={state.editavel}
              onSave={() => doSave()}
              onPreview={() => {
                setPreviewGhost(null);
                setPreviewOpen(true);
              }}
            />
          ) : null}
        </div>

        {railBeside && !isEmptyDoc ? (
          <div className="min-w-0 w-[300px] shrink-0">
            <div className="sticky top-0 max-h-[calc(100dvh-8rem)] overflow-y-auto">
              <AnamneseDocRail {...railProps} />
            </div>
          </div>
        ) : null}
      </div>

      <AnamneseDocRailSheet
        open={!railBeside && !isEmptyDoc && railSheetOpen}
        onClose={closeRailSheet}
        railProps={railProps}
      />
    </div>
  );
}
