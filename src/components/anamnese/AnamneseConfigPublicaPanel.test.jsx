import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { AnamneseConfigPublicaPanel } from './AnamneseConfigPublicaPanel.jsx';

vi.mock('../../services/api', () => ({
  acessoPublicoApi: { buscar: vi.fn(), atualizar: vi.fn() },
  anamneseApi: { listarFichas: vi.fn() },
}));

// Objeto estável: o painel tem [toast] nas dependências do efeito.
vi.mock('../../contexts/useToast', () => {
  const toast = { success: vi.fn(), error: vi.fn() };
  return { useToast: () => toast };
});

import { acessoPublicoApi, anamneseApi } from '../../services/api';

describe('AnamneseConfigPublicaPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    acessoPublicoApi.buscar.mockResolvedValue({
      slug: 'demo',
      validadeAnamneseDias: 90,
      anamnesePadraoId: 'f1',
    });
    acessoPublicoApi.atualizar.mockResolvedValue({});
    anamneseApi.listarFichas.mockResolvedValue([{ id: 'f1', nome: 'Ficha padrão' }]);
  });

  it('não mostra a seção de notificações nem o aviso de 7 dias', async () => {
    render(<AnamneseConfigPublicaPanel />);
    await screen.findByText('Endereço público');
    expect(screen.queryByText(/Notificações/)).not.toBeInTheDocument();
    expect(screen.queryByText(/7 dias/)).not.toBeInTheDocument();
  });

  it('envia no PUT só slug, validade e ficha padrão', async () => {
    render(<AnamneseConfigPublicaPanel />);
    await screen.findByText('Endereço público');
    await userEvent.click(screen.getByRole('button', { name: /Salvar alterações/ }));
    await waitFor(() => expect(acessoPublicoApi.atualizar).toHaveBeenCalledTimes(1));
    const corpo = acessoPublicoApi.atualizar.mock.calls[0][0];
    expect(corpo).toEqual({ slug: 'demo', validadeAnamneseDias: 90, anamnesePadraoId: 'f1' });
    expect(corpo).not.toHaveProperty('notificarNovaFicha');
    expect(corpo).not.toHaveProperty('notificarVencimento');
  });
});
