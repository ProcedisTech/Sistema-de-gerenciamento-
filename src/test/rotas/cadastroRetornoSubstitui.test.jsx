/** Cadastro: o retorno automático à lista (1,5 s) é redirecionamento e SUBSTITUI /pacientes/novo no histórico. */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

vi.mock('../../components/patients/PatientForm.jsx', () => ({
  PatientForm: ({ onSubmit }) => <button type="button" onClick={onSubmit}>Salvar paciente</button>,
}));
vi.mock('../../hooks/usePapel', () => ({ usePapel: () => ({ isNivel1: false }) }));
vi.mock('../../components/hooks/useAgoraDaClinica.js', () => ({ useAgoraDaClinica: () => ({ fuso: 'America/Sao_Paulo', hojeIso: '2026-11-07' }) }));
vi.mock('../../contexts/useToast.js', () => ({ useToast: () => ({ error: () => {}, success: () => {} }) }));
vi.mock('../../utils/patientFormValidation', () => ({ validatePacienteFormBasics: () => ({}) }));
vi.mock('../../utils/patientMapping', () => ({ mapBackendPatient: (p) => p }));
vi.mock('../../components/utils/formatters', async (orig) => ({
  ...(await orig()),
  normalizeCpf: () => '52998224725',
  isCpfValidCheckDigits: () => true,
}));
vi.mock('../../services/api', () => ({
  pacientesApi: { create: async () => ({ id: 'P-1' }) },
  getPacienteCreateErrorFeedback: () => ({ banner: 'erro' }),
}));

import { PatientCreateView } from '../../components/patients/PatientCreateView.jsx';

afterEach(() => vi.useRealTimers());

describe('Cadastro de paciente', () => {
  it('retorno automático após cadastrar substitui /pacientes/novo (Voltar não reabre o cadastro)', async () => {
    vi.useFakeTimers();
    let roteador;
    const Tela = () => (
      <PatientCreateView
        rota={{ rotaId: 'pacienteNovo' }}
        voltarParaLista={(opcoes) => roteador.navigate('/pacientes', opcoes)}
      />
    );
    roteador = createMemoryRouter(
      [{ path: '/pacientes', element: <p>Lista</p> }, { path: '/pacientes/novo', element: <Tela /> }],
      { initialEntries: ['/pacientes', '/pacientes/novo'], initialIndex: 1 },
    );
    render(<RouterProvider router={roteador} />);

    await act(async () => { fireEvent.click(screen.getByText('Salvar paciente')); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });

    expect(roteador.state.location.pathname).toBe('/pacientes');
    expect(roteador.state.historyAction).toBe('REPLACE');
    await act(async () => { await roteador.navigate(-1); });
    expect(roteador.state.location.pathname).not.toBe('/pacientes/novo');
  });
});
