import React, { useState, useMemo } from 'react';
import { Search, Loader2, Stethoscope, Trash2 } from 'lucide-react';
import { useBancoProcedimentos } from '../../hooks/useBancoProcedimentos';
import { ProcedimentoCard } from './ProcedimentoCard';
import { usePapel } from '../../hooks/usePapel';

export function BancoProcedimentosPanel() {
  const { isAdmin } = usePapel();
  const { loading, error, catalogo, vinculos, vincular, desvincular } = useBancoProcedimentos();

  const [busca, setBusca] = useState('');
  const [tab, setTab] = useState('catalogo'); // 'catalogo' ou 'meu_banco'
  const [confirmModal, setConfirmModal] = useState({ open: false, vinculoId: null, nome: '' });
  const [actionLoading, setActionLoading] = useState({}); // { [id]: true }

  const handleVincular = async (id) => {
    if (!isAdmin) return;
    setActionLoading(prev => ({ ...prev, [id]: true }));
    await vincular(id);
    setActionLoading(prev => ({ ...prev, [id]: false }));
  };

  const handleDesvincular = async (vinculoId) => {
    if (!isAdmin) return;
    setActionLoading(prev => ({ ...prev, [vinculoId]: true }));
    await desvincular(vinculoId);
    setActionLoading(prev => ({ ...prev, [vinculoId]: false }));
    setConfirmModal({ open: false, vinculoId: null, nome: '' });
  };

  const openConfirmModal = (vinculoId, nome) => {
    setConfirmModal({ open: true, vinculoId, nome });
  };

  const closeConfirmModal = () => {
    setConfirmModal({ open: false, vinculoId: null, nome: '' });
  };

  // Filtros
  const catalogoFiltrado = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return catalogo.filter(p =>
      p.nome.toLowerCase().includes(q) || (p.descricao && p.descricao.toLowerCase().includes(q))
    );
  }, [catalogo, busca]);

  const vinculosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return vinculos.filter(v =>
      v.nome.toLowerCase().includes(q) || (v.descricao && v.descricao.toLowerCase().includes(q))
    );
  }, [vinculos, busca]);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-[#e2e8f0] bg-[#f8fafc]">
        <Loader2 className="h-9 w-9 animate-spin text-[#00a88e]" aria-hidden />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-5 text-center">
        <p className="text-[14px] font-semibold text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {!isAdmin && (
        <div
          role="status"
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] font-medium text-slate-600"
        >
          Você não tem permissão para editar o banco de procedimentos. Entre em contato com um administrador.
        </div>
      )}

      {/* Barra de Busca */}
      <div className="shrink-0 rounded-2xl border border-app-border bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00a88e]/60" strokeWidth={2.5} aria-hidden />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar procedimentos por nome ou descrição..."
            className="w-full rounded-xl border border-slate-200 bg-[#f8fbfb] py-3 pl-11 pr-4 text-[14px] font-medium outline-none focus:border-[#00a88e] focus:ring-4 focus:ring-[#00a88e]/20"
          />
        </div>
      </div>

      {/* Tabs (Apenas Mobile) */}
      <div className="flex rounded-lg bg-[#f1f5f9] p-1 md:hidden">
        <button
          type="button"
          onClick={() => setTab('catalogo')}
          className={`flex-1 rounded-md py-2 text-[13px] font-bold transition-colors ${tab === 'catalogo' ? 'bg-white text-[#0f172a] shadow-sm' : 'text-[#64748b]'}`}
        >
          Disponíveis ({catalogoFiltrado.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('meu_banco')}
          className={`flex-1 rounded-md py-2 text-[13px] font-bold transition-colors ${tab === 'meu_banco' ? 'bg-white text-[#0f172a] shadow-sm' : 'text-[#64748b]'}`}
        >
          Meus Procedimentos ({vinculosFiltrados.length})
        </button>
      </div>

      {/* Grid de Conteúdo */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Coluna Esquerda: Catálogo (Visível no Desktop ou se tab for 'catalogo') */}
        <div className={`${tab !== 'catalogo' ? 'hidden md:block' : ''} space-y-4`}>
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-bold text-[#0f172a]">Catálogo Geral</h2>
            <span className="text-[12px] font-medium text-[#64748b]">
              {catalogoFiltrado.length} disponíveis
            </span>
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-3">
            {catalogoFiltrado.map(proc => {
              const vinculo = vinculos.find(v => v.catalogoProcedimentoId === proc.id);
              const isLinked = !!vinculo;
              return (
                <ProcedimentoCard
                  key={proc.id}
                  procedimento={proc}
                  isVinculado={isLinked}
                  onVincular={() => handleVincular(proc.id)}
                  onDesvincular={() => vinculo && openConfirmModal(vinculo.id, proc.nome)}
                  loading={actionLoading[proc.id] || (vinculo && actionLoading[vinculo.id]) || false}
                />
              );
            })}
          </div>

          {catalogoFiltrado.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#cbd5e1] p-8 text-center text-[#94a3b8]">
              <Search className="h-10 w-10 opacity-30" />
              <p className="text-[14px] font-medium">Nenhum procedimento encontrado no catálogo.</p>
            </div>
          )}
        </div>

        {/* Coluna Direita: Meu Banco (Visível no Desktop ou se tab for 'meu_banco') */}
        <div className={`${tab !== 'meu_banco' ? 'hidden md:block' : ''} space-y-4`}>
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-bold text-[#0f172a]">Procedimentos da Clínica</h2>
            <span className="text-[12px] font-medium text-[#64748b]">
              {vinculosFiltrados.length} selecionados
            </span>
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-3">
            {vinculosFiltrados.map(v => (
              <ProcedimentoCard
                key={v.id}
                procedimento={{
                  id: v.catalogoProcedimentoId,
                  nome: v.nome,
                  tipoCodigo: v.tipoCodigo,
                  descricao: v.descricao
                }}
                isVinculado={true}
                onDesvincular={() => openConfirmModal(v.id, v.nome)}
                loading={actionLoading[v.id] || false}
              />
            ))}
          </div>

          {vinculosFiltrados.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#cbd5e1] p-8 text-center text-[#94a3b8]">
              <Stethoscope className="h-10 w-10 opacity-30" />
              <p className="text-[14px] font-medium">Nenhum procedimento vinculado.</p>
              {isAdmin && <p className="text-[12px]">Adicione procedimentos do catálogo ao lado.</p>}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Confirmação */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-[16px] font-bold text-[#0f172a]">Confirmar Remoção</h3>
            <p className="mt-2 text-[14px] font-medium text-[#64748b]">
              Confirma remover <span className="font-bold text-[#0f172a]">&ldquo;{confirmModal.nome}&rdquo;</span> do seu banco?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeConfirmModal}
                className="rounded-lg bg-[#f1f5f9] px-4 py-2 text-[13px] font-bold text-[#64748b] hover:bg-[#e2e8f0] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDesvincular(confirmModal.vinculoId)}
                className="rounded-lg bg-red-500 px-4 py-2 text-[13px] font-bold text-white hover:bg-red-600 transition-colors"
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
