/**
 * LgpdConsentStep.test.jsx
 *
 * Testes de componente para LgpdConsentStep usando Vitest + React Testing Library.
 * Cobertura:
 *   1. Renderização correta dos dois botões de ação
 *   2. Modal abre ao clicar em "Visualizar Documento"
 *   3. Modal fecha via botão "Entendi — Fechar"
 *   4. Botão "Exportar PDF e Assinar" chama exportAndSign com payload correto
 *   5. Estado de loading durante exportação/persistência
 *   6. Estado de sucesso após aceite registrado
 *   7. Mensagem de erro quando assinaturas estão ausentes
 *   8. Aviso de campos de contexto ausentes
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { LgpdConsentStep } from './LgpdConsentStep';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock do hook useLgpdConsent para isolar a lógica de negócio
vi.mock('./useLgpdConsent', () => ({
  useLgpdConsent: vi.fn(),
}));

// Mock do termoAssinaturaApi para não fazer chamadas HTTP reais
vi.mock('../../../services/api', () => ({
  termoAssinaturaApi: {
    criar: vi.fn(),
  },
}));

import { useLgpdConsent } from './useLgpdConsent';
import { termoAssinaturaApi } from '../../../services/api';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DEFAULT_PROPS = {
  paciente:     { nome: 'Maria Silva',   cpf: '123.456.789-00' },
  clinica:      { nome: 'Clínica Bella', cnpj: '12.345.678/0001-90' },
  profissional: { nome: 'Dr. João Costa' },
  termoId:      'termo-uuid-123',
  pacienteId:   'paciente-uuid-456',
  roleUserId:   'role-uuid-789',
  assinaturaProfissional: 'data:image/png;base64,prof123',
  assinaturaPaciente:     'data:image/png;base64,pac456',
  profissionalAssinouEm:  Date.now() - 5000,
  pacienteAssinouEm:      Date.now(),
};

const mockExportAndSign = vi.fn();

function setupHookMock({ isExporting = false, isPersisting = false } = {}) {
  useLgpdConsent.mockReturnValue({
    isExporting,
    isPersisting,
    exportAndSign: mockExportAndSign,
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  setupHookMock();
  mockExportAndSign.mockResolvedValue({ id: 'assinatura-uuid-abc' });
});

// ── Testes de Renderização ────────────────────────────────────────────────────

describe('LgpdConsentStep — renderização', () => {
  it('renderiza o título da seção', () => {
    render(<LgpdConsentStep {...DEFAULT_PROPS} />);
    expect(screen.getByText('Termo de Consentimento LGPD')).toBeInTheDocument();
  });

  it('renderiza o botão "Visualizar Documento"', () => {
    render(<LgpdConsentStep {...DEFAULT_PROPS} />);
    expect(screen.getByRole('button', { name: /visualizar documento/i })).toBeInTheDocument();
  });

  it('renderiza o botão "Exportar PDF e Assinar"', () => {
    render(<LgpdConsentStep {...DEFAULT_PROPS} />);
    expect(screen.getByRole('button', { name: /exportar pdf e assinar/i })).toBeInTheDocument();
  });

  it('renderiza o painel de aviso legal quando contexto está completo', () => {
    render(<LgpdConsentStep {...DEFAULT_PROPS} />);
    expect(screen.getByText(/pronto para assinar/i)).toBeInTheDocument();
  });

  it('renderiza aviso de campos ausentes quando contexto incompleto', () => {
    const props = {
      ...DEFAULT_PROPS,
      paciente: { nome: '', cpf: '' },
    };
    render(<LgpdConsentStep {...props} />);
    expect(screen.getByText(/dados incompletos para o termo lgpd/i)).toBeInTheDocument();
  });
});

// ── Testes do Modal ───────────────────────────────────────────────────────────

describe('LgpdConsentStep — modal de visualização', () => {
  it('modal não está visível inicialmente', () => {
    render(<LgpdConsentStep {...DEFAULT_PROPS} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('abre o modal ao clicar em "Visualizar Documento"', async () => {
    const user = userEvent.setup();
    render(<LgpdConsentStep {...DEFAULT_PROPS} />);

    await user.click(screen.getByRole('button', { name: /visualizar documento/i }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // O cabeçalho do modal deve exibir o título do termo
    expect(dialog).toHaveTextContent(/termo de consentimento lgpd/i);
  });

  it('exibe o nome do paciente no texto do modal', async () => {
    const user = userEvent.setup();
    render(<LgpdConsentStep {...DEFAULT_PROPS} />);

    await user.click(screen.getByRole('button', { name: /visualizar documento/i }));

    expect(screen.getByRole('dialog')).toHaveTextContent('Maria Silva');
  });

  it('fecha o modal ao clicar em "Entendi — Fechar"', async () => {
    const user = userEvent.setup();
    render(<LgpdConsentStep {...DEFAULT_PROPS} />);

    await user.click(screen.getByRole('button', { name: /visualizar documento/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /entendi.*fechar/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('fecha o modal ao pressionar Escape', async () => {
    const user = userEvent.setup();
    render(<LgpdConsentStep {...DEFAULT_PROPS} />);

    await user.click(screen.getByRole('button', { name: /visualizar documento/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

// ── Testes de Exportação e Assinatura ────────────────────────────────────────

describe('LgpdConsentStep — exportar PDF e assinar', () => {
  it('chama exportAndSign com os campos corretos ao clicar no botão', async () => {
    const user = userEvent.setup();
    const onAceiteRegistrado = vi.fn();

    render(<LgpdConsentStep {...DEFAULT_PROPS} onAceiteRegistrado={onAceiteRegistrado} />);

    await user.click(screen.getByRole('button', { name: /exportar pdf e assinar/i }));

    expect(mockExportAndSign).toHaveBeenCalledTimes(1);

    const callArg = mockExportAndSign.mock.calls[0][0];
    expect(callArg.termoId).toBe('termo-uuid-123');
    expect(callArg.pacienteId).toBe('paciente-uuid-456');
    expect(callArg.roleUserId).toBe('role-uuid-789');
    expect(callArg.assinaturaProfissional).toBe('data:image/png;base64,prof123');
    expect(callArg.assinaturaPaciente).toBe('data:image/png;base64,pac456');
    // O consentText deve ser string não vazia com o nome do paciente
    expect(typeof callArg.consentText).toBe('string');
    expect(callArg.consentText).toContain('Maria Silva');
  });

  it('exibe estado de sucesso após aceite registrado', async () => {
    const user = userEvent.setup();

    // Mock simula callback de sucesso
    mockExportAndSign.mockImplementationOnce(async ({ onSuccess }) => {
      onSuccess({ id: 'assinatura-uuid-abc' });
    });

    render(<LgpdConsentStep {...DEFAULT_PROPS} />);

    await user.click(screen.getByRole('button', { name: /exportar pdf e assinar/i }));

    await waitFor(() => {
      expect(screen.getByText(/aceite registrado com sucesso/i)).toBeInTheDocument();
    });

    // Botões de ação não devem mais aparecer após o aceite
    expect(screen.queryByRole('button', { name: /exportar pdf e assinar/i })).not.toBeInTheDocument();
  });

  it('exibe mensagem de erro quando exportAndSign lança exceção', async () => {
    const user = userEvent.setup();
    mockExportAndSign.mockRejectedValueOnce(new Error('Falha ao gerar PDF'));

    render(<LgpdConsentStep {...DEFAULT_PROPS} />);

    await user.click(screen.getByRole('button', { name: /exportar pdf e assinar/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/falha ao gerar pdf/i);
    });
  });
});

// ── Testes de Estado Desabilitado ─────────────────────────────────────────────

describe('LgpdConsentStep — botão desabilitado quando assinaturas ausentes', () => {
  it('botão "Exportar PDF e Assinar" está desabilitado sem assinaturas', () => {
    render(
      <LgpdConsentStep
        {...DEFAULT_PROPS}
        assinaturaProfissional=""
        assinaturaPaciente=""
      />,
    );
    expect(
      screen.getByRole('button', { name: /exportar pdf e assinar/i }),
    ).toBeDisabled();
  });

  it('exibe aviso quando ambas as assinaturas estão ausentes', () => {
    render(
      <LgpdConsentStep
        {...DEFAULT_PROPS}
        assinaturaProfissional=""
        assinaturaPaciente=""
      />,
    );
    expect(screen.getByText(/profissional e paciente precisam assinar/i)).toBeInTheDocument();
  });

  it('exibe aviso específico quando só a assinatura do profissional está ausente', () => {
    render(
      <LgpdConsentStep
        {...DEFAULT_PROPS}
        assinaturaProfissional=""
      />,
    );
    expect(screen.getByText(/o profissional precisa assinar/i)).toBeInTheDocument();
  });

  it('exibe aviso específico quando só a assinatura do paciente está ausente', () => {
    render(
      <LgpdConsentStep
        {...DEFAULT_PROPS}
        assinaturaPaciente=""
      />,
    );
    expect(screen.getByText(/o paciente precisa assinar/i)).toBeInTheDocument();
  });

  it('não chama exportAndSign quando assinaturas estão ausentes', async () => {
    const user = userEvent.setup();
    render(
      <LgpdConsentStep
        {...DEFAULT_PROPS}
        assinaturaProfissional=""
        assinaturaPaciente=""
      />,
    );

    // Botão está disabled, portanto não dispara click
    const btn = screen.getByRole('button', { name: /exportar pdf e assinar/i });
    expect(btn).toBeDisabled();
    expect(mockExportAndSign).not.toHaveBeenCalled();
  });
});

// ── Testes de Loading ─────────────────────────────────────────────────────────

describe('LgpdConsentStep — estados de loading', () => {
  it('exibe "Gerando PDF…" durante exportação', () => {
    setupHookMock({ isExporting: true });
    render(<LgpdConsentStep {...DEFAULT_PROPS} />);
    expect(screen.getByText(/gerando pdf/i)).toBeInTheDocument();
  });

  it('exibe "Registrando aceite…" durante persistência', () => {
    setupHookMock({ isPersisting: true });
    render(<LgpdConsentStep {...DEFAULT_PROPS} />);
    expect(screen.getByText(/registrando aceite/i)).toBeInTheDocument();
  });

  it('botão está desabilitado durante exportação', () => {
    setupHookMock({ isExporting: true });
    render(<LgpdConsentStep {...DEFAULT_PROPS} />);
    expect(
      screen.getByRole('button', { name: /gerando pdf/i }),
    ).toBeDisabled();
  });
});
