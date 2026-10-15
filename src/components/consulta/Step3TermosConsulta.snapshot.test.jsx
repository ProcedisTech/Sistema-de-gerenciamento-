import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { htmlEstavel, limparAmbienteSnapshot, prepararAmbienteSnapshot } from '../../test/snapshotConsulta.jsx';
import { pacienteFixo, termoFixo } from '../../test/fixtures/consultaFixtures.js';
import { termosApi } from '../../services/api.js';
import { Step3Termos } from '../journey/Step4LGPD.jsx';

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
const pendentesUmTermo = [termoFixo.id];

function termos(extra) {
  return (
    <Step3Termos
      setTermoLido={noop}
      termoAssinaturaDataUrl=""
      setTermoAssinaturaDataUrl={noop}
      setTermoAssinado={noop}
      profissionalAssinaturaDataUrl=""
      setProfissionalAssinaturaDataUrl={noop}
      setStep4Errors={noop}
      termosAssinados={[]}
      setTermosAssinados={noop}
      termosPendentesIds={[]}
      setTermosPendentesIds={noop}
      termoTitulo=""
      termoConteudo=""
      onTermoChange={noop}
      onAssinaturaSalva={noop}
      pacienteId={pacienteFixo.id}
      procedimentoFeitoId={null}
      roleUserId="ru-1"
      pacienteCtx={{ nome: pacienteFixo.nome, cpf: pacienteFixo.cpf, telefone: pacienteFixo.telefone }}
      clinicaCtx={{ nome: 'Clínica Teste', cnpj: '00000000000191', endereco: 'Rua A, 1', telefone: '1133330000' }}
      profissionalCtx={{ nome: 'Dra. Beatriz', cpf: '98765432100', telefone: '11988880000' }}
      onConcluir={noop}
      catalogoIds={['cat-1']}
      exigirFilaVinculo
      termoFocoId={null}
      onAbrirMetodosAssinatura={noop}
      {...extra}
    />
  );
}

describe('snapshot — Step4LGPD (Step3Termos) no módulo termos da consulta', () => {
  beforeEach(prepararAmbienteSnapshot);
  afterEach(limparAmbienteSnapshot);

  it('termos da consulta com um catálogo, nenhum termo no servidor', async () => {
    const html = await htmlEstavel(termos());
    expect(html).toMatchSnapshot();
  });

  it('um termo cadastrado e pendente de assinatura', async () => {
    termosApi.list.mockResolvedValue([termoFixo]);
    termosApi.resolver.mockResolvedValue(null);
    const html = await htmlEstavel(termos({ termosPendentesIds: pendentesUmTermo }));
    expect(html).toMatchSnapshot();
  });
});
