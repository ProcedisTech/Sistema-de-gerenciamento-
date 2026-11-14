// Regressão prevenida: Procedimentos do plano realizados juntos em atendimento avulso/on-the-spot exibem a data e horário da visita mesmo quando apenas o primeiro item possui agenda vinculada.
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlanoItemCard } from './PlanoItemCard.jsx';

vi.mock('../hooks/useFusoClinica.js', () => ({
  useFusoClinica: () => ({ fuso: 'America/Sao_Paulo' }),
}));

describe('PlanoItemCard - Exibição de Procedimentos Realizados', () => {
  it('exibe data e hora de realização com fallback para _visitaData e _visitaHora quando item está realizado sem sessaoRealizada própria', () => {
    const item = {
      id: 'item-2',
      catalogoNome: 'Drenagem de Abscesso',
      statusItem: 'finalizado',
      dataPlanejada: '2026-10-17',
    };

    render(
      <PlanoItemCard
        item={item}
        plano={{ id: 'plano-1', titulo: 'Plano Facial' }}
        visitaLabel="Visita 1"
        visitaData="2026-10-17"
        visitaHora="22:45"
      />
    );

    expect(screen.getByText('Drenagem de Abscesso')).not.toBeNull();
    expect(screen.getByText(/Realizado em 17\/10\/2026 às 22:45/i)).not.toBeNull();
  });
});

describe('PlanoItemCard - Ação de Edição do Procedimento', () => {
  it('renderiza o botão de editar e aciona onEdit com o item ao ser clicado', () => {
    const item = {
      id: 'item-1',
      catalogoNome: 'Toxina Botulínica',
      statusItem: 'planejado',
      valor: 1200,
    };
    const onEditMock = vi.fn();

    render(
      <PlanoItemCard
        item={item}
        plano={{ id: 'plano-1', titulo: 'Plano Facial' }}
        canCrud={true}
        onEdit={onEditMock}
      />
    );

    const editBtn = screen.getByRole('button', { name: /editar procedimento e valor/i });
    expect(editBtn).not.toBeNull();

    fireEvent.click(editBtn);
    expect(onEditMock).toHaveBeenCalledTimes(1);
    expect(onEditMock).toHaveBeenCalledWith(item);
  });

  it('não renderiza o botão de editar quando o item já está realizado', () => {
    const item = {
      id: 'item-1',
      catalogoNome: 'Toxina Botulínica',
      statusItem: 'finalizado',
    };
    const onEditMock = vi.fn();

    render(
      <PlanoItemCard
        item={item}
        plano={{ id: 'plano-1', titulo: 'Plano Facial' }}
        canCrud={true}
        onEdit={onEditMock}
      />
    );

    expect(screen.queryByRole('button', { name: /editar procedimento e valor/i })).toBeNull();
  });

  it('não renderiza o botão de editar quando canCrud é false', () => {
    const item = {
      id: 'item-1',
      catalogoNome: 'Toxina Botulínica',
      statusItem: 'planejado',
    };
    const onEditMock = vi.fn();

    render(
      <PlanoItemCard
        item={item}
        plano={{ id: 'plano-1', titulo: 'Plano Facial' }}
        canCrud={false}
        onEdit={onEditMock}
      />
    );

    expect(screen.queryByRole('button', { name: /editar procedimento e valor/i })).toBeNull();
  });
});
