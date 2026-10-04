import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { PulseSidebar } from './PulseSidebar.jsx';

vi.mock('../../hooks/usePapel.js', () => ({
  usePapel: () => ({ isNivel1: false, canDeleteAgenda: false, canStartAnamnese: false }),
}));

vi.mock('../../hooks/usePatientProfilePhotoSrc.js', () => ({
  usePatientProfilePhotoSrc: () => ({ src: null, loading: false }),
}));

const fusoMock = vi.hoisted(() => ({ fuso: 'America/Sao_Paulo' }));

vi.mock('../hooks/useFusoClinica', () => ({
  useFusoClinica: () => ({ fuso: fusoMock.fuso, pronto: true, recarregarFuso: () => {} }),
}));

const FUSO_DF = 'America/Sao_Paulo';
const FUSO_AC = 'America/Rio_Branco';

function renderSidebar(aniversariantes) {
  return render(
    <PulseSidebar
      kpi={{ agendamentosHoje: [], semPlanoList: [], totalSemPlano: 0, aniversariantesList: aniversariantes }}
      loading={false}
      nomeUsuario="Ana"
      getPatientInitials={() => 'MT'}
    />,
  );
}

function rowDe(nome) {
  return screen.getByText(nome).closest('button');
}

describe('PulseSidebar · aniversariantes no fuso da clínica', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([FUSO_DF, FUSO_AC])('22:00 de Brasília (01:00 UTC do dia seguinte): aniversário de hoje segue HOJE em %s', (fuso) => {
    fusoMock.fuso = fuso;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-13T01:00:00Z'));
    renderSidebar([
      { id: 'a', nome: 'Maria Hoje', dataNascimento: '1990-09-12' },
      { id: 'b', nome: 'João Amanhã', dataNascimento: '1985-09-13' },
    ]);
    const hoje = rowDe('Maria Hoje');
    expect(within(hoje).getByText('HOJE!!')).toBeInTheDocument();
    expect(within(hoje).getByText(/12\/09/)).toBeInTheDocument();
    expect(within(rowDe('João Amanhã')).getByText('Amanhã')).toBeInTheDocument();
  });

  it('00:30 de Brasília: DF já é dia 13, AC ainda é dia 12', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-13T03:30:00Z'));
    const lista = [{ id: 'b', nome: 'João', dataNascimento: '1985-09-13' }];

    fusoMock.fuso = FUSO_DF;
    const df = renderSidebar(lista);
    expect(within(rowDe('João')).getByText('HOJE!!')).toBeInTheDocument();
    df.unmount();

    fusoMock.fuso = FUSO_AC;
    renderSidebar(lista);
    expect(within(rowDe('João')).getByText('Amanhã')).toBeInTheDocument();
  });

  it('saudação segue a hora da clínica', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-13T01:00:00Z'));
    fusoMock.fuso = FUSO_AC;
    renderSidebar([]);
    expect(screen.getByText(/Boa noite/)).toBeInTheDocument();
  });
});
