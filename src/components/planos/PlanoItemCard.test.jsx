// Regressão prevenida: Procedimentos do plano realizados juntos em atendimento avulso/on-the-spot exibem a data e horário da visita mesmo quando apenas o primeiro item possui agenda vinculada.
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
