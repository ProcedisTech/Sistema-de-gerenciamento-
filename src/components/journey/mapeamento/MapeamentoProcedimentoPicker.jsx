import React from 'react';
import { useCatalogoMapeamentoOptions } from '../../../hooks/useCatalogoMapeamentoOptions.js';
import { MapeamentoProcedimentoSearch } from './MapeamentoProcedimentoSearch.jsx';

export function MapeamentoProcedimentoPicker({ procedimentoArmado, onArmar, procedimentosUsados = [] }) {
  const { options, loading } = useCatalogoMapeamentoOptions({ enabled: true });

  return (
    <MapeamentoProcedimentoSearch
      options={options}
      loading={loading}
      procedimentoArmado={procedimentoArmado}
      procedimentosUsados={procedimentosUsados}
      onArmar={onArmar}
    />
  );
}
