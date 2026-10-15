import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { htmlEstavel, limparAmbienteSnapshot, prepararAmbienteSnapshot } from '../../test/snapshotConsulta.jsx';
import { ConsultaEncerrarConfirmModal } from './ConsultaEncerrarConfirmModal.jsx';

const noop = () => {};

describe('snapshot — ConsultaEncerrarConfirmModal', () => {
  beforeEach(prepararAmbienteSnapshot);
  afterEach(limparAmbienteSnapshot);

  it('modal aberto, sem bloqueio de termo', async () => {
    await htmlEstavel(
      <ConsultaEncerrarConfirmModal
        open
        message="O que deseja fazer com o atendimento de Ana Souza?"
        onCancel={noop}
        onConfirm={noop}
        finishingMode={null}
        procedimentoSemTermo={false}
      />,
    );
    expect(document.body.innerHTML).toMatchSnapshot();
  });

  it('modal aberto, com procedimento sem termo', async () => {
    await htmlEstavel(
      <ConsultaEncerrarConfirmModal
        open
        message="O que deseja fazer com o atendimento de Ana Souza?"
        onCancel={noop}
        onConfirm={noop}
        finishingMode={null}
        procedimentoSemTermo
      />,
    );
    expect(document.body.innerHTML).toMatchSnapshot();
  });
});
