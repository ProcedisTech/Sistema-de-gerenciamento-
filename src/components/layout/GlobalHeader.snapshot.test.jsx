import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { htmlEstavel, limparAmbienteSnapshot, prepararAmbienteSnapshot } from '../../test/snapshotConsulta.jsx';
import { criarAvisosFalsos } from '../../test/avisosFalsos.jsx';
import { GlobalHeader } from './GlobalHeader.jsx';

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

describe('snapshot — GlobalHeader', () => {
  beforeEach(prepararAmbienteSnapshot);
  afterEach(limparAmbienteSnapshot);

  it.each(['agenda', 'pacientes', 'consulta'])('cabeçalho na view %s, sem o atalho da consulta', async (view) => {
    const { Wrapper } = criarAvisosFalsos();
    const html = await htmlEstavel(
      <Wrapper>
        <GlobalHeader
          activeView={view}
          onPatientSelect={noop}
          onNovoPaciente={noop}
          onAgendamento={noop}
          onOpenNotificacoes={noop}
          notificacoesRefreshKey={0}
          patientSearchQuery=""
          setPatientSearchQuery={noop}
          authUser={{ nome: 'Beatriz Lima', email: 'beatriz@teste.com' }}
          clinicaNome="Clínica Teste"
          clinicaLogoUrl=""
          perfilNomeCompleto="Beatriz Lima"
          perfilApelido="Bia"
          perfilFotoUrl=""
          onOpenClinicaSettings={noop}
          onOpenPerfilSettings={noop}
        />
      </Wrapper>,
    );
    expect(document.querySelector('[data-atalho-consulta]')).toBeNull();
    expect(html).toMatchSnapshot();
  });
});
