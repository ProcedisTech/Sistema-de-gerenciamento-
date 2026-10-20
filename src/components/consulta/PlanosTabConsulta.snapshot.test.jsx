import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { htmlEstavel, limparAmbienteSnapshot, prepararAmbienteSnapshot } from '../../test/snapshotConsulta.jsx';
import { pacienteFixo, planoFixo } from '../../test/fixtures/consultaFixtures.js';
import { planejamentosApi, procedimentosApi } from '../../services/api.js';
import { PlanosTab } from '../planos/PlanosTab.jsx';

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

function planos() {
  return (
    <PlanosTab
      variant="consulta"
      pacienteId={pacienteFixo.id}
      roleUserId="ru-1"
      pacienteNome={pacienteFixo.nome}
      paciente={pacienteFixo}
      onVoltar={noop}
      onSelectProcedimentoParaConsulta={noop}
      onAgendarItem={noop}
      onAgendarRetornoItem={noop}
      onConcluirComRetorno={noop}
      onPlanoConcluido={noop}
    />
  );
}

describe('snapshot — PlanosTab variante consulta', () => {
  beforeEach(() => {
    prepararAmbienteSnapshot();
    // Sem `procedimentosFeitos` (como em AppRefactored.jsx:4572) o efeito de PlanosTab.jsx:1267 refaz a busca a
    // cada render enquanto ela devolver array; resposta não-array para o laço parar no snapshot.
    procedimentosApi.byPaciente.mockResolvedValue(undefined);
  });
  afterEach(limparAmbienteSnapshot);

  it('paciente sem plano', async () => {
    planejamentosApi.listarPorPaciente.mockResolvedValue([]);
    const html = await htmlEstavel(planos());
    expect(html).toMatchSnapshot();
  });

  it('paciente com um plano ativo', async () => {
    planejamentosApi.listarPorPaciente.mockResolvedValue([planoFixo]);
    const html = await htmlEstavel(planos());
    expect(html).toMatchSnapshot();
  });
});
