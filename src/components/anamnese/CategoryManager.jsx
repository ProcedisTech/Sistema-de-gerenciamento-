import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Tag, Loader2, Pencil, Trash2, Check, X, Search, ChevronRight } from 'lucide-react';
import { anamneseApi, getApiErrorDetail } from '../../services/api';

export function CategoryManager({ onVerPerguntas }) {
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState('');

  // edit state
  const [editingId, setEditingId] = useState(null);
  const [editingNome, setEditingNome] = useState('');
  const [salvando, setSalvando] = useState(false);

  // delete state
  const [deletingId, setDeletingId] = useState(null);
  const [excluindo, setExcluindo] = useState(false);

  // per-card inline error: { id, msg }
  const [erroInline, setErroInline] = useState(null);

  const editInputRef = useRef(null);

  const fetchCategorias = async () => {
    setLoading(true);
    try {
      const data = await anamneseApi.listCategorias();
      setCategorias(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Erro ao buscar categorias:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCategorias(); }, []);

  useEffect(() => {
    if (editingId && editInputRef.current) editInputRef.current.focus();
  }, [editingId]);

  const categoriasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return categorias;
    return categorias.filter((c) => c.nome.toLowerCase().includes(q));
  }, [categorias, busca]);

  const handleCriar = async (e) => {
    e.preventDefault();
    const nome = novoNome.trim();
    if (!nome) {
      setErro('Você precisa digitar um nome da categoria.');
      return;
    }
    setErro('');
    setCriando(true);
    try {
      await anamneseApi.createCategoria({ nome });
      setNovoNome('');
      await fetchCategorias();
    } catch (err) {
      if (err.status === 409) {
        setErro(getApiErrorDetail(err) || 'Já existe uma categoria com esse nome.');
      } else {
        setErro(getApiErrorDetail(err) || err.message || 'Erro ao criar categoria.');
      }
    } finally {
      setCriando(false);
    }
  };

  const handleEditar = (cat) => {
    setErroInline(null);
    setDeletingId(null);
    setEditingId(cat.id);
    setEditingNome(cat.nome);
  };

  const handleCancelarEdicao = () => {
    setEditingId(null);
    setEditingNome('');
    setErroInline(null);
  };

  const handleSalvarEdicao = async (id) => {
    const nome = editingNome.trim();
    if (!nome) return;
    setErroInline(null);
    setSalvando(true);
    try {
      const updated = await anamneseApi.updateCategoria(id, { nome });
      setCategorias((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setEditingId(null);
      setEditingNome('');
    } catch (err) {
      if (err.status === 409) {
        setErroInline({
          id,
          msg: getApiErrorDetail(err) || err.message || 'Já existe uma categoria com esse nome.',
        });
      } else if (err.status === 404) {
        setEditingId(null);
        setEditingNome('');
        await fetchCategorias();
      } else {
        setErroInline({ id, msg: err.message || 'Erro ao salvar.' });
      }
    } finally {
      setSalvando(false);
    }
  };

  const handleConfirmarExclusao = (id) => {
    setErroInline(null);
    setEditingId(null);
    setDeletingId(id);
  };

  const handleCancelarExclusao = () => {
    setDeletingId(null);
    setErroInline(null);
  };

  const handleExcluir = async (id) => {
    setErroInline(null);
    setExcluindo(true);
    try {
      await anamneseApi.deleteCategoria(id);
      setCategorias((prev) => prev.filter((c) => c.id !== id));
      setDeletingId(null);
    } catch (err) {
      if (err.status === 409) {
        setErroInline({ id, msg: 'Esta categoria ainda tem hábitos ativos — remova-os primeiro.' });
      } else {
        setErroInline({ id, msg: err.message || 'Erro ao excluir.' });
      }
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 xl:gap-5">
      {/* Barra superior: buscar + criar */}
      <div className="shrink-0 rounded-2xl border-[3px] border-[#00a88e]/10 bg-white p-3 sm:p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-4">
          <div className="flex-1 min-w-0 space-y-1.5">
            <label htmlFor="category-search" className="text-[13px] font-bold text-[#00a88e] ml-1">
              Buscar categoria
            </label>
            <div className="relative">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00a88e]/60 pointer-events-none"
                strokeWidth={2.5}
              />
              <input
                id="category-search"
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Digite para filtrar a lista..."
                className="w-full pl-11 pr-4 py-2.5 sm:py-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/20 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e]"
                autoComplete="off"
              />
            </div>
          </div>

          <form onSubmit={handleCriar} className="flex flex-col sm:flex-row sm:items-end gap-2 lg:gap-3 flex-1 min-w-0 lg:max-w-xl xl:max-w-2xl">
            <div className="flex-1 space-y-1.5 min-w-0">
              <label htmlFor="category-new-name" className="text-[13px] font-bold text-[#00a88e] ml-1">
                Nova categoria
              </label>
              <input
                id="category-new-name"
                type="text"
                value={novoNome}
                onChange={(e) => { setNovoNome(e.target.value); if (erro) setErro(''); }}
                placeholder="Ex.: Cardiológico, Estético..."
                className={`w-full px-4 py-2.5 sm:py-3 bg-[#f8fbfb] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 ${erro ? 'border-red-400 focus:border-red-500' : 'border-[#00a88e]/25 focus:border-[#00a88e]'}`}
              />
            </div>
            <button
              type="submit"
              disabled={criando}
              className="w-full sm:w-auto shrink-0 px-5 py-2.5 sm:py-3 rounded-xl font-bold text-[14px] transition-all shadow-md bg-[#00a88e] hover:bg-[#00967f] text-white border-[3px] border-transparent disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {criando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" strokeWidth={2.5} />}
              Criar
            </button>
          </form>
        </div>

        {erro && (
          <div className="mt-3 bg-red-50 text-red-600 border-[3px] border-red-200 rounded-xl p-3 text-[13px] font-bold">
            {erro}
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="flex flex-col min-w-0 w-full rounded-2xl border-[3px] border-[#00a88e]/10 bg-[#f8fbfb]/80 p-4 sm:p-5 xl:p-6">
        {loading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-2 py-8 text-center min-h-[12rem]">
            <Loader2 className="w-6 h-6 animate-spin text-[#00a88e]" />
            <span className="text-[#64748b] text-[13px] font-medium">Carregando categorias...</span>
          </div>
        ) : categorias.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center text-[#94a3b8] min-h-[12rem]">
            <Tag className="w-10 h-10 opacity-30 shrink-0" />
            <p className="text-[14px] font-medium max-w-[280px]">Nenhuma categoria cadastrada</p>
            <p className="text-[12px] mt-0.5 max-w-[320px]">Use o campo &ldquo;Nova categoria&rdquo; acima para criar a primeira</p>
          </div>
        ) : categoriasFiltradas.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center text-[#94a3b8] min-h-[12rem]">
            <Search className="w-10 h-10 opacity-30 shrink-0" strokeWidth={2} />
            <p className="text-[14px] font-medium max-w-[280px]">Nenhuma categoria coincide com a busca</p>
            <button
              type="button"
              onClick={() => setBusca('')}
              className="text-[13px] font-bold text-[#00a88e] hover:underline mt-1"
            >
              Limpar filtro
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-3 w-full content-start min-w-0">
            {categoriasFiltradas.map((cat) => {
              const isEditing = editingId === cat.id;
              const isDeleting = deletingId === cat.id;
              const cardErro = erroInline?.id === cat.id ? erroInline.msg : null;

              return (
                <div
                  key={cat.id}
                  className="flex flex-col gap-2 p-3.5 sm:p-4 rounded-xl border-[3px] border-[#00a88e]/15 bg-white hover:border-[#00a88e]/30 transition-all shadow-sm min-w-[min(100%,14rem)]"
                >
                  {isEditing ? (
                    /* ── Edit mode ── */
                    <div className="flex flex-wrap items-center gap-2 w-full min-w-0">
                      <Tag className="w-5 h-5 text-[#00a88e] flex-shrink-0" strokeWidth={2} />
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editingNome}
                        onChange={(e) => setEditingNome(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSalvarEdicao(cat.id);
                          if (e.key === 'Escape') handleCancelarEdicao();
                        }}
                        className="flex-1 min-w-0 px-2 py-1 bg-[#f8fbfb] border-[2px] border-[#00a88e]/40 rounded-lg text-[13px] font-medium focus:ring-2 focus:ring-[#00a88e]/20 focus:border-[#00a88e] outline-none"
                      />
                      <button
                        onClick={() => handleSalvarEdicao(cat.id)}
                        disabled={salvando || !editingNome.trim()}
                        title="Salvar"
                        className="p-1.5 rounded-lg bg-[#00a88e] text-white hover:bg-[#00967f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                      >
                        {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" strokeWidth={2.5} />}
                      </button>
                      <button
                        onClick={handleCancelarEdicao}
                        title="Cancelar"
                        className="p-1.5 rounded-lg bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0] transition-colors flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                      </button>
                    </div>
                  ) : isDeleting ? (
                    /* ── Delete confirmation ── */
                    <div className="flex flex-col gap-2.5 w-full min-w-0 xl:flex-row xl:items-center xl:flex-wrap xl:gap-2">
                      <span className="text-[13px] font-bold text-[#0f172a] w-full min-w-0 break-words leading-snug xl:flex-1">
                        Remover &ldquo;{cat.nome}&rdquo;?
                      </span>
                      <div className="flex flex-row flex-wrap gap-2 w-full xl:w-auto xl:flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleExcluir(cat.id)}
                          disabled={excluindo}
                          className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-[12px] font-bold hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 flex-shrink-0"
                        >
                          {excluindo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" strokeWidth={2.5} />}
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelarExclusao}
                          className="px-3 py-1.5 rounded-lg bg-[#f1f5f9] text-[#64748b] text-[12px] font-bold hover:bg-[#e2e8f0] transition-colors flex-shrink-0"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Normal view ── */
                    <div className="flex flex-col gap-2 w-full min-w-0 xl:flex-row xl:items-center xl:justify-between xl:gap-2">
                      {typeof onVerPerguntas === 'function' ? (
                        <button
                          type="button"
                          onClick={() => onVerPerguntas(cat.id)}
                          className="flex items-start gap-2.5 min-w-0 flex-1 xl:items-center xl:gap-3 text-left rounded-xl -m-1 p-1 hover:bg-[#f0fdfa]/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00a88e]/40 transition-colors"
                        >
                          <Tag className="w-5 h-5 text-[#00a88e] flex-shrink-0 mt-0.5 md:mt-0" strokeWidth={2} />
                          <span className="min-w-0 flex-1 flex flex-col gap-0.5">
                            <span title={cat.nome} className="text-[15px] md:text-[14px] font-bold text-[#0f172a] break-words leading-snug">
                              {cat.nome}
                            </span>
                            <span className="text-[11px] font-bold text-[#00a88e]/80 flex items-center gap-0.5">
                              Ver perguntas
                              <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2.5} aria-hidden />
                            </span>
                          </span>
                        </button>
                      ) : (
                        <div className="flex items-start gap-2.5 min-w-0 flex-1 xl:items-center xl:gap-3">
                          <Tag className="w-5 h-5 text-[#00a88e] flex-shrink-0 mt-0.5 md:mt-0" strokeWidth={2} />
                          <span title={cat.nome} className="text-[15px] md:text-[14px] font-bold text-[#0f172a] min-w-0 flex-1 break-words leading-snug">
                            {cat.nome}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-end gap-1.5 flex-shrink-0 w-full xl:w-auto xl:ml-2 pt-0.5 xl:pt-0 border-t border-[#00a88e]/10 xl:border-0">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleEditar(cat); }}
                          title="Editar"
                          className="p-1.5 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#00a88e] transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleConfirmarExclusao(cat.id); }}
                          title="Excluir"
                          className="p-1.5 rounded-lg text-[#64748b] hover:bg-red-50 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Per-card inline error */}
                  {cardErro && (
                    <div className="text-[12px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      {cardErro}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
