/** Cadastro: CPF inválido mostra o motivo no campo; erro de outro campo mantém a mensagem genérica. */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const toastError = vi.fn();

vi.mock('./PatientForm.jsx', () => ({
  PatientForm: ({ onSubmit, onNomeChange, onCpfChange, cpfErrorText, erroBanner }) => (
    <div>
      <button type="button" onClick={() => onNomeChange('Maria')}>Preencher nome</button>
      <button type="button" onClick={() => onCpfChange('111.111.111-12')}>Preencher CPF</button>
      <button type="button" onClick={onSubmit}>Salvar paciente</button>
      <p data-testid="campo-cpf">{cpfErrorText}</p>
      <p data-testid="banner">{erroBanner}</p>
    </div>
  ),
}));
vi.mock('../../hooks/usePapel', () => ({ usePapel: () => ({ isNivel1: false }) }));
vi.mock('../hooks/useAgoraDaClinica.js', () => ({ useAgoraDaClinica: () => ({ fuso: 'America/Sao_Paulo', hojeIso: '2026-11-07' }) }));
vi.mock('../../contexts/useToast.js', () => ({ useToast: () => ({ error: toastError, success: () => {} }) }));
vi.mock('../../services/api', () => ({
  pacientesApi: { create: vi.fn() },
  getPacienteCreateErrorFeedback: () => ({ banner: 'erro' }),
}));
// Só o resto do formulário é simulado: o CPF passa pela validação real.
vi.mock('../../utils/patientFormValidation', async (orig) => {
  const real = await orig();
  return {
    ...real,
    validatePacienteFormBasics: ({ nome, cpf }) => ({
      ...(nome ? {} : { nome: true }),
      ...(cpf && !real.validateCpfField(cpf).ok ? { cpf: true } : {}),
    }),
  };
});

import { PatientCreateView } from './PatientCreateView.jsx';

describe('Cadastro de paciente, CPF', () => {
  it('CPF inválido sendo o único erro mostra "CPF inválido" no campo e não a mensagem genérica', () => {
    render(<PatientCreateView rota={{ rotaId: 'pacienteNovo' }} voltarParaLista={() => {}} />);
    fireEvent.click(screen.getByText('Preencher nome'));
    fireEvent.click(screen.getByText('Preencher CPF'));
    fireEvent.click(screen.getByText('Salvar paciente'));

    expect(screen.getByTestId('campo-cpf')).toHaveTextContent('CPF inválido');
    expect(screen.getByTestId('banner')).toHaveTextContent('CPF inválido');
    expect(screen.getByTestId('banner')).not.toHaveTextContent('Preencha os campos obrigatórios');
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('CPF inválido'));
  });

  it('nome vazio mostra a mensagem genérica', () => {
    toastError.mockClear();
    render(<PatientCreateView rota={{ rotaId: 'pacienteNovo' }} voltarParaLista={() => {}} />);
    fireEvent.click(screen.getByText('Salvar paciente'));

    expect(screen.getByTestId('banner')).toHaveTextContent('Preencha os campos obrigatórios.');
    expect(screen.getByTestId('campo-cpf')).toBeEmptyDOMElement();
    expect(toastError).toHaveBeenCalledWith('Preencha todos os campos obrigatórios antes de continuar.');
  });
});
