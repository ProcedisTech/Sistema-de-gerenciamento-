import React, { useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  FlaskConical,
  HeartPulse,
  Loader2,
  Pill,
  RefreshCw,
  Shield,
  UtensilsCrossed,
} from 'lucide-react';
import { classifyPerfilError } from '../../hooks/usePerfilClinico';
import { CatalogoChipSection } from './CatalogoChipSection';

/**
 * Bloco 1 — Perfil Clínico Persistente
 *
 * Recebe estado e handlers do `usePerfilClinico` (estado liftado para Step2Anamnese
 * para que o "Continuar" do AppRefactored possa disparar o `save()`).
 */
export function PerfilClinicoBloco({
  state,
  isLoading,
  isSaving = false,
  isDirty = false,
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
  readOnly = false,
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

  const statusBanner = useMemo(() => {
    if (error || isLoading) return null;
    if (secoesPreenchidas === 0) {
      return {
        text: 'Nenhuma informação registrada ainda — preencha alergias e medicamentos quando souber',
        className: 'bg-slate-50 border-slate-200 text-slate-600',
        icon: null,
      };
    }
    if (secoesPreenchidas < 4) {
      return {
        text: `Perfil parcial — ${secoesPreenchidas} de 4 áreas preenchidas`,
        className: 'bg-[#fffbeb] border-[#fde68a] text-[#92400e]',
        icon: AlertTriangle,
      };
    }
    return {
      text: 'Perfil completo — 4 de 4 áreas',
      className: 'bg-[#e6f7f5] border-[#00a88e] text-[#0f766e]',
      icon: CheckCircle,
    };
  }, [error, isLoading, secoesPreenchidas]);

  if (isLoading) {
    return (
      <div className="min-w-0 animate-pulse">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-200" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-36 rounded bg-slate-200" />
              <div className="h-3 w-52 max-w-full rounded bg-slate-100" />
            </div>
          </div>
          <div className="h-6 w-24 shrink-0 rounded-full bg-slate-100" />
        </div>
        <div className="mb-3 h-10 w-full rounded-lg bg-slate-100" />
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

  const StatusIcon = statusBanner?.icon;

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#e6f7f5] text-[#00a88e]"
            aria-hidden
          >
            <Shield className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold leading-snug text-slate-800 sm:text-[16px]">
              Perfil clínico
            </h3>
            <p className="mt-0.5 text-[12px] text-slate-500">
              {readOnly
                ? 'Registro permanente atual do paciente'
                : 'Registro permanente — independente da ficha'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
            {secoesPreenchidas} de 4 áreas
          </span>
          {isDirty && !readOnly && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-800">
              Alterações não salvas
            </span>
          )}
          {isSaving && !readOnly && (
            <span className="flex items-center gap-1 text-[11px] text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Salvando…
            </span>
          )}
          {error && !readOnly && (
            <button
              type="button"
              onClick={load}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-600 transition-colors hover:bg-red-100"
            >
              <RefreshCw className="h-3 w-3" />
              Tentar novamente
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-600">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 break-words">{errorMessage}</span>
        </div>
      )}

      {statusBanner && (
        <div
          className={`mb-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[12px] font-medium leading-snug ${statusBanner.className}`}
        >
          {StatusIcon ? (
            <StatusIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
          ) : null}
          <span className="min-w-0 break-words">{statusBanner.text}</span>
        </div>
      )}

      <div className="flex flex-col gap-5">
        <section className="rounded-lg border-l-[3px] border-l-amber-400 bg-amber-50/40 py-1 pl-3 pr-1">
          <div className="mb-3 flex items-center gap-1.5">
            <UtensilsCrossed className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
            <h4 className="text-[11px] font-bold uppercase tracking-wide text-amber-800/80">Alergias alimentares</h4>
          </div>
          <CatalogoChipSection
            titulo="Alergias alimentares"
            selected={state.alergias}
            onAdd={(item) => addItem('alergias', item)}
            onRemove={(id) => removeItem('alergias', id)}
            onUpdateObservacao={(id, texto) => updateObservacao('alergias', id, texto)}
            searchFn={buscarAlimentos}
            placeholder="Buscar alimento (ex.: amendoim, glúten…)"
            readOnly={readOnly}
          />
        </section>

        <section className="rounded-lg border-l-[3px] border-l-purple-400 bg-purple-50/40 py-1 pl-3 pr-1">
          <div className="mb-3 flex items-center gap-1.5">
            <FlaskConical className="h-3.5 w-3.5 shrink-0 text-purple-500" aria-hidden />
            <h4 className="text-[11px] font-bold uppercase tracking-wide text-purple-700/80">
              Alergias a princípios ativos
            </h4>
          </div>
          <CatalogoChipSection
            titulo="Alergias a princípios ativos"
            selected={state.alergiasPrincipioAtivo}
            onAdd={(item) => addItem('alergiasPrincipioAtivo', item)}
            onRemove={(id) => removeItem('alergiasPrincipioAtivo', id)}
            onUpdateObservacao={(id, texto) => updateObservacao('alergiasPrincipioAtivo', id, texto)}
            searchFn={buscarPrincipiosAtivos}
            placeholder="Buscar princípio ativo (ex.: dipirona, penicilina…)"
            readOnly={readOnly}
          />
        </section>

        <section className="rounded-lg border-l-[3px] border-l-blue-400 bg-blue-50/40 py-1 pl-3 pr-1">
          <div className="mb-3 flex items-center gap-1.5">
            <Pill className="h-3.5 w-3.5 shrink-0 text-blue-500" aria-hidden />
            <h4 className="text-[11px] font-bold uppercase tracking-wide text-blue-700/80">Medicamentos em uso</h4>
          </div>
          <CatalogoChipSection
            titulo="Medicamentos em uso"
            selected={state.medicamentosEmUso}
            onAdd={(item) => addItem('medicamentosEmUso', item)}
            onRemove={(id) => removeItem('medicamentosEmUso', id)}
            onUpdateObservacao={(id, texto) => updateObservacao('medicamentosEmUso', id, texto)}
            searchFn={buscarMedicamentos}
            placeholder="Buscar medicamento…"
            readOnly={readOnly}
            renderChipExtra={readOnly ? undefined : (item, _onChange) => (
              <MedicamentoExtra
                item={item}
                onChange={(fields) => updateMedicamentoExtra(item.id, fields)}
              />
            )}
          />
        </section>

        <section className="rounded-lg border-l-[3px] border-l-red-400 bg-red-50/40 py-1 pl-3 pr-1">
          <div className="mb-3 flex items-center gap-1.5">
            <HeartPulse className="h-3.5 w-3.5 shrink-0 text-red-500" aria-hidden />
            <h4 className="text-[11px] font-bold uppercase tracking-wide text-red-700/80">Antecedentes</h4>
          </div>
          <CatalogoChipSection
            titulo="Antecedentes pessoais"
            selected={state.antecedentes}
            onAdd={(item) => addItem('antecedentes', item)}
            onRemove={(id) => removeItem('antecedentes', id)}
            onUpdateObservacao={(id, texto) => updateObservacao('antecedentes', id, texto)}
            searchFn={buscarAntecedentes}
            placeholder="Buscar antecedente (ex.: hipertensão, diabetes…)"
            readOnly={readOnly}
          />
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
            className="rounded border border-slate-200 px-2 py-1 text-[12px] text-slate-700 outline-none transition-colors focus:border-[#00a88e]"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[11px] text-slate-500">Frequência</span>
          <input
            type="text"
            value={item.frequencia ?? ''}
            onChange={(e) => onChange({ frequencia: e.target.value })}
            placeholder="ex.: 1x/dia"
            className="rounded border border-slate-200 px-2 py-1 text-[12px] text-slate-700 outline-none transition-colors focus:border-[#00a88e]"
          />
        </label>
      </div>
      <label className="flex cursor-pointer items-center gap-2">
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
