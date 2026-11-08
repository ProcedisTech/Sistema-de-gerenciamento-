import { describe, expect, it } from 'vitest';
import {
  CHIP_FILTERS,
  TIPO_VERBO,
  TIPOS_AGENDA,
  countByChip,
  filterByChip,
  formatarMensagemNotificacao,
  matchesChip,
} from './notificacaoFormat.js';

describe('notificacaoFormat — agenda_profissional_transferido', () => {
  it('contém agenda_profissional_transferido em TIPO_VERBO e TIPOS_AGENDA', () => {
    expect(TIPO_VERBO.agenda_profissional_transferido).toBe('Transferência de profissional');
    expect(TIPOS_AGENDA).toContain('agenda_profissional_transferido');
  });

  it('matchesChip categoriza agenda_profissional_transferido sob "agenda" e "todas"', () => {
    const notif = { tipo: 'agenda_profissional_transferido' };
    expect(matchesChip(notif, 'todas')).toBe(true);
    expect(matchesChip(notif, 'agenda')).toBe(true);
    expect(matchesChip(notif, 'sugestoes')).toBe(false);
    expect(matchesChip(notif, 'confirmacoes')).toBe(false);
  });

  it('countByChip e filterByChip contabilizam a transferência na aba Agenda', () => {
    const items = [
      { id: 1, tipo: 'agenda_profissional_transferido' },
      { id: 2, tipo: 'agenda_cancelada' },
      { id: 3, tipo: 'SUGESTAO_PROCEDIMENTO' },
    ];
    const counts = countByChip(items);
    expect(counts.todas).toBe(3);
    expect(counts.agenda).toBe(2);
    expect(counts.sugestoes).toBe(1);
    expect(counts.confirmacoes).toBe(0);

    const agendaFiltered = filterByChip(items, 'agenda');
    expect(agendaFiltered.map((i) => i.id)).toEqual([1, 2]);
  });

  it('formata mensagem completa com paciente, data/hora, procedimento e ambos profissionais', () => {
    const notif = {
      tipo: 'agenda_profissional_transferido',
      payload: {
        pacienteNome: 'Ana Carolina Silva Oliveira',
        dataAgendamento: '2026-11-06',
        horaInicio: '18:00',
        procedimentoNome: 'Toxina Botulínica',
        profissionalAnteriorNome: 'Guilherme Barcelos',
        profissionalNovoNome: 'Dra. Camila Souza',
        motivo: 'Imprevisto do profissional',
      },
    };
    const msg = formatarMensagemNotificacao(notif);
    expect(msg).toBe(
      'Agendamento de Ana Carolina Silva Oliveira em 06/11 às 18:00 (Toxina Botulínica) transferido de Guilherme Barcelos para Dra. Camila Souza'
    );
  });

  it('formata mensagem quando procedimento é nulo', () => {
    const notif = {
      tipo: 'agenda_profissional_transferido',
      payload: {
        pacienteNome: 'André Lima Carvalho',
        dataAgendamento: '2026-11-06',
        horaInicio: '17:00',
        procedimentoNome: null,
        profissionalAnteriorNome: 'Guilherme Barcelos',
        profissionalNovoNome: 'Dra. Camila Souza',
      },
    };
    const msg = formatarMensagemNotificacao(notif);
    expect(msg).toBe(
      'Agendamento de André Lima Carvalho em 06/11 às 17:00 transferido de Guilherme Barcelos para Dra. Camila Souza'
    );
  });

  it('formata mensagem sem profissional anterior', () => {
    const notif = {
      tipo: 'agenda_profissional_transferido',
      payload: {
        pacienteNome: 'Carlos Eduardo',
        dataAgendamento: '2026-11-07',
        horaInicio: '10:00',
        profissionalNovoNome: 'Dra. Camila Souza',
      },
    };
    const msg = formatarMensagemNotificacao(notif);
    expect(msg).toBe(
      'Agendamento de Carlos Eduardo em 07/11 às 10:00 transferido para Dra. Camila Souza'
    );
  });

  it('formata mensagem de fallback sem dados no payload', () => {
    const notif = { tipo: 'agenda_profissional_transferido', payload: {} };
    expect(formatarMensagemNotificacao(notif)).toBe('Transferência de profissional no agendamento');
  });
});

