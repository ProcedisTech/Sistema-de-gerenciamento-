import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import { GlobalHeader } from './GlobalHeader.jsx';

vi.mock('../../hooks/usePapel', () => ({
  usePapel: () => ({
    canCreatePacientes: true, canWriteAgenda: true, isNivel1: false,
    canSeeConfig: true, canSeeNotificacoes: false,
  }),
}));
vi.mock('../agenda/PacienteSearchInput.jsx', () => ({ PacienteSearchInput: () => <div /> }));

function montar() {
  render(<GlobalHeader activeView="agenda" clinicaNome="Clínica Teste" />);
  return screen.getByRole('button', { name: 'Abrir perfil do profissional' });
}

describe('GlobalHeader — menu do perfil', () => {
  it('ao abrir, o foco vai para o primeiro item', async () => {
    const chip = montar();
    await userEvent.click(chip);
    expect(screen.getByRole('menuitem', { name: /Meu perfil/ })).toHaveFocus();
  });

  it('Esc fecha o menu e devolve o foco ao chip', async () => {
    const chip = montar();
    await userEvent.click(chip);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(chip).toHaveFocus();
  });
});
