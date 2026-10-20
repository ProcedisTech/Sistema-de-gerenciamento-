import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { htmlEstavel, limparAmbienteSnapshot, prepararAmbienteSnapshot } from '../../test/snapshotConsulta.jsx';
import { pacienteFixo } from '../../test/fixtures/consultaFixtures.js';
import { Step2Anamnese } from '../journey/Step2Anamnese.jsx';

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

describe('snapshot — Step2Anamnese em consultaMode', () => {
  beforeEach(prepararAmbienteSnapshot);
  afterEach(limparAmbienteSnapshot);

  it('anamnese da consulta sem fichas no servidor', async () => {
    const html = await htmlEstavel(
      <Step2Anamnese
        queixa="Rugas na testa"
        setQueixa={noop}
        expectativas="Aparência descansada"
        setExpectativas={noop}
        pacienteId={pacienteFixo.id}
        pacienteSexo={pacienteFixo.sexo}
        pacienteNome={pacienteFixo.nome}
        pacienteCpf={pacienteFixo.cpf}
        pacienteTelefone={pacienteFixo.telefone}
        roleUserId="ru-1"
        step2Errors={{}}
        setStep2Errors={noop}
        savedAnamneseState={null}
        onSavedAnamneseStateChange={noop}
        respostasAnamnese={{}}
        salvarRespostaAnamnese={noop}
        setRespostasAnamnese={noop}
        perfilClinicoDraft={null}
        onPerfilClinicoDraftChange={noop}
        consultaMode
        onConcluirAnamnese={noop}
        isConcluirAnamneseBusy={false}
        onSolicitarAoPaciente={noop}
        onSolicitacaoRespondida={noop}
      />,
    );
    expect(html).toMatchSnapshot();
  });
});
