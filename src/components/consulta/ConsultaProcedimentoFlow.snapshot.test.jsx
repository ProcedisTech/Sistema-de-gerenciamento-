import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assentar,
  htmlEstavel,
  limparAmbienteSnapshot,
  prepararAmbienteSnapshot,
} from '../../test/snapshotConsulta.jsx';
import {
  INSTANTE_FIXO,
  fotosAvaliacaoFixas,
  fotosProcedimentoFixas,
  loteFixo,
  orientacoesFixas,
  pacienteFixo,
} from '../../test/fixtures/consultaFixtures.js';
import { useMapaAplicacaoState } from '../hooks/useMapaAplicacaoState.js';
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
const toastFalso = { error: noop, success: noop, info: noop, warning: noop };
const validarTermos = async () => true;

function ComMapa(props) {
  const mapaState = useMapaAplicacaoState();
  return (
    <ConsultaProcedimentoFlow
      pacienteIdForProcedures={pacienteFixo.id}
      nomeProcedimento="Toxina botulínica"
      setNomeProcedimento={noop}
      setNomeProcedimentoCatalogoId={noop}
      setProcedimentoDoCatalogo={noop}
      procedimentosLote={loteFixo}
      activeProcedimentoIndex={0}
      setActiveProcedimentoIndex={noop}
      updateProcedureByIndex={noop}
      observacoesExecucao="Aplicação sem intercorrências"
      setObservacoesExecucao={noop}
      procedureCapturedPhotos={fotosProcedimentoFixas}
      setProcedureCapturedPhotos={noop}
      procedurePhotoMax={30}
      onProcedureUploadFiles={noop}
      onProcedureRemovePhoto={noop}
      step4Errors={{}}
      setStep4Errors={noop}
      fotosAvaliacao={fotosAvaliacaoFixas}
      onProcedureFotoCategoriaSync={noop}
      onProcedureAnnotatePhoto={noop}
      mapaState={mapaState}
      roleUserId="ru-1"
      procedimentoFeitoId={null}
      catalogoId="cat-1"
      onValidarTermosCatalogo={validarTermos}
      procedureDateIso={INSTANTE_FIXO.slice(0, 10)}
      itensOrientacoes={[
        { itemId: 'item-1', nome: 'Toxina botulínica', orient: orientacoesFixas, legado: false },
      ]}
      setOrientacoesDoItem={noop}
      itensSemOrientacaoMarcada={[]}
      step5Errors={{}}
      setStep5Errors={noop}
      pacienteNome={pacienteFixo.nome}
      pacienteIdade={pacienteFixo.idade}
      pacienteCpf={pacienteFixo.cpf}
      telefonePaciente={pacienteFixo.telefone}
      queixa="Rugas na testa"
      profissionalAssinaturaDataUrl=""
      termoAssinaturaDataUrl=""
      termoTitulo=""
      nomeUsuario="Dra. Beatriz"
      encerrarAtendimento={noop}
      toast={toastFalso}
      {...props}
    />
  );
}

describe('snapshot — ConsultaProcedimentoFlow + MapaAplicacaoPanel', () => {
  beforeEach(prepararAmbienteSnapshot);
  afterEach(limparAmbienteSnapshot);

  it('registro do procedimento com mapa', async () => {
    const html = await htmlEstavel(<ComMapa />);
    expect(html).toMatchSnapshot();
  });

  it('registro bloqueado por termos', async () => {
    const html = await htmlEstavel(
      <ComMapa execucaoBloqueadaPorTermos titulosTermosFaltantes={['Termo de toxina']} />,
    );
    expect(html).toMatchSnapshot();
  });

  it('fase de orientações e finalização', async () => {
    const { container } = render(<ComMapa />);
    await assentar();
    fireEvent.click(screen.getByRole('button', { name: /Ir para Finalização e Orientações/ }));
    await assentar();
    expect(container.innerHTML).toMatchSnapshot();
  });
});
