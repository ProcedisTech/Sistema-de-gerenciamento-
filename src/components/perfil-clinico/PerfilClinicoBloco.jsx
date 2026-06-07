import React, { useMemo } from 'react';
import { AlertCircle, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { classifyPerfilError } from '../../hooks/usePerfilClinico';
import { CatalogoChipSection } from './CatalogoChipSection';

/**
 * Bloco 1 — Perfil Clínico Persistente
 *
 * Recebe estado e handlers do `usePerfilClinico` (estado liftado para Step2Anamnese
 * para que o "Continuar" do AppRefactored possa disparar o `save()`).
 *
 * Props: todas vindas de usePerfilClinico destructurado
 */
export function PerfilClinicoBloco({
  state,
  isLoading,
  isSaving = false,
  error,
  load,
  addItem,
  removeItem,
  updateObservacao,
  updateMedicamentoExtra,
  buscarAlimentos,
  buscarPrincipiosAtivos,
  buscarMedicamentos,
  buscarAntecedentes,
}) {
  const errorMessage = useMemo(
    () => (error ? classifyPerfilError(error) : ''),
    [error],
  );

  const secoesPreenchidas = useMemo(() => {
    const lists = [
      state.alergias,
      state.alergiasPrincipioAtivo,
      state.medicamentosEmUso,
      state.antecedentes,
    ];
    return lists.filter((arr) => Array.isArray(arr) && arr.length > 0).length;
  }, [state]);

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="mb-3 flex items-center justify-between">
          <div className="h-4 w-32 rounded bg-slate-200" />
        </div>
        <div className="flex flex-col gap-5">
          <div className="border-l-2 border-l-red-200 pl-3">
            <div className="mb-3 h-3 w-20 rounded bg-slate-200" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-6">
              {[1, 2].map((i) => (
                <div key={i} className="flex min-w-0 flex-col gap-1.5">
                  <div className="h-3.5 w-32 rounded bg-slate-200" />
                  <div className="h-8 w-full rounded-lg bg-slate-100" />
                </div>
              ))}
            </div>
          </div>
          <div className="border-l-2 border-l-slate-200 pl-3">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-6">
              {[3, 4].map((i) => (
                <div key={i} className="flex min-w-0 flex-col gap-1.5">
                  <div className="h-3.5 w-32 rounded bg-slate-200" />
                  <div className="h-8 w-full rounded-lg bg-slate-100" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#00a88e]">① Perfil do paciente</p>
          <h3 className="text-[12px] font-bold text-slate-600">Dados permanentes</h3>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            {secoesPreenchidas} de 4 seções
          </span>
          {isSaving && (
            <span className="flex items-center gap-1 text-[11px] text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Salvando…
            </span>
          )}
        {error && (
          <button
            type="button"
            onClick={load}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-600 hover:bg-red-100 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Tentar novamente
          </button>
        )}
        </div>
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {errorMessage}
        </div>
      )}

      <div className="flex flex-col gap-5">
        <section className="rounded-lg border-l-[3px] border-l-red-400 bg-red-50/40 pl-3 pr-1 py-1">
          <div className="mb-3 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" aria-hidden />
            <h4 className="text-[11px] font-bold uppercase tracking-wide text-red-700/80">Alergias</h4>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-6 md:gap-y-4">
            <CatalogoChipSection
              titulo="Alergias alimentares"
              selected={state.alergias}
              onAdd={(item) => addItem('alergias', item)}
              onRemove={(id) => removeItem('alergias', id)}
              onUpdateObservacao={(id, texto) => updateObservacao('alergias', id, texto)}
              searchFn={buscarAlimentos}
              placeholder="Buscar alimento (ex.: amendoim, glúten…)"
            />

            <CatalogoChipSection
              titulo="Alergias a princípios ativos"
              selected={state.alergiasPrincipioAtivo}
              onAdd={(item) => addItem('alergiasPrincipioAtivo', item)}
              onRemove={(id) => removeItem('alergiasPrincipioAtivo', id)}
              onUpdateObservacao={(id, texto) => updateObservacao('alergiasPrincipioAtivo', id, texto)}
              searchFn={buscarPrincipiosAtivos}
              placeholder="Buscar princípio ativo (ex.: dipirona, penicilina…)"
            />
          </div>
        </section>

        <section className="border-l-[3px] border-l-slate-200 pl-3 pr-1">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-6 md:gap-y-4">
            <CatalogoChipSection
              titulo="Medicamentos em uso"
              selected={state.medicamentosEmUso}
              onAdd={(item) => addItem('medicamentosEmUso', item)}
              onRemove={(id) => removeItem('medicamentosEmUso', id)}
              onUpdateObservacao={(id, texto) => updateObservacao('medicamentosEmUso', id, texto)}
              searchFn={buscarMedicamentos}
              placeholder="Buscar medicamento…"
              renderChipExtra={(item, _onChange) => (
                <MedicamentoExtra
                  item={item}
                  onChange={(fields) => updateMedicamentoExtra(item.id, fields)}
                />
              )}
            />

            <CatalogoChipSection
              titulo="Antecedentes pessoais"
              selected={state.antecedentes}
              onAdd={(item) => addItem('antecedentes', item)}
              onRemove={(id) => removeItem('antecedentes', id)}
              onUpdateObservacao={(id, texto) => updateObservacao('antecedentes', id, texto)}
              searchFn={buscarAntecedentes}
              placeholder="Buscar antecedente (ex.: hipertensão, diabetes…)"
            />
          </div>
        </section>
      </div>
    </div>
  );
}

/** Sub-componente para campos extras de medicamento (dose, frequência, uso contínuo). */
function MedicamentoExtra({ item, onChange }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[11px] text-slate-500">Dose</span>
          <input
            type="text"
            value={item.dose ?? ''}
            onChange={(e) => onChange({ dose: e.target.value })}
            placeholder="ex.: 500 mg"
            className="rounded border border-slate-200 px-2 py-1 text-[12px] text-slate-700 outline-none focus:border-[#00a88e] transition-colors"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[11px] text-slate-500">Frequência</span>
          <input
            type="text"
            value={item.frequencia ?? ''}
            onChange={(e) => onChange({ frequencia: e.target.value })}
            placeholder="ex.: 1x/dia"
            className="rounded border border-slate-200 px-2 py-1 text-[12px] text-slate-700 outline-none focus:border-[#00a88e] transition-colors"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={item.usoContinuo ?? true}
          onChange={(e) => onChange({ usoContinuo: e.target.checked })}
          className="h-3.5 w-3.5 accent-[#00a88e]"
        />
        <span className="text-[12px] text-slate-600">Uso contínuo</span>
      </label>
    </div>
  );
}
