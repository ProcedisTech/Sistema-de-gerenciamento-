import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, FileText, Loader2, Search, Trash2, Pencil,
  ChevronUp, ChevronDown, Save, X, AlertTriangle,
} from 'lucide-react';
import { anamneseApi, dimensoesApi } from '../../services/api';
import { HabitoEditModal } from './HabitoEditModal';
import { tipoLabel } from './anamneseTipoLabels';
import { ConfigTableSkeleton } from '../shared/ConfigPanelSkeletons';

// ── Badges de especialidade (padrão do Catálogo/BancoProcedimentos) ──────────

const ESPECIALIDADE_BADGE = {
  Facial:   'bg-violet-100 text-violet-800 border-violet-200',
  Corporal: 'bg-blue-100  text-blue-800  border-blue-200',
};

function EspecialidadeBadge({ nome }) {
  if (!nome) {
    return (
      <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wide">
        Geral
      </span>
    );
  }
  const cls = ESPECIALIDADE_BADGE[nome] ?? 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <span className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wide ${cls}`}>
      {nome}
    </span>
  );
}

// ── Editor de ficha (inline) ─────────────────────────────────────────────────

function FichaEditor({ ficha, categorias, perguntas, tiposResposta, especialidades, onClose, onSaved }) {
  const isNova = ficha === 'nova';

  const [fichaNome, setFichaNome] = useState(isNova ? '' : (ficha.nome || ''));
  const [fichaEspId, setFichaEspId] = useState(isNova ? '' : (ficha.especialidadeId || ''));
  const [fichaItens, setFichaItens] = useState(() => {
    if (isNova) return [];
    return (ficha.itens || []).map((item) => ({
      perguntaId: item.pergunta?.id || item.perguntaId,
      descricao: item.pergunta?.descricao || '',
      categoriaNome: item.pergunta?.categoriaNome || '',
      tipoResposta: item.pergunta?.tipoResposta || '',
      prioridade: item.pergunta?.prioridade || 'NORMAL',
      ordem: item.ordem,
      obrigatorio: item.obrigatorio ?? false,
    }));
  });
  const [filtroCat, setFiltroCat] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [editingPergunta, setEditingPergunta] = useState(null);
  const [perguntasState, setPerguntasState] = useState(perguntas);

  const idsNaFicha = useMemo(() => new Set(fichaItens.map((i) => i.perguntaId)), [fichaItens]);

  const disponiveis = useMemo(() => {
    let lista = perguntasState.filter((p) => !idsNaFicha.has(p.id));
    if (filtroCat) lista = lista.filter((p) => String(p.categoriaId) === String(filtroCat));
    return lista;
  }, [perguntasState, idsNaFicha, filtroCat]);

  const adicionarPergunta = (p) => {
    setFichaItens((prev) => [
      ...prev,
      { perguntaId: p.id, descricao: p.descricao, categoriaNome: p.categoriaNome || '',
        tipoResposta: p.tipoResposta || '', prioridade: p.prioridade || 'NORMAL',
        ordem: prev.length + 1, obrigatorio: false },
    ]);
  };

  const removerItem = (idx) => {
    setFichaItens((prev) => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, ordem: i + 1 })));
  };

  const moverItem = (idx, dir) => {
    setFichaItens((prev) => {
      const copy = [...prev];
      const ti = idx + dir;
      if (ti < 0 || ti >= copy.length) return prev;
      [copy[idx], copy[ti]] = [copy[ti], copy[idx]];
      return copy.map((it, i) => ({ ...it, ordem: i + 1 }));
    });
  };

  const toggleObrigatorio = (idx) => {
    setFichaItens((prev) => prev.map((it, i) => i === idx ? { ...it, obrigatorio: !it.obrigatorio } : it));
  };

  const handleSalvar = async () => {
    if (!fichaNome.trim()) { setErro('Preencha o nome da ficha.'); return; }
    if (fichaItens.length === 0) { setErro('Adicione pelo menos uma pergunta.'); return; }
    setErro('');
    setSalvando(true);
    try {
      const payload = {
        nome: fichaNome.trim(),
        especialidadeId: fichaEspId || undefined,
        itens: fichaItens.map((it) => ({ perguntaId: it.perguntaId, ordem: it.ordem, obrigatorio: it.obrigatorio })),
      };
      if (isNova) {
        await anamneseApi.createFicha(payload);
      } else {
        await anamneseApi.updateFicha(ficha.id, payload);
      }
      onSaved();
    } catch (err) {
      setErro(err.message || 'Erro ao salvar ficha.');
    } finally {
      setSalvando(false);
    }
  };

  const handleEditSavedInEditor = useCallback((updated) => {
    setEditingPergunta(null);
    if (updated) {
      setPerguntasState((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setFichaItens((prev) =>
        prev.map((it) =>
          String(it.perguntaId) === String(updated.id)
            ? { ...it, descricao: updated.descricao || it.descricao,
                categoriaNome: updated.categoriaNome || it.categoriaNome,
                prioridade: updated.prioridade || 'NORMAL' }
            : it
        )
      );
    }
  }, []);

  return (
    <>
      {editingPergunta && (
        <HabitoEditModal
          key={editingPergunta.id}
          pergunta={editingPergunta}
          categorias={categorias}
          tiposResposta={tiposResposta}
          onClose={() => setEditingPergunta(null)}
          onSaved={handleEditSavedInEditor}
        />
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-[16px] font-bold text-[#0f172a]">
            {isNova ? 'Nova Ficha' : 'Editar Ficha'}
          </h4>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl font-bold text-[13px] bg-white text-[#64748b] border border-slate-200 hover:border-[#00a88e]/20 flex items-center gap-1.5">
            <X className="w-4 h-4" /> Cancelar
          </button>
        </div>

        {erro && (
          <div className="bg-red-50 text-red-600 border border-red-200 rounded-xl p-3 text-[13px] font-bold flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{erro}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-[#00a88e] ml-1">Nome da Ficha *</label>
            <input
              type="text"
              value={fichaNome}
              onChange={(e) => setFichaNome(e.target.value)}
              placeholder="Ex.: Anamnese Cardiológica Padrão"
              className="w-full px-4 py-3 bg-[#f8fbfb] border border-app-border rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-[#00a88e] ml-1">Especialidade (opcional)</label>
            <select
              value={fichaEspId}
              onChange={(e) => setFichaEspId(e.target.value)}
              className="w-full px-4 py-3 bg-[#f8fbfb] border border-app-border rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e] appearance-none"
            >
              <option value="">Nenhuma (Geral)</option>
              {especialidades.map((e) => (
                <option key={e.especialidade_id || e.id} value={e.especialidade_id || e.id}>{e.nome}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
          {/* Perguntas na ficha */}
          <div className="space-y-3 min-w-0">
            <h5 className="text-[14px] font-bold text-[#0f172a]">Perguntas na ficha ({fichaItens.length})</h5>
            {fichaItens.length === 0 ? (
              <div className="text-center py-8 text-[#94a3b8] bg-[#f8fbfb] border border-dashed border-slate-200 rounded-xl">
                <p className="text-[13px]">Selecione perguntas do banco ao lado</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[min(520px,calc(100vh-22rem))] overflow-y-auto pr-1 custom-scrollbar">
                {fichaItens.map((item, idx) => (
                  <div
                    key={item.perguntaId}
                    className="flex flex-col gap-2 p-3 rounded-xl border border-app-border bg-white cursor-pointer hover:border-[#00a88e]/30 transition-all"
                    onClick={() => {
                      const p = perguntasState.find((q) => String(q.id) === String(item.perguntaId));
                      if (p) setEditingPergunta(p);
                    }}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="flex flex-col gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => moverItem(idx, -1)} disabled={idx === 0} className="text-[#94a3b8] hover:text-[#00a88e] disabled:opacity-30">
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => moverItem(idx, 1)} disabled={idx === fichaItens.length - 1} className="text-[#94a3b8] hover:text-[#00a88e] disabled:opacity-30">
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                      <span className="w-6 h-6 rounded-full bg-[#00a88e] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{item.ordem}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-[#0f172a] break-words [overflow-wrap:anywhere] leading-snug">{item.descricao}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="text-[11px] text-[#64748b]">{item.categoriaNome}</span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md border bg-slate-100 text-slate-600 border-slate-200">
                            {tipoLabel(item.tipoResposta)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pl-8" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => toggleObrigatorio(idx)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-colors flex-shrink-0 ${
                          item.obrigatorio ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                        }`}
                        title={item.obrigatorio ? 'Tornar opcional' : 'Tornar obrigatória'}
                      >
                        <span className={`w-3 h-3 rounded-sm border flex-shrink-0 flex items-center justify-center ${item.obrigatorio ? 'border-white/60 bg-white/20' : 'border-slate-400'}`}>
                          {item.obrigatorio && (
                            <svg className="w-2 h-2" viewBox="0 0 10 10" fill="none">
                              <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        Obrigatório
                      </button>
                      <button
                        type="button"
                        onClick={() => removerItem(idx)}
                        title="Remover da ficha"
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Banco de perguntas */}
          <div className="space-y-3 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h5 className="text-[14px] font-bold text-[#0f172a]">Banco de Perguntas</h5>
              <select
                value={filtroCat}
                onChange={(e) => setFiltroCat(e.target.value)}
                className="px-2 py-1 bg-[#f8fbfb] border border-app-border rounded-lg text-[12px] font-medium focus:outline-none appearance-none"
              >
                <option value="">Todas</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2 max-h-[min(520px,calc(100vh-22rem))] overflow-y-auto pr-1 custom-scrollbar">
              {disponiveis.length === 0 ? (
                <p className="text-center py-6 text-[#94a3b8] text-[13px]">Nenhuma pergunta disponível</p>
              ) : (
                disponiveis.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => adicionarPergunta(p)}
                    className="w-full text-left p-3 rounded-xl border-2 border-[#e2e8f0] bg-white hover:border-[#00a88e]/30 hover:bg-[#f0fdfa] transition-all"
                  >
                    <p className="text-[13px] font-bold text-[#0f766e] break-words [overflow-wrap:anywhere]">{p.descricao}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="text-[11px] text-[#64748b]">{p.categoriaNome}</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md border bg-slate-100 text-slate-600 border-slate-200">
                        {tipoLabel(p.tipoResposta)}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t-[3px] border-[#00a88e]/15">
          <button
            type="button"
            onClick={handleSalvar}
            disabled={salvando}
            className="px-6 py-3 rounded-xl font-bold text-[14px] bg-[#00a88e] hover:bg-[#00967f] text-white border border-transparent shadow-md disabled:opacity-60 flex items-center gap-2"
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Ficha
          </button>
        </div>
      </div>
    </>
  );
}

// ── FichasPanel ───────────────────────────────────────────────────────────────

/**
 * Painel moderno de Fichas de Anamnese.
 * Listagem em tabela (desktop) / cards (mobile).
 * Editor de fichas inline (abre abaixo da tabela em vez de page replace).
 */
export function FichasPanel() {
  const [fichas, setFichas] = useState([]);
  const [perguntas, setPerguntas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [tiposResposta, setTiposResposta] = useState([]);
  const [especialidades, setEspecialidades] = useState([]);
  const [loading, setLoading] = useState(true);

  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState(null); // null | 'nova' | fichaObj
  const [fichaParaExcluir, setFichaParaExcluir] = useState(null);
  const [excluindo, setExcluindo] = useState(false);

  const fetchDados = useCallback(async () => {
    setLoading(true);
    const [fs, ps, cats, tipos, esps] = await Promise.all([
      anamneseApi.listFichas().catch(() => []),
      anamneseApi.listAllHabitos().catch(() => []),
      anamneseApi.listCategorias().catch(() => []),
      dimensoesApi.tiposResposta().catch(() => []),
      dimensoesApi.especialidades().catch(() => []),
    ]);
    setFichas(Array.isArray(fs) ? fs : []);
      setPerguntas(Array.isArray(ps) ? ps : []);
    setCategorias(Array.isArray(cats) ? cats : []);
    setTiposResposta(Array.isArray(tipos) ? tipos : []);
    setEspecialidades(Array.isArray(esps) ? esps : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDados(); }, [fetchDados]);

  const fichasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return fichas;
    return fichas.filter(
      (f) =>
        f.nome?.toLowerCase().includes(q) ||
        f.especialidadeNome?.toLowerCase().includes(q)
    );
  }, [fichas, busca]);

  const confirmarExcluir = async () => {
    if (!fichaParaExcluir) return;
    setExcluindo(true);
    try {
      await anamneseApi.removeFicha(fichaParaExcluir);
      setFichaParaExcluir(null);
      await fetchDados();
    } catch (err) {
      console.warn('Erro ao excluir ficha:', err.message);
    } finally {
      setExcluindo(false);
    }
  };

  const handleSaved = useCallback(async () => {
    setEditando(null);
    await fetchDados();
  }, [fetchDados]);

  if (loading && editando === null) {
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

  // Editor em tela cheia (substitui a tabela)
  if (editando !== null) {
    return (
      <FichaEditor
        ficha={editando}
        categorias={categorias}
        perguntas={perguntas}
        tiposResposta={tiposResposta}
        especialidades={especialidades}
        onClose={() => setEditando(null)}
        onSaved={handleSaved}
      />
    );
  }

  return (
    <>
      {/* Modal confirmação exclusão */}
      {fichaParaExcluir && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md flex flex-col">
            <div className="px-6 py-4 border-b border-[#e2e8f0]">
              <h3 className="text-[16px] font-bold text-[#0f172a]">Desativar ficha</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-[14px] font-medium text-[#475569] leading-relaxed">
                Deseja desativar esta ficha? Ela não estará mais disponível para novas consultas.
              </p>
            </div>
            <div className="px-6 pb-6 flex justify-end gap-3">
              <button type="button" onClick={() => setFichaParaExcluir(null)} disabled={excluindo} className="px-5 py-3 rounded-xl font-bold text-[14px] bg-white text-[#64748b] border border-slate-200 hover:border-[#00a88e]/20 disabled:opacity-50">
                Cancelar
              </button>
              <button type="button" onClick={confirmarExcluir} disabled={excluindo} className="px-5 py-3 rounded-xl font-bold text-[14px] bg-red-500 hover:bg-red-600 text-white shadow-md disabled:opacity-60 flex items-center gap-2">
                {excluindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Desativar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* Barra superior */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 min-w-0 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00a88e]/60 pointer-events-none" strokeWidth={2.5} />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar fichas..."
              className="w-full pl-11 pr-4 py-2.5 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e]"
            />
          </div>
          <button
            type="button"
            onClick={() => setEditando('nova')}
            disabled={loading}
            className="shrink-0 px-5 py-2.5 rounded-xl font-bold text-[13px] bg-[#00a88e] hover:bg-[#00967f] text-white shadow-md flex items-center gap-2 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            Nova Ficha
          </button>
        </div>

        {/* Tabela desktop */}
        {fichasFiltradas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-[#94a3b8]">
            {busca ? (
              <>
                <Search className="w-10 h-10 opacity-30" />
                <p className="text-[14px] font-medium">Nenhuma ficha coincide com &ldquo;{busca}&rdquo;</p>
                <button type="button" onClick={() => setBusca('')} className="text-[13px] font-bold text-[#00a88e] hover:underline mt-1">Limpar busca</button>
              </>
            ) : (
              <>
                <FileText className="w-10 h-10 opacity-30" />
                <p className="text-[14px] font-medium">Nenhuma ficha cadastrada</p>
                <p className="text-[12px] mt-1">Clique em &ldquo;Nova Ficha&rdquo; para criar a primeira</p>
              </>
            )}
          </div>
        ) : (
          <>
            {/* ── Tabela desktop (md+) ── */}
            <div className="hidden md:block rounded-2xl border border-app-border overflow-x-auto bg-white shadow-sm">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="bg-[#f8fbfb] border-b border-app-border">
                    <th className="px-5 py-3 font-bold text-[#64748b] uppercase text-[11px] tracking-wide">Nome</th>
                    <th className="px-5 py-3 font-bold text-[#64748b] uppercase text-[11px] tracking-wide">Especialidade</th>
                    <th className="px-5 py-3 font-bold text-[#64748b] uppercase text-[11px] tracking-wide text-right">Qtd. Perguntas</th>
                    <th className="px-5 py-3 font-bold text-[#64748b] uppercase text-[11px] tracking-wide text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border/60">
                  {fichasFiltradas.map((ficha) => (
                    <tr
                      key={ficha.id}
                      className="group hover:bg-[#f0fdfa]/50 transition-colors cursor-pointer"
                      onClick={() => setEditando(ficha)}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-[#00a88e] flex-shrink-0" strokeWidth={2} />
                          <span className="font-bold text-[#0f172a]">{ficha.nome}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <EspecialidadeBadge nome={ficha.especialidadeNome} />
                      </td>
                      <td className="px-5 py-3.5 text-right text-[#64748b] font-medium tabular-nums">
                        {ficha.itens?.length ?? 0}
                      </td>
                      <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => setEditando(ficha)}
                            title="Editar ficha"
                            className="p-1.5 rounded-lg text-[#64748b] hover:bg-[#f0fdfa] hover:text-[#00a88e] transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setFichaParaExcluir(ficha.id)}
                            title="Desativar ficha"
                            className="p-1.5 rounded-lg text-[#64748b] hover:bg-red-50 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Cards mobile (< md) ── */}
            <div className="flex flex-col gap-3 md:hidden">
              {fichasFiltradas.map((ficha) => (
                <div
                  key={ficha.id}
                  className="p-4 rounded-xl border border-app-border bg-white shadow-sm flex items-start justify-between gap-3 cursor-pointer hover:border-[#00a88e]/30"
                  onClick={() => setEditando(ficha)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-[#00a88e] flex-shrink-0" strokeWidth={2} />
                      <span className="font-bold text-[#0f172a] text-[14px] break-words [overflow-wrap:anywhere]">{ficha.nome}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <EspecialidadeBadge nome={ficha.especialidadeNome} />
                      <span className="text-[12px] text-[#64748b]">{ficha.itens?.length ?? 0} pergunta{(ficha.itens?.length ?? 0) !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => setEditando(ficha)} title="Editar" className="p-1.5 rounded-lg text-[#64748b] hover:bg-[#f0fdfa] hover:text-[#00a88e]">
                      <Pencil className="w-4 h-4" strokeWidth={2} />
                    </button>
                    <button type="button" onClick={() => setFichaParaExcluir(ficha.id)} title="Desativar" className="p-1.5 rounded-lg text-[#64748b] hover:bg-red-50 hover:text-red-500">
                      <Trash2 className="w-4 h-4" strokeWidth={2} />
                    </button>
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
