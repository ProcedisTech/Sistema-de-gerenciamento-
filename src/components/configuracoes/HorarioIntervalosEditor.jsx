import React from "react";
import { Plus, Trash2 } from "lucide-react";

const DIAS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
];

const DIAS_ORDEM = [1, 2, 3, 4, 5, 6, 0];
const MAX_TURNOS_DIA = 3;

function emptyInterval(diaSemana = 1) {
  return {
    id: null,
    diaSemana,
    horaInicio: "08:00",
    horaFim: "18:00",
    ativo: true,
  };
}

export function HorarioIntervalosEditor({
  value = [],
  onChange,
  addButtonLabel = "Adicionar turno",
  emptyStateLabel = "Nenhum intervalo cadastrado.",
}) {
  const rows = Array.isArray(value) ? value : [];

  const counts = new Map(
    DIAS_ORDEM.map((day) => [
      day,
      rows.filter((row) => Number(row.diaSemana) === day).length,
    ]),
  );
  const nextDay =
    DIAS_ORDEM.find((day) => counts.get(day) === 0) ??
    [...DIAS_ORDEM]
      .sort((a, b) => counts.get(a) - counts.get(b))
      .find((day) => counts.get(day) < MAX_TURNOS_DIA);

  const updateRow = (index, patch) => {
    const next = rows.map((row, i) =>
      i === index ? { ...row, ...patch } : row,
    );
    onChange?.(next);
  };

  const removeRow = (index) => {
    onChange?.(rows.filter((_, i) => i !== index));
  };

  const addRow = () => {
    if (nextDay !== undefined) onChange?.([...rows, emptyInterval(nextDay)]);
  };

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#e2e8f0] bg-[#f8fafc] px-3 py-4 text-[13px] text-[#64748b]">
          {emptyStateLabel}
        </div>
      ) : null}
      {rows.map((row, index) => {
        const invalidTime = Boolean(
          row?.horaInicio && row?.horaFim && row.horaFim <= row.horaInicio,
        );
        return (
          <div
            key={`${row?.id || "new"}-${index}`}
            className="rounded-lg border border-[#e2e8f0] bg-white p-3"
          >
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
              <select
                aria-label={`Dia do intervalo ${index + 1}`}
                value={Number(row?.diaSemana ?? 1)}
                onChange={(e) =>
                  updateRow(index, { diaSemana: Number(e.target.value) })
                }
                className="rounded-md border border-[#e2e8f0] px-2 py-1.5 text-[13px]"
              >
                {DIAS.map((d) => (
                  <option
                    key={d.value}
                    value={d.value}
                    disabled={
                      d.value !== Number(row.diaSemana) &&
                      counts.get(d.value) >= MAX_TURNOS_DIA
                    }
                  >
                    {d.label}
                  </option>
                ))}
              </select>
              <input
                aria-label={`Início do intervalo ${index + 1}`}
                type="time"
                value={String(row?.horaInicio || "08:00").slice(0, 5)}
                onChange={(e) =>
                  updateRow(index, { horaInicio: e.target.value })
                }
                className={`rounded-md border px-2 py-1.5 text-[13px] ${invalidTime ? "border-red-500" : "border-[#e2e8f0]"}`}
              />
              <input
                aria-label={`Fim do intervalo ${index + 1}`}
                type="time"
                value={String(row?.horaFim || "18:00").slice(0, 5)}
                onChange={(e) => updateRow(index, { horaFim: e.target.value })}
                className={`rounded-md border px-2 py-1.5 text-[13px] ${invalidTime ? "border-red-500" : "border-[#e2e8f0]"}`}
              />
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="inline-flex items-center justify-center rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-red-600 hover:bg-red-100"
                title="Remover intervalo"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {invalidTime ? (
              <p className="mt-2 text-xs text-red-600">
                Horário final deve ser depois do horário inicial.
              </p>
            ) : null}
          </div>
        );
      })}
      <button
        type="button"
        onClick={addRow}
        disabled={nextDay === undefined}
        title={
          nextDay === undefined ? "Limite de horários atingido" : undefined
        }
        className="inline-flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-[13px] font-semibold text-[#0f172a] hover:bg-[#f8fafc]"
      >
        <Plus className="h-4 w-4" />
        {nextDay === undefined ? "Limite de horários atingido" : addButtonLabel}
      </button>
    </div>
  );
}
