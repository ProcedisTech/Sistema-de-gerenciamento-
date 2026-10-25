import { describe, expect, it } from 'vitest';
import {
  TIPO_META, formatarMensagemNotificacao, formatarTempoRelativo, getTipoMeta, grupoDoTipo,
  grupoTemporal, matchesChip, motivoTexto, normalizarNotificacao,
} from './notificacaoFormat.js';
import { PAYLOAD_REAL } from './notificacaoPayloadsReais.js';

const DF = 'America/Sao_Paulo';

describe('normalizarNotificacao — contrato do back -> formato das telas', () => {
  it('achata tipo/nível/autor e deriva lida de lidaEm', () => {
    const bruto = {
      id: 'n1',
      tipo: { codigo: 'CONSULTA_ENCERRADA', nome: 'Consulta encerrada', nivel: { codigo: 'URGENTE', apareceNaHora: true, acendeSino: true } },
      motivo: 'PESSOA_EXTRA',
      autor: { nome: 'Ana' },
      payload: '{"pacienteNome":"Maria"}',
      criadoEm: '2026-10-24T15:00:00Z',
      lidaEm: null,
    };
    expect(normalizarNotificacao(bruto)).toMatchObject({
      id: 'n1', tipo: 'CONSULTA_ENCERRADA', tipoNome: 'Consulta encerrada', nivel: 'URGENTE',
      acendeSino: true, lida: false, motivo: 'PESSOA_EXTRA', autorNome: 'Ana', payload: '{"pacienteNome":"Maria"}',
    });
    const lida = normalizarNotificacao({
      ...bruto,
      autor: null,
      lidaEm: '2026-10-24T16:00:00Z',
      tipo: { ...bruto.tipo, nivel: { codigo: 'SILENCIOSA', acendeSino: false } },
    });
    expect(lida).toMatchObject({ lida: true, autorNome: undefined, nivel: 'SILENCIOSA', acendeSino: false });
  });
});

describe('13 tipos: ícone e texto', () => {
  const esperado = {
    AGENDA_NOVO: 'Novo agendamento: Maria em 25/10 às 09:00 (Botox)',
    AGENDA_CANCELADO: 'Agendamento de Maria em 25/10 às 09:00 (Botox) cancelado',
    AGENDA_REAGENDADO: 'Agendamento de Maria reagendado de 25/10 às 09:00 para 26/10 às 10:00 (Botox)',
    CONFIRMACAO_CONFIRMOU: 'Maria confirmou presença em 25/10 às 09:00 (Botox)',
    CONFIRMACAO_RECUSOU: 'Maria recusou em 25/10 às 09:00 (Botox)',
    CONFIRMACAO_SEM_RESPOSTA: 'Maria não respondeu em 25/10 às 09:00 (Botox)',
    ANAMNESE_RESPONDIDA: 'Maria respondeu a ficha de anamnese',
    ANAMNESE_VENCIDA: 'Ficha de Maria vencida · horário em 25/10 às 09:00',
    TERMO_ASSINADO: 'Maria assinou o termo "Termo de Botox"',
    TERMO_LINK_EXPIRADO: 'O link do termo "Termo de Botox" de Maria expirou sem assinatura',
    CONSULTA_ENCERRADA: 'Consulta de Maria encerrada por Dra. Ana',
    EQUIPE_NOVO_MEMBRO: 'João entrou na equipe como Recepção',
    RETORNO_LEMBRETE_VENCIDO: 'Lembrete de retorno venceu',
  };

  it.each(Object.entries(esperado))('%s', (tipo, texto) => {
    // payload REAL do tipo (o que o back grava), como string JSON igual ao contrato
    const n = { tipo, tipoNome: 'Lembrete de retorno venceu', payload: JSON.stringify(PAYLOAD_REAL[tipo]) };
    expect(formatarMensagemNotificacao(n)).toBe(texto);
    expect(formatarMensagemNotificacao(n)).not.toContain('undefined');
    expect(TIPO_META[tipo].Icon).toBeTruthy();
    expect(getTipoMeta(tipo)).toBe(TIPO_META[tipo]);
  });

  it('sem payload nenhum o texto também não vaza "undefined" nem "null"', () => {
    for (const tipo of Object.keys(esperado)) {
      const texto = formatarMensagemNotificacao({ tipo, tipoNome: 'X', payload: '{}' });
      expect(texto).not.toContain('undefined');
      expect(texto).not.toContain('null');
    }
  });

  it('usa paciente.nome e autor do DTO quando o payload não traz', () => {
    const n = normalizarNotificacao({
      id: 'n', tipo: { codigo: 'CONSULTA_ENCERRADA', nome: 'x', nivel: { codigo: 'NORMAL', acendeSino: true } },
      paciente: { id: 'p', nome: 'Joana' }, autor: { nome: 'Dr. Beto' }, payload: '{}', lidaEm: null,
    });
    expect(formatarMensagemNotificacao(n)).toBe('Consulta de Joana encerrada por Dr. Beto');
  });

  it('são 13 e os chips agrupam pelo prefixo', () => {
    expect(Object.keys(esperado)).toHaveLength(13);
    expect(Object.keys(TIPO_META)).toHaveLength(13);
    expect(grupoDoTipo('TERMO_ASSINADO')).toBe('TERMOS');
    expect(matchesChip({ tipo: 'CONSULTA_ENCERRADA' }, 'ATENDIMENTO')).toBe(true);
    expect(matchesChip({ tipo: 'CONSULTA_ENCERRADA' }, 'AGENDA')).toBe(false);
  });
});

describe('motivoTexto', () => {
  it('os 4 motivos', () => {
    expect(motivoTexto({ motivo: 'PAPEL_NO_FATO', tipo: 'AGENDA_NOVO' })).toBe('Você recebe porque o horário é seu');
    expect(motivoTexto({ motivo: 'PAPEL_NO_FATO', tipo: 'TERMO_ASSINADO' })).toBe('Você recebe porque enviou o link');
    expect(motivoTexto({ motivo: 'PAPEL_NO_FATO', tipo: 'CONSULTA_ENCERRADA' })).toBe('Você recebe porque a consulta é sua');
    expect(motivoTexto({ motivo: 'PERFIL_EXTRA' })).toBe('Você recebe pelo seu perfil de acesso');
    expect(motivoTexto({ motivo: 'PESSOA_EXTRA' })).toBe('A clínica incluiu você neste aviso');
    expect(motivoTexto({ motivo: 'ACOMPANHAMENTO' })).toBe('Você recebe porque acompanha o profissional deste horário');
    expect(motivoTexto({ motivo: 'ACOMPANHAMENTO', tipo: 'AGENDA_NOVO' })).toBe('Você recebe porque acompanha o profissional deste horário');
    expect(motivoTexto({ motivo: 'ACOMPANHAMENTO', tipo: 'CONSULTA_ENCERRADA' })).toBe('Você recebe porque acompanha o profissional desta consulta');
  });
});

describe('tempo relativo e grupos (dia de calendário no fuso)', () => {
  const agora = new Date('2026-10-24T15:00:00Z').getTime(); // sáb 12:00 em Brasília

  it('horas, ontem e dias no plural', () => {
    expect(formatarTempoRelativo('2026-10-24T13:00:00Z', agora, DF)).toBe('há 2 h');
    expect(formatarTempoRelativo('2026-10-23T20:00:00Z', agora, DF)).toBe('ontem');
    expect(formatarTempoRelativo('2026-10-21T20:00:00Z', agora, DF)).toBe('há 3 dias');
  });

  it('grupoTemporal tem "ontem"', () => {
    expect(grupoTemporal('2026-10-23T20:00:00Z', DF, agora)).toBe('ontem');
    expect(grupoTemporal('2026-10-21T20:00:00Z', DF, agora)).toBe('semana');
    expect(grupoTemporal('2026-10-10T20:00:00Z', DF, agora)).toBe('anteriores');
  });
});
