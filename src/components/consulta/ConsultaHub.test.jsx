import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { ConsultaHub } from './ConsultaHub.jsx';

vi.mock('../../hooks/useTermosPendentes', () => ({
  useTermosPendentes: () => ({
    pendentes: [{ id: 't1', titulo: 'Termo B' }],
    count: 1,
    isLoading: false,
    resolucao: { faltantes: [{ termoId: 't1', titulo: 'Termo B' }] },
  }),
}));

vi.mock('../planos/usePlanosPaciente.js', () => ({
  usePlanosPaciente: () => ({ planos: [] }),
}));

vi.mock('../../hooks/useAnamneseStatusPaciente', () => ({
  useAnamneseStatusPaciente: () => ({
    list: [],
    isLoading: false,
    pendente: false,
    desatualizada: false,
  }),
}));

const paciente = { id: 'pac-1', nome: 'Ana' };

function cardProcedimento() {
  return screen.getByRole('button', { name: /^Procedimento/ });
}

describe('ConsultaHub — gate do card Procedimento', () => {
  it('bloqueia Procedimento quando há faltantes e o ato ainda não nasceu', async () => {
    const onSelect = vi.fn();
    const onBloqueio = vi.fn();
    render(
      <ConsultaHub
        paciente={paciente}
        catalogoIds={['cat-b']}
        exigirFilaVinculo
        onSelectModule={onSelect}
        onTermosBloqueio={onBloqueio}
      />
    );
    await userEvent.click(cardProcedimento());
    expect(onBloqueio).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('não bloqueia Procedimento do catálogo que já tem PF nesta sessão', async () => {
    const onSelect = vi.fn();
    const onBloqueio = vi.fn();
    render(
      <ConsultaHub
        paciente={paciente}
        catalogoIds={['cat-a']}
        exigirFilaVinculo
        atoJaIniciado
        onSelectModule={onSelect}
        onTermosBloqueio={onBloqueio}
      />
    );
    await userEvent.click(cardProcedimento());
    expect(onBloqueio).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith('procedimento');
  });
});
