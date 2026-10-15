import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assentar, limparAmbienteSnapshot, prepararAmbienteSnapshot } from '../../test/snapshotConsulta.jsx';
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

function planos(extra = {}) {
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
      {...extra}
    />
  );
}

/** Dois procedimentos já feitos do mesmo catálogo do item do planoFixo (cat-1). */
const feitosCat1 = [
  { id: 'pf-1', catalogoProcedimentoSaudeId: 'cat-1', nomeProcedimento: 'Toxina botulínica' },
  { id: 'pf-2', catalogoProcedimentoSaudeId: 'cat-1', nomeProcedimento: 'Toxina botulínica' },
];

describe('PlanosTab variante consulta — chamadas de procedimentosApi.byPaciente', () => {
  beforeEach(() => {
    prepararAmbienteSnapshot();
    vi.clearAllMocks();
    planejamentosApi.listarPorPaciente.mockResolvedValue([]);
  });
  afterEach(limparAmbienteSnapshot);

  it('(a) busca o histórico uma única vez com o pacienteId', async () => {
    procedimentosApi.byPaciente.mockResolvedValue([]);
    render(planos());
    await assentar();
    expect(procedimentosApi.byPaciente).toHaveBeenCalledTimes(1);
    expect(procedimentosApi.byPaciente).toHaveBeenCalledWith(pacienteFixo.id);
  });

  it('(b) troca de paciente busca de novo; mesmo paciente não', async () => {
    procedimentosApi.byPaciente.mockResolvedValue([]);
    const { rerender } = render(planos());
    await assentar();
    expect(procedimentosApi.byPaciente).toHaveBeenCalledTimes(1);

    rerender(planos({ pacienteId: 'pac-2' }));
    await assentar();
    expect(procedimentosApi.byPaciente).toHaveBeenCalledTimes(2);
    expect(procedimentosApi.byPaciente).toHaveBeenLastCalledWith('pac-2');

    rerender(planos({ pacienteId: 'pac-2' }));
    await assentar();
    expect(procedimentosApi.byPaciente).toHaveBeenCalledTimes(2);
  });

  it('(c) selo "Nª vez" conta o histórico buscado na consulta', async () => {
    planejamentosApi.listarPorPaciente.mockResolvedValue([planoFixo]);
    procedimentosApi.byPaciente.mockResolvedValue(feitosCat1);
    render(planos());
    await assentar();
    expect(screen.getAllByText('3ª vez').length).toBeGreaterThan(0);
    expect(screen.queryByText('1ª vez')).toBeNull();
  });

  it('(d) com procedimentosFeitos na prop não busca o histórico', async () => {
    procedimentosApi.byPaciente.mockResolvedValue([]);
    render(planos({ procedimentosFeitos: feitosCat1 }));
    await assentar();
    expect(procedimentosApi.byPaciente).not.toHaveBeenCalled();
  });
});
