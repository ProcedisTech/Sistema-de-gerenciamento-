import React, { useState, useEffect, useCallback } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Plus, Loader2, Filter, Package } from 'lucide-react';
import { estoqueApi } from '../../services/api';
import { MovimentacaoFormModal } from './MovimentacaoFormModal';

const TIPO_META = {
  entrada_compra:    { label: 'Compra',           sign: '+', cls: 'bg-[#dcfce7] text-[#16a34a] border-[#22c55e]/20' },
  entrada_ajuste:    { label: 'Ajuste (entrada)',  sign: '+', cls: 'bg-[#dcfce7] text-[#16a34a] border-[#22c55e]/20' },
  entrada_devolucao: { label: 'Devolução',         sign: '+', cls: 'bg-[#dcfce7] text-[#16a34a] border-[#22c55e]/20' },
  saida_procedimento:{ label: 'Procedimento',      sign: '−', cls: 'bg-red-50 text-red-600 border-red-200' },
  saida_ajuste:      { label: 'Ajuste (saída)',    sign: '−', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  saida_perda:       { label: 'Perda / Descarte',  sign: '−', cls: 'bg-red-50 text-red-600 border-red-200' },
};

const TIPO_OPTIONS = [
  { value: '', label: 'Todos os tipos' },
  { value: 'entrada_compra', label: 'Compra' },
  { value: 'entrada_ajuste', label: 'Ajuste (entrada)' },
  { value: 'entrada_devolucao', label: 'Devolução' },
  { value: 'saida_procedimento', label: 'Procedimento' },
  { value: 'saida_ajuste', label: 'Ajuste (saída)' },
  { value: 'saida_perda', label: 'Perda / Descarte' },
];

function formatDate(isoStr) {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch { return isoStr; }
}

export function MovimentacoesManager() {
  const [movs, setMovs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filterTipo, setFilterTipo] = useState('');
  const [filterItemId, setFilterItemId] = useState('');
  const [itens, setItens] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchMovs = useCallback(() => {
    setLoading(true);
    setError('');
    const params = {};
    if (filterTipo) params.tipo = filterTipo;
    if (filterItemId) params.itemEstoqueId = filterItemId;
    estoqueApi.listMovimentacoes(params)
      .then((data) => setMovs(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.warn('[estoque] Falha ao carregar movimentações:', err.message);
        setError(err.message || 'Falha ao carregar movimentações');
        setMovs([]);
      })
      .finally(() => setLoading(false));
  }, [filterTipo, filterItemId]);

  useEffect(() => { fetchMovs(); }, [fetchMovs]);

  useEffect(() => {
    estoqueApi.listItens()
      .then((data) => setItens(Array.isArray(data) ? data : []))
      .catch(() => setItens([]));
  }, []);

  const openModal = () => { setModalError(''); setModalOpen(true); };

  const saveMovimentacao = async (data) => {
    setModalSaving(true);
    setModalError('');
    try {
      await estoqueApi.createMovimentacao(data);
      fetchMovs();
      setModalOpen(false);
    } catch (err) {
      setModalError(err.message || 'Erro ao registrar movimentação.');
    } finally {
      setModalSaving(false);
    }
  };

  const entradas = movs.filter((m) => (m.tipo || '').startsWith('entrada'));
  const saidas = movs.filter((m) => (m.tipo || '').startsWith('saida'));

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#64748b]">
            <Filter className="w-3.5 h-3.5" />
          </div>
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            className="px-3 py-2 bg-[#f8fbfb] border-[3px] border-[#00a88e]/20 rounded-xl text-[12px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e] appearance-none"
          >
            {TIPO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={filterItemId}
            onChange={(e) => setFilterItemId(e.target.value)}
            className="px-3 py-2 bg-[#f8fbfb] border-[3px] border-[#00a88e]/20 rounded-xl text-[12px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e] appearance-none max-w-[200px]"
          >
            <option value="">Todos os itens</option>
            {itens.map((i) => (
              <option key={i.id} value={i.id}>{i.nome}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={openModal}
          className="px-4 py-2.5 rounded-xl font-bold text-[13px] bg-[#00a88e] hover:bg-[#00967f] text-white shadow-md border-[3px] border-transparent flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" strokeWidth={3} /> Nova Movimentação
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white border-[3px] border-[#00a88e]/15 rounded-xl p-3">
          <div className="text-[11px] font-bold text-[#64748b] mb-0.5">Total</div>
          <div className="text-[18px] font-extrabold text-[#0f172a]">{movs.length}</div>
        </div>
        <div className="bg-white border-[3px] border-[#22c55e]/15 rounded-xl p-3">
          <div className="text-[11px] font-bold text-[#64748b] mb-0.5">Entradas</div>
          <div className="text-[18px] font-extrabold text-[#16a34a]">{entradas.length}</div>
        </div>
        <div className="bg-white border-[3px] border-red-100 rounded-xl p-3">
          <div className="text-[11px] font-bold text-[#64748b] mb-0.5">Saídas</div>
          <div className="text-[18px] font-extrabold text-red-600">{saidas.length}</div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl border-[3px] border-amber-200 bg-amber-50 text-amber-900 text-[13px] font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#00a88e]" />
        </div>
      ) : movs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-[#94a3b8]">
          <Package className="w-12 h-12 mb-3 opacity-40" strokeWidth={1.5} />
          <p className="text-[14px] font-bold mb-1">Nenhuma movimentação</p>
          <p className="text-[13px] font-medium">Registre entradas e saídas do estoque.</p>
        </div>
      ) : (
        <div className="space-y-2 flex-1 overflow-y-auto pr-1 custom-scrollbar">
          {movs.map((m) => {
            const meta = TIPO_META[m.tipo] || { label: m.tipo, sign: '?', cls: 'bg-slate-100 text-slate-600 border-slate-200' };
            const isEntrada = (m.tipo || '').startsWith('entrada');
            return (
              <div key={m.id} className="flex items-start gap-3 p-3 bg-white border-[2px] border-[#e2e8f0] rounded-xl hover:border-[#00a88e]/20 transition-all">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isEntrada ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-red-50 text-red-500'}`}>
                  {isEntrada
                    ? <ArrowDownCircle className="w-5 h-5" strokeWidth={2} />
                    : <ArrowUpCircle className="w-5 h-5" strokeWidth={2} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-[13px] font-bold text-[#0f172a]">{m.itemNome || 'Item'}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${meta.cls}`}>{meta.label}</span>
                  </div>
                  <div className="text-[12px] text-[#64748b] flex flex-wrap gap-x-3">
                    {m.loteNumero && <span>Lote: {m.loteNumero}</span>}
                    {m.responsavelNome && <span>Por: {m.responsavelNome}</span>}
                    {m.observacao && <span className="text-[#94a3b8]">— {m.observacao}</span>}
                  </div>
                  <div className="text-[11px] text-[#94a3b8] mt-0.5">{formatDate(m.criadoEm)}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`text-[16px] font-extrabold ${isEntrada ? 'text-[#16a34a]' : 'text-red-600'}`}>
                    {meta.sign}{m.quantidade}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <MovimentacaoFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={saveMovimentacao}
        itens={itens}
        saving={modalSaving}
        error={modalError}
      />
    </div>
  );
}
