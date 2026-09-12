import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('não mostra Foi pro prontuário em texto livre mesmo se id vier no DTO', async () => {
    anamneseApi.getDocumento.mockResolvedValue({
      ...baseDoc,
      prontuarioPerguntaIds: ['q-texto'],
      conteudoJsonb: {
        ...baseDoc.conteudoJsonb,
        itens: [
          {
            pergunta_id: 'q-texto',
            tipo_resposta: 'texto',
            categoria: 'Queixa',
            pergunta: 'Qual a sua queixa estética principal?',
            prioridade: 'NORMAL',
            ordem: 1,
            resposta: { texto: 'teste' },
          },
        ],
      },
    });

    render(<AnamneseDocumentoView pacienteId="pac1" preenchimentoId="p1" />);

    expect(await screen.findByText('teste')).toBeInTheDocument();
    const selos = screen.getAllByText('Foi pro prontuário').filter((el) => !el.closest('button'));
    expect(selos).toHaveLength(0);
  });

  it('mostra reação adversa como chip e selo em catalogo_principio_ativo', async () => {
    anamneseApi.getDocumento.mockResolvedValue({
      ...baseDoc,
      prontuarioPerguntaIds: ['q-pa'],
      conteudoJsonb: {
        ...baseDoc.conteudoJsonb,
        itens: [
          {
            pergunta_id: 'q-pa',
            tipo_resposta: 'catalogo_principio_ativo',
            categoria: 'Alergias',
            pergunta: 'A quais princípios ativos?',
            prioridade: 'CRITICA',
            ordem: 1,
            resposta: { catalogo: { nome: 'Dipirona', tipo: 'principio_ativo', id: 'pa1' } },
          },
          {
            pergunta_id: 'q-reacao',
            tipo_resposta: 'catalogo_reacao',
            categoria: 'Alergias',
            pergunta: 'Qual foi a reacao?',
            prioridade: 'CRITICA',
            ordem: 2,
            resposta: { catalogo: { nome: 'Coceira', tipo: 'reacao', id: 'ra1' } },
          },
        ],
      },
    });

    render(<AnamneseDocumentoView pacienteId="pac1" preenchimentoId="p1" />);

    expect(await screen.findByText('Dipirona')).toBeInTheDocument();
    expect(screen.getByText('Coceira')).toBeInTheDocument();
    expect(screen.getAllByText('Foi pro prontuário').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('não respondeu')).not.toBeInTheDocument();
  });

  it('filtro Só as críticas inclui reação com chip', async () => {
    const user = userEvent.setup();
    anamneseApi.getDocumento.mockResolvedValue({
      ...baseDoc,
      conteudoJsonb: {
        ...baseDoc.conteudoJsonb,
        itens: [
          {
            pergunta_id: 'q-pa',
            tipo_resposta: 'catalogo_principio_ativo',
            categoria: 'Alergias',
            pergunta: 'A quais princípios ativos?',
            prioridade: 'CRITICA',
            ordem: 1,
            resposta: { catalogo: { nome: 'Dipirona', tipo: 'principio_ativo', id: 'pa1' } },
          },
          {
            pergunta_id: 'q-reacao',
            tipo_resposta: 'catalogo_reacao',
            categoria: 'Alergias',
            pergunta: 'Qual foi a reacao?',
            prioridade: 'CRITICA',
            ordem: 2,
            resposta: { catalogo: { nome: 'Coceira', tipo: 'reacao', id: 'ra1' } },
          },
        ],
      },
    });

    render(<AnamneseDocumentoView pacienteId="pac1" preenchimentoId="p1" />);
    await screen.findByText('Dipirona');
    await user.click(screen.getByRole('button', { name: /Só as críticas/ }));

    expect(screen.getByText('Dipirona')).toBeInTheDocument();
    expect(screen.getByText('Coceira')).toBeInTheDocument();
  });
});
