import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  Copy,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { anamneseApi } from '../../services/api';
import { useToast } from '../../contexts/useToast';
import { ConfigTableSkeleton } from '../shared/ConfigPanelSkeletons';
import { ViewportDialog } from '../shared/ViewportDialog.jsx';
import { AnamneseDocumentoEditor } from './AnamneseDocumentoEditor.jsx';

const ESPECIALIDADE_BADGE = {
  Facial: 'bg-violet-100 text-violet-800 border-violet-200',
  Corporal: 'bg-blue-100 text-blue-800 border-blue-200',
};

function totalPerguntasDaFicha(ficha) {
  return ficha.totalPerguntas ?? ficha.itens?.length ?? 0;
}

function FichaAcoes({ onEditar, onDuplicar, onDesativar }) {
  const btn = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[#64748b]';
  return (
    <div className="fichas-home__actions" onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={onEditar} title="Editar" aria-label="Editar" className={`${btn} hover:bg-[#f0fdfa] hover:text-[#00a88e]`}>
        <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      <button type="button" onClick={onDuplicar} title="Duplicar" aria-label="Duplicar" className={`${btn} hover:bg-violet-50 hover:text-violet-600`}>
        <Copy className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      <button type="button" onClick={onDesativar} title="Desativar" aria-label="Desativar" className={`${btn} hover:bg-red-50 hover:text-red-500`}>
        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}

function FichaPerguntasLabel({ total }) {
  return (
    <>
      <span className="tabular-nums font-semibold text-[#0f172a]">{total}</span>
      {' '}
      <span className="text-[#64748b]">{total === 1 ? 'pergunta' : 'perguntas'}</span>
    </>
  );
}

function EspecialidadeBadge({ nome }) {
  if (!nome) {
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Geral
      </span>
    );
  }
  const cls = ESPECIALIDADE_BADGE[nome] ?? 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${cls}`}>
      {nome}
    </span>
  );
}

/**
 * Hub de Fichas: listagem das fichas salvas. "Nova Ficha" abre o editor local-first (sem POST).
 */
export const AnamneseFichasHome = forwardRef(function AnamneseFichasHome(
  { onFichaNomeChange, onDirtyFichaChange },
  ref,
) {
  const toast = useToast();
  const [fichas, setFichas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [view, setView] = useState('list');
  const [editorFichaId, setEditorFichaId] = useState(undefined);
  const [fichaParaExcluir, setFichaParaExcluir] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const onDirtyFichaChangeRef = useRef(onDirtyFichaChange);
  const onFichaNomeChangeRef = useRef(onFichaNomeChange);
  onDirtyFichaChangeRef.current = onDirtyFichaChange;
  onFichaNomeChangeRef.current = onFichaNomeChange;

  const fetchDados = useCallback(async () => {
    setLoading(true);
    try {
      const fs = await anamneseApi.listFichas().catch(() => []);
      setFichas(Array.isArray(fs) ? fs : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDados();
  }, [fetchDados]);

  useEffect(() => {
    if (view === 'list') {
      onFichaNomeChangeRef.current?.(null);
      onDirtyFichaChangeRef.current?.(false);
    }
  }, [view]);

  useEffect(() => () => {
    onFichaNomeChangeRef.current?.(null);
    onDirtyFichaChangeRef.current?.(false);
  }, []);

  const exitToList = useCallback(() => {
    setView('list');
    setEditorFichaId(undefined);
    fetchDados();
  }, [fetchDados]);

  useImperativeHandle(ref, () => ({ exitToList }), [exitToList]);

  const fichasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return fichas;
    return fichas.filter(
      (f) =>
        f.nome?.toLowerCase().includes(q) ||
        f.especialidadeNome?.toLowerCase().includes(q)
    );
  }, [fichas, busca]);

  const openEditor = (id) => {
    setEditorFichaId(id);
    setView('editor');
  };

  const handleNovaFicha = () => {
    setEditorFichaId(null);
    setView('editor');
  };

  const handleDuplicar = async (id, e) => {
    e?.stopPropagation();
    try {
      const dup = await anamneseApi.duplicarFicha(id);
      await fetchDados();
      openEditor(dup.id);
      toast.success('Ficha duplicada.');
    } catch (err) {
      toast.error(err.message || 'Erro ao duplicar.');
    }
  };

  const confirmarExcluir = async () => {
    if (!fichaParaExcluir) return;
    setExcluindo(true);
    try {
      await anamneseApi.removeFicha(fichaParaExcluir);
      setFichaParaExcluir(null);
      await fetchDados();
      toast.success('Ficha arquivada');
    } catch (err) {
      toast.error(err.message || 'Erro ao desativar ficha.');
    } finally {
      setExcluindo(false);
    }
  };

  if (view === 'editor') {
    return (
      <AnamneseDocumentoEditor
        fichaId={editorFichaId}
        onBack={exitToList}
        onFichaNomeChange={onFichaNomeChange}
        onSaved={() => fetchDados()}
        onDirtyChange={onDirtyFichaChange}
      />
    );
  }

  if (loading) {
    return (
      <div className="anamnese-sora fichas-home mx-auto flex w-full min-w-0 max-w-[1440px] flex-col gap-4">
        <div className="fichas-home__toolbar">
          <div className="h-10 min-w-0 flex-1 animate-pulse rounded-xl bg-[#f1f5f9]" />
          <div className="h-10 w-full animate-pulse rounded-xl bg-[#f1f5f9] sm:w-32" />
        </div>
        <ConfigTableSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="anamnese-sora fichas-home mx-auto w-full min-w-0 max-w-[1440px]">
      {fichaParaExcluir ? (
        <ViewportDialog
          open
          onDismiss={() => setFichaParaExcluir(null)}
          titleId="desativar-ficha-title"
        >
          <div className="border-b border-[#e2e8f0] px-5 py-4">
            <h3 id="desativar-ficha-title" className="text-[16px] font-bold text-[#0f172a]">
              Desativar ficha
            </h3>
          </div>
          <div className="px-5 py-4">
            <p className="text-[14px] font-medium leading-relaxed text-[#475569]">
              Deseja desativar esta ficha? Ela não estará mais disponível para novas consultas.
            </p>
          </div>
          <div className="flex flex-col-reverse gap-3 px-5 pb-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              data-dialog-initial-focus
              onClick={() => setFichaParaExcluir(null)}
              disabled={excluindo}
              className="min-h-11 rounded-xl border border-slate-200 px-5 py-3 text-[14px] font-bold text-[#64748b] hover:border-[#00a88e]/20 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmarExcluir}
              disabled={excluindo}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-500 px-5 py-3 text-[14px] font-bold text-white shadow-md hover:bg-red-600 disabled:opacity-60"
            >
              {excluindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Desativar
            </button>
          </div>
        </ViewportDialog>
      ) : null}

      <div className="flex flex-col gap-4">
        <div className="fichas-home__toolbar">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00a88e]/60" strokeWidth={2.5} />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar fichas..."
              className="w-full rounded-xl border border-slate-200 bg-[#f8fbfb] py-2.5 pl-11 pr-4 text-base font-medium outline-none focus:border-[#00a88e] focus:ring-4 focus:ring-[#00a88e]/20 sm:text-[14px]"
            />
          </div>
          <button
            type="button"
            onClick={handleNovaFicha}
            className="fichas-home__nova flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-[#00a88e] px-5 py-2.5 text-[13px] font-bold text-white shadow-md hover:bg-[#00967f]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Nova Ficha
          </button>
        </div>

        {fichasFiltradas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-2 py-16 text-center text-[#94a3b8]">
            <FileText className="h-10 w-10 opacity-30" />
            <p className="text-[14px] font-medium">
              {busca ? `Nenhuma ficha coincide com "${busca}"` : 'Nenhuma ficha cadastrada'}
            </p>
            {!busca && (
              <button
                type="button"
                onClick={handleNovaFicha}
                className="mt-2 min-h-11 text-[13px] font-bold text-[#00a88e] hover:underline"
              >
                Criar primeira ficha
              </button>
            )}
          </div>
        ) : (
          <div className="min-w-0 w-full">
            <div className="fichas-home__head" aria-hidden="true">
              <span className="min-w-0 w-0 flex-1">Ficha</span>
              <span className="w-[9.5rem] shrink-0 text-right">Perguntas</span>
              <span className="w-[10.75rem] shrink-0 text-right">Ações</span>
            </div>
            <div className="fichas-home__list">
              {fichasFiltradas.map((ficha) => {
                const totalPerguntas = totalPerguntasDaFicha(ficha);
                return (
                  <div
                    key={ficha.id}
                    className="fichas-home__row hover:bg-[#f0fdfa]/50 hover:border-[#00a88e]/30"
                    onClick={() => openEditor(ficha.id)}
                  >
                    <div className="fichas-home__identity">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#00a88e]" strokeWidth={2} />
                      <div className="min-w-0 w-full">
                        <p className="fichas-home__title">
                          {ficha.nome}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <EspecialidadeBadge nome={ficha.especialidadeNome} />
                          <span className="fichas-home__count-inline text-[12px]">
                            <FichaPerguntasLabel total={totalPerguntas} />
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="fichas-home__count-aside text-[13px]">
                      <FichaPerguntasLabel total={totalPerguntas} />
                    </div>
                    <FichaAcoes
                      onEditar={() => openEditor(ficha.id)}
                      onDuplicar={(e) => handleDuplicar(ficha.id, e)}
                      onDesativar={() => setFichaParaExcluir(ficha.id)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
