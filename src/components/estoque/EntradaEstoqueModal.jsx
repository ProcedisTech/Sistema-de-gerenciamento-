import React, { useState, useEffect } from 'react';
import { X, Loader2, ArrowDownCircle } from 'lucide-react';
import { estoqueApi } from '../../services/api';

export function EntradaEstoqueModal({ isOpen, onClose, onSaved, itens }) {
  const [itemId, setItemId] = useState('');
  const [modo, setModo] = useState('novo');
  const [loteId, setLoteId] = useState('');
  const [loteNumero, setLoteNumero] = useState('');
  const [loteFabricacao, setLoteFabricacao] = useState('');
  const [loteValidade, setLoteValidade] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [observacao, setObservacao] = useState('');
  const [lotes, setLotes] = useState([]);
  const [loadingLotes, setLoadingLotes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setItemId('');
      setModo('novo');
      setLoteId('');
      setLoteNumero('');
      setLoteFabricacao('');
      setLoteValidade('');
      setQuantidade('');
      setObservacao('');
      setLotes([]);
      setError('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!itemId) { setLotes([]); setLoteId(''); return; }
    let cancelled = false;
    setLoadingLotes(true);
    estoqueApi.listLotes(itemId)
      .then((data) => { if (!cancelled) setLotes(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setLotes([]); })
      .finally(() => { if (!cancelled) setLoadingLotes(false); });
    return () => { cancelled = true; };
  }, [itemId]);

  if (!isOpen) return null;

  const canSubmit = modo === 'novo'
    ? itemId && loteNumero.trim() && loteValidade && quantidade
    : itemId && loteId && quantidade;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    try {
      if (modo === 'novo') {
        await estoqueApi.createLote(itemId, {
          numeroLote: loteNumero.trim(),
          dataFabricacao: loteFabricacao || null,
          dataValidade: loteValidade,
          quantidadeInicial: Number(quantidade) || 0,
        });
      } else {
        await estoqueApi.createMovimentacao({
          tipo: 'entrada_compra',
          itemEstoqueId: itemId,
          loteItemEstoqueId: loteId,
          quantidade: Number(quantidade),
          observacao: observacao.trim() || null,
        });
      }
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Erro ao registrar entrada.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-emerald-200 shadow-2xl w-full max-w-[500px] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b-[3px] border-[#22c55e]/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#dcfce7] text-[#16a34a] flex items-center justify-center">
              <ArrowDownCircle className="w-5 h-5" strokeWidth={2} />
            </div>
            <h3 className="text-[18px] font-bold text-[#0f172a]">Entrada de Estoque</h3>
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-xl border border-slate-200 text-[#64748b] hover:text-[#00a88e] hover:bg-[#f0fdfa] flex items-center justify-center">
            <X className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 border border-red-200 rounded-xl p-3 text-[13px] font-bold">{error}</div>
          )}

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-[#00a88e]">Produto <span className="text-red-500">*</span></label>
            <select value={itemId} onChange={(e) => { setItemId(e.target.value); setLoteId(''); }} className="w-full px-4 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e] appearance-none">
              <option value="">Selecione o produto...</option>
              {(itens || []).filter((i) => i.ativo !== false).map((i) => (
                <option key={i.id} value={i.id}>{i.nome}{i.codigoInterno ? ` (${i.codigoInterno})` : ''}</option>
              ))}
            </select>
          </div>

          {itemId && (
            <div className="flex bg-[#f8fbfb] p-1 rounded-xl border border-app-border">
              <button type="button" onClick={() => setModo('novo')} className={`flex-1 py-2.5 text-[13px] font-bold rounded-lg transition-all ${modo === 'novo' ? 'bg-[#00a88e] text-white shadow-sm' : 'text-[#64748b] hover:text-[#00a88e]'}`}>
                Novo Lote
              </button>
              <button type="button" onClick={() => setModo('existente')} className={`flex-1 py-2.5 text-[13px] font-bold rounded-lg transition-all ${modo === 'existente' ? 'bg-[#00a88e] text-white shadow-sm' : 'text-[#64748b] hover:text-[#00a88e]'}`}>
                Lote Existente
              </button>
            </div>
          )}

          {itemId && modo === 'novo' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#00a88e]">Nº do Lote <span className="text-red-500">*</span></label>
                  <input type="text" value={loteNumero} onChange={(e) => setLoteNumero(e.target.value)} placeholder="LOT-2025-001" className="w-full px-3 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e]" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#00a88e]">Validade <span className="text-red-500">*</span></label>
                  <input type="date" value={loteValidade} onChange={(e) => setLoteValidade(e.target.value)} className="w-full px-3 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e]" required />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#00a88e]">Fabricação</label>
                <input type="date" value={loteFabricacao} onChange={(e) => setLoteFabricacao(e.target.value)} className="w-full px-3 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e]" />
              </div>
            </>
          )}

          {itemId && modo === 'existente' && (
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#00a88e]">Lote <span className="text-red-500">*</span></label>
              {loadingLotes ? (
                <div className="flex items-center gap-2 text-[#64748b] text-[13px] py-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>
              ) : (
                <select value={loteId} onChange={(e) => setLoteId(e.target.value)} disabled={lotes.length === 0} className="w-full px-4 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e] appearance-none disabled:opacity-60">
                  <option value="">{lotes.length === 0 ? 'Nenhum lote — use "Novo Lote"' : 'Selecione...'}</option>
                  {lotes.map((l) => (
                    <option key={l.id} value={l.id}>{l.numeroLote} — saldo: {l.saldoAtual ?? 0}{l.dataValidade ? ` · val: ${l.dataValidade}` : ''}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {itemId && (
            <>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#00a88e]">Quantidade <span className="text-red-500">*</span></label>
                <input type="number" min="0.01" step="any" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="0" className="w-full px-4 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e]" required />
              </div>

              {modo === 'existente' && (
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#00a88e]">Observação</label>
                  <input type="text" value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="NF, fornecedor, motivo..." className="w-full px-4 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e]" />
                </div>
              )}
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={saving} className="flex-1 py-3 rounded-xl font-bold text-[14px] border border-app-border text-[#64748b] hover:bg-[#f8fbfb] transition-all">Cancelar</button>
            <button type="submit" disabled={saving || !canSubmit} className="flex-1 py-3 rounded-xl font-bold text-[14px] border border-transparent bg-[#16a34a] hover:bg-[#15803d] text-white shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Registrar Entrada
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
