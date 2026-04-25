import React, { useState, useEffect } from 'react';
import { X, Loader2, ArrowUpCircle } from 'lucide-react';
import { estoqueApi } from '../../services/api';

const TIPOS_SAIDA = [
  { value: 'saida_procedimento', label: 'Procedimento' },
  { value: 'saida_ajuste', label: 'Ajuste de saída' },
  { value: 'saida_perda', label: 'Perda / Descarte' },
];

export function BaixaEstoqueModal({ isOpen, onClose, onSaved, itens }) {
  const [itemId, setItemId] = useState('');
  const [loteId, setLoteId] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [tipo, setTipo] = useState('saida_procedimento');
  const [observacao, setObservacao] = useState('');
  const [lotes, setLotes] = useState([]);
  const [loadingLotes, setLoadingLotes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setItemId('');
      setLoteId('');
      setQuantidade('');
      setTipo('saida_procedimento');
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
      .then((data) => {
        if (cancelled) return;
        const all = Array.isArray(data) ? data : [];
        const available = all
          .filter((l) => (l.saldoAtual || 0) > 0)
          .sort((a, b) => {
            if (!a.dataValidade) return 1;
            if (!b.dataValidade) return -1;
            return a.dataValidade.localeCompare(b.dataValidade);
          });
        setLotes(available);
        if (available.length === 1) setLoteId(available[0].id);
      })
      .catch(() => { if (!cancelled) setLotes([]); })
      .finally(() => { if (!cancelled) setLoadingLotes(false); });
    return () => { cancelled = true; };
  }, [itemId]);

  if (!isOpen) return null;

  const selectedLote = lotes.find((l) => l.id === loteId);
  const maxQty = selectedLote?.saldoAtual ?? 0;
  const canSubmit = itemId && loteId && quantidade && Number(quantidade) > 0 && Number(quantidade) <= maxQty;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    try {
      await estoqueApi.createMovimentacao({
        tipo,
        itemEstoqueId: itemId,
        loteItemEstoqueId: loteId,
        quantidade: Number(quantidade),
        observacao: observacao.trim() || null,
      });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Erro ao registrar baixa.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-red-200 shadow-2xl w-full max-w-[500px] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b-[3px] border-red-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-50 text-red-500 flex items-center justify-center">
              <ArrowUpCircle className="w-5 h-5" strokeWidth={2} />
            </div>
            <h3 className="text-[18px] font-bold text-[#0f172a]">Baixa Manual</h3>
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
            <select value={itemId} onChange={(e) => { setItemId(e.target.value); setLoteId(''); setQuantidade(''); }} className="w-full px-4 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e] appearance-none">
              <option value="">Selecione o produto...</option>
              {(itens || []).filter((i) => i.ativo !== false).map((i) => (
                <option key={i.id} value={i.id}>{i.nome}{i.codigoInterno ? ` (${i.codigoInterno})` : ''}</option>
              ))}
            </select>
          </div>

          {itemId && (
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#00a88e]">
                Lote <span className="text-red-500">*</span>
                <span className="text-[11px] text-[#64748b] font-medium ml-2">(FIFO — mais próximo do vencimento primeiro)</span>
              </label>
              {loadingLotes ? (
                <div className="flex items-center gap-2 text-[#64748b] text-[13px] py-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>
              ) : lotes.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[13px] text-amber-700 font-medium">
                  Nenhum lote com saldo disponível para este produto.
                </div>
              ) : (
                <select value={loteId} onChange={(e) => { setLoteId(e.target.value); setQuantidade(''); }} className="w-full px-4 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e] appearance-none">
                  <option value="">Selecione o lote...</option>
                  {lotes.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.numeroLote} — saldo: {l.saldoAtual}{l.dataValidade ? ` · val: ${l.dataValidade}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {itemId && loteId && (
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#00a88e]">
                Quantidade <span className="text-red-500">*</span>
              </label>
              <input type="number" min="0.01" step="any" max={maxQty} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="0" className="w-full px-4 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e]" required />
              <p className="text-[12px] text-[#64748b] font-medium">
                Disponível: <span className="font-bold text-[#0f766e]">{maxQty}</span>
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-[#00a88e]">Motivo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full px-4 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e] appearance-none">
              {TIPOS_SAIDA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-[#00a88e]">Observação</label>
            <input type="text" value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Detalhe opcional..." className="w-full px-4 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e]" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={saving} className="flex-1 py-3 rounded-xl font-bold text-[14px] border border-app-border text-[#64748b] hover:bg-[#f8fbfb] transition-all">Cancelar</button>
            <button type="submit" disabled={saving || !canSubmit} className="flex-1 py-3 rounded-xl font-bold text-[14px] border border-transparent bg-red-600 hover:bg-red-700 text-white shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Registrar Baixa
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
