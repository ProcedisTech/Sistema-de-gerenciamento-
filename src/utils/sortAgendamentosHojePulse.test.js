import { describe, expect, it } from 'vitest';
import { isAgendamentoHojePassado, sortAgendamentosHojePulse } from './sortAgendamentosHojePulse.js';

const AC = 'America/Rio_Branco';
const DF = 'America/Sao_Paulo';
// 12:00Z = 09:00 em Brasília = 07:00 em Rio Branco
const NOW = new Date('2026-10-02T12:00:00Z');

function slot(overrides) {
  return {
    data: '2026-10-02',
    horaInicio: '07:00',
    horaFim: '08:00',
    status: 'confirmado',
    ...overrides,
  };
}

describe('isAgendamentoHojePassado', () => {
  it('realizado é passado mesmo com horaFim no futuro', () => {
    expect(isAgendamentoHojePassado(slot({ status: 'realizado', horaFim: '20:00' }), DF, NOW)).toBe(true);
  });

  it('slot que termina às 08:00: passado em DF, ainda por vir em AC no mesmo instante', () => {
    expect(isAgendamentoHojePassado(slot(), DF, NOW)).toBe(true);
    expect(isAgendamentoHojePassado(slot(), AC, NOW)).toBe(false);
  });

  it('pendente com horaFim depois de agora não é passado', () => {
    expect(isAgendamentoHojePassado(slot({ status: 'pendente', horaFim: '20:00' }), DF, NOW)).toBe(false);
  });
});

describe('sortAgendamentosHojePulse', () => {
  const rows = [
    slot({ horaInicio: '07:00', horaFim: '08:00' }),
    slot({ horaInicio: '08:30', horaFim: '08:45' }),
    slot({ horaInicio: '06:00', horaFim: '06:30', status: 'realizado' }),
    slot({ horaInicio: '10:00', horaFim: '11:00', status: 'pendente' }),
  ];

  it('DF: 07:00 e 08:30 já terminaram e vão para o fim', () => {
    expect(sortAgendamentosHojePulse(rows, DF, NOW).map((r) => r.horaInicio)).toEqual(['10:00', '06:00', '07:00', '08:30']);
  });

  it('AC: no mesmo instante, 07:00 e 08:30 ainda estão por vir', () => {
    expect(sortAgendamentosHojePulse(rows, AC, NOW).map((r) => r.horaInicio)).toEqual(['07:00', '08:30', '10:00', '06:00']);
  });
});

// ── Camada 2 · F3: cards do painel com o mesmo agrupamento da Agenda ──
import { agruparAgendamentosHojePulse, isEntradaHojePassada } from './sortAgendamentosHojePulse.js';
import { groupConsecutiveAppointments } from './agendaDayInsights.js';

function ag(id, overrides) {
  return {
    id,
    agendaId: id,
    data: '2026-10-02',
    pacienteId: 'p1',
    pacienteNome: 'Maria Silva',
    profissionalRoleUserId: 'ru-a',
    roleUserId: 'ru-a',
    status: 'pendente',
    ...overrides,
  };
}

/** ids das agendas de cada card, na ordem do card. */
const idsDosCards = (cards) =>
  cards.map((c) => (c.kind === 'group' ? c.appointments.map((a) => a.id) : [c.appointment.id]));

describe('agruparAgendamentosHojePulse (cards)', () => {
  it('duas linhas encadeadas do mesmo paciente e profissional viram 1 card', () => {
    const cards = agruparAgendamentosHojePulse(
      [
        ag('a1', { horaInicio: '10:00', horaFim: '10:30', procedimentoNome: 'Botox' }),
        ag('a2', { horaInicio: '10:30', horaFim: '11:00', procedimentoNome: 'Preenchimento Labial' }),
      ],
      DF,
      NOW,
    );
    expect(cards).toHaveLength(1);
    expect(cards[0].kind).toBe('group');
    expect(idsDosCards(cards)).toEqual([['a1', 'a2']]);
    expect(cards[0].horaInicio).toBe('10:00');
    expect(cards[0].horaFim).toBe('11:00');
  });

  it('9h e 16h do mesmo paciente e profissional = 2 cards', () => {
    const cards = agruparAgendamentosHojePulse(
      [
        ag('a16', { horaInicio: '16:00', horaFim: '16:30' }),
        ag('a9', { horaInicio: '09:00', horaFim: '09:30' }),
      ],
      DF,
      NOW,
    );
    expect(idsDosCards(cards)).toEqual([['a9'], ['a16']]);
  });

  it('encadeadas mas com outro profissional = 2 cards', () => {
    const cards = agruparAgendamentosHojePulse(
      [
        ag('a1', { horaInicio: '10:00', horaFim: '10:30' }),
        ag('a2', { horaInicio: '10:30', horaFim: '11:00', profissionalRoleUserId: 'ru-b', roleUserId: 'ru-b' }),
      ],
      DF,
      NOW,
    );
    expect(idsDosCards(cards)).toEqual([['a1'], ['a2']]);
  });

  it('card passado vai para o fim (simples e grupo)', () => {
    // 09:00 em DF: o grupo 07:00–08:00 já terminou; a simples das 10:00 ainda vem.
    const rows = [
      ag('g1', { horaInicio: '07:00', horaFim: '07:30' }),
      ag('g2', { horaInicio: '07:30', horaFim: '08:00' }),
      ag('s1', { horaInicio: '10:00', horaFim: '10:30', pacienteId: 'p2', pacienteNome: 'Ana' }),
    ];
    const cards = agruparAgendamentosHojePulse(rows, DF, NOW);
    expect(idsDosCards(cards)).toEqual([['s1'], ['g1', 'g2']]);
    expect(isEntradaHojePassada(cards[1], DF, NOW)).toBe(true);
    expect(isEntradaHojePassada(cards[0], DF, NOW)).toBe(false);

    // simples passada (08:00) atrás de um grupo futuro (10:00–11:00)
    const cards2 = agruparAgendamentosHojePulse(
      [
        ag('x1', { horaInicio: '07:00', horaFim: '08:00', pacienteId: 'p2', pacienteNome: 'Ana' }),
        ag('y1', { horaInicio: '10:00', horaFim: '10:30' }),
        ag('y2', { horaInicio: '10:30', horaFim: '11:00' }),
      ],
      DF,
      NOW,
    );
    expect(idsDosCards(cards2)).toEqual([['y1', 'y2'], ['x1']]);
  });

  it('o critério de juntar é o de groupConsecutiveAppointments, aplicado por paciente + profissional + dia', () => {
    const rows = [
      ag('a1', { horaInicio: '10:00', horaFim: '10:30' }),
      ag('a2', { horaInicio: '10:30', horaFim: '11:00' }),
      ag('a3', { horaInicio: '11:00', horaFim: '11:30', status: 'realizado' }),
      ag('b1', { horaInicio: '10:00', horaFim: '10:30', pacienteId: 'p2', pacienteNome: 'Ana' }),
      ag('b2', { horaInicio: '10:30', horaFim: '11:00', pacienteId: 'p2', profissionalRoleUserId: 'ru-b', roleUserId: 'ru-b' }),
      ag('c1', { horaInicio: '14:00', horaFim: '14:30', pacienteId: 'p3', pacienteNome: 'Bia' }),
      ag('c2', { horaInicio: '14:30', horaFim: '15:00', pacienteId: 'p3', pacienteNome: 'Bia' }),
      ag('c3', { horaInicio: '15:00', horaFim: '15:30', pacienteId: 'p3', pacienteNome: 'Bia' }),
      ag('d1', { horaInicio: '16:00', horaFim: '16:30' }),
    ];
    const chave = (cards) => idsDosCards(cards).map((ids) => ids.join('+')).sort();
    const doPainel = agruparAgendamentosHojePulse(rows, DF, NOW);

    // referência: a função compartilhada (inalterada) aplicada a cada partição paciente+profissional+dia
    const particoes = new Map();
    for (const r of rows) {
      const k = `${r.pacienteId}|${r.profissionalRoleUserId || r.roleUserId}|${r.data}`;
      if (!particoes.has(k)) particoes.set(k, []);
      particoes.get(k).push(r);
    }
    const porParticao = [...particoes.values()].flatMap((linhas) => groupConsecutiveAppointments(linhas));

    expect(chave(doPainel)).toEqual(chave(porParticao));
    expect(chave(doPainel)).toEqual(['a1+a2', 'a3', 'b1', 'b2', 'c1+c2+c3', 'd1']);
    expect(doPainel).toHaveLength(6);
  });

  it('Maria às 9h e 9h30 (mesma profissional, encadeadas) com outro paciente às 9h de outra profissional = 1 card da Maria', () => {
    // ordem de entrada por horário, como vem do dashboard: o outro paciente fica ENTRE as duas da Maria
    const rows = [
      ag('m1', { horaInicio: '09:00', horaFim: '09:30', procedimentoNome: 'Botox' }),
      ag('o1', {
        horaInicio: '09:00',
        horaFim: '09:30',
        pacienteId: 'p2',
        pacienteNome: 'Ana Souza',
        profissionalRoleUserId: 'ru-b',
        roleUserId: 'ru-b',
      }),
      ag('m2', { horaInicio: '09:30', horaFim: '10:00', procedimentoNome: 'Preenchimento Labial' }),
    ];
    const cards = agruparAgendamentosHojePulse(rows, DF, NOW);
    expect(idsDosCards(cards)).toEqual([['m1', 'm2'], ['o1']]);
    expect(cards[0].kind).toBe('group');
    expect(cards[0].horaInicio).toBe('09:00');
    expect(cards[0].horaFim).toBe('10:00');
    expect(cards[1].kind).toBe('single');
  });
});
