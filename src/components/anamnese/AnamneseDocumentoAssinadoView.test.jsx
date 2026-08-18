import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AnamneseDocumentoView } from './AnamneseDocumentoAssinadoView.jsx';

vi.mock('../../services/api', () => ({
  anamneseApi: {
    getDocumento: vi.fn(),
    verificarGravada: vi.fn(),
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
    expect(screen.getByText(/Assinada em/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Conferir' })).toBeInTheDocument();
    expect(screen.getByText(/SHA-256 · abc123/)).toBeInTheDocument();
    expect(screen.queryByText('Aguardando assinatura do paciente')).not.toBeInTheDocument();
  });

  it('renderiza estado aguardando assinatura sem hash', async () => {
    anamneseApi.getDocumento.mockResolvedValue({
      ...baseDoc,
      assinaturaPaciente: null,
      conteudoHash: null,
      gravadoEm: null,
    });

    render(<AnamneseDocumentoView pacienteId="pac1" preenchimentoId="p1" onModificar={() => {}} />);

    expect((await screen.findAllByText('Aguardando assinatura do paciente')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Modificar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Conferir' })).not.toBeInTheDocument();
  });
});
