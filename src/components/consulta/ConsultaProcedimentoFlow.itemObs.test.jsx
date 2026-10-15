import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assentar, limparAmbienteSnapshot, prepararAmbienteSnapshot } from '../../test/snapshotConsulta.jsx';
import { ConsultaProcedimentoFlow } from './ConsultaProcedimentoFlow.jsx';

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
const OBS = 'Aplicação sem intercorrências';

function Flow({ lote }) {
  return (
    <ConsultaProcedimentoFlow
      pacienteIdForProcedures="pac-1"
      nomeProcedimento="Toxina botulínica"
      setNomeProcedimento={noop}
      setNomeProcedimentoCatalogoId={noop}
      setProcedimentoDoCatalogo={noop}
      procedimentosLote={lote}
      activeProcedimentoIndex={0}
      setActiveProcedimentoIndex={noop}
      updateProcedureByIndex={noop}
      observacoesExecucao={OBS}
      setObservacoesExecucao={noop}
      procedureCapturedPhotos={[]}
      setProcedureCapturedPhotos={noop}
      procedurePhotoMax={30}
      step4Errors={{}}
      setStep4Errors={noop}
      fotosAvaliacao={[]}
      onProcedureFotoCategoriaSync={noop}
      roleUserId="ru-1"
      catalogoId="cat-1"
      itensOrientacoes={[]}
      itensSemOrientacaoMarcada={[]}
      step5Errors={{}}
      setStep5Errors={noop}
      toast={{ error: noop, success: noop, info: noop, warning: noop }}
    />
  );
}

const linha = (extra) => ({
  procedimentoNome: 'Toxina botulínica',
  nomeProcedimento: 'Toxina botulínica',
  catalogoProcedimentoSaudeId: 'cat-1',
  ...extra,
});

describe('observação da execução — data-campo-consulta por item', () => {
  beforeEach(prepararAmbienteSnapshot);
  afterEach(limparAmbienteSnapshot);

  it('(c) com itemId o textarea recebe item:<id>:obs', async () => {
    render(<Flow lote={[linha({ itemId: 'item-42' })]} />);
    await assentar();
    const ta = screen.getByDisplayValue(OBS);
    expect(ta.tagName).toBe('TEXTAREA');
    expect(ta).toHaveAttribute('data-campo-consulta', 'item:item-42:obs');
  });

  it('(c) sem itemId o textarea não tem o atributo', async () => {
    render(<Flow lote={[linha({})]} />);
    await assentar();
    const ta = screen.getByDisplayValue(OBS);
    expect(ta.hasAttribute('data-campo-consulta')).toBe(false);
  });
});
