import React, { useCallback, useState } from 'react';
import { X } from 'lucide-react';
import { ProcedimentoAutocomplete } from '../shared/ProcedimentoAutocomplete.jsx';
import { AppDateInput } from '../shared/AppDateInput.jsx';
import { ValorOrcadoInput } from './ValorOrcadoInput.jsx';
import { parseValorBrlInput, valorBrlDisplayFromNumber } from '../../utils/planejamentoDraftUtils.js';

function PlanoItemEditForm({
  item,
  catalogoOptions,
  catalogoLoading,
  mutating,
  onClose,
  onSave,
}) {
  const [nome, setNome] = useState(item.catalogoNome ?? '');
  const [catalogoId, setCatalogoId] = useState(
    String(item.catalogoProcedimentoSaudeId ?? '').trim(),
  );
  const [valorDisplay, setValorDisplay] = useState(valorBrlDisplayFromNumber(item.valorOrcado));
  const [data, setData] = useState(item.dataPlanejada ? String(item.dataPlanejada).slice(0, 10) : '');

  const handleSave = useCallback(() => {
    if (!catalogoId) return;
    onSave?.({
      catalogoProcedimentoSaudeId: catalogoId,
      catalogoNome: nome,
      valorOrcado: parseValorBrlInput(valorDisplay),
      dataPlanejada: data || null,
    });
  }, [catalogoId, data, nome, onSave, valorDisplay]);

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 id="plano-item-edit-title" className="text-[16px] font-bold text-[#0f172a]">
          Editar procedimento
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-[#94a3b8] transition-colors hover:bg-[#f1f5f9] hover:text-[#475569]"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>

      <div className="space-y-3">
        <ProcedimentoAutocomplete
          value={nome}
          catalogoOptions={catalogoOptions}
          disabled={mutating || catalogoLoading}
          onInputChange={(v) => {
            setNome(v);
            setCatalogoId('');
          }}
          onCommit={(v, id) => {
            setNome(v);
            setCatalogoId(id ? String(id) : '');
          }}
          placeholder="Buscar procedimento…"
        />
        <ValorOrcadoInput
          value={valorDisplay}
          disabled={mutating}
          onChange={setValorDisplay}
          className="w-full rounded-xl border border-slate-200 bg-[#f8fbfb] px-4 py-2.5 text-[13px] font-medium outline-none focus:border-[#00a88e] focus:ring-4 focus:ring-[#00a88e]/10"
        />
        <AppDateInput value={data} disabled={mutating} onChange={(e) => setData(e.target.value)} />
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          disabled={mutating}
          onClick={onClose}
          className="rounded-xl border border-app-border bg-white px-4 py-2 text-[13px] font-semibold text-[#64748b] hover:bg-app-nav-hover disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={mutating || !catalogoId}
          onClick={handleSave}
          className="rounded-xl bg-[#00a88e] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#00967f] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Aplicar
        </button>
      </div>
    </>
  );
}

export function PlanoItemEditModal({
  open,
  item,
  catalogoOptions,
  catalogoLoading,
  mutating,
  onClose,
  onSave,
}) {
  if (!open || !item) return null;

  const itemKey = String(item.id ?? item.tempId ?? '');

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plano-item-edit-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <PlanoItemEditForm
          key={itemKey}
          item={item}
          catalogoOptions={catalogoOptions}
          catalogoLoading={catalogoLoading}
          mutating={mutating}
          onClose={onClose}
          onSave={onSave}
        />
      </div>
    </div>
  );
}
