import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import '@testing-library/jest-dom';
import {
  COPY_ENCERRAR_SEM_TERMO,
  ConsultaEncerrarConfirmModal,
} from './ConsultaEncerrarConfirmModal.jsx';

describe('ConsultaEncerrarConfirmModal', () => {
  it('mostra aviso quando há procedimento sem termo e confirma encerrar', async () => {
    const onConfirm = vi.fn();
    render(
      <ConsultaEncerrarConfirmModal
        open
        message="O que deseja fazer com o atendimento?"
        procedimentoSemTermo
        onCancel={() => {}}
        onConfirm={onConfirm}
      />
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(COPY_ENCERRAR_SEM_TERMO)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Finalizar Atendimento' }));
    expect(onConfirm).toHaveBeenCalledWith('finalizar');
  });

  it('não mostra o aviso quando o termo não bloqueia', () => {
    render(
      <ConsultaEncerrarConfirmModal
        open
        message="O que deseja fazer?"
        procedimentoSemTermo={false}
        onCancel={() => {}}
        onConfirm={() => {}}
      />
    );
    expect(screen.queryByText(COPY_ENCERRAR_SEM_TERMO)).not.toBeInTheDocument();
  });
});
