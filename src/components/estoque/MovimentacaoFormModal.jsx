import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { estoqueApi } from '../../services/api';

const TIPOS = [
  { value: 'entrada_compra', label: 'Compra', grupo: 'entrada' },
  { value: 'entrada_ajuste', label: 'Ajuste (entrada)', grupo: 'entrada' },
  { value: 'entrada_devolucao', label: 'Devolução', grupo: 'entrada' },
  { value: 'saida_procedimento', label: 'Procedimento', grupo: 'saida' },
  { value: 'saida_ajuste', label: 'Ajuste (saída)', grupo: 'saida' },
  { value: 'saida_perda', label: 'Perda / Descarte', grupo: 'saida' },
];

export function MovimentacaoFormModal({ isOpen, onClose, onSave, itens, saving, error }) {
  const [tipo, setTipo] = useState('entrada_compra');
  const [itemEstoqueId, setItemEstoqueId] = useState('');
  const [loteItemEstoqueId, setLoteItemEstoqueId] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [observacao, setObservacao] = useState('');
  const [lotes, setLotes] = useState([]);
  const [loadingLotes, setLoadingLotes] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTipo('entrada_compra');
      setItemEstoqueId('');
      setLoteItemEstoqueId('');
      setQuantidade('');
      setObservacao('');
      setLotes([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!itemEstoqueId) { setLotes([]); setLoteItemEstoqueId(''); return; }
    let cancelled = false;
    setLoadingLotes(true);
    estoqueApi.listLotes(itemEstoqueId)
      .then((data) => { if (!cancelled) setLotes(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setLotes([]); })
      .finally(() => { if (!cancelled) setLoadingLotes(false); });
    return () => { cancelled = true; };
  }, [itemEstoqueId]);

  if (!isOpen) return null;

  const isSaida = tipo.startsWith('saida');
  const lotesDisp = isSaida ? lotes.filter((l) => (l.saldoAtual || 0) > 0) : lotes;
  const selectedLote = lotes.find((l) => l.id === loteItemEstoqueId);
  const maxQty = isSaida && selectedLote ? selectedLote.saldoAtual : undefined;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!itemEstoqueId || !loteItemEstoqueId || !quantidade) return;
    onSave({
      tipo,
      itemEstoqueId,
      loteItemEstoqueId,
      quantidade: Number(quantidade),
      observacao: observacao.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-app-border shadow-2xl w-full max-w-[520px] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-app-border">
          <h3 className="text-[18px] font-bold text-[#0f172a]">Nova Movimentação</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-slate-200 text-[#64748b] hover:text-[#00a88e] hover:bg-[#f0fdfa] flex items-center justify-center"
          >
            <X className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 border border-red-200 rounded-xl p-3 text-[13px] font-bold">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-[#00a88e]">
              Tipo <span className="text-red-500">*</span>
            </label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full px-4 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e] appearance-none"
            >
              <optgroup label="Entrada">
                {TIPOS.filter((t) => t.grupo === 'entrada').map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </optgroup>
              <optgroup label="Saída">
                {TIPOS.filter((t) => t.grupo === 'saida').map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-[#00a88e]">
              Item <span className="text-red-500">*</span>
            </label>
            <select
              value={itemEstoqueId}
              onChange={(e) => { setItemEstoqueId(e.target.value); setLoteItemEstoqueId(''); }}
              className="w-full px-4 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e] appearance-none"
            >
              <option value="">Selecione o item...</option>
              {(itens || []).filter((i) => i.ativo !== false).map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nome}{i.codigoInterno ? ` (${i.codigoInterno})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-[#00a88e]">
              Lote <span className="text-red-500">*</span>
            </label>
            {loadingLotes ? (
              <div className="flex items-center gap-2 text-[#64748b] text-[13px] py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando lotes...
              </div>
            ) : (
              <select
                value={loteItemEstoqueId}
                onChange={(e) => setLoteItemEstoqueId(e.target.value)}
                disabled={!itemEstoqueId || lotesDisp.length === 0}
                className="w-full px-4 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e] appearance-none disabled:opacity-60"
              >
                <option value="">
                  {!itemEstoqueId ? 'Selecione um item primeiro' : lotesDisp.length === 0 ? 'Nenhum lote disponível' : 'Selecione o lote...'}
                </option>
                {lotesDisp.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.numeroLote} — saldo: {l.saldoAtual ?? 0}
                    {l.dataValidade ? ` · val: ${l.dataValidade}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-[#00a88e]">
              Quantidade <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0.01"
              step="any"
              max={maxQty}
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              placeholder="0"
              className="w-full px-4 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e]"
              required
            />
            {isSaida && selectedLote && (
              <p className="text-[12px] text-[#64748b] font-medium mt-1">
                Saldo disponível: <span className="font-bold text-[#0f766e]">{selectedLote.saldoAtual}</span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-[#00a88e]">Observação</label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              placeholder="Motivo, NF, fornecedor..."
              className="w-full px-4 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e]"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-3 rounded-xl font-bold text-[14px] border border-app-border text-[#64748b] hover:bg-[#f8fbfb] transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !itemEstoqueId || !loteItemEstoqueId || !quantidade}
              className={`flex-1 py-3 rounded-xl font-bold text-[14px] border border-transparent shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                isSaida
                  ? 'bg-[#f59e0b] hover:bg-[#d97706] text-white'
                  : 'bg-[#00a88e] hover:bg-[#00967f] text-white'
              }`}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Registrar {isSaida ? 'Saída' : 'Entrada'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
