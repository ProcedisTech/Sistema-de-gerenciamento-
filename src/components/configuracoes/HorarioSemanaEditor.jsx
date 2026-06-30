import React, { useState } from 'react';
import { Plus, Trash2, Copy, AlertCircle, Clock } from 'lucide-react';
import { Switch } from '../shared/Switch.jsx';
import { encontrarSobrepostos, hhmm } from './horarioSemanaUtils.js';

const DIAS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
];

/** Rótulo do turno conforme posição (0-indexed). */
function rotuloTurno(index, total) {
  if (total <= 1) return null;
  if (index === 0) return 'Manhã';
  if (index === 1) return 'Tarde';
  return `Turno ${index + 1}`;
}

function emptyTurno() {
  return { horaInicio: '08:00', horaFim: '18:00' };
}

/**
 * @param {{
 *   diasConfig: Array<{ ativo: boolean, turnos: Array<{ horaInicio: string, horaFim: string }> }>,
 *   onChange: (diasConfig: Array) => void,
 * }} props
 */
export function HorarioSemanaEditor({ diasConfig, onChange }) {
  const [confirmCopiarDia, setConfirmCopiarDia] = useState(null);

  const updateDia = (diaIdx, patch) => {
    const next = diasConfig.map((d, i) => (i === diaIdx ? { ...d, ...patch } : d));
    onChange(next);
  };

  const toggleDia = (diaIdx) => {
    const dia = diasConfig[diaIdx];
    if (!dia.ativo) {
      updateDia(diaIdx, { ativo: true, turnos: dia.turnos.length ? dia.turnos : [emptyTurno()] });
    } else {
      updateDia(diaIdx, { ativo: false });
    }
  };

  const addTurno = (diaIdx) => {
    const dia = diasConfig[diaIdx];
    updateDia(diaIdx, { turnos: [...dia.turnos, emptyTurno()] });
  };

  const removeTurno = (diaIdx, turnoIdx) => {
    const dia = diasConfig[diaIdx];
    updateDia(diaIdx, { turnos: dia.turnos.filter((_, i) => i !== turnoIdx) });
  };

  const updateTurno = (diaIdx, turnoIdx, patch) => {
    const dia = diasConfig[diaIdx];
    const turnos = dia.turnos.map((t, i) => (i === turnoIdx ? { ...t, ...patch } : t));
    updateDia(diaIdx, { turnos });
  };

  const handleCopiarParaTodos = (diaIdx) => {
    setConfirmCopiarDia(diaIdx);
  };

  const confirmarCopia = () => {
    const origem = diasConfig[confirmCopiarDia];
    const next = diasConfig.map((d, i) =>
      i === confirmCopiarDia ? d : { ...d, ativo: origem.ativo, turnos: origem.turnos.map((t) => ({ ...t })) }
    );
    onChange(next);
    setConfirmCopiarDia(null);
  };

  const todosDesmarcados = diasConfig.every((d) => !d.ativo);

  return (
    <div className="space-y-2">
      {/* Empty state */}
      {todosDesmarcados && (
        <div className="rounded-xl border border-dashed border-[#e2e8f0] bg-[#f8fafc] px-4 py-5 text-center">
          <Clock className="mx-auto mb-2 h-8 w-8 text-[#94a3b8]" aria-hidden />
          <p className="text-[13px] font-semibold text-[#475569]">Nenhum dia configurado</p>
          <p className="mt-0.5 text-[12px] text-[#94a3b8]">
            Ligue o botão ao lado de cada dia para definir o horário.
          </p>
          <button
            type="button"
            onClick={() => {
              const next = diasConfig.map((d, i) =>
                i >= 1 && i <= 5
                  ? { ativo: true, turnos: [{ horaInicio: '08:00', horaFim: '18:00' }] }
                  : { ativo: false, turnos: [] }
              );
              onChange(next);
            }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#00a88e]/30 bg-[#f0fdf9] px-3 py-1.5 text-[12px] font-semibold text-[#00a88e] transition-colors hover:bg-[#dcfdf4]"
          >
            Usar horário comercial padrão (Seg–Sex, 8h–18h)
          </button>
        </div>
      )}

      {/* Lista dos 7 dias */}
      {DIAS.map(({ value: diaIdx, label }) => {
        const dia = diasConfig[diaIdx];
        const sobrepostos = encontrarSobrepostos(dia.turnos);
        const temSobreposto = sobrepostos.size > 0;

        return (
          <div
            key={diaIdx}
            className={`rounded-xl border bg-white transition-colors ${
              dia.ativo ? 'border-[#e2e8f0]' : 'border-[#f1f5f9] bg-[#fafafa]'
            }`}
          >
            {/* Cabeçalho do dia */}
            <div className="flex items-center gap-3 px-4 py-3">
              <Switch
                checked={dia.ativo}
                onChange={() => toggleDia(diaIdx)}
                ariaLabel={`${label} ${dia.ativo ? 'ativo' : 'inativo'}`}
              />
              <span
                className={`min-w-[110px] text-[13px] font-semibold ${
                  dia.ativo ? 'text-[#0f172a]' : 'text-[#94a3b8]'
                }`}
              >
                {label}
              </span>

              {!dia.ativo && (
                <span className="text-[12px] text-[#94a3b8]">
                  Fechado — ligue o botão para definir horários
                </span>
              )}

              {dia.ativo && temSobreposto && (
                <span className="ml-auto flex items-center gap-1 text-[12px] font-medium text-red-600">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                  Turnos sobrepostos
                </span>
              )}

              {dia.ativo && !temSobreposto && (
                <button
                  type="button"
                  onClick={() => handleCopiarParaTodos(diaIdx)}
                  title="Copiar horário para todos os dias"
                  className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[#64748b] transition-colors hover:bg-[#f1f5f9] hover:text-[#0f172a]"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                  Copiar para todos
                </button>
              )}
            </div>

            {/* Turnos */}
            {dia.ativo && (
              <div className="border-t border-[#f1f5f9] px-4 pb-3 pt-2 space-y-2">
                {dia.turnos.map((turno, turnoIdx) => {
                  const rotulo = rotuloTurno(turnoIdx, dia.turnos.length);
                  const fimInvalido = Boolean(
                    turno.horaInicio && turno.horaFim && hhmm(turno.horaFim) <= hhmm(turno.horaInicio)
                  );
                  const sobreposto = sobrepostos.has(turnoIdx);
                  const erroTurno = fimInvalido || sobreposto;

                  return (
                    <div key={turnoIdx}>
                      {rotulo && (
                        <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#94a3b8]">
                          {rotulo}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={hhmm(turno.horaInicio)}
                          onChange={(e) => updateTurno(diaIdx, turnoIdx, { horaInicio: e.target.value })}
                          className={`rounded-md border px-2 py-1.5 text-[13px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00a88e]/40 ${
                            erroTurno ? 'border-red-400 bg-red-50' : 'border-[#e2e8f0]'
                          }`}
                        />
                        <span className="text-[12px] text-[#94a3b8]">até</span>
                        <input
                          type="time"
                          value={hhmm(turno.horaFim)}
                          onChange={(e) => updateTurno(diaIdx, turnoIdx, { horaFim: e.target.value })}
                          className={`rounded-md border px-2 py-1.5 text-[13px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00a88e]/40 ${
                            erroTurno ? 'border-red-400 bg-red-50' : 'border-[#e2e8f0]'
                          }`}
                        />
                        {dia.turnos.length >= 2 && (
                          <button
                            type="button"
                            onClick={() => removeTurno(diaIdx, turnoIdx)}
                            className="ml-auto inline-flex items-center justify-center rounded-md border border-red-200 bg-red-50 p-1.5 text-red-600 transition-colors hover:bg-red-100"
                            title="Remover turno"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        )}
                      </div>
                      {fimInvalido && (
                        <p className="mt-1 text-[11px] text-red-600">
                          Horário final deve ser depois do horário inicial.
                        </p>
                      )}
                      {sobreposto && !fimInvalido && (
                        <p className="mt-1 text-[11px] text-red-600">
                          Este turno se sobrepõe a outro turno do dia.
                        </p>
                      )}
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => addTurno(diaIdx)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[#e2e8f0] px-3 py-1.5 text-[12px] font-medium text-[#64748b] transition-colors hover:border-[#00a88e]/40 hover:bg-[#f0fdf9] hover:text-[#00a88e]"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Adicionar turno
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Modal de confirmar cópia */}
      {confirmCopiarDia !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="copiar-modal-title"
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setConfirmCopiarDia(null)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-xl">
            <h2 id="copiar-modal-title" className="mb-2 text-[16px] font-bold text-[#0f172a]">
              Copiar horário para todos os dias
            </h2>
            <p className="mb-6 text-[14px] leading-relaxed text-[#475569]">
              O horário de{' '}
              <strong>{DIAS[confirmCopiarDia]?.label}</strong> será copiado para
              todos os outros dias (substituindo os horários existentes). Essa
              ação não pode ser desfeita aqui — você pode salvar antes se
              quiser preservar o estado atual.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmCopiarDia(null)}
                className="rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-[13px] font-semibold text-[#475569] transition-colors hover:bg-[#f8fafc]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarCopia}
                className="rounded-lg bg-[#00a88e] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#008f78]"
              >
                Confirmar cópia
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
