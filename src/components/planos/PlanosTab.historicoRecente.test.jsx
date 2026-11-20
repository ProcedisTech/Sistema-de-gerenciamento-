import React, { StrictMode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarAvisosFalsos } from '../../test/avisosFalsos.jsx';
import { AVISO } from '../../services/avisos/tiposAviso.js';
import { PlanosTab } from './PlanosTab.jsx';

vi.mock('../../services/api.js', () => ({
  planejamentosApi: {
    listarPorPaciente: vi.fn(),
    detalhe: vi.fn(),
    atualizarItem: vi.fn(),
    adicionarItem: vi.fn(),
    removerItem: vi.fn(),
    alterarStatus: vi.fn(),
    criar: vi.fn(),
  },
  procedimentosApi: {
    byPaciente: vi.fn(),
  },
  pacientesGaleriaApi: {
    list: vi.fn().mockResolvedValue([]),
  },
  pacientesApi: {
    get: vi.fn().mockResolvedValue({ id: 'pac-1', nome: 'Paciente Teste' }),
  },
  termosApi: {
    resolver: vi.fn().mockResolvedValue({ faltantes: [] }),
  },
  getApiErrorDetail: () => '',
}));

vi.mock('../../hooks/useProcedimentosOptions.js', () => ({
  useProcedimentosOptions: () => ({
    options: [{ id: 'cat-1', nomeProcedimento: 'Toxina botulínica', valorPadrao: 1200 }],
    loading: false,
  }),
}));

vi.mock('../../hooks/usePapel.js', () => ({
  usePapel: () => ({
    canSeeOrcamentos: true,
    canEditPrecosOrcados: true,
  }),
}));

vi.mock('../hooks/useFusoClinica.js', () => ({
  useFusoClinica: () => ({ fuso: 'America/Sao_Paulo', pronto: true }),
}));

vi.mock('../../contexts/useToast.js', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

const { planejamentosApi, procedimentosApi } = await import('../../services/api.js');

const PACIENTE_ID = 'pac-1';

const planoAtivo = {
  id: 'plano-1',
  planejamentoId: 'plano-1',
  statusCodigo: 'ativo',
  statusNome: 'Em andamento',
  observacao: 'Plano de Tratamento',
  itens: [
    {
      id: 'item-1',
      planejamentoItemId: 'item-1',
      catalogoProcedimentoSaudeId: 'cat-1',
      catalogoNome: 'Toxina botulínica',
      valorOrcado: 1200,
      dataPlanejada: null,
      statusItem: null,
    },
  ],
};

async function esperar(ms = 50) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

function criarDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('PlanosTab — Histórico Clínico Recente na lateral do Hub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    planejamentosApi.listarPorPaciente.mockResolvedValue([planoAtivo]);
    if (!window.matchMedia) {
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('exibe DTO real (statusNome, horaFim, nomeManual, Retorno/Retoque) e omite cancelados, em andamento e agendados', async () => {
    procedimentosApi.byPaciente.mockResolvedValue([
      null,
      {
        id: 'pf-antigo',
        pacienteId: PACIENTE_ID,
        procedimentoNome: 'Toxina botulínica',
        criadoEm: '2026-10-10T15:00:00Z',
        horaInicio: '2026-10-10T15:00:00Z',
        horaFim: '2026-10-10T15:40:00Z',
        statusNome: 'Finalizado',
      },
      {
        id: 'pf-cancelado',
        pacienteId: PACIENTE_ID,
        procedimentoNome: 'Procedimento Cancelado',
        criadoEm: '2026-11-18T15:00:00Z',
        statusNome: 'Cancelado',
      },
      {
        id: 'pf-em-andamento',
        pacienteId: PACIENTE_ID,
        procedimentoNome: 'Procedimento Em Andamento',
        horaInicio: '2026-11-19T19:00:00Z',
        criadoEm: '2026-11-19T19:00:00Z',
        statusNome: 'Em andamento',
      },
      {
        id: 'pf-agendado',
        pacienteId: PACIENTE_ID,
        procedimentoNome: 'Procedimento Agendado',
        criadoEm: '2026-11-20T10:00:00Z',
        statusNome: 'Agendado',
      },
      {
        id: 'pf-manual',
        pacienteId: PACIENTE_ID,
        procedimentoNome: '   ',
        nomeManual: '  Limpeza de Pele  ',
        criadoEm: '2026-11-17T12:00:00Z',
        horaFim: '2026-11-17T13:00:00Z',
        statusNome: 'Finalizado',
      },
      {
        id: 'pf-retorno',
        pacienteId: PACIENTE_ID,
        procedimentoNome: 'Bioestimulador',
        criadoEm: '2026-11-01T10:00:00Z',
        horaFim: '2026-11-19T14:00:00Z',
        statusNome: 'Finalizado',
        procedimentoFeitoOrigemId: 'pf-origem-1',
        isRetoque: false,
      },
      {
        id: 'pf-retoque',
        pacienteId: PACIENTE_ID,
        procedimentoNome: 'Preenchimento Labial',
        criadoEm: '2026-11-18T14:00:00Z',
        horaFim: '2026-11-18T15:00:00Z',
        statusNome: 'Finalizado',
        procedimentoFeitoOrigemId: 'pf-origem-2',
        isRetoque: true,
      },
    ]);

    const { Wrapper } = criarAvisosFalsos();
    render(
      <Wrapper>
        <PlanosTab
          variant="consulta"
          pacienteId={PACIENTE_ID}
          paciente={{ id: PACIENTE_ID, nome: 'Paciente Teste' }}
          roleUserId="ru-1"
        />
      </Wrapper>,
    );

    await esperar(80);

    const card = screen.getByText('Histórico Clínico Recente').closest('div');
    expect(card).toBeTruthy();

    const textoCard = card.textContent || '';
    expect(textoCard).toContain('Bioestimulador');
    expect(textoCard).toContain('19/11/2026');
    expect(textoCard).toContain('Retorno');
    expect(textoCard).toContain('Preenchimento Labial');
    expect(textoCard).toContain('18/11/2026');
    expect(textoCard).toContain('Retoque');
    expect(textoCard).toContain('Limpeza de Pele');
    expect(textoCard).toContain('17/11/2026');
    expect(textoCard).toContain('Toxina botulínica');
    expect(textoCard).toContain('10/10/2026');
    expect(textoCard).not.toContain('Procedimento Cancelado');
    expect(textoCard).not.toContain('Procedimento Em Andamento');
    expect(textoCard).not.toContain('Procedimento Agendado');
    expect(textoCard).not.toContain('Realizado');

    expect(textoCard.indexOf('Bioestimulador')).toBeLessThan(textoCard.indexOf('Preenchimento Labial'));
    expect(textoCard.indexOf('Preenchimento Labial')).toBeLessThan(textoCard.indexOf('Limpeza de Pele'));
    expect(textoCard.indexOf('Limpeza de Pele')).toBeLessThan(textoCard.indexOf('Toxina botulínica'));
  });

  it('ordena no fuso -03:00 sem inverter calendário com instante noturno e aceita legados sem status/data', async () => {
    procedimentosApi.byPaciente.mockResolvedValue([
      {
        id: 'pf-noturno',
        pacienteId: PACIENTE_ID,
        procedimentoNome: 'Microagulhamento Noturno',
        horaFim: '2026-11-18T22:30:00-03:00',
        statusNome: 'Finalizado',
      },
      {
        id: 'pf-calendario',
        pacienteId: PACIENTE_ID,
        procedimentoNome: 'Peeling Legado',
        dataRealizacao: '2026-11-19',
      },
      {
        id: 'pf-sem-data',
        pacienteId: PACIENTE_ID,
        procedimentoNome: 'Botox Antigo',
        statusNome: 'Finalizado',
        horaFim: null,
        horaInicio: null,
        criadoEm: null,
      },
    ]);

    const { Wrapper } = criarAvisosFalsos();
    render(
      <Wrapper>
        <PlanosTab
          variant="consulta"
          pacienteId={PACIENTE_ID}
          paciente={{ id: PACIENTE_ID, nome: 'Paciente Teste' }}
          roleUserId="ru-1"
        />
      </Wrapper>,
    );

    await esperar(80);

    const card = screen.getByText('Histórico Clínico Recente').closest('div');
    const textoCard = card.textContent || '';

    expect(textoCard).toContain('Peeling Legado');
    expect(textoCard).toContain('19/11/2026');
    expect(textoCard).toContain('Microagulhamento Noturno');
    expect(textoCard).toContain('18/11/2026');
    expect(textoCard).toContain('Botox Antigo');
    expect(textoCard).toContain('Realizado');

    expect(textoCard.indexOf('Peeling Legado')).toBeLessThan(textoCard.indexOf('Microagulhamento Noturno'));
    expect(textoCard.indexOf('Microagulhamento Noturno')).toBeLessThan(textoCard.indexOf('Botox Antigo'));
  });

  it('preserva a regra de negócio do selo "Nª vez" no PlanoVisitasTimeline com DTO real', async () => {
    procedimentosApi.byPaciente.mockResolvedValue([
      {
        id: 'pf-1',
        pacienteId: PACIENTE_ID,
        catalogoProcedimentoSaudeId: 'cat-1',
        procedimentoNome: 'Toxina botulínica',
        statusNome: 'Finalizado',
        horaFim: '2026-10-10T14:00:00Z',
      },
      {
        id: 'pf-2',
        pacienteId: PACIENTE_ID,
        catalogoProcedimentoSaudeId: 'cat-1',
        procedimentoNome: 'Toxina botulínica',
        statusNome: 'Em andamento',
        horaInicio: '2026-11-19T14:00:00Z',
      },
    ]);

    const { Wrapper } = criarAvisosFalsos();
    render(
      <Wrapper>
        <PlanosTab
          variant="consulta"
          pacienteId={PACIENTE_ID}
          paciente={{ id: PACIENTE_ID, nome: 'Paciente Teste' }}
          roleUserId="ru-1"
        />
      </Wrapper>,
    );

    await esperar(80);

    expect(screen.getAllByText('3ª vez').length).toBeGreaterThan(0);
    const card = screen.getByText('Histórico Clínico Recente').closest('div');
    const matchesNoCard = (card.textContent || '').match(/Toxina botulínica/g) || [];
    expect(matchesNoCard.length).toBe(1);
  });

  it('limpa imediatamente o histórico ao trocar de paciente (pac-1 -> pac-2) e descarta resposta tardia de pac-1', async () => {
    const d1 = criarDeferred();
    const d1Tardio = criarDeferred();
    const d2 = criarDeferred();
    const avisos = criarAvisosFalsos();

    procedimentosApi.byPaciente
      .mockReturnValueOnce(d1.promise)
      .mockReturnValueOnce(d1Tardio.promise)
      .mockReturnValueOnce(d2.promise);

    const { rerender } = render(
      <avisos.Wrapper>
        <PlanosTab
          variant="consulta"
          pacienteId="pac-1"
          paciente={{ id: 'pac-1', nome: 'Paciente Um' }}
          roleUserId="ru-1"
        />
      </avisos.Wrapper>,
    );

    await act(async () => {
      d1.resolve([
        {
          id: 'pf-p1',
          pacienteId: 'pac-1',
          procedimentoNome: 'Procedimento Paciente Um',
          statusNome: 'Finalizado',
          horaFim: '2026-11-10T12:00:00Z',
        },
      ]);
      await Promise.resolve();
    });
    await esperar(50);

    const cardInicial = screen.getByText('Histórico Clínico Recente').closest('div');
    expect(cardInicial.textContent).toContain('Procedimento Paciente Um');

    // Dispara reload por SSE no pac-1 cuja resposta vai ficar atrasada
    act(() => {
      avisos.emitirAviso(AVISO.PACIENTE.EDITADO, 'pac-1');
    });
    await esperar(360);
    expect(procedimentosApi.byPaciente).toHaveBeenCalledTimes(2);

    // Troca para pac-2 antes da resposta tardia e com pac-2 ainda pendente/falhando
    rerender(
      <avisos.Wrapper>
        <PlanosTab
          variant="consulta"
          pacienteId="pac-2"
          paciente={{ id: 'pac-2', nome: 'Paciente Dois' }}
          roleUserId="ru-1"
        />
      </avisos.Wrapper>,
    );
    await esperar(40);

    const cardDuranteTroca = screen.getByText('Histórico Clínico Recente').closest('div');
    expect(cardDuranteTroca.textContent).not.toContain('Procedimento Paciente Um');
    expect(cardDuranteTroca.textContent).toContain('Nenhum procedimento anterior registrado.');

    // Resposta tardia de pac-1 resolve e pac-2 rejeita -> pac-1 continua descartado
    await act(async () => {
      d1Tardio.resolve([
        {
          id: 'pf-p1-tardio',
          pacienteId: 'pac-1',
          procedimentoNome: 'Vazamento Paciente Um',
          statusNome: 'Finalizado',
          horaFim: '2026-11-12T12:00:00Z',
        },
      ]);
      d2.reject(new Error('Falha de rede simulada'));
      await Promise.resolve();
    });
    await esperar(40);

    const cardFinal = screen.getByText('Histórico Clínico Recente').closest('div');
    expect(cardFinal.textContent).not.toContain('Vazamento Paciente Um');
    expect(cardFinal.textContent).toContain('Nenhum procedimento anterior registrado.');
  });

  it('recarrega via SSE PACIENTE.EDITADO no mesmo paciente sem apagar a lista enquanto carrega', async () => {
    const dSse = criarDeferred();
    const avisos = criarAvisosFalsos();

    procedimentosApi.byPaciente
      .mockResolvedValueOnce([
        {
          id: 'pf-v1',
          pacienteId: PACIENTE_ID,
          procedimentoNome: 'Toxina Inicial',
          statusNome: 'Finalizado',
          horaFim: '2026-11-10T12:00:00Z',
        },
      ])
      .mockReturnValueOnce(dSse.promise);

    render(
      <avisos.Wrapper>
        <PlanosTab
          variant="consulta"
          pacienteId={PACIENTE_ID}
          paciente={{ id: PACIENTE_ID, nome: 'Paciente Teste' }}
          roleUserId="ru-1"
        />
      </avisos.Wrapper>,
    );

    await esperar(80);
    expect(screen.getByText('Histórico Clínico Recente').closest('div').textContent).toContain('Toxina Inicial');

    act(() => {
      avisos.emitirAviso(AVISO.PACIENTE.EDITADO, PACIENTE_ID);
    });
    await esperar(360);

    // Enquanto dSse está pendente, a lista do mesmo paciente permanece visível sem flicker
    expect(procedimentosApi.byPaciente).toHaveBeenCalledTimes(2);
    const cardPendente = screen.getByText('Histórico Clínico Recente').closest('div');
    expect(cardPendente.textContent).toContain('Toxina Inicial');
    expect(cardPendente.textContent).not.toContain('Nenhum procedimento anterior registrado.');

    await act(async () => {
      dSse.resolve([
        {
          id: 'pf-v2',
          pacienteId: PACIENTE_ID,
          procedimentoNome: 'Bioestimulador Novo',
          statusNome: 'Finalizado',
          horaFim: '2026-11-19T12:00:00Z',
        },
      ]);
      await Promise.resolve();
    });
    await esperar(40);

    expect(screen.getByText('Histórico Clínico Recente').closest('div').textContent).toContain('Bioestimulador Novo');
  });

  it('no modo controlado por prop (PatientProfileView + StrictMode) filtra por pacienteId sem flicker nem chamada duplicada', async () => {
    const { Wrapper } = criarAvisosFalsos();
    const listaPac1 = [
      {
        id: 'pf-a',
        pacienteId: 'pac-1',
        procedimentoNome: 'Procedimento A Perfil',
        statusNome: 'Finalizado',
        horaFim: '2026-11-15T12:00:00Z',
      },
    ];
    const listaPac2 = [
      {
        id: 'pf-b',
        pacienteId: 'pac-2',
        procedimentoNome: 'Procedimento B Perfil',
        statusNome: 'Finalizado',
        horaFim: '2026-11-19T12:00:00Z',
      },
    ];

    const { rerender } = render(
      <StrictMode>
        <Wrapper>
          <PlanosTab
            variant="profile"
            pacienteId="pac-1"
            paciente={{ id: 'pac-1', nome: 'Paciente Um' }}
            roleUserId="ru-1"
            procedimentosFeitos={listaPac1}
          />
        </Wrapper>
      </StrictMode>,
    );

    await esperar(60);
    expect(procedimentosApi.byPaciente).not.toHaveBeenCalled();

    // Troca para pac-2 mantendo ainda listaPac1 no Render 1 (igual ao ciclo filho->pai de PatientProfileView)
    rerender(
      <StrictMode>
        <Wrapper>
          <PlanosTab
            variant="profile"
            pacienteId="pac-2"
            paciente={{ id: 'pac-2', nome: 'Paciente Dois' }}
            roleUserId="ru-1"
            procedimentosFeitos={listaPac1}
          />
        </Wrapper>
      </StrictMode>,
    );

    // Síncrono no Render 1: nenhum dado de pac-1 aparece
    expect(screen.queryByText('Procedimento A Perfil')).toBeNull();
    expect(procedimentosApi.byPaciente).not.toHaveBeenCalled();

    // Pai limpa array ([]), depois recebe listaPac2
    rerender(
      <StrictMode>
        <Wrapper>
          <PlanosTab
            variant="profile"
            pacienteId="pac-2"
            paciente={{ id: 'pac-2', nome: 'Paciente Dois' }}
            roleUserId="ru-1"
            procedimentosFeitos={[]}
          />
        </Wrapper>
      </StrictMode>,
    );
    await esperar(30);
    expect(procedimentosApi.byPaciente).not.toHaveBeenCalled();
    expect(screen.queryByText('Procedimento A Perfil')).toBeNull();

    rerender(
      <StrictMode>
        <Wrapper>
          <PlanosTab
            variant="profile"
            pacienteId="pac-2"
            paciente={{ id: 'pac-2', nome: 'Paciente Dois' }}
            roleUserId="ru-1"
            procedimentosFeitos={listaPac2}
          />
        </Wrapper>
      </StrictMode>,
    );
    await esperar(30);
    expect(procedimentosApi.byPaciente).not.toHaveBeenCalled();
  });
});
