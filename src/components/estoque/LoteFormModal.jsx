import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';

export function LoteFormModal({ isOpen, onClose, onSave, lote, itemNome, saving, error }) {
  const isEdit = Boolean(lote?.id);

  const [numeroLote, setNumeroLote] = useState('');
  const [dataFabricacao, setDataFabricacao] = useState('');
  const [dataValidade, setDataValidade] = useState('');
  const [quantidadeInicial, setQuantidadeInicial] = useState('');

  useEffect(() => {
    if (isOpen) {
      setNumeroLote(lote?.numeroLote || '');
      setDataFabricacao(lote?.dataFabricacao || '');
      setDataValidade(lote?.dataValidade || '');
      setQuantidadeInicial(lote?.saldoAtual != null ? String(lote.saldoAtual) : '');
    }
  }, [isOpen, lote]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!numeroLote.trim() || !dataValidade) return;
    onSave({
      numeroLote: numeroLote.trim(),
      dataFabricacao: dataFabricacao || null,
      dataValidade,
      ...(isEdit
        ? { saldoAtual: quantidadeInicial !== '' ? Number(quantidadeInicial) : 0 }
        : { quantidadeInicial: quantidadeInicial !== '' ? Number(quantidadeInicial) : 0 }),
    });
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border-[3px] border-[#00a88e]/25 shadow-2xl w-full max-w-[480px] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b-[3px] border-[#00a88e]/10">
          <div>
            <h3 className="text-[18px] font-bold text-[#0f172a]">
              {isEdit ? 'Editar Lote' : 'Novo Lote'}
            </h3>
            {itemNome && (
              <p className="text-[13px] text-[#64748b] font-medium mt-0.5">{itemNome}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl border-[3px] border-[#00a88e]/20 text-[#64748b] hover:text-[#00a88e] hover:bg-[#f0fdfa] flex items-center justify-center"
          >
            <X className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 border-[3px] border-red-200 rounded-xl p-3 text-[13px] font-bold">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-[#00a88e]">
              Número do Lote <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={numeroLote}
              onChange={(e) => setNumeroLote(e.target.value)}
              placeholder="Ex: LOT-2025-001"
              className="w-full px-4 py-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/20 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#00a88e]">Fabricação</label>
              <input
                type="date"
                value={dataFabricacao}
                onChange={(e) => setDataFabricacao(e.target.value)}
                className="w-full px-4 py-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/20 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#00a88e]">
                Validade <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={dataValidade}
                onChange={(e) => setDataValidade(e.target.value)}
                className="w-full px-4 py-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/20 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e]"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-[#00a88e]">
              {isEdit ? 'Saldo Atual' : 'Quantidade Inicial'}
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={quantidadeInicial}
              onChange={(e) => setQuantidadeInicial(e.target.value)}
              placeholder="0"
              className="w-full px-4 py-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/20 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e]"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-3 rounded-xl font-bold text-[14px] border-[3px] border-[#00a88e]/25 text-[#64748b] hover:bg-[#f8fbfb] transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !numeroLote.trim() || !dataValidade}
              className="flex-1 py-3 rounded-xl font-bold text-[14px] border-[3px] border-transparent bg-[#00a88e] hover:bg-[#00967f] text-white shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Salvar' : 'Criar Lote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
