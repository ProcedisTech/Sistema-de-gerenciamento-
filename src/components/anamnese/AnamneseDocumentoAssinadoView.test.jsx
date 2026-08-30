import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AnamneseDocumentoView } from './AnamneseDocumentoAssinadoView.jsx';

vi.mock('../../services/api', () => ({
  anamneseApi: {
    getDocumento: vi.fn(),
    verificarGravada: vi.fn(),
  },
  anamneseEnvioApi: {
    status: vi.fn(),
  },
}));

vi.mock('./AnamneseAssinaturaActions.jsx', () => ({
  AnamneseAssinaturaActions: ({ assinada, envioAtivo }) => {
    if (assinada) return <span>Assinada mock</span>;
    if (envioAtivo?.status === 'PENDENTE') {
      return <span>Aguardando resposta do paciente</span>;
    }
    return (
      <button type="button">
        Solicitar assinatura do paciente
      </button>
    );
  },
}));

import { anamneseApi } from '../../services/api';

const baseDoc = {
  preenchimentoId: 'p1',
  anamneseNome: 'Odontologia',
  pacienteNome: 'Marina Alves',
  pacienteCpf: '41288790633',
  pacienteIdade: 42,
  preenchidoPorNome: 'Dra. Ana',
  fatosCriticos: [{ texto: 'Dipirona sódica', icone: 'item' }],
  fatosAlerta: [],
  prontuarioPerguntaIds: [],
  envioAtivo: null,
  conteudoJsonb: {
    anamnese_nome: 'Odontologia',
    texto_declaracao: 'Declaro verdadeiras as informações.',
    itens: [
      {
        pergunta_id: 'q1',
        categoria: 'História médica',
        pergunta: 'É hipertenso?',
        prioridade: 'CRITICA',
        ordem: 1,
        resposta: { trivalente: 'SIM' },
      },
    ],
  },
};

describe('AnamneseDocumentoView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza documento assinado com selo e conferir hash', async () => {
    anamneseApi.getDocumento.mockResolvedValue({
      ...baseDoc,
      assinaturaPaciente: 'data:image/png;base64,xx',
      pacienteAssinouEm: '2026-08-16T12:24:00Z',
      conteudoHash: 'abc123',
      gravadoEm: '2026-08-16T12:24:00Z',
    });

    render(<AnamneseDocumentoView pacienteId="pac1" preenchimentoId="p1" />);

    expect((await screen.findAllByText('Marina Alves')).length).toBeGreaterThan(0);
    expect(screen.getByText('Assinada mock')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Conferir' })).toBeInTheDocument();
    expect(screen.getByText(/SHA-256 · abc123/)).toBeInTheDocument();
  });

  it('renderiza botão solicitar assinatura quando sem assinatura e sem envio', async () => {
    anamneseApi.getDocumento.mockResolvedValue({
      ...baseDoc,
      assinaturaPaciente: null,
      conteudoHash: null,
      gravadoEm: null,
    });

    render(<AnamneseDocumentoView pacienteId="pac1" preenchimentoId="p1" onModificar={() => {}} />);

    expect(await screen.findByRole('button', { name: 'Solicitar assinatura do paciente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Modificar' })).toBeInTheDocument();
    expect(screen.getByText('Ainda não assinado — é possível modificar as respostas.')).toBeInTheDocument();
  });

  it('com envio ativo esconde Modificar e ajusta rodapé', async () => {
    anamneseApi.getDocumento.mockResolvedValue({
      ...baseDoc,
      assinaturaPaciente: null,
      conteudoHash: null,
      gravadoEm: null,
      envioAtivo: { id: 'env1', status: 'PENDENTE', expiraEm: '2026-08-16T15:00:00Z' },
    });

    render(<AnamneseDocumentoView pacienteId="pac1" preenchimentoId="p1" onModificar={() => {}} />);

    expect(await screen.findByText('Aguardando resposta do paciente')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Modificar' })).not.toBeInTheDocument();
    expect(screen.getByText(/Link enviado — edição bloqueada/)).toBeInTheDocument();
  });
});
