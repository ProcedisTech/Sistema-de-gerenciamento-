import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Plus, ArrowDownCircle, ArrowUpCircle, Edit3, Package, AlertTriangle, Loader2, Archive } from 'lucide-react';
import { estoqueApi } from '../../services/api';
import { ItemFormModal } from './ItemFormModal';
import { LoteFormModal } from './LoteFormModal';
import { EntradaEstoqueModal } from './EntradaEstoqueModal';
import { BaixaEstoqueModal } from './BaixaEstoqueModal';

function getRowStatus(lote, item) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  if (!lote) return { level: 'critico', label: 'Sem lote', dias: null };

  const saldo = lote.saldoAtual || 0;
  let dias = null;
  if (lote.dataValidade) {
    const val = new Date(lote.dataValidade + 'T00:00:00');
    dias = Math.ceil((val - hoje) / 86400000);
  }

  if (dias !== null && dias < 0) return { level: 'critico', label: 'Vencido', dias };
  if (saldo <= 0) return { level: 'critico', label: 'Zerado', dias };
  if (item.estoqueMinimo > 0 && saldo < item.estoqueMinimo) return { level: 'critico', label: 'Baixo', dias };
  if (dias !== null && dias <= 30) return { level: 'critico', label: `${dias}d`, dias };
  if (dias !== null && dias <= 60) return { level: 'atencao', label: `${dias}d`, dias };
  return { level: 'normal', label: dias !== null ? `${dias}d` : 'OK', dias };
}

const STATUS_STYLES = {
  critico: 'bg-red-100 text-red-700 border-red-200',
  atencao: 'bg-amber-100 text-amber-700 border-amber-200',
  normal: 'bg-green-100 text-green-700 border-green-200',
};

const FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'critico', label: 'Crítico' },
  { key: 'atencao', label: 'Atenção' },
  { key: 'normal', label: 'Normal' },
];

function StockBar({ saldo, minimo }) {
  if (!minimo || minimo <= 0) return null;
  const ratio = Math.min(saldo / minimo, 2);
  const pct = Math.max(Math.round(ratio * 50), 2);
  const color = ratio < 1 ? 'bg-red-400' : ratio < 1.5 ? 'bg-amber-400' : 'bg-[#22c55e]';
  return (
    <div className="w-full h-1.5 bg-[#e2e8f0] rounded-full mt-1.5 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function InventoryRow({ row, onEditItem, onEditLote }) {
  const { item, lote } = row;
  const status = getRowStatus(lote, item);
  const saldo = lote?.saldoAtual ?? 0;

  return (
    <div className="grid grid-cols-[1fr] md:grid-cols-[2.2fr_1.2fr_1fr_0.8fr_1.1fr_auto] gap-x-3 gap-y-1 px-4 py-3 border-b-[2px] border-[#f1f5f9] hover:bg-[#f8fbfb] transition-colors items-center">
      {/* Produto */}
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
          item.ativo === false ? 'bg-slate-100 text-slate-400' : 'bg-[#e6f7f5] text-[#00a88e]'
        }`}>
          <Package className="w-4 h-4" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[13px] font-bold leading-tight ${item.ativo === false ? 'text-slate-400 line-through' : 'text-[#0f172a]'}`}>{item.nome}</span>
            {item.codigoInterno && (
              <span className="text-[10px] font-bold text-[#94a3b8] bg-[#f1f5f9] px-1.5 py-0.5 rounded">{item.codigoInterno}</span>
            )}
          </div>
          <div className="text-[11px] text-[#94a3b8] font-medium">{item.unidadeMedida || 'un'}</div>
        </div>
      </div>

      {/* Lote */}
      <div className="md:text-left">
        <span className="md:hidden text-[11px] text-[#94a3b8] font-bold mr-1">Lote:</span>
        <span className="text-[13px] font-bold text-[#334155]">{lote?.numeroLote || '—'}</span>
      </div>

      {/* Validade */}
      <div className="md:text-left">
        <span className="md:hidden text-[11px] text-[#94a3b8] font-bold mr-1">Val:</span>
        <span className="text-[13px] text-[#475569] font-medium">{lote?.dataValidade || '—'}</span>
      </div>

      {/* Quantidade */}
      <div>
        <span className="md:hidden text-[11px] text-[#94a3b8] font-bold mr-1">Qtd:</span>
        <span className={`text-[15px] font-extrabold ${
          saldo <= 0 ? 'text-red-500'
          : item.estoqueMinimo > 0 && saldo < item.estoqueMinimo ? 'text-amber-600'
          : 'text-[#0f172a]'
        }`}>{saldo}</span>
        <StockBar saldo={saldo} minimo={item.estoqueMinimo} />
      </div>

      {/* Status */}
      <div className="flex items-center gap-2">
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLES[status.level]}`}>
          {status.label}
        </span>
        {status.level === 'critico' && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" strokeWidth={2.5} />}
      </div>

      {/* Ações */}
      <div className="flex items-center gap-1 justify-end">
        <button type="button" onClick={() => onEditItem(item)} title="Editar produto" className="p-1.5 rounded-lg text-[#64748b] hover:text-[#00a88e] hover:bg-[#e6f7f5] transition-all">
          <Edit3 className="w-3.5 h-3.5" />
        </button>
        {lote && (
          <button type="button" onClick={() => onEditLote(lote)} title="Editar lote" className="p-1.5 rounded-lg text-[#64748b] hover:text-[#3b82f6] hover:bg-blue-50 transition-all">
            <Archive className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export function ItensEstoqueManager() {
  const [itens, setItens] = useState([]);
  const [lotesMap, setLotesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('todos');

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalData, setItemModalData] = useState(null);
  const [itemSaving, setItemSaving] = useState(false);
  const [itemError, setItemError] = useState('');

  const [loteModalOpen, setLoteModalOpen] = useState(false);
  const [loteModalData, setLoteModalData] = useState(null);
  const [loteModalItemNome, setLoteModalItemNome] = useState('');
  const [loteSaving, setLoteSaving] = useState(false);
  const [loteError, setLoteError] = useState('');

  const [entradaOpen, setEntradaOpen] = useState(false);
  const [baixaOpen, setBaixaOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const itemsList = await estoqueApi.listItens();
      const items = Array.isArray(itemsList) ? itemsList : [];
      setItens(items);
      const results = await Promise.all(items.map((i) => estoqueApi.listLotes(i.id).catch(() => [])));
      const map = {};
      items.forEach((item, idx) => { map[item.id] = Array.isArray(results[idx]) ? results[idx] : []; });
      setLotesMap(map);
    } catch (err) {
      console.warn('[estoque]', err.message);
      setError(err.message || 'Falha ao carregar estoque');
      setItens([]);
      setLotesMap({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const rows = useMemo(() => {
    const result = [];
    itens.forEach((item) => {
      const lotes = lotesMap[item.id] || [];
      if (lotes.length === 0) {
        result.push({ item, lote: null });
      } else {
        [...lotes]
          .sort((a, b) => (a.dataValidade || '').localeCompare(b.dataValidade || ''))
          .forEach((lote) => result.push({ item, lote }));
      }
    });
    return result;
  }, [itens, lotesMap]);

  const filteredRows = useMemo(() => {
    let list = rows;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        [r.item.nome, r.item.codigoInterno, r.lote?.numeroLote]
          .filter(Boolean).some((v) => v.toLowerCase().includes(q))
      );
    }
    if (activeFilter !== 'todos') {
      list = list.filter((r) => getRowStatus(r.lote, r.item).level === activeFilter);
    }
    return list;
  }, [rows, searchQuery, activeFilter]);

  const stats = useMemo(() => {
    let totalQty = 0;
    let criticos = 0;
    const itemIds = new Set();
    rows.forEach((r) => {
      itemIds.add(r.item.id);
      totalQty += r.lote?.saldoAtual || 0;
      if (getRowStatus(r.lote, r.item).level === 'critico') criticos++;
    });
    return { totalQty, criticos, totalProdutos: itemIds.size };
  }, [rows]);

  const openNewProduct = () => { setItemModalData(null); setItemError(''); setItemModalOpen(true); };
  const openEditItem = (item) => { setItemModalData(item); setItemError(''); setItemModalOpen(true); };

  const saveItem = async (itemData, loteData) => {
    setItemSaving(true);
    setItemError('');
    try {
      if (itemModalData?.id) {
        await estoqueApi.updateItem(itemModalData.id, itemData);
      } else {
        const created = await estoqueApi.createItem(itemData);
        if (loteData && created?.id) {
          await estoqueApi.createLote(created.id, loteData);
        }
      }
      await fetchAll();
      setItemModalOpen(false);
    } catch (err) {
      setItemError(err.message || 'Erro ao salvar.');
    } finally {
      setItemSaving(false);
    }
  };

  const openEditLote = (lote) => {
    setLoteModalData(lote);
    const item = itens.find((i) => i.id === lote.itemEstoqueId);
    setLoteModalItemNome(item?.nome || '');
    setLoteError('');
    setLoteModalOpen(true);
  };

  const saveLote = async (data) => {
    setLoteSaving(true);
    setLoteError('');
    try {
      await estoqueApi.updateLote(loteModalData.id, data);
      await fetchAll();
      setLoteModalOpen(false);
    } catch (err) {
      setLoteError(err.message || 'Erro ao salvar lote.');
    } finally {
      setLoteSaving(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white border border-app-border rounded-xl p-3">
          <div className="text-[11px] font-bold text-[#64748b] mb-0.5">Total em Estoque</div>
          <div className="text-[20px] font-extrabold text-[#0f766e]">{stats.totalQty}</div>
        </div>
        <div className="bg-white border border-red-100 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#64748b] mb-0.5">
            Itens Críticos {stats.criticos > 0 && <AlertTriangle className="w-3 h-3 text-red-500" />}
          </div>
          <div className={`text-[20px] font-extrabold ${stats.criticos > 0 ? 'text-red-600' : 'text-[#0f172a]'}`}>{stats.criticos}</div>
        </div>
        <div className="bg-white border border-app-border rounded-xl p-3">
          <div className="text-[11px] font-bold text-[#64748b] mb-0.5">Total de Produtos</div>
          <div className="text-[20px] font-extrabold text-[#0f172a]">{stats.totalProdutos}</div>
        </div>
      </div>

      {/* Search + Filters + Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00a88e]" strokeWidth={2.5} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar produto ou lote..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[13px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e]"
          />
        </div>
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setActiveFilter(f.key)}
              className={`px-3 py-2 rounded-xl text-[12px] font-bold border transition-all whitespace-nowrap ${
                activeFilter === f.key
                  ? 'bg-[#00a88e] text-white border-[#00a88e] shadow-sm'
                  : 'bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#00a88e]/30'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button type="button" onClick={openNewProduct} className="px-4 py-2.5 rounded-xl font-bold text-[13px] bg-[#00a88e] hover:bg-[#00967f] text-white shadow-md border border-transparent flex items-center gap-2">
          <Plus className="w-4 h-4" strokeWidth={3} /> Novo Produto
        </button>
        <button type="button" onClick={() => setEntradaOpen(true)} className="px-4 py-2.5 rounded-xl font-bold text-[13px] bg-white hover:bg-[#dcfce7] text-[#16a34a] shadow-sm border border-emerald-200 flex items-center gap-2">
          <ArrowDownCircle className="w-4 h-4" strokeWidth={2} /> Entrada
        </button>
        <button type="button" onClick={() => setBaixaOpen(true)} className="px-4 py-2.5 rounded-xl font-bold text-[13px] bg-white hover:bg-red-50 text-red-600 shadow-sm border border-red-200 flex items-center gap-2">
          <ArrowUpCircle className="w-4 h-4" strokeWidth={2} /> Baixa Manual
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-[13px] font-medium">{error}</div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#00a88e]" />
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-[#94a3b8]">
          <Package className="w-12 h-12 mb-3 opacity-40" strokeWidth={1.5} />
          <p className="text-[14px] font-bold mb-1">{searchQuery || activeFilter !== 'todos' ? 'Nenhum resultado' : 'Estoque vazio'}</p>
          <p className="text-[13px] font-medium">{searchQuery || activeFilter !== 'todos' ? 'Ajuste os filtros.' : 'Comece adicionando um produto.'}</p>
        </div>
      ) : (
        <div className="bg-white border border-app-border rounded-2xl overflow-hidden flex-1 flex flex-col min-h-0">
          {/* Header */}
          <div className="hidden md:grid grid-cols-[2.2fr_1.2fr_1fr_0.8fr_1.1fr_auto] gap-x-3 px-4 py-2.5 bg-[#f8fbfb] border-b border-app-border text-[11px] font-bold text-[#64748b] uppercase tracking-wide">
            <div>Produto</div>
            <div>Lote</div>
            <div>Validade</div>
            <div>Qtd</div>
            <div>Status</div>
            <div className="w-16" />
          </div>
          {/* Rows */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {filteredRows.map((row, idx) => (
              <InventoryRow
                key={`${row.item.id}_${row.lote?.id || 'no-lot'}_${idx}`}
                row={row}
                onEditItem={openEditItem}
                onEditLote={openEditLote}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <ItemFormModal isOpen={itemModalOpen} onClose={() => setItemModalOpen(false)} onSave={saveItem} item={itemModalData} saving={itemSaving} error={itemError} />
      <LoteFormModal isOpen={loteModalOpen} onClose={() => setLoteModalOpen(false)} onSave={saveLote} lote={loteModalData} itemNome={loteModalItemNome} saving={loteSaving} error={loteError} />
      <EntradaEstoqueModal isOpen={entradaOpen} onClose={() => setEntradaOpen(false)} onSaved={fetchAll} itens={itens} />
      <BaixaEstoqueModal isOpen={baixaOpen} onClose={() => setBaixaOpen(false)} onSaved={fetchAll} itens={itens} />
    </div>
  );
}
