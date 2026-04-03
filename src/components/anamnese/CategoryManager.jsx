import React, { useState, useEffect } from 'react';
import { Plus, Tag, Loader2 } from 'lucide-react';
import { anamneseApi } from '../../services/api';

export function CategoryManager() {
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [novoNome, setNovoNome] = useState('');
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState('');

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

  const handleCriar = async (e) => {
    e.preventDefault();
    const nome = novoNome.trim();
    if (!nome) return;
    setErro('');
    setCriando(true);
    try {
      await anamneseApi.createCategoria({ nome });
      setNovoNome('');
      await fetchCategorias();
    } catch (err) {
      setErro(err.message || 'Erro ao criar categoria.');
    } finally {
      setCriando(false);
    }
  };

  return (
    <div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-[minmax(260px,34%)_minmax(0,1fr)] lg:gap-6 xl:gap-8 2xl:gap-10 lg:min-h-[min(62vh,520px)] lg:items-stretch">
      <div className="min-w-0 w-full flex flex-col justify-start lg:h-full lg:min-h-0 lg:rounded-2xl lg:border-[3px] lg:border-[#00a88e]/10 lg:bg-white lg:p-5 xl:p-6">
        <div className="space-y-4 flex flex-col flex-1 min-h-0">
          <form onSubmit={handleCriar} className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 space-y-1.5 min-w-0">
              <label className="text-[13px] font-bold text-[#00a88e] ml-1">Nova Categoria</label>
              <input
                type="text"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex: Cardiológico, Estético, Medicamentos..."
                className="w-full px-4 py-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e] lg:bg-white"
              />
            </div>
            <button
              type="submit"
              disabled={criando || !novoNome.trim()}
              className="w-full sm:w-auto shrink-0 px-5 py-3 rounded-xl font-bold text-[14px] transition-all shadow-md bg-[#00a88e] hover:bg-[#00967f] text-white border-[3px] border-transparent disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {criando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" strokeWidth={2.5} />}
              Criar
            </button>
          </form>

          {erro && (
            <div className="bg-red-50 text-red-600 border-[3px] border-red-200 rounded-xl p-3 text-[13px] font-bold">
              {erro}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col min-h-[12rem] min-w-0 w-full rounded-2xl border-[3px] border-[#00a88e]/10 bg-[#f8fbfb]/80 p-4 sm:p-5 xl:p-6 lg:h-full lg:min-h-0">
        {loading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-2 py-8 text-center min-h-[11rem] lg:min-h-0">
            <Loader2 className="w-6 h-6 animate-spin text-[#00a88e]" />
            <span className="text-[#64748b] text-[13px] font-medium">Carregando categorias...</span>
          </div>
        ) : categorias.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center text-[#94a3b8] min-h-[11rem] lg:min-h-0">
            <Tag className="w-10 h-10 opacity-30 shrink-0" />
            <p className="text-[14px] font-medium max-w-[280px]">Nenhuma categoria cadastrada</p>
            <p className="text-[12px] mt-0.5 lg:hidden max-w-[260px]">Crie a primeira categoria acima</p>
            <p className="text-[12px] mt-0.5 hidden lg:block max-w-[280px]">Crie a primeira categoria no formulário ao lado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3 w-full content-start flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            {categorias.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between p-4 rounded-xl border-[3px] border-[#00a88e]/15 bg-white hover:border-[#00a88e]/30 transition-all shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Tag className="w-5 h-5 text-[#00a88e] flex-shrink-0" strokeWidth={2} />
                  <span className="text-[14px] font-bold text-[#0f172a] truncate">{cat.nome}</span>
                </div>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border-[2px] flex-shrink-0 ml-2 ${
                  cat.ativo !== false
                    ? 'bg-[#dcfce7] text-[#16a34a] border-[#22c55e]/20'
                    : 'bg-red-50 text-red-600 border-red-200'
                }`}>
                  {cat.ativo !== false ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
