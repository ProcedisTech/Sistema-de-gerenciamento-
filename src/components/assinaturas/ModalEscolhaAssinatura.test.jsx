import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import '@testing-library/jest-dom';
import { ModalEscolhaAssinatura } from './ModalEscolhaAssinatura.jsx';

describe('ModalEscolhaAssinatura', () => {
  it('mostra empty state quando nenhum método está ativo', async () => {
    const onAbrir = vi.fn();
    render(
      <ModalEscolhaAssinatura
        open
        onClose={() => {}}
        opcoes={{ tablet: false, qrCode: false, link: false }}
        onAbrirConfiguracoes={onAbrir}
      />
    );
    expect(
      screen.getByText('Nenhum método de assinatura ativo para esta clínica')
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: /métodos de assinatura/i })
    );
    expect(onAbrir).toHaveBeenCalled();
  });
});
