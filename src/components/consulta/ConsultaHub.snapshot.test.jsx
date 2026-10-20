import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { htmlEstavel, limparAmbienteSnapshot, prepararAmbienteSnapshot } from '../../test/snapshotConsulta.jsx';
import { pacienteFixo } from '../../test/fixtures/consultaFixtures.js';
import { ConsultaHub } from './ConsultaHub.jsx';

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

describe('snapshot — ConsultaHub', () => {
  beforeEach(prepararAmbienteSnapshot);
  afterEach(limparAmbienteSnapshot);

  it('hub de consulta com um procedimento do catálogo', async () => {
    const html = await htmlEstavel(
      <ConsultaHub
        paciente={pacienteFixo}
        isRetorno={false}
        onSelectModule={noop}
        onIniciarRetornoAvulso={noop}
        onEncerrarConsulta={noop}
        catalogoIds={['cat-1']}
        exigirFilaVinculo
        nomeProcedimento="Toxina botulínica"
        atoJaIniciado={false}
        onTermosBloqueio={noop}
      />,
    );
    expect(html).toMatchSnapshot();
  });

  it('hub de retorno', async () => {
    const html = await htmlEstavel(
      <ConsultaHub
        paciente={pacienteFixo}
        isRetorno
        onSelectModule={noop}
        onIniciarRetornoAvulso={noop}
        onEncerrarConsulta={noop}
        catalogoIds={[]}
        exigirFilaVinculo={false}
        nomeProcedimento=""
        atoJaIniciado={false}
        onTermosBloqueio={noop}
      />,
    );
    expect(html).toMatchSnapshot();
  });
});
