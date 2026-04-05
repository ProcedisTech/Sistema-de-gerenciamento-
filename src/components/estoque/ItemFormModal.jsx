import React, { useState, useEffect } from 'react';
import { X, Loader2, Package, Tag } from 'lucide-react';

const UNIDADES = [
  { value: 'unidade', label: 'Unidade (un)' },
  { value: 'ml', label: 'Mililitro (ml)' },
  { value: 'g', label: 'Grama (g)' },
  { value: 'mg', label: 'Miligrama (mg)' },
  { value: 'ampola', label: 'Ampola' },
  { value: 'frasco', label: 'Frasco' },
  { value: 'seringa', label: 'Seringa' },
  { value: 'caixa', label: 'Caixa' },
  { value: 'par', label: 'Par' },
  { value: 'kit', label: 'Kit' },
];

export function ItemFormModal({ isOpen, onClose, onSave, item, saving, error }) {
  const isEdit = Boolean(item?.id);

  const [nome, setNome] = useState('');
  const [codigoInterno, setCodigoInterno] = useState('');
  const [unidadeMedida, setUnidadeMedida] = useState('unidade');
  const [estoqueMinimo, setEstoqueMinimo] = useState('');

  const [loteNumero, setLoteNumero] = useState('');
  const [loteFabricacao, setLoteFabricacao] = useState('');
  const [loteValidade, setLoteValidade] = useState('');
  const [loteQuantidade, setLoteQuantidade] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setNome(item?.nome || '');
    setCodigoInterno(item?.codigoInterno || '');
    setUnidadeMedida(item?.unidadeMedida || 'unidade');
    setEstoqueMinimo(item?.estoqueMinimo != null ? String(item.estoqueMinimo) : '');
    setLoteNumero('');
    setLoteFabricacao('');
    setLoteValidade('');
    setLoteQuantidade('');
  }, [isOpen, item]);

  if (!isOpen) return null;

  const canSubmit = isEdit
    ? nome.trim()
    : nome.trim() && loteNumero.trim() && loteValidade && loteQuantidade;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    const itemData = {
      nome: nome.trim(),
      codigoInterno: codigoInterno.trim() || null,
      unidadeMedida,
      estoqueMinimo: estoqueMinimo !== '' ? Number(estoqueMinimo) : 0,
    };

    const loteData = !isEdit ? {
      numeroLote: loteNumero.trim(),
      dataFabricacao: loteFabricacao || null,
      dataValidade: loteValidade,
      quantidadeInicial: Number(loteQuantidade) || 0,
    } : null;

    onSave(itemData, loteData);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border-[3px] border-[#00a88e]/25 shadow-2xl w-full max-w-[540px] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b-[3px] border-[#00a88e]/10">
          <h3 className="text-[18px] font-bold text-[#0f172a]">
            {isEdit ? 'Editar Produto' : 'Novo Produto'}
          </h3>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-xl border-[3px] border-[#00a88e]/20 text-[#64748b] hover:text-[#00a88e] hover:bg-[#f0fdfa] flex items-center justify-center">
            <X className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {error && (
            <div className="bg-red-50 text-red-600 border-[3px] border-red-200 rounded-xl p-3 text-[13px] font-bold">{error}</div>
          )}

          {/* ── Dados do Produto ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[#0f766e]">
              <Package className="w-4 h-4" strokeWidth={2.5} />
              <span className="text-[13px] font-bold uppercase tracking-wide">Dados do Produto</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#00a88e]">Nome <span className="text-red-500">*</span></label>
              <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Toxina Botulínica, Ácido Hialurônico..." className="w-full px-4 py-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/20 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e]" required />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#00a88e]">Código</label>
                <input type="text" value={codigoInterno} onChange={(e) => setCodigoInterno(e.target.value)} placeholder="TOX-001" className="w-full px-3 py-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/20 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e]" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#00a88e]">Unidade <span className="text-red-500">*</span></label>
                <select value={unidadeMedida} onChange={(e) => setUnidadeMedida(e.target.value)} className="w-full px-3 py-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/20 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e] appearance-none">
                  {UNIDADES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#00a88e]">Mínimo</label>
                <input type="number" min="0" value={estoqueMinimo} onChange={(e) => setEstoqueMinimo(e.target.value)} placeholder="0" className="w-full px-3 py-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/20 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e]" />
              </div>
            </div>
          </div>

          {/* ── Primeiro Lote (apenas criação) ── */}
          {!isEdit && (
            <div className="space-y-4 border-t-[3px] border-[#00a88e]/10 pt-5">
              <div className="flex items-center gap-2 text-[#0f766e]">
                <Tag className="w-4 h-4" strokeWidth={2.5} />
                <span className="text-[13px] font-bold uppercase tracking-wide">Primeiro Lote</span>
              </div>
              <p className="text-[12px] text-[#64748b] font-medium -mt-2">
                Todo produto precisa de pelo menos um lote para entrar no estoque.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#00a88e]">Nº do Lote <span className="text-red-500">*</span></label>
                  <input type="text" value={loteNumero} onChange={(e) => setLoteNumero(e.target.value)} placeholder="LOT-2025-001" className="w-full px-3 py-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/20 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e]" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#00a88e]">Quantidade <span className="text-red-500">*</span></label>
                  <input type="number" min="1" step="any" value={loteQuantidade} onChange={(e) => setLoteQuantidade(e.target.value)} placeholder="0" className="w-full px-3 py-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/20 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e]" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#00a88e]">Fabricação</label>
                  <input type="date" value={loteFabricacao} onChange={(e) => setLoteFabricacao(e.target.value)} className="w-full px-3 py-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/20 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e]" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#00a88e]">Validade <span className="text-red-500">*</span></label>
                  <input type="date" value={loteValidade} onChange={(e) => setLoteValidade(e.target.value)} className="w-full px-3 py-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/20 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e]" required />
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={saving} className="flex-1 py-3 rounded-xl font-bold text-[14px] border-[3px] border-[#00a88e]/25 text-[#64748b] hover:bg-[#f8fbfb] transition-all">
              Cancelar
            </button>
            <button type="submit" disabled={saving || !canSubmit} className="flex-1 py-3 rounded-xl font-bold text-[14px] border-[3px] border-transparent bg-[#00a88e] hover:bg-[#00967f] text-white shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Salvar' : 'Criar Produto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
