import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { ProfileHero } from './ProfileHero.jsx';

vi.mock('../../hooks/usePatientProfilePhotoSrc.js', () => ({
  usePatientProfilePhotoSrc: () => ({ src: null, loading: false }),
}));

const fusoMock = vi.hoisted(() => ({ fuso: 'America/Sao_Paulo' }));

vi.mock('../hooks/useFusoClinica', () => ({
  useFusoClinica: () => ({ fuso: fusoMock.fuso, pronto: true, recarregarFuso: () => {} }),
}));

function renderHero(patient) {
  return render(
    <ProfileHero
      patient={{ id: 'p1', nome: 'Maria Teste', cpf: '00000000000', ...patient }}
      getPatientInitials={() => 'MT'}
      isPerfilAtivo
    />,
  );
}

describe('ProfileHero · datas no fuso da clínica', () => {
  it.each(['America/Sao_Paulo', 'America/Rio_Branco'])(
    "'cadastrado em' de 2026-10-01T02:52:00Z mostra 30/09/2026 em %s",
    (fuso) => {
      fusoMock.fuso = fuso;
      renderHero({ createdAt: '2026-10-01T02:52:00Z' });
      expect(screen.getAllByText(/30\/09\/2026/).length).toBeGreaterThan(0);
      expect(screen.queryByText(/01\/10\/2026/)).not.toBeInTheDocument();
    },
  );

  it('data de nascimento (calendário) não volta um dia', () => {
    fusoMock.fuso = 'America/Rio_Branco';
    renderHero({ dataNascimento: '1990-01-01' });
    expect(screen.getAllByText(/01\/01\/1990/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/31\/12\/1989/)).not.toBeInTheDocument();
  });
});
