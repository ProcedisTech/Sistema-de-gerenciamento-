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
    <div className="space-y-6">
      <form onSubmit={handleCriar} className="flex items-end gap-3">
        <div className="flex-1 space-y-1.5">
          <label className="text-[13px] font-bold text-[#00a88e] ml-1">Nova Categoria</label>
          <input
            type="text"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder="Ex: Cardiológico, Estético, Medicamentos..."
            className="w-full px-4 py-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e]"
          />
        </div>
        <button
          type="submit"
          disabled={criando || !novoNome.trim()}
          className="px-5 py-3 rounded-xl font-bold text-[14px] transition-all shadow-md bg-[#00a88e] hover:bg-[#00967f] text-white border-[3px] border-transparent disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
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

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#00a88e]" />
          <span className="ml-2 text-[#64748b] text-[13px] font-medium">Carregando categorias...</span>
        </div>
      ) : categorias.length === 0 ? (
        <div className="text-center py-12 text-[#94a3b8]">
          <Tag className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-[14px] font-medium">Nenhuma categoria cadastrada</p>
          <p className="text-[12px] mt-1">Crie a primeira categoria acima</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categorias.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center justify-between p-4 rounded-xl border-[3px] border-[#00a88e]/15 bg-[#f8fbfb] hover:border-[#00a88e]/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <Tag className="w-5 h-5 text-[#00a88e]" strokeWidth={2} />
                <span className="text-[14px] font-bold text-[#0f172a]">{cat.nome}</span>
              </div>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border-[2px] ${
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
  );
}
