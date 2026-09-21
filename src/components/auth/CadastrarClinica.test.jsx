import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CadastrarClinica } from './CadastrarClinica';
import * as apiModule from '../../services/api.js';
import * as toastModule from '../../contexts/useToast.js';

vi.mock('../../services/api.js', () => ({
  organizacaoApi: {
    criar: vi.fn(),
  },
  getApiErrorToastMessage: vi.fn((err, fallback) => fallback),
}));

vi.mock('../../contexts/useToast.js', () => ({
  useToast: vi.fn(),
}));

vi.mock('../hooks/useCepLookup.js', () => ({
  useCepLookup: () => ({
    lookup: vi.fn().mockResolvedValue({ ok: true, data: null }),
    status: 'idle',
  }),
}));

describe('CadastrarClinica - Seleção de Cargo do Fundador', () => {
  const mockToast = {
    error: vi.fn(),
    success: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(toastModule.useToast).mockReturnValue(mockToast);
    vi.mocked(apiModule.organizacaoApi.criar).mockResolvedValue({ id: 'org-uuid-123' });
  });

  it('renderiza o select com valor inicial "esteticista" e texto explicativo', () => {
    render(<CadastrarClinica onComplete={vi.fn()} />);

    const label = screen.getByText('Sua profissão / cargo na clínica');
    expect(label).toBeInTheDocument();

    expect(
      screen.getByText('Define sua atuação inicial e exibição na agenda de atendimentos.')
    ).toBeInTheDocument();

    const select = screen.getByLabelText('Sua profissão / cargo na clínica');
    expect(select.value).toBe('esteticista');
  });

  it('contém todas as 6 opções canônicas de atuação', () => {
    render(<CadastrarClinica onComplete={vi.fn()} />);

    const select = screen.getByLabelText('Sua profissão / cargo na clínica');
    const options = Array.from(select.querySelectorAll('option')).map((o) => ({
      value: o.value,
      text: o.textContent,
    }));

    expect(options).toEqual([
      { value: 'esteticista', text: 'Esteticista' },
      { value: 'biomedico', text: 'Biomédico(a)' },
      { value: 'medico', text: 'Médico(a)' },
      { value: 'dentista', text: 'Cirurgião(ã)-Dentista' },
      { value: 'enfermeiro', text: 'Enfermeiro(a)' },
      { value: 'administrador', text: 'Apenas Administrador / Gestor (Não atende pacientes)' },
    ]);
  });

  it('envia cargo "esteticista" por padrão no payload de criação', async () => {
    const onComplete = vi.fn();
    render(<CadastrarClinica onComplete={onComplete} />);

    fireEvent.change(screen.getByLabelText(/Razão social/i), {
      target: { value: 'Minha Clinica LTDA' },
    });
    fireEvent.change(screen.getByLabelText(/Nome fantasia/i), {
      target: { value: 'Minha Clinica' },
    });
    fireEvent.change(screen.getByLabelText(/CNPJ/i), {
      target: { value: '11.222.333/0001-81' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));

    await waitFor(() => {
      expect(apiModule.organizacaoApi.criar).toHaveBeenCalledTimes(1);
    });

    const payload = vi.mocked(apiModule.organizacaoApi.criar).mock.calls[0][0];
    expect(payload.cargo).toBe('esteticista');
    expect(payload.nome).toBe('Minha Clinica');
    expect(payload.razaoSocial).toBe('Minha Clinica LTDA');
    expect(payload.cnpj).toBe('11222333000181');
    expect(onComplete).toHaveBeenCalledWith('org-uuid-123');
  });

  it('envia cargo selecionado "medico" quando o usuário altera a opção', async () => {
    const onComplete = vi.fn();
    render(<CadastrarClinica onComplete={onComplete} />);

    fireEvent.change(screen.getByLabelText(/Razão social/i), {
      target: { value: 'Clinica Medica LTDA' },
    });
    fireEvent.change(screen.getByLabelText(/Nome fantasia/i), {
      target: { value: 'Clinica Medica' },
    });
    fireEvent.change(screen.getByLabelText(/CNPJ/i), {
      target: { value: '11.222.333/0001-81' },
    });

    const select = screen.getByLabelText('Sua profissão / cargo na clínica');
    fireEvent.change(select, { target: { value: 'medico' } });
    expect(select.value).toBe('medico');

    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));

    await waitFor(() => {
      expect(apiModule.organizacaoApi.criar).toHaveBeenCalledTimes(1);
    });

    const payload = vi.mocked(apiModule.organizacaoApi.criar).mock.calls[0][0];
    expect(payload.cargo).toBe('medico');
  });

  it('envia cargo selecionado "administrador" quando o usuário escolhe gestão pura', async () => {
    render(<CadastrarClinica onComplete={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Razão social/i), {
      target: { value: 'Clinica Gestao LTDA' },
    });
    fireEvent.change(screen.getByLabelText(/Nome fantasia/i), {
      target: { value: 'Clinica Gestao' },
    });
    fireEvent.change(screen.getByLabelText(/CNPJ/i), {
      target: { value: '11.222.333/0001-81' },
    });

    const select = screen.getByLabelText('Sua profissão / cargo na clínica');
    fireEvent.change(select, { target: { value: 'administrador' } });

    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));

    await waitFor(() => {
      expect(apiModule.organizacaoApi.criar).toHaveBeenCalledTimes(1);
    });

    const payload = vi.mocked(apiModule.organizacaoApi.criar).mock.calls[0][0];
    expect(payload.cargo).toBe('administrador');
  });

  it('envia cargo selecionado "biomedico"', async () => {
    render(<CadastrarClinica onComplete={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Razão social/i), {
      target: { value: 'Clinica Biomedica LTDA' },
    });
    fireEvent.change(screen.getByLabelText(/Nome fantasia/i), {
      target: { value: 'Clinica Biomedica' },
    });
    fireEvent.change(screen.getByLabelText(/CNPJ/i), {
      target: { value: '11.222.333/0001-81' },
    });

    const select = screen.getByLabelText('Sua profissão / cargo na clínica');
    fireEvent.change(select, { target: { value: 'biomedico' } });
    expect(select.value).toBe('biomedico');

    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));

    await waitFor(() => {
      expect(apiModule.organizacaoApi.criar).toHaveBeenCalledTimes(1);
    });

    const payload = vi.mocked(apiModule.organizacaoApi.criar).mock.calls[0][0];
    expect(payload.cargo).toBe('biomedico');
  });

  it('envia cargo selecionado "dentista"', async () => {
    render(<CadastrarClinica onComplete={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Razão social/i), {
      target: { value: 'Clinica Odonto LTDA' },
    });
    fireEvent.change(screen.getByLabelText(/Nome fantasia/i), {
      target: { value: 'Clinica Odonto' },
    });
    fireEvent.change(screen.getByLabelText(/CNPJ/i), {
      target: { value: '11.222.333/0001-81' },
    });

    const select = screen.getByLabelText('Sua profissão / cargo na clínica');
    fireEvent.change(select, { target: { value: 'dentista' } });
    expect(select.value).toBe('dentista');

    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));

    await waitFor(() => {
      expect(apiModule.organizacaoApi.criar).toHaveBeenCalledTimes(1);
    });

    const payload = vi.mocked(apiModule.organizacaoApi.criar).mock.calls[0][0];
    expect(payload.cargo).toBe('dentista');
  });

  it('envia cargo selecionado "enfermeiro"', async () => {
    render(<CadastrarClinica onComplete={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Razão social/i), {
      target: { value: 'Clinica Enfermagem LTDA' },
    });
    fireEvent.change(screen.getByLabelText(/Nome fantasia/i), {
      target: { value: 'Clinica Enfermagem' },
    });
    fireEvent.change(screen.getByLabelText(/CNPJ/i), {
      target: { value: '11.222.333/0001-81' },
    });

    const select = screen.getByLabelText('Sua profissão / cargo na clínica');
    fireEvent.change(select, { target: { value: 'enfermeiro' } });
    expect(select.value).toBe('enfermeiro');

    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));

    await waitFor(() => {
      expect(apiModule.organizacaoApi.criar).toHaveBeenCalledTimes(1);
    });

    const payload = vi.mocked(apiModule.organizacaoApi.criar).mock.calls[0][0];
    expect(payload.cargo).toBe('enfermeiro');
  });
});
