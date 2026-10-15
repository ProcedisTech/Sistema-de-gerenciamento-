import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { htmlEstavel, limparAmbienteSnapshot, prepararAmbienteSnapshot } from '../../test/snapshotConsulta.jsx';
import { fotosAvaliacaoFixas } from '../../test/fixtures/consultaFixtures.js';
import { ConsultaAvaliacaoFlow } from './ConsultaAvaliacaoFlow.jsx';

vi.mock('../../services/api.js', async (importOriginal) => {
  const { apiVazia } = await import('../../test/snapshotConsulta.jsx');
  return apiVazia(await importOriginal());
});

const noop = () => {};

describe('snapshot — ConsultaAvaliacaoFlow', () => {
  beforeEach(prepararAmbienteSnapshot);
  afterEach(limparAmbienteSnapshot);

  it('avaliação com queixa, expectativas e duas fotos', async () => {
    const html = await htmlEstavel(
      <ConsultaAvaliacaoFlow
        queixa="Rugas na testa"
        setQueixa={noop}
        expectativas="Aparência descansada"
        setExpectativas={noop}
        evaluationCapturedPhotos={fotosAvaliacaoFixas}
        evaluationPhotoMax={30}
        onEvaluationUploadFiles={noop}
        onEvaluationRemovePhoto={noop}
        onAnnotatePhoto={noop}
        onConcluirAvaliacao={noop}
      />,
    );
    expect(html).toMatchSnapshot();
  });

  it('avaliação vazia', async () => {
    const html = await htmlEstavel(
      <ConsultaAvaliacaoFlow
        queixa=""
        setQueixa={noop}
        expectativas=""
        setExpectativas={noop}
        evaluationCapturedPhotos={[]}
        evaluationPhotoMax={30}
        onEvaluationUploadFiles={noop}
        onEvaluationRemovePhoto={noop}
        onAnnotatePhoto={noop}
        onConcluirAvaliacao={noop}
      />,
    );
    expect(html).toMatchSnapshot();
  });
});
