import React from 'react';
import { useEstadosCivis } from '../../hooks/useEstadosCivis.js';

/**
 * Estado civil conforme `/api/v1/dimensoes/estados-civis` (`id` + `nome`).
 */
export function EstadoCivilSelect({
  value,
  onChange,
  disabled = false,
  error: _error = false,
  selectClassName,
  id,
}) {
  const { estadosCivis, loading, error: loadError, reload } = useEstadosCivis();
  const mergedDisabled = disabled || loading;

  const showRows = !loading && !loadError && estadosCivis.length > 0;

  return (
    <div className="space-y-1">
      <select
        id={id}
        value={value}
        disabled={mergedDisabled}
        aria-invalid={_error ? 'true' : undefined}
        aria-busy={loading || undefined}
        onChange={(e) => {
          if (mergedDisabled) return;
          onChange(e.target.value);
        }}
        className={selectClassName}
      >
        <option value="">{loading ? 'Carregando…' : 'Selecione...'}</option>
        {showRows
          ? estadosCivis.map((ec) => (
              <option key={ec.id} value={ec.id}>
                {ec.nome}
              </option>
            ))
          : null}
      </select>
      {loadError && !loading ? (
        <p className="text-[12px] font-medium text-amber-800" role="alert">
          Não foi possível carregar estados civis.
          <button
            type="button"
            onClick={() => reload()}
            className="ml-1 font-bold text-[#00a88e] underline underline-offset-2 hover:text-[#00967f]"
          >
            Tentar novamente
          </button>
        </p>
      ) : null}
      {!loading && !loadError && estadosCivis.length === 0 ? (
        <p className="text-[12px] font-medium text-slate-600" role="status">
          Nenhum estado civil cadastrado no sistema.
        </p>
      ) : null}
    </div>
  );
}
