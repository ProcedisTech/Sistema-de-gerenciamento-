import React, { useEffect, useState } from 'react';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { indisponibilidadesApi, getApiErrorToastMessage } from '../../services/api.js';
import { useToast } from '../../contexts/useToast.js';

function emptyRow(roleUserId) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: null,
    roleUserId,
    dataInicio: today,
    dataFim: today,
    horaInicio: '',
    horaFim: '',
    motivo: '',
  };
}

export default function IndisponibilidadesProfissionalPanel({ roleUserId }) {
  const { success, error } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingIndex, setSavingIndex] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await indisponibilidadesApi.listar({ roleUserId });
      setRows(Array.isArray(list) ? list : []);
    } catch (e) {
      error(getApiErrorToastMessage(e, 'Erro ao carregar indisponibilidades.'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleUserId]);

  const updateRow = (index, patch) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow(roleUserId)]);
  };

  const saveRow = async (row, index) => {
    if (!row?.dataInicio || !row?.dataFim) {
      error('Informe data inicial e final.');
      return;
    }
    if (row.dataFim < row.dataInicio) {
      error('Data final deve ser maior ou igual à data inicial.');
      return;
    }
    if (row.horaInicio && row.horaFim && row.horaFim <= row.horaInicio) {
      error('Horário final deve ser depois do horário inicial.');
      return;
    }
    setSavingIndex(index);
    const payload = {
      roleUserId,
      dataInicio: row.dataInicio,
      dataFim: row.dataFim,
      horaInicio: row.horaInicio || null,
      horaFim: row.horaFim || null,
      motivo: row.motivo?.trim() || null,
    };
    try {
      const saved = row.id
        ? await indisponibilidadesApi.atualizar(row.id, payload)
        : await indisponibilidadesApi.criar(payload);
      setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...(saved || {}), ...payload } : r)));
      success('Indisponibilidade salva.');
    } catch (e) {
      error(getApiErrorToastMessage(e, 'Erro ao salvar indisponibilidade.'));
    } finally {
      setSavingIndex(null);
    }
  };

  const removeRow = async (row, index) => {
    if (!row?.id) {
      setRows((prev) => prev.filter((_, i) => i !== index));
      return;
    }
    try {
      await indisponibilidadesApi.remover(row.id);
      setRows((prev) => prev.filter((_, i) => i !== index));
      success('Indisponibilidade removida.');
    } catch (e) {
      error(getApiErrorToastMessage(e, 'Erro ao remover indisponibilidade.'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-[#00a88e]" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#e2e8f0] bg-[#f8fafc] px-3 py-4 text-[13px] text-[#64748b]">
          Nenhum bloqueio/exceção cadastrado.
        </div>
      ) : null}
      {rows.map((row, index) => (
        <div key={`${row?.id || 'new'}-${index}`} className="rounded-lg border border-[#e2e8f0] bg-white p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <input type="date" value={row.dataInicio || ''} onChange={(e) => updateRow(index, { dataInicio: e.target.value })} className="rounded-md border border-[#e2e8f0] px-2 py-1.5 text-[13px]" />
            <input type="date" value={row.dataFim || ''} onChange={(e) => updateRow(index, { dataFim: e.target.value })} className="rounded-md border border-[#e2e8f0] px-2 py-1.5 text-[13px]" />
            <input type="time" value={String(row.horaInicio || '').slice(0, 5)} onChange={(e) => updateRow(index, { horaInicio: e.target.value })} className="rounded-md border border-[#e2e8f0] px-2 py-1.5 text-[13px]" />
            <input type="time" value={String(row.horaFim || '').slice(0, 5)} onChange={(e) => updateRow(index, { horaFim: e.target.value })} className="rounded-md border border-[#e2e8f0] px-2 py-1.5 text-[13px]" />
          </div>
          <textarea value={row.motivo || ''} onChange={(e) => updateRow(index, { motivo: e.target.value })} rows={2} placeholder="Motivo (opcional)" className="mt-2 w-full rounded-md border border-[#e2e8f0] px-2 py-1.5 text-[13px]" />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => removeRow(row, index)} className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100">
              <Trash2 className="h-3.5 w-3.5" />
              Remover
            </button>
            <button type="button" onClick={() => saveRow(row, index)} className="inline-flex items-center gap-1 rounded-md bg-[#00a88e] px-2 py-1.5 text-xs font-semibold text-white hover:bg-[#008f78]">
              {savingIndex === index ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salvar
            </button>
          </div>
        </div>
      ))}
      <button type="button" onClick={addRow} className="inline-flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-[13px] font-semibold text-[#0f172a] hover:bg-[#f8fafc]">
        <Plus className="h-4 w-4" />
        Adicionar bloqueio/exceção
      </button>
    </div>
  );
}
