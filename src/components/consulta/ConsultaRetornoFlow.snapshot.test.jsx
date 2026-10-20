import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { htmlEstavel, limparAmbienteSnapshot, prepararAmbienteSnapshot } from '../../test/snapshotConsulta.jsx';
import { fotosAvaliacaoFixas, pacienteFixo } from '../../test/fixtures/consultaFixtures.js';
import { useMapaAplicacaoState } from '../hooks/useMapaAplicacaoState.js';
import { ConsultaRetornoFlow } from './ConsultaRetornoFlow.jsx';

vi.mock('../../services/api.js', async (importOriginal) => {
  const { apiVazia } = await import('../../test/snapshotConsulta.jsx');
  return apiVazia(await importOriginal());
});
vi.mock('../../contexts/OrgContext', async (importOriginal) => {
  const { orgComTodasPermissoes } = await import('../../test/snapshotConsulta.jsx');
  const { PERMISSOES } = await import('../../constants/permissoes.js');
  return orgComTodasPermissoes(await importOriginal(), Object.values(PERMISSOES));
});

const noop = () => {};

function ComMapaRetorno(props) {
  const mapaRetornoState = useMapaAplicacaoState();
  return (
    <ConsultaRetornoFlow
      pacienteId={pacienteFixo.id}
      procedimentoFeitoOrigemId="pf-origem-1"
      catalogoId="cat-1"
      nomeProcedimento="Toxina botulínica"
      onOrigemResolved={noop}
      mapaRetornoState={mapaRetornoState}
      setHouveRetoque={noop}
      evaluationCapturedPhotos={fotosAvaliacaoFixas}
      evaluationPhotoMax={30}
      onEvaluationUploadFiles={noop}
      onEvaluationRemovePhoto={noop}
      procedureCapturedPhotos={[]}
      onProcedureUploadFiles={noop}
      onProcedureRemovePhoto={noop}
      onProcedureOpenCamera={noop}
      onConcluirRetorno={noop}
      {...props}
    />
  );
}

describe('snapshot — ConsultaRetornoFlow', () => {
  beforeEach(prepararAmbienteSnapshot);
  afterEach(limparAmbienteSnapshot);

  it('retorno sem retoque, origem sem dados no servidor', async () => {
    const html = await htmlEstavel(<ComMapaRetorno houveRetoque={false} />);
    expect(html).toMatchSnapshot();
  });

  it('retorno com retoque', async () => {
    const html = await htmlEstavel(<ComMapaRetorno houveRetoque />);
    expect(html).toMatchSnapshot();
  });
});
