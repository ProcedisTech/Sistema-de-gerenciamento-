import React, { useState, useMemo, useCallback } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { useBancoProcedimentos } from '../../hooks/useBancoProcedimentos';
import { usePapel } from '../../hooks/usePapel';
import { Switch } from '../shared/Switch';

const FILTROS = [
  { id: 'todos', label: 'Todos' },
  { id: 'facial', label: 'Facial' },
  { id: 'corporal', label: 'Corporal' },
  { id: 'ativos', label: 'Só ativos' },
];

function getCategoriaBadgeClass(tipoCodigo) {
  if (tipoCodigo === 'estetico_facial') return 'bg-violet-100 text-violet-700';
  if (tipoCodigo === 'estetico_corporal') return 'bg-blue-100 text-blue-700';
  return 'bg-slate-100 text-slate-700';
}

function getCategoriaLabel(proc) {
  return proc.tipoNome ?? proc.tipoCodigo ?? 'Procedimento';
}

function StatusToggle({ proc, vinculo, isLinked, isAdmin, loading, onToggle }) {
  const statusLabel = isLinked ? 'Oferece' : 'Não oferece';

  return (
    <div className="flex items-center justify-end gap-2.5 md:justify-start">
      <Switch
        checked={isLinked}
        onChange={() => onToggle(proc, vinculo, isLinked)}
        disabled={!isAdmin}
        loading={loading}
        ariaLabel={`${statusLabel}: ${proc.nome}`}
      />
      <span
        className={`text-[13px] font-semibold ${isLinked ? 'text-[#00a88e]' : 'text-[#64748b]'}`}
      >
        {statusLabel}
      </span>
    </div>
  );
}

function CategoriaBadge({ proc }) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${getCategoriaBadgeClass(proc.tipoCodigo)}`}
    >
      {getCategoriaLabel(proc)}
    </span>
  );
}

export function BancoProcedimentosPanel() {
  const { isAdmin } = usePapel();
  const { loading, error, catalogo, vinculos, vincular, desvincular } = useBancoProcedimentos();

  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [actionLoading, setActionLoading] = useState({});

  const vinculosPorCatalogoId = useMemo(() => {
    const map = new Map();
    for (const v of vinculos) {
      if (v.catalogoProcedimentoId) {
        map.set(v.catalogoProcedimentoId, v);
      }
    }
    return map;
  }, [vinculos]);

  const itensFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let items = catalogo;

    if (q) {
      items = items.filter(
        (p) =>
          p.nome.toLowerCase().includes(q) ||
          (p.descricao && p.descricao.toLowerCase().includes(q))
      );
    }

    if (filtro === 'facial') {
      items = items.filter((p) => p.tipoCodigo === 'estetico_facial');
    } else if (filtro === 'corporal') {
      items = items.filter((p) => p.tipoCodigo === 'estetico_corporal');
    } else if (filtro === 'ativos') {
      items = items.filter((p) => vinculosPorCatalogoId.has(p.id));
    }

    return items;
  }, [catalogo, busca, filtro, vinculosPorCatalogoId]);

  const handleToggle = useCallback(
    async (proc, vinculo, isLinked) => {
      if (!isAdmin) return;

      setActionLoading((prev) => ({ ...prev, [proc.id]: true }));

      if (isLinked && vinculo) {
        await desvincular(vinculo.id);
      } else {
        await vincular(proc.id);
      }

      setActionLoading((prev) => ({ ...prev, [proc.id]: false }));
    },
    [isAdmin, vincular, desvincular]
  );

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

  const totalAtivos = vinculos.length;
  const totalCatalogo = catalogo.length;

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

      <div className="shrink-0 rounded-2xl border border-app-border bg-white p-4 shadow-sm">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00a88e]/60"
            strokeWidth={2.5}
            aria-hidden
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar procedimentos por nome ou descrição..."
            className="w-full rounded-xl border border-slate-200 bg-[#f8fbfb] py-3 pl-11 pr-4 text-[14px] font-medium outline-none focus:border-[#00a88e] focus:ring-4 focus:ring-[#00a88e]/20"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTROS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setFiltro(id)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors ${
                filtro === id
                  ? 'bg-[#00a88e] text-white shadow-sm'
                  : 'border border-[#e2e8f0] bg-white text-[#64748b] hover:border-[#00a88e]/30 hover:text-[#0f172a]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[13px] font-semibold text-[#64748b]">
          <span className="text-[#00a88e]">{totalAtivos}</span> de {totalCatalogo} ativos
        </p>
      </div>

      {itensFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#cbd5e1] p-8 text-center text-[#94a3b8]">
          <Search className="h-10 w-10 opacity-30" />
          <p className="text-[14px] font-medium">Nenhum procedimento encontrado.</p>
        </div>
      ) : (
        <>
          {/* Desktop: tabela */}
          <div className="hidden overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
                    Procedimento
                  </th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
                    Categoria
                  </th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
                    Status na Clínica
                  </th>
                </tr>
              </thead>
              <tbody>
                {itensFiltrados.map((proc) => {
                  const vinculo = vinculosPorCatalogoId.get(proc.id);
                  const isLinked = !!vinculo;
                  const itemLoading = !!actionLoading[proc.id];

                  return (
                    <tr
                      key={proc.id}
                      className="border-b border-[#e2e8f0] last:border-b-0 transition-colors hover:bg-[#f8fafc]/80"
                    >
                      <td className="px-5 py-4">
                        <p className="text-[14px] font-bold text-[#0f172a]">{proc.nome}</p>
                        <p className="mt-0.5 text-[13px] font-medium text-[#64748b] line-clamp-2">
                          {proc.descricao || 'Sem descrição.'}
                        </p>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <CategoriaBadge proc={proc} />
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <StatusToggle
                          proc={proc}
                          vinculo={vinculo}
                          isLinked={isLinked}
                          isAdmin={isAdmin}
                          loading={itemLoading}
                          onToggle={handleToggle}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards empilhados */}
          <div className="flex flex-col gap-3 md:hidden">
            {itensFiltrados.map((proc) => {
              const vinculo = vinculosPorCatalogoId.get(proc.id);
              const isLinked = !!vinculo;
              const itemLoading = !!actionLoading[proc.id];

              return (
                <div
                  key={proc.id}
                  className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-bold text-[#0f172a]">{proc.nome}</p>
                      <p className="mt-0.5 text-[13px] font-medium text-[#64748b] line-clamp-2">
                        {proc.descricao || 'Sem descrição.'}
                      </p>
                    </div>
                    <CategoriaBadge proc={proc} />
                  </div>
                  <div className="mt-3 border-t border-[#e2e8f0] pt-3">
                    <StatusToggle
                      proc={proc}
                      vinculo={vinculo}
                      isLinked={isLinked}
                      isAdmin={isAdmin}
                      loading={itemLoading}
                      onToggle={handleToggle}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
