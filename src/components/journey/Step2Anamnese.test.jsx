import React, { createRef } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { Step2Anamnese } from './Step2Anamnese.jsx';

const stub = vi.hoisted(() => ({ envio: null }));

vi.mock('../../services/api', () => ({
  anamneseApi: {
    listFichas: vi.fn(),
    listPaciente: vi.fn(),
    getFicha: vi.fn(),
    getPaciente: vi.fn(),
    getDocumento: vi.fn(),
  },
  anamneseEnvioApi: {
    cancelar: vi.fn(),
    status: vi.fn(),
  },
}));

vi.mock('../../hooks/usePerfilClinico', () => ({
  usePerfilClinico: () => ({}),
}));

vi.mock('../perfil-clinico/PerfilClinicoBloco', () => ({
  PerfilClinicoBloco: () => null,
}));

vi.mock('../anamnese/AnamneseDocumentoAssinadoView.jsx', async () => {
  const { useEffect } = await import('react');
  return {
    AnamneseDocumentoView: ({ preenchimentoId, onEnvioAtivoChange }) => {
      useEffect(() => {
        onEnvioAtivoChange?.(stub.envio);
      }, [onEnvioAtivoChange]);
      return <div data-testid="documento-stub">{preenchimentoId}</div>;
    },
  };
});

import { anamneseApi } from '../../services/api';

const FICHA = 'f1';
const assinada = {
  id: 'pre-assinada',
  anamneseId: FICHA,
  status: 'finalizada',
  preenchidoPorPaciente: false,
  quantidadeRespostas: 9,
  dataHora: '2026-08-01T10:00:00Z',
};
const emBranco = {
  id: 'pre-branco',
  anamneseId: FICHA,
  status: 'aguardando_paciente',
  preenchidoPorPaciente: true,
  quantidadeRespostas: 0,
  dataHora: '2026-09-01T10:00:00Z',
};

function renderStep2(props = {}, ref = createRef()) {
  const utils = render(
    <Step2Anamnese
      ref={ref}
      queixa=""
      setQueixa={() => {}}
      expectativas=""
      setExpectativas={() => {}}
      pacienteId="pac1"
      consultaMode
      onSolicitarAoPaciente={vi.fn()}
      {...props}
    />,
  );
  return { ...utils, ref };
}

const botaoSolicitar = () => screen.queryByRole('button', { name: 'Solicitar ao paciente' });

describe('Step2Anamnese — Solicitar ao paciente', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stub.envio = null;
    anamneseApi.listFichas.mockResolvedValue([{ id: FICHA, nome: 'Estética' }]);
    anamneseApi.listPaciente.mockResolvedValue([assinada]);
  });

  it('aparece com consultaMode e um vigente', async () => {
    renderStep2();
    await screen.findByTestId('documento-stub');
    expect(botaoSolicitar()).toBeInTheDocument();
  });

  it('some sem consultaMode', async () => {
    renderStep2({ consultaMode: false });
    await screen.findByTestId('documento-stub');
    expect(botaoSolicitar()).not.toBeInTheDocument();
  });

  it('some sem vigente (lista vazia)', async () => {
    anamneseApi.listPaciente.mockResolvedValue([]);
    renderStep2();
    await screen.findByText('Dados clínicos do paciente');
    expect(screen.queryByTestId('documento-stub')).not.toBeInTheDocument();
    expect(botaoSolicitar()).not.toBeInTheDocument();
  });

  it('some quando o documento reporta envio PENDENTE', async () => {
    stub.envio = { id: 'env1', status: 'PENDENTE' };
    renderStep2();
    await screen.findByTestId('documento-stub');
    await waitFor(() => expect(botaoSolicitar()).not.toBeInTheDocument());
  });

  it('some depois de registrarEnvioSolicitacao e volta com null', async () => {
    const { ref } = renderStep2();
    await screen.findByTestId('documento-stub');
    expect(botaoSolicitar()).toBeInTheDocument();

    act(() => ref.current.registrarEnvioSolicitacao({ envioId: 'env9' }));
    expect(botaoSolicitar()).not.toBeInTheDocument();

    act(() => ref.current.registrarEnvioSolicitacao(null));
    expect(botaoSolicitar()).toBeInTheDocument();
  });

  it('o clique chama onSolicitarAoPaciente', async () => {
    const user = userEvent.setup();
    const onSolicitarAoPaciente = vi.fn();
    renderStep2({ onSolicitarAoPaciente });
    await screen.findByTestId('documento-stub');
    await user.click(botaoSolicitar());
    expect(onSolicitarAoPaciente).toHaveBeenCalledTimes(1);
  });

  it('"Nova ficha" continua presente', async () => {
    renderStep2();
    await screen.findByTestId('documento-stub');
    expect(screen.getByRole('button', { name: 'Nova ficha' })).toBeInTheDocument();
  });

  it('assinada + branco pendente mais novo: o documento recebe a assinada', async () => {
    anamneseApi.listPaciente.mockResolvedValue([emBranco, assinada]);
    renderStep2();
    expect(await screen.findByTestId('documento-stub')).toHaveTextContent('pre-assinada');
  });

  it('só um preenchimento em branco: sem documento, renderiza o formulário', async () => {
    anamneseApi.listPaciente.mockResolvedValue([emBranco]);
    renderStep2();
    await screen.findByText('Dados clínicos do paciente');
    expect(screen.queryByTestId('documento-stub')).not.toBeInTheDocument();
  });

  it('fallback sem quantidadeRespostas: o documento recebe o branco (comportamento de hoje)', async () => {
    const { quantidadeRespostas: _q, ...brancoSemContagem } = emBranco;
    anamneseApi.listPaciente.mockResolvedValue([brancoSemContagem, assinada]);
    renderStep2();
    expect(await screen.findByTestId('documento-stub')).toHaveTextContent('pre-branco');
  });
});

describe('Step2Anamnese — faixa de pedido pendente', () => {
  const envioPendente = { id: 'env1', status: 'PENDENTE', expiraEm: '2099-01-01T00:00:00Z' };
  const faixa = () => screen.queryByTestId('solicitacao-pendente-faixa');

  beforeEach(() => {
    vi.clearAllMocks();
    stub.envio = null;
    anamneseApi.listFichas.mockResolvedValue([{ id: FICHA, nome: 'Estética' }]);
    anamneseApi.getDocumento.mockResolvedValue({ envioAtivo: envioPendente });
  });

  it('assinada + branco pendente: faixa acima da assinada e botão escondido', async () => {
    anamneseApi.listPaciente.mockResolvedValue([emBranco, assinada]);
    renderStep2();
    expect(await screen.findByTestId('documento-stub')).toHaveTextContent('pre-assinada');
    await waitFor(() => expect(faixa()).toBeInTheDocument());
    expect(faixa()).toHaveTextContent('Anamnese solicitada ao paciente · aguardando resposta');
    expect(anamneseApi.getDocumento).toHaveBeenCalledWith('pac1', 'pre-branco');
    expect(botaoSolicitar()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nova ficha' })).toBeInTheDocument();
  });

  it('sem assinada: faixa acima do formulário', async () => {
    anamneseApi.listPaciente.mockResolvedValue([emBranco]);
    renderStep2();
    await screen.findByText('Dados clínicos do paciente');
    await waitFor(() => expect(faixa()).toBeInTheDocument());
    expect(screen.queryByTestId('documento-stub')).not.toBeInTheDocument();
  });

  it('"Ver QR / link" chama onSolicitarAoPaciente', async () => {
    const user = userEvent.setup();
    const onSolicitarAoPaciente = vi.fn();
    anamneseApi.listPaciente.mockResolvedValue([emBranco, assinada]);
    renderStep2({ onSolicitarAoPaciente });
    await user.click(await screen.findByRole('button', { name: 'Ver QR / link' }));
    expect(onSolicitarAoPaciente).toHaveBeenCalledTimes(1);
  });

  it('sem faixa para o aguardando_assinatura do hub', async () => {
    const hub = {
      ...emBranco,
      id: 'pre-hub',
      status: 'aguardando_assinatura',
      preenchidoPorPaciente: false,
    };
    anamneseApi.listPaciente.mockResolvedValue([hub, assinada]);
    renderStep2();
    await screen.findByTestId('documento-stub');
    expect(faixa()).not.toBeInTheDocument();
    expect(anamneseApi.getDocumento).not.toHaveBeenCalledWith('pac1', 'pre-hub');
  });

  it('sem faixa quando não há branco', async () => {
    anamneseApi.listPaciente.mockResolvedValue([assinada]);
    renderStep2();
    await screen.findByTestId('documento-stub');
    expect(faixa()).not.toBeInTheDocument();
    expect(botaoSolicitar()).toBeInTheDocument();
  });

  it('sem faixa fora do consultaMode', async () => {
    anamneseApi.listPaciente.mockResolvedValue([emBranco, assinada]);
    renderStep2({ consultaMode: false });
    await screen.findByTestId('documento-stub');
    expect(faixa()).not.toBeInTheDocument();
    expect(anamneseApi.getDocumento).not.toHaveBeenCalled();
  });

  it('registrarEnvioSolicitacao mostra a faixa na hora', async () => {
    anamneseApi.listPaciente.mockResolvedValue([assinada]);
    const { ref } = renderStep2();
    await screen.findByTestId('documento-stub');
    act(() => ref.current.registrarEnvioSolicitacao({ envioId: 'env9', preenchimentoAnamneseId: 'pre-novo' }));
    expect(faixa()).toBeInTheDocument();
    expect(botaoSolicitar()).not.toBeInTheDocument();
  });
});
