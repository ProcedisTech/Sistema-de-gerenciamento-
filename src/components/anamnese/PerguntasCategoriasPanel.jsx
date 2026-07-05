import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus, Search, Loader2, ChevronDown, ChevronUp,
  Pencil, Trash2, Check, X, Tag, HelpCircle, AlertTriangle,
} from 'lucide-react';
import { anamneseApi, dimensoesApi, getApiErrorDetail } from '../../services/api';
import { HabitoEditModal } from './HabitoEditModal';
import {
  HabitoModalShell,
  HABITO_INPUT_CLASS,
  HABITO_READONLY_CLASS,
  HABITO_MODAL_CANCEL_CLASS,
  HABITO_MODAL_SUBMIT_CLASS,
  PrioridadeSegmented,
} from './HabitoModalShell';
import { tipoLabel } from './anamneseTipoLabels';
import { ConfigCardStackSkeleton } from '../shared/ConfigPanelSkeletons';

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRIORIDADE_CONFIG = {
  NORMAL:  { label: 'Normal',   dot: 'bg-slate-400',  badge: 'bg-slate-100 text-slate-700 border-slate-200' },
  ALERTA:  { label: 'Alerta',   dot: 'bg-amber-400',  badge: 'bg-amber-50 text-amber-800 border-amber-300' },
  CRITICA: { label: 'Crítica',  dot: 'bg-red-500',    badge: 'bg-red-50 text-red-700 border-red-300' },
};

function PrioridadeBadge({ prioridade }) {
  const cfg = PRIORIDADE_CONFIG[prioridade] ?? PRIORIDADE_CONFIG.NORMAL;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function TipoBadge({ tipo }) {
  return (
    <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
      {tipoLabel(tipo)}
    </span>
  );
}

// ── CreateHabitoModal ─────────────────────────────────────────────────────────

function CreateHabitoModal({ categorias, tiposResposta, preCategoriaId, onClose, onSaved }) {
  const [categoriaId, setCategoriaId] = useState(preCategoriaId || '');
  const [tipoRespostaId, setTipoRespostaId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState('NORMAL');
  const [alternativas, setAlternativas] = useState([]);
  const [novaAlt, setNovaAlt] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const DESCRICAO_MAX = 300;
  const TIPOS_ESCOLHA = ['escolha_unica', 'multipla_escolha'];

  const tipoSelecionado = useMemo(() => {
    const t = tiposResposta.find((tr) => String(tr.tipo_resposta_id || tr.id) === String(tipoRespostaId));
    return t?.tipo || '';
  }, [tiposResposta, tipoRespostaId]);

  const precisaAlts = TIPOS_ESCOLHA.includes(tipoSelecionado);

  const handleAdicionarAlt = () => {
    const texto = novaAlt.trim();
    if (!texto) return;
    const norm = texto.toLowerCase();
    if (alternativas.some((a) => (a.alternativa || '').trim().toLowerCase() === norm)) {
      setErro('Essa alternativa já existe.');
      return;
    }
    setErro('');
    setAlternativas((prev) => [...prev, { alternativa: texto, ordem: prev.length + 1 }]);
    setNovaAlt('');
  };

  const handleRemoverAlt = (idx) => {
    setAlternativas((prev) => prev.filter((_, i) => i !== idx).map((a, i) => ({ ...a, ordem: i + 1 })));
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    const catOk = preCategoriaId ? true : Boolean(categoriaId);
    if (!catOk || !tipoRespostaId || !descricao.trim()) {
      setErro('Preencha categoria, tipo de resposta e descrição.');
      return;
    }
    if (precisaAlts && alternativas.length < 2) {
      setErro('Adicione pelo menos 2 alternativas para perguntas de escolha.');
      return;
    }
    setErro('');
    setSalvando(true);
    try {
      const habito = await anamneseApi.createHabito({
        categoriaId: preCategoriaId || categoriaId,
        tipoRespostaId,
        descricao: descricao.trim().slice(0, DESCRICAO_MAX),
        prioridade,
      });
      if (precisaAlts && alternativas.length > 0) {
        await anamneseApi.addAlternativas(habito.id, alternativas);
      }
      onSaved(habito);
    } catch (err) {
      setErro(err.message || 'Erro ao criar pergunta.');
    } finally {
      setSalvando(false);
    }
  };

  const catNome = preCategoriaId
    ? categorias.find((c) => String(c.id) === String(preCategoriaId))?.nome
    : null;

  return (
    <HabitoModalShell
      title="Nova Pergunta"
      subtitle={catNome ? `Categoria: ${catNome}` : null}
      icon={HelpCircle}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={HABITO_MODAL_CANCEL_CLASS}>
            Cancelar
          </button>
          <button
            type="submit"
            form="create-habito-form"
            disabled={salvando}
            className={HABITO_MODAL_SUBMIT_CLASS}
          >
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />}
            Salvar Pergunta
          </button>
        </>
      }
    >
      <form
        id="create-habito-form"
        onSubmit={handleSalvar}
        className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4"
      >
          {erro ? (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] font-bold text-red-600">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{erro}</span>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="ml-1 text-[13px] font-bold text-[#00a88e]">Categoria *</label>
              {preCategoriaId ? (
                <div className={HABITO_READONLY_CLASS}>{catNome || '—'}</div>
              ) : (
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
              )}
            </div>

            <div className="space-y-1.5">
              <label className="ml-1 text-[13px] font-bold text-[#00a88e]">Tipo de Resposta *</label>
              <select
                value={tipoRespostaId}
                onChange={(e) => { setTipoRespostaId(e.target.value); setAlternativas([]); }}
                className={HABITO_INPUT_CLASS}
              >
                <option value="">Selecione...</option>
                {tiposResposta.filter((t) => t.ativo !== false).map((t) => (
                  <option key={t.tipo_resposta_id || t.id} value={t.tipo_resposta_id || t.id}>
                    {tipoLabel(t.tipo)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="ml-1 text-[13px] font-bold text-[#00a88e]">Prioridade</label>
            <PrioridadeSegmented value={prioridade} onChange={setPrioridade} />
          </div>

          <div className="space-y-1.5">
            <div className="ml-1 flex items-baseline justify-between gap-2">
              <label className="text-[13px] font-bold text-[#00a88e]">Pergunta / Descrição *</label>
              <span className={`text-[11px] font-medium tabular-nums ${descricao.length >= 300 ? 'text-red-600' : 'text-[#94a3b8]'}`}>
                {descricao.length}/300
              </span>
            </div>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value.slice(0, 300))}
              rows={3}
              maxLength={300}
              placeholder="Ex.: O paciente faz uso de medicamentos controlados?"
              className={HABITO_INPUT_CLASS}
            />
          </div>

          {precisaAlts ? (
            <div className="space-y-3 rounded-xl border border-fuchsia-200 bg-[#f8fbfb] p-4">
              <label className="ml-1 text-[13px] font-bold text-[#a855f7]">Alternativas *</label>
              {alternativas.map((alt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#a855f7]/10 text-[11px] font-bold text-[#a855f7]">
                    {alt.ordem}
                  </span>
                  <span className="flex-1 text-[13px] font-medium text-[#0f172a]">{alt.alternativa}</span>
                  <button type="button" onClick={() => handleRemoverAlt(idx)} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-red-400 hover:bg-red-50 hover:text-red-600">
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={novaAlt}
                  onChange={(e) => setNovaAlt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdicionarAlt(); } }}
                  placeholder="Nova alternativa..."
                  className="flex-1 rounded-lg border-[2px] border-[#a855f7]/20 bg-white px-3 py-2 text-[13px] font-medium focus:border-[#a855f7] focus:outline-none"
                />
                <button type="button" onClick={handleAdicionarAlt} className="rounded-lg bg-[#a855f7] px-3 py-2 text-[12px] font-bold text-white">
                  <Plus className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          ) : null}
      </form>
    </HabitoModalShell>
  );
}

// ── PerguntasCategoriasPanel ──────────────────────────────────────────────────

/**
 * Painel unificado de Perguntas & Categorias de Anamnese.
 *
 * Modo acordeão (padrão): categorias fechadas, clique expande/colapsa.
 * Modo tudo aberto: todas as perguntas visíveis; toggle no topo.
 * O modo NÃO é persistido — sempre abre no acordeão fechado.
 */
export function PerguntasCategoriasPanel() {
  // ── Dados ──
  const [categorias, setCategorias] = useState([]);
  const [perguntasPorCat, setPerguntasPorCat] = useState({}); // { [catId]: HabitoDTO[] }
  const [tiposResposta, setTiposResposta] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // ── UI ──
  const [busca, setBusca] = useState('');
  const [modoTudoAberto, setModoTudoAberto] = useState(false);
  const [expandidas, setExpandidas] = useState(new Set()); // ids das categorias expandidas no acordeão

  // ── CRUD Categoria ──
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('');
  const [criandoCategoria, setCriandoCategoria] = useState(false);
  const [erroCategoria, setErroCategoria] = useState('');
  const [editandoCatId, setEditandoCatId] = useState(null);
  const [editandoCatNome, setEditandoCatNome] = useState('');
  const [salvandoCat, setSalvandoCat] = useState(false);
  const [deletandoCatId, setDeletandoCatId] = useState(null);
  const [excluindoCat, setExcluindoCat] = useState(false);
  const [erroCatInline, setErroCatInline] = useState(null); // { id, msg }
  const editCatRef = useRef(null);

  // ── CRUD Pergunta ──
  const [editandoPergunta, setEditandoPergunta] = useState(null);
  const [deletandoPergId, setDeletandoPergId] = useState(null);
  const [excluindoPergs, setExcluindoPergs] = useState(false);
  const [erroPergInline, setErroPergInline] = useState(null); // { id, msg }
  const [deletePergConflict, setDeletePergConflict] = useState(null);

  // ── Criar pergunta ──
  const [createForm, setCreateForm] = useState({ open: false, preCategoriaId: null });

  // ── Load ──────────────────────────────────────────────────────────────────

  const fetchTudo = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [cats, tipos] = await Promise.all([
        anamneseApi.listCategorias().catch(() => []),
        dimensoesApi.tiposResposta().catch(() => []),
      ]);
      const catList = Array.isArray(cats) ? cats : [];
      setCategorias(catList);
      setTiposResposta(Array.isArray(tipos) ? tipos : []);

      // Eager: carrega perguntas de todas as categorias em paralelo
      const resultados = await Promise.all(
        catList.map((c) =>
          anamneseApi.listHabitos(c.id).catch(() => [])
        )
      );
      const mapa = {};
      catList.forEach((c, i) => {
        mapa[c.id] = Array.isArray(resultados[i]) ? resultados[i] : [];
      });
      setPerguntasPorCat(mapa);
    } catch (err) {
      setLoadError(err.message || 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTudo(); }, [fetchTudo]);

  useEffect(() => {
    if (editandoCatId && editCatRef.current) editCatRef.current.focus();
  }, [editandoCatId]);

  // ── Refetch de uma categoria específica ─────────────────────────────────

  const refetchPerguntas = useCallback(async (catId) => {
    try {
      const pergs = await anamneseApi.listHabitos(catId);
      setPerguntasPorCat((prev) => ({ ...prev, [catId]: Array.isArray(pergs) ? pergs : [] }));
    } catch {
      // silencia: dados anteriores permanecem
    }
  }, []);

  // ── Busca ─────────────────────────────────────────────────────────────────

  const termoBusca = busca.trim().toLowerCase();

  const gruposFiltrados = useMemo(() => {
    if (!termoBusca) {
      return categorias.map((cat) => ({
        cat,
        perguntas: perguntasPorCat[cat.id] || [],
        matchCat: false,
      }));
    }
    return categorias
      .map((cat) => {
        const matchCat = cat.nome.toLowerCase().includes(termoBusca);
        const perguntas = (perguntasPorCat[cat.id] || []).filter(
          (p) => p.descricao.toLowerCase().includes(termoBusca) || cat.nome.toLowerCase().includes(termoBusca)
        );
        return { cat, perguntas, matchCat };
      })
      .filter(({ matchCat, perguntas }) => matchCat || perguntas.length > 0);
  }, [categorias, perguntasPorCat, termoBusca]);

  // ── Acordeão ──────────────────────────────────────────────────────────────

  const toggleExpand = useCallback((catId) => {
    setExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }, []);

  const isAberta = useCallback(
    (catId) => modoTudoAberto || termoBusca !== '' || expandidas.has(catId),
    [modoTudoAberto, termoBusca, expandidas]
  );

  // ── CRUD Categoria ────────────────────────────────────────────────────────

  const handleCriarCategoria = async (e) => {
    e.preventDefault();
    const nome = novaCategoriaNome.trim();
    if (!nome) { setErroCategoria('Digite um nome para a categoria.'); return; }
    setErroCategoria('');
    setCriandoCategoria(true);
    try {
      await anamneseApi.createCategoria({ nome });
      setNovaCategoriaNome('');
      await fetchTudo();
    } catch (err) {
      setErroCategoria(
        err.status === 409
          ? getApiErrorDetail(err) || 'Já existe uma categoria com esse nome.'
          : getApiErrorDetail(err) || err.message || 'Erro ao criar categoria.'
      );
    } finally {
      setCriandoCategoria(false);
    }
  };

  const handleEditarCategoria = (cat) => {
    setErroCatInline(null);
    setDeletandoCatId(null);
    setEditandoCatId(cat.id);
    setEditandoCatNome(cat.nome);
  };

  const handleSalvarEdicaoCategoria = async (id) => {
    const nome = editandoCatNome.trim();
    if (!nome) return;
    setErroCatInline(null);
    setSalvandoCat(true);
    try {
      const updated = await anamneseApi.updateCategoria(id, { nome });
      setCategorias((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setEditandoCatId(null);
    } catch (err) {
      setErroCatInline({
        id,
        msg: err.status === 409
          ? getApiErrorDetail(err) || 'Já existe uma categoria com esse nome.'
          : err.message || 'Erro ao salvar.',
      });
    } finally {
      setSalvandoCat(false);
    }
  };

  const handleExcluirCategoria = async (id) => {
    setErroCatInline(null);
    setExcluindoCat(true);
    try {
      await anamneseApi.deleteCategoria(id);
      setCategorias((prev) => prev.filter((c) => c.id !== id));
      setPerguntasPorCat((prev) => { const n = { ...prev }; delete n[id]; return n; });
      setDeletandoCatId(null);
    } catch (err) {
      setErroCatInline({
        id,
        msg: err.status === 409
          ? 'Esta categoria tem perguntas ativas — remova-as antes de excluir.'
          : err.message || 'Erro ao excluir.',
      });
    } finally {
      setExcluindoCat(false);
    }
  };

  // ── CRUD Pergunta ─────────────────────────────────────────────────────────

  const handleEditSaved = useCallback(async (updated) => {
    setEditandoPergunta(null);
    if (!updated) {
      await fetchTudo();
    } else {
      const catId = updated.categoriaId;
      if (catId) {
        setPerguntasPorCat((prev) => ({
          ...prev,
          [catId]: (prev[catId] || []).map((p) => (p.id === updated.id ? updated : p)),
        }));
      }
    }
  }, [fetchTudo]);

  const handleExcluirPergunta = async (pergunta) => {
    setErroPergInline(null);
    setExcluindoPergs(true);
    try {
      await anamneseApi.deleteHabito(pergunta.id);
      const catId = pergunta.categoriaId;
      setPerguntasPorCat((prev) => ({
        ...prev,
        [catId]: (prev[catId] || []).filter((p) => p.id !== pergunta.id),
      }));
      setDeletandoPergId(null);
    } catch (err) {
      if (err.status === 409) {
        setDeletandoPergId(null);
        setDeletePergConflict(
          getApiErrorDetail(err) || 'Essa pergunta está em uso em uma ou mais fichas. Remova-a das fichas antes de excluir.'
        );
      } else {
        setErroPergInline({ id: pergunta.id, msg: err.message || 'Erro ao excluir.' });
      }
    } finally {
      setExcluindoPergs(false);
    }
  };

  const handleCreateSaved = useCallback(async (habito) => {
    setCreateForm({ open: false, preCategoriaId: null });
    if (habito?.categoriaId) {
      await refetchPerguntas(habito.categoriaId);
      // Garante que a categoria do item criado fique aberta
      setExpandidas((prev) => new Set([...prev, habito.categoriaId]));
    }
  }, [refetchPerguntas]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loadError && !loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400" />
        <p className="text-[14px] font-medium text-[#475569]">{loadError}</p>
        <button
          type="button"
          onClick={fetchTudo}
          className="px-4 py-2 rounded-xl font-bold text-[13px] bg-[#00a88e] text-white hover:bg-[#00967f]"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Modal editar pergunta */}
      {editandoPergunta && (
        <HabitoEditModal
          key={editandoPergunta.id}
          pergunta={editandoPergunta}
          categorias={categorias}
          tiposResposta={tiposResposta}
          onClose={() => setEditandoPergunta(null)}
          onSaved={handleEditSaved}
        />
      )}

      {/* Modal criar pergunta */}
      {createForm.open && (
        <CreateHabitoModal
          categorias={categorias}
          tiposResposta={tiposResposta}
          preCategoriaId={createForm.preCategoriaId}
          onClose={() => setCreateForm({ open: false, preCategoriaId: null })}
          onSaved={handleCreateSaved}
        />
      )}

      {/* Modal conflito delete pergunta */}
      {deletePergConflict && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md flex flex-col">
            <div className="px-6 py-4 border-b border-[#e2e8f0]">
              <h3 className="text-[16px] font-bold text-[#0f172a]">Não foi possível excluir</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-[14px] font-medium text-[#475569] leading-relaxed whitespace-pre-wrap">{deletePergConflict}</p>
            </div>
            <div className="px-6 pb-6 flex justify-end">
              <button
                type="button"
                onClick={() => setDeletePergConflict(null)}
                className="px-5 py-3 rounded-xl font-bold text-[14px] bg-[#00a88e] hover:bg-[#00967f] text-white shadow-md"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* ── Barra superior ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Busca */}
          <div className="relative flex-1 min-w-0 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00a88e]/60 pointer-events-none" strokeWidth={2.5} />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar perguntas ou categorias..."
              className="w-full pl-11 pr-4 py-2.5 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e]"
            />
          </div>

          {/* Toggle e botão nova categoria */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setModoTudoAberto((v) => !v)}
              className={`px-3.5 py-2 rounded-xl font-bold text-[12px] border transition-all ${
                modoTudoAberto
                  ? 'bg-[#00a88e]/10 text-[#0f766e] border-[#00a88e]/30'
                  : 'bg-white text-[#64748b] border-slate-200 hover:border-[#00a88e]/20'
              }`}
            >
              {modoTudoAberto ? 'Acordeão' : 'Tudo aberto'}
            </button>
            <button
              type="button"
              onClick={() => {
                setErroCategoria('');
                const el = document.getElementById('nova-cat-input');
                if (el) el.focus();
              }}
              className="px-4 py-2.5 rounded-xl font-bold text-[13px] bg-[#00a88e] hover:bg-[#00967f] text-white border border-transparent shadow-md flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              <span className="hidden sm:inline">Nova categoria</span>
              <span className="sm:hidden">Categoria</span>
            </button>
          </div>
        </div>

        {/* ── Form criar categoria ── */}
        <form onSubmit={handleCriarCategoria} className="flex flex-col sm:flex-row gap-2 items-start sm:items-end">
          <div className="flex-1 min-w-0 space-y-1">
            <label htmlFor="nova-cat-input" className="text-[12px] font-bold text-[#00a88e] ml-1">
              Nova categoria
            </label>
            <input
              id="nova-cat-input"
              type="text"
              value={novaCategoriaNome}
              onChange={(e) => { setNovaCategoriaNome(e.target.value); if (erroCategoria) setErroCategoria(''); }}
              placeholder="Ex.: Cardiológico, Estético..."
              className={`w-full px-4 py-2.5 bg-[#f8fbfb] border rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 ${
                erroCategoria ? 'border-red-400' : 'border-[#00a88e]/25 focus:border-[#00a88e]'
              }`}
            />
          </div>
          <button
            type="submit"
            disabled={criandoCategoria}
            className="shrink-0 px-4 py-2.5 rounded-xl font-bold text-[13px] bg-[#00a88e] hover:bg-[#00967f] text-white shadow-md disabled:opacity-60 flex items-center gap-1.5"
          >
            {criandoCategoria ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Criar
          </button>
        </form>
        {erroCategoria && (
          <p className="text-[13px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 -mt-2">
            {erroCategoria}
          </p>
        )}

        {/* ── Lista de grupos ── */}
        {loading ? (
          <ConfigCardStackSkeleton count={5} className="h-20" />
        ) : gruposFiltrados.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-[#94a3b8]">
            {termoBusca ? (
              <>
                <Search className="w-10 h-10 opacity-30" strokeWidth={2} />
                <p className="text-[14px] font-medium">Nenhum resultado para &ldquo;{busca}&rdquo;</p>
                <button type="button" onClick={() => setBusca('')} className="text-[13px] font-bold text-[#00a88e] hover:underline mt-1">
                  Limpar busca
                </button>
              </>
            ) : (
              <>
                <Tag className="w-10 h-10 opacity-30" />
                <p className="text-[14px] font-medium">Nenhuma categoria cadastrada</p>
                <p className="text-[12px] mt-0.5">Use o campo &ldquo;Nova categoria&rdquo; acima para começar</p>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {gruposFiltrados.map(({ cat, perguntas }) => {
              const aberta = isAberta(cat.id);
              const contagem = (perguntasPorCat[cat.id] || []).length;
              const isEditandoCat = editandoCatId === cat.id;
              const isDeletandoCat = deletandoCatId === cat.id;
              const catErro = erroCatInline?.id === cat.id ? erroCatInline.msg : null;

              return (
                <div key={cat.id} className="group rounded-2xl border border-app-border bg-white shadow-sm overflow-hidden">
                  {/* Cabeçalho da categoria */}
                  <div className="flex items-center gap-2 px-4 py-3 bg-[#f8fbfb] border-b border-app-border">
                    {isEditandoCat ? (
                      /* Modo edição inline da categoria */
                      <div className="flex flex-1 items-center gap-2 min-w-0">
                        <Tag className="w-4 h-4 text-[#00a88e] flex-shrink-0" strokeWidth={2} />
                        <input
                          ref={editCatRef}
                          type="text"
                          value={editandoCatNome}
                          onChange={(e) => setEditandoCatNome(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSalvarEdicaoCategoria(cat.id);
                            if (e.key === 'Escape') { setEditandoCatId(null); setErroCatInline(null); }
                          }}
                          className="flex-1 min-w-0 px-2 py-1 bg-white border-2 border-[#00a88e]/40 rounded-lg text-[13px] font-medium focus:ring-2 focus:ring-[#00a88e]/20 focus:border-[#00a88e] outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSalvarEdicaoCategoria(cat.id)}
                          disabled={salvandoCat || !editandoCatNome.trim()}
                          className="p-1.5 rounded-lg bg-[#00a88e] text-white hover:bg-[#00967f] disabled:opacity-50 flex-shrink-0"
                        >
                          {salvandoCat ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" strokeWidth={2.5} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditandoCatId(null); setErroCatInline(null); }}
                          className="p-1.5 rounded-lg bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0] flex-shrink-0"
                        >
                          <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                        </button>
                      </div>
                    ) : isDeletandoCat ? (
                      /* Confirmação de exclusão da categoria */
                      <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
                        <span className="text-[13px] font-bold text-[#0f172a] flex-1 min-w-0 break-words">
                          Remover &ldquo;{cat.nome}&rdquo;?
                        </span>
                        <button
                          type="button"
                          onClick={() => handleExcluirCategoria(cat.id)}
                          disabled={excluindoCat}
                          className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-[12px] font-bold hover:bg-red-600 disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
                        >
                          {excluindoCat ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => { setDeletandoCatId(null); setErroCatInline(null); }}
                          className="px-3 py-1.5 rounded-lg bg-[#f1f5f9] text-[#64748b] text-[12px] font-bold hover:bg-[#e2e8f0] flex-shrink-0"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      /* Cabeçalho normal */
                      <>
                        <button
                          type="button"
                          onClick={() => !modoTudoAberto && !termoBusca && toggleExpand(cat.id)}
                          className={`flex flex-1 items-center gap-2 min-w-0 text-left ${!modoTudoAberto && !termoBusca ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                          <Tag className="w-4 h-4 text-[#00a88e] flex-shrink-0" strokeWidth={2} />
                          <span className="flex-1 min-w-0 text-[14px] font-bold text-[#0f172a] truncate">{cat.nome}</span>
                          <span className="text-[12px] font-medium text-[#94a3b8] flex-shrink-0 mr-1">
                            {contagem} pergunta{contagem !== 1 ? 's' : ''}
                          </span>
                          {!modoTudoAberto && !termoBusca && (
                            aberta
                              ? <ChevronUp className="w-4 h-4 text-[#64748b] flex-shrink-0 transition-transform" strokeWidth={2} />
                              : <ChevronDown className="w-4 h-4 text-[#64748b] flex-shrink-0 transition-transform" strokeWidth={2} />
                          )}
                        </button>

                        {/* Ações da categoria */}
                        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 sm:opacity-100 md:opacity-0 md:group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => handleEditarCategoria(cat)}
                            title="Renomear categoria"
                            className="p-1.5 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#00a88e] transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            onClick={() => { setErroCatInline(null); setEditandoCatId(null); setDeletandoCatId(cat.id); }}
                            title="Excluir categoria"
                            className="p-1.5 rounded-lg text-[#64748b] hover:bg-red-50 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {catErro && (
                    <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-[12px] font-semibold text-red-600">
                      {catErro}
                    </div>
                  )}

                  {/* Perguntas */}
                  {aberta && (
                    <div className="divide-y divide-app-border/60">
                      {perguntas.length === 0 ? (
                        <div className="flex items-center gap-2 px-6 py-4 text-[#94a3b8]">
                          <HelpCircle className="w-4 h-4 opacity-40" />
                          <span className="text-[13px]">Nenhuma pergunta nesta categoria</span>
                        </div>
                      ) : (
                        perguntas.map((p) => {
                          const isDeleting = deletandoPergId === p.id;
                          const pergErro = erroPergInline?.id === p.id ? erroPergInline.msg : null;

                          return (
                            <div key={p.id} className="group px-4 sm:px-6 py-3">
                              {isDeleting ? (
                                /* Confirmação exclusão pergunta */
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[13px] font-bold text-[#0f172a] flex-1 min-w-0 break-words">
                                    Remover esta pergunta?
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleExcluirPergunta(p)}
                                    disabled={excluindoPergs}
                                    className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-[12px] font-bold hover:bg-red-600 disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
                                  >
                                    {excluindoPergs ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                    Confirmar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setDeletandoPergId(null); setErroPergInline(null); }}
                                    className="px-3 py-1.5 rounded-lg bg-[#f1f5f9] text-[#64748b] text-[12px] font-bold hover:bg-[#e2e8f0] flex-shrink-0"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-start gap-3 min-w-0">
                                  {/* Texto + badges */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[14px] font-medium text-[#0f172a] break-words [overflow-wrap:anywhere] leading-snug">
                                      {p.descricao}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                      <TipoBadge tipo={p.tipoResposta} />
                                      <PrioridadeBadge prioridade={p.prioridade || 'NORMAL'} />
                                    </div>
                                  </div>

                                  {/* Ações */}
                                  <div className="flex items-center gap-1 flex-shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                    <button
                                      type="button"
                                      onClick={() => setEditandoPergunta(p)}
                                      title="Editar pergunta"
                                      className="p-1.5 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#00a88e] transition-colors"
                                    >
                                      <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setErroPergInline(null); setDeletandoPergId(p.id); }}
                                      title="Excluir pergunta"
                                      className="p-1.5 rounded-lg text-[#64748b] hover:bg-red-50 hover:text-red-500 transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                                    </button>
                                  </div>
                                </div>
                              )}

                              {pergErro && (
                                <p className="mt-2 text-[12px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                  {pergErro}
                                </p>
                              )}
                            </div>
                          );
                        })
                      )}

                      {/* Botão adicionar pergunta nesta categoria */}
                      <div className="px-4 sm:px-6 py-2.5">
                        <button
                          type="button"
                          onClick={() => setCreateForm({ open: true, preCategoriaId: cat.id })}
                          className="flex items-center gap-1.5 text-[12px] font-bold text-[#00a88e] hover:text-[#00967f] hover:underline"
                        >
                          <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                          Adicionar pergunta em {cat.nome}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Botão flutuante nova pergunta sem categoria específica */}
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={() => setCreateForm({ open: true, preCategoriaId: null })}
            className="px-4 py-2.5 rounded-xl font-bold text-[13px] bg-white border border-slate-200 text-[#64748b] hover:border-[#00a88e]/30 hover:text-[#00a88e] flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            Nova pergunta
          </button>
        </div>
      </div>
    </>
  );
}
