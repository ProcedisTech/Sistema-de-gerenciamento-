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
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 12, 10));
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
