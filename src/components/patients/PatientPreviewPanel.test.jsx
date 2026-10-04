import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { PatientPreviewPanel } from './PatientsListView.jsx';

vi.mock('../../hooks/usePapel', () => ({
  usePapel: () => ({
    isNivel1: false,
    canSeeProntuario: false,
    canStartAnamnese: false,
    canDeleteAgenda: false,
  }),
}));

vi.mock('../../hooks/useAlertasClinicos.js', () => ({
  useAlertasClinicos: () => ({
    alertasPerfil: [],
    alertasAnamnese: [],
    resumo: null,
    isLoading: false,
  }),
}));

vi.mock('../planos/usePlanosPaciente.js', () => ({
  usePlanosPaciente: () => ({ planos: [], loading: false }),
}));

vi.mock('../../hooks/usePatientProfilePhotoSrc.js', () => ({
  usePatientProfilePhotoSrc: () => ({ src: null, loading: false }),
}));

vi.mock('../../services/api', () => ({
  anamneseApi: {},
  procedimentosApi: {},
}));

const fusoMock = vi.hoisted(() => ({ fuso: 'America/Sao_Paulo' }));

vi.mock('../hooks/useFusoClinica', () => ({
  useFusoClinica: () => ({ fuso: fusoMock.fuso, pronto: true, recarregarFuso: () => {} }),
}));

const FUSO_DF = 'America/Sao_Paulo';
const FUSO_AC = 'America/Rio_Branco';

function renderPanel(patient) {
  return render(
    <PatientPreviewPanel
      selectedPatient={{ id: 'p1', nome: 'Maria Teste', cpf: '00000000000', ...patient }}
      detailTitleId="detail-title"
      closeDetail={vi.fn()}
      getPatientInitials={() => 'MT'}
      setPatientDetailTab={vi.fn()}
      setPatientView={vi.fn()}
    />,
  );
}

describe('PatientPreviewPanel · selo de aniversário', () => {
  beforeEach(() => {
    fusoMock.fuso = FUSO_DF;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-12T13:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('aniversariante do mês não é rotulado como hoje', () => {
    renderPanel({ ehAniversariante: true, dataNascimento: '1990-09-28' });
    expect(screen.getByText('Aniversariante do mês')).toBeInTheDocument();
    expect(screen.queryByText('Aniversariante hoje!')).not.toBeInTheDocument();
  });

  it('aniversário hoje', () => {
    renderPanel({ ehAniversariante: true, dataNascimento: '1990-09-12' });
    expect(screen.getByText('Aniversariante hoje!')).toBeInTheDocument();
  });

  it('sem selo quando o cálculo local não cai em nenhum caso', () => {
    renderPanel({ ehAniversariante: true, dataNascimento: '1990-03-15' });
    expect(screen.queryByText(/Anivers/)).not.toBeInTheDocument();
  });

  it('sem selo quando o backend não marca aniversariante', () => {
    renderPanel({ ehAniversariante: false, dataNascimento: '1990-09-12' });
    expect(screen.queryByText(/Anivers/)).not.toBeInTheDocument();
  });
});

describe('PatientPreviewPanel · selo de aniversário no fuso da clínica', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([FUSO_DF, FUSO_AC])('22:00 de Brasília (01:00 UTC do dia seguinte) ainda é hoje em %s', (fuso) => {
    fusoMock.fuso = fuso;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-13T01:00:00Z'));
    renderPanel({ ehAniversariante: true, dataNascimento: '1990-09-12' });
    expect(screen.getByText('Aniversariante hoje!')).toBeInTheDocument();
  });

  it('00:30 de Brasília: DF já virou o dia, AC ainda está na véspera', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-13T03:30:00Z'));

    fusoMock.fuso = FUSO_DF;
    const df = renderPanel({ ehAniversariante: true, dataNascimento: '1990-09-13' });
    expect(screen.getByText('Aniversariante hoje!')).toBeInTheDocument();
    df.unmount();

    fusoMock.fuso = FUSO_AC;
    renderPanel({ ehAniversariante: true, dataNascimento: '1990-09-13' });
    expect(screen.getByText('Aniversário amanhã')).toBeInTheDocument();
  });

  it('data de nascimento exibida sem voltar um dia', () => {
    fusoMock.fuso = FUSO_AC;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-13T03:30:00Z'));
    renderPanel({ ehAniversariante: false, dataNascimento: '1990-09-12', idade: 36 });
    expect(screen.getByText(/12\/09\/1990/)).toBeInTheDocument();
    expect(screen.queryByText(/11\/09\/1990/)).not.toBeInTheDocument();
  });
});
