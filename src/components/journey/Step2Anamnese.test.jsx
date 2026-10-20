import React, { createRef } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { Step2Anamnese } from './Step2Anamnese.jsx';
import { ToastContext } from '../../contexts/toastContext.js';

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
  getOrgId: () => null,
  setOrgId: vi.fn(),
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

describe('Step2Anamnese — blur de queixa/expectativas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stub.envio = null;
    anamneseApi.listFichas.mockResolvedValue([]);
    anamneseApi.listPaciente.mockResolvedValue([]);
  });

  const textareas = async () => {
    await screen.findByText('Queixa e Expectativas');
    const [queixa, expectativas] = [
      screen.getByPlaceholderText('Descreva o motivo da consulta...'),
      screen.getByPlaceholderText('O que o paciente espera do procedimento...'),
    ];
    return { queixa, expectativas };
  };

  it('consultaMode: blur chama onCampoAvaliacaoBlur e não o onAutoSaveAnamnese', async () => {
    const onCampoAvaliacaoBlur = vi.fn();
    const onAutoSaveAnamnese = vi.fn(async () => {});
    renderStep2({ queixa: 'dor', expectativas: 'melhorar', onCampoAvaliacaoBlur, onAutoSaveAnamnese });
    const { queixa, expectativas } = await textareas();
    expect(queixa).toHaveAttribute('data-campo-consulta', 'avaliacao:queixa');
    expect(expectativas).toHaveAttribute('data-campo-consulta', 'avaliacao:expectativas');
    act(() => queixa.focus());
    act(() => queixa.blur());
    act(() => expectativas.focus());
    act(() => expectativas.blur());
    expect(onCampoAvaliacaoBlur.mock.calls).toEqual([['queixa'], ['expectativas']]);
    expect(onAutoSaveAnamnese).not.toHaveBeenCalled();
  });

  it('fora do consultaMode: blur chama o onAutoSaveAnamnese e não o onCampoAvaliacaoBlur', async () => {
    const onCampoAvaliacaoBlur = vi.fn();
    const onAutoSaveAnamnese = vi.fn(async () => {});
    renderStep2({
      consultaMode: false, queixa: 'dor', expectativas: 'melhorar', onCampoAvaliacaoBlur, onAutoSaveAnamnese,
    });
    const { queixa, expectativas } = await textareas();
    expect(queixa).not.toHaveAttribute('data-campo-consulta');
    expect(expectativas).not.toHaveAttribute('data-campo-consulta');
    act(() => queixa.focus());
    act(() => queixa.blur());
    act(() => expectativas.focus());
    act(() => expectativas.blur());
    await waitFor(() => expect(onAutoSaveAnamnese).toHaveBeenCalledTimes(2));
    expect(onCampoAvaliacaoBlur).not.toHaveBeenCalled();
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

describe('Step2Anamnese — "Motivo da consulta" (ficha com perguntas)', () => {
  const fichaComPerguntas = {
    id: FICHA,
    nome: 'Estética',
    itens: [
      {
        id: 'it1',
        ordem: 1,
        pergunta: { id: 'perg1', tipoResposta: 'texto', enunciado: 'Alguma alergia?', categoriaSexoAplicavel: null },
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    stub.envio = null;
    anamneseApi.listFichas.mockResolvedValue([{ id: FICHA, nome: 'Estética' }]);
    anamneseApi.listPaciente.mockResolvedValue([emBranco]);
    anamneseApi.getFicha.mockResolvedValue(fichaComPerguntas);
  });

  const SALVO = { pacienteId: 'pac1', fichaSelecionadaId: FICHA, respostas: {} };
  const motivo = () => screen.findByPlaceholderText('O que trouxe o paciente nesta consulta…');

  it('consultaMode: blur chama onCampoAvaliacaoBlur("queixa") com data-campo-consulta; só um campo de queixa na tela', async () => {
    const onCampoAvaliacaoBlur = vi.fn();
    renderStep2({ queixa: 'dor', onCampoAvaliacaoBlur, savedAnamneseState: SALVO });
    const el = await motivo();
    expect(el).toHaveAttribute('data-campo-consulta', 'avaliacao:queixa');
    expect(screen.queryByPlaceholderText('Descreva o motivo da consulta...')).not.toBeInTheDocument();
    act(() => el.focus());
    act(() => el.blur());
    expect(onCampoAvaliacaoBlur.mock.calls).toEqual([['queixa']]);
  });

  it('fora do consultaMode: blur não chama onCampoAvaliacaoBlur e sem data-campo-consulta', async () => {
    const onCampoAvaliacaoBlur = vi.fn();
    renderStep2({ queixa: 'dor', consultaMode: false, onCampoAvaliacaoBlur, savedAnamneseState: SALVO });
    const el = await motivo();
    expect(el).not.toHaveAttribute('data-campo-consulta');
    act(() => el.focus());
    act(() => el.blur());
    expect(onCampoAvaliacaoBlur).not.toHaveBeenCalled();
  });
});

describe('Step2Anamnese — Concluir Anamnese espera a fila da avaliação', () => {
  const toastWarning = vi.fn();
  const wrapper = ({ children }) => (
    <ToastContext.Provider
      value={{ toast: vi.fn(), success: vi.fn(), error: vi.fn(), warning: toastWarning, info: vi.fn(), dismiss: vi.fn() }}
    >
      {children}
    </ToastContext.Provider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    stub.envio = null;
    anamneseApi.listFichas.mockResolvedValue([]);
    anamneseApi.listPaciente.mockResolvedValue([]);
  });

  const botaoConcluir = async () => screen.findByRole('button', { name: 'Concluir Anamnese' });
  const montar = (props) =>
    render(
      <Step2Anamnese
        queixa=""
        setQueixa={() => {}}
        expectativas=""
        setExpectativas={() => {}}
        pacienteId="pac1"
        consultaMode
        {...props}
      />,
      { wrapper },
    );

  it('não prossegue até a fila resolver; depois prossegue', async () => {
    const user = userEvent.setup();
    let liberar;
    const esperarFilaAvaliacao = vi.fn(
      () =>
        new Promise((r) => {
          liberar = r;
        }),
    );
    const onConcluirAnamnese = vi.fn();
    montar({ esperarFilaAvaliacao, onConcluirAnamnese });
    await user.click(await botaoConcluir());
    expect(esperarFilaAvaliacao).toHaveBeenCalledTimes(1);
    expect(onConcluirAnamnese).not.toHaveBeenCalled();
    await act(async () => liberar({ ok: true, preenchimentoAnamneseId: 'pre-1' }));
    await waitFor(() => expect(onConcluirAnamnese).toHaveBeenCalledTimes(1));
  });

  it('ok:false mostra o aviso e não prossegue', async () => {
    const user = userEvent.setup();
    const onConcluirAnamnese = vi.fn();
    montar({ esperarFilaAvaliacao: async () => ({ ok: false }), onConcluirAnamnese });
    await user.click(await botaoConcluir());
    await waitFor(() => expect(toastWarning).toHaveBeenCalledWith('Aguarde: ainda enviando a avaliação…'));
    expect(onConcluirAnamnese).not.toHaveBeenCalled();
  });

  it('sem esperarFilaAvaliacao segue direto (fluxo de hoje)', async () => {
    const user = userEvent.setup();
    const onConcluirAnamnese = vi.fn();
    montar({ onConcluirAnamnese });
    await user.click(await botaoConcluir());
    expect(onConcluirAnamnese).toHaveBeenCalledTimes(1);
  });
});
