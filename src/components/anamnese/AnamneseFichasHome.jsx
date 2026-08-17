import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ClipboardList,
  Copy,
  FileText,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { anamneseApi } from '../../services/api';
import { useToast } from '../../contexts/useToast';
import { ConfigTableSkeleton } from '../shared/ConfigPanelSkeletons';
import { AnamneseDocumentoEditor } from './AnamneseDocumentoEditor.jsx';

const ESPECIALIDADE_BADGE = {
  Facial: 'bg-violet-100 text-violet-800 border-violet-200',
  Corporal: 'bg-blue-100 text-blue-800 border-blue-200',
};

function EspecialidadeBadge({ nome }) {
  if (!nome) {
    return (
      <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Geral
      </span>
    );
  }
  const cls = ESPECIALIDADE_BADGE[nome] ?? 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${cls}`}>
      {nome}
    </span>
  );
}

function StartScreen({ starters, onFromStarter, onMontarSecoes, onDoZero, loading }) {
  const fichaStarters = starters.filter((s) => s.tipo === 'FICHA');

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <div className="text-center">
        <ClipboardList className="mx-auto mb-3 h-10 w-10 text-[#00a88e] opacity-80" strokeWidth={1.5} />
        <h3 className="text-[18px] font-bold text-[#0f172a]">Como deseja começar?</h3>
        <p className="mt-1 text-[13px] text-[#64748b]">Escolha um ponto de partida para sua ficha de anamnese.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-1">
        <div className="rounded-2xl border border-app-border bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-600" />
            <h4 className="text-[14px] font-bold text-[#0f172a]">Partir de ficha pronta</h4>
          </div>
          <div className="space-y-2">
            {fichaStarters.map((s) => (
              <button
                key={s.codigo}
                type="button"
                disabled={loading}
                onClick={() => onFromStarter(s.codigo)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left transition-colors hover:border-[#00a88e]/30 hover:bg-[#f0fdfa] disabled:opacity-60"
              >
                <div>
                  <p className="text-[13px] font-bold text-[#0f766e]">{s.nome}</p>
                  <p className="text-[11px] text-[#64748b]">{s.descricao}</p>
                </div>
                <span className="text-[11px] font-bold text-[#64748b]">{s.contagemPerguntas} perg.</span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={onMontarSecoes}
          className="flex items-start gap-3 rounded-2xl border border-app-border bg-white p-4 text-left shadow-sm transition-colors hover:border-[#00a88e]/30 hover:bg-[#f0fdfa] disabled:opacity-60"
        >
          <Layers className="mt-0.5 h-5 w-5 shrink-0 text-[#00a88e]" />
          <div>
            <p className="text-[14px] font-bold text-[#0f172a]">Montar por seções</p>
            <p className="text-[12px] text-[#64748b]">Ficha vazia — adicione blocos prontos no editor.</p>
          </div>
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={onDoZero}
          className="flex items-start gap-3 rounded-2xl border border-app-border bg-white p-4 text-left shadow-sm transition-colors hover:border-[#00a88e]/30 hover:bg-[#f0fdfa] disabled:opacity-60"
        >
          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#00a88e]" />
          <div>
            <p className="text-[14px] font-bold text-[#0f172a]">Escrever do zero</p>
            <p className="text-[12px] text-[#64748b]">Comece com uma seção em branco.</p>
          </div>
        </button>
      </div>
    </div>
  );
}

/**
 * Hub unificado de Fichas: listagem + tela inicial + editor de documento.
 */
export function AnamneseFichasHome({ onFichaNomeChange }) {
  const toast = useToast();
  const [fichas, setFichas] = useState([]);
  const [starters, setStarters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busca, setBusca] = useState('');
  const [view, setView] = useState('list');
  const [editorFichaId, setEditorFichaId] = useState(null);
  const [fichaParaExcluir, setFichaParaExcluir] = useState(null);
  const [excluindo, setExcluindo] = useState(false);

  const fetchDados = useCallback(async () => {
    setLoading(true);
    try {
      const [fs, st] = await Promise.all([
        anamneseApi.listFichas().catch(() => []),
        anamneseApi.listStarters().catch(() => []),
      ]);
      setFichas(Array.isArray(fs) ? fs : []);
      setStarters(Array.isArray(st) ? st : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDados();
  }, [fetchDados]);

  useEffect(() => {
    if (view === 'list') onFichaNomeChange?.(null);
  }, [view, onFichaNomeChange]);

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

  const handleCreateEmpty = async (nome = 'Nova ficha') => {
    setCreating(true);
    try {
      const ficha = await anamneseApi.createFicha({ nome, itens: [] });
      await fetchDados();
      openEditor(ficha.id);
    } catch (err) {
      toast.error(err.message || 'Erro ao criar ficha.');
    } finally {
      setCreating(false);
    }
  };

  const handleFromStarter = async (codigo) => {
    setCreating(true);
    try {
      const ficha = await anamneseApi.fromStarter(codigo);
      await fetchDados();
      openEditor(ficha.id);
      toast.success('Ficha criada a partir do modelo.');
    } catch (err) {
      toast.error(err.message || 'Erro ao materializar starter.');
    } finally {
      setCreating(false);
    }
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
      toast.success('Ficha desativada.');
    } catch (err) {
      toast.error(err.message || 'Erro ao desativar ficha.');
    } finally {
      setExcluindo(false);
    }
  };

  if (view === 'editor' && editorFichaId) {
    return (
      <AnamneseDocumentoEditor
        fichaId={editorFichaId}
        onBack={() => {
          setView('list');
          setEditorFichaId(null);
          fetchDados();
        }}
        onFichaNomeChange={onFichaNomeChange}
        onSaved={() => fetchDados()}
      />
    );
  }

  if (view === 'start') {
    return (
      <div>
        <button
          type="button"
          onClick={() => setView('list')}
          className="mb-4 text-[13px] font-bold text-[#64748b] hover:text-[#00a88e]"
        >
          ← Voltar à lista
        </button>
        <StartScreen
          starters={starters}
          loading={creating}
          onFromStarter={handleFromStarter}
          onMontarSecoes={() => handleCreateEmpty('Ficha por seções')}
          onDoZero={() => handleCreateEmpty('Nova ficha')}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-10 max-w-sm flex-1 animate-pulse rounded-xl bg-[#f1f5f9]" />
          <div className="h-10 w-32 animate-pulse rounded-xl bg-[#f1f5f9]" />
        </div>
        <ConfigTableSkeleton rows={5} />
      </div>
    );
  }

  return (
    <>
      {fichaParaExcluir && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-md flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-[#e2e8f0] px-6 py-4">
              <h3 className="text-[16px] font-bold text-[#0f172a]">Desativar ficha</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-[14px] font-medium leading-relaxed text-[#475569]">
                Deseja desativar esta ficha? Ela não estará mais disponível para novas consultas.
              </p>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-6">
              <button
                type="button"
                onClick={() => setFichaParaExcluir(null)}
                disabled={excluindo}
                className="rounded-xl border border-slate-200 px-5 py-3 text-[14px] font-bold text-[#64748b] hover:border-[#00a88e]/20 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarExcluir}
                disabled={excluindo}
                className="flex items-center gap-2 rounded-xl bg-red-500 px-5 py-3 text-[14px] font-bold text-white shadow-md hover:bg-red-600 disabled:opacity-60"
              >
                {excluindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Desativar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00a88e]/60" strokeWidth={2.5} />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar fichas..."
              className="w-full rounded-xl border border-slate-200 bg-[#f8fbfb] py-2.5 pl-11 pr-4 text-[14px] font-medium outline-none focus:border-[#00a88e] focus:ring-4 focus:ring-[#00a88e]/20"
            />
          </div>
          <button
            type="button"
            onClick={() => setView('start')}
            disabled={creating}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-[#00a88e] px-5 py-2.5 text-[13px] font-bold text-white shadow-md hover:bg-[#00967f] disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" strokeWidth={2.5} />}
            Nova Ficha
          </button>
        </div>

        {fichasFiltradas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-[#94a3b8]">
            <FileText className="h-10 w-10 opacity-30" />
            <p className="text-[14px] font-medium">
              {busca ? `Nenhuma ficha coincide com "${busca}"` : 'Nenhuma ficha cadastrada'}
            </p>
            {!busca && (
              <button
                type="button"
                onClick={() => setView('start')}
                className="mt-2 text-[13px] font-bold text-[#00a88e] hover:underline"
              >
                Criar primeira ficha
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-2xl border border-app-border bg-white shadow-sm md:block">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-app-border bg-[#f8fbfb]">
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-[#64748b]">Nome</th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-[#64748b]">Especialidade</th>
                    <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-[#64748b]">Perguntas</th>
                    <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-[#64748b]">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border/60">
                  {fichasFiltradas.map((ficha) => (
                    <tr
                      key={ficha.id}
                      className="group cursor-pointer transition-colors hover:bg-[#f0fdfa]/50"
                      onClick={() => openEditor(ficha.id)}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-[#00a88e]" strokeWidth={2} />
                          <span className="font-bold text-[#0f172a]">{ficha.nome}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <EspecialidadeBadge nome={ficha.especialidadeNome} />
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium tabular-nums text-[#64748b]">
                        {ficha.totalPerguntas ?? ficha.itens?.length ?? 0}
                      </td>
                      <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button type="button" onClick={() => openEditor(ficha.id)} title="Editar" className="rounded-lg p-1.5 text-[#64748b] hover:bg-[#f0fdfa] hover:text-[#00a88e]">
                            <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                          </button>
                          <button type="button" onClick={(e) => handleDuplicar(ficha.id, e)} title="Duplicar" className="rounded-lg p-1.5 text-[#64748b] hover:bg-violet-50 hover:text-violet-600">
                            <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                          </button>
                          <button type="button" onClick={() => setFichaParaExcluir(ficha.id)} title="Desativar" className="rounded-lg p-1.5 text-[#64748b] hover:bg-red-50 hover:text-red-500">
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 md:hidden">
              {fichasFiltradas.map((ficha) => (
                <div
                  key={ficha.id}
                  className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-app-border bg-white p-4 shadow-sm hover:border-[#00a88e]/30"
                  onClick={() => openEditor(ficha.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-[#00a88e]" strokeWidth={2} />
                      <span className="break-words text-[14px] font-bold text-[#0f172a] [overflow-wrap:anywhere]">{ficha.nome}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <EspecialidadeBadge nome={ficha.especialidadeNome} />
                      <span className="text-[12px] text-[#64748b]">
                        {ficha.totalPerguntas ?? ficha.itens?.length ?? 0} pergunta(s)
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
