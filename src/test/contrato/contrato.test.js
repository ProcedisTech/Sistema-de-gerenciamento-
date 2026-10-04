import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { agendaContrato, pacienteContrato } from './fixtures.js';
import {
  diaDoInstante,
  formatarDataCalendario,
  formatarInstante,
  parseDataHoraCalendario,
} from '../../utils/datasClinica.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PASTA_BACKEND = resolve(AQUI, '../../../../plataforma-procedimentos/backend/src/test/resources/contrato');
const ARQUIVOS = ['agenda-dto.json', 'paciente-dto.json'];

const RE_INSTANTE_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
const RE_HORA = /^\d{2}:\d{2}:\d{2}$/;
const RE_DATA_HORA_CAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

const INSTANTES = {
  agenda: ['criadoEm', 'atualizadoEm'],
  paciente: ['criadoEm', 'atualizadoEm', 'ultimaVinda', 'inativadoEm'],
};

function instantesPresentes(dto, campos) {
  return campos.filter((c) => dto[c] != null).map((c) => [c, dto[c]]);
}

describe('contrato de datas com o backend', () => {
  it.each(ARQUIVOS)('%s é cópia idêntica do backend (quando o repositório está ao lado)', (arquivo) => {
    const backend = resolve(PASTA_BACKEND, arquivo);
    if (!existsSync(backend)) return;
    const local = readFileSync(resolve(AQUI, arquivo), 'utf8');
    expect(local.replace(/\r\n/g, '\n')).toBe(readFileSync(backend, 'utf8').replace(/\r\n/g, '\n'));
  });

  it('agenda: instantes em UTC com Z e calendário sem fuso', () => {
    const dto = agendaContrato();
    for (const [, valor] of instantesPresentes(dto, INSTANTES.agenda)) expect(valor).toMatch(RE_INSTANTE_UTC);
    expect(dto.dataAgendamento).toMatch(RE_DATA);
    expect(dto.horaInicio).toMatch(RE_HORA);
    expect(dto.horaFim).toMatch(RE_HORA);
  });

  it('paciente: instantes em UTC com Z, nascimento e próximo agendamento como calendário', () => {
    const dto = pacienteContrato();
    for (const [, valor] of instantesPresentes(dto, INSTANTES.paciente)) expect(valor).toMatch(RE_INSTANTE_UTC);
    expect(dto.dataNascimento).toMatch(RE_DATA);
    expect(dto.proximoAgendamento).toMatch(RE_DATA_HORA_CAL);
  });

  it.each([
    ['America/Sao_Paulo', '30/09/2026 23:52', '2026-09-30'],
    ['America/Rio_Branco', '30/09/2026 21:52', '2026-09-30'],
  ])('criadoEm 02:52Z aparece no dia certo em %s', (fuso, texto, dia) => {
    const { criadoEm } = agendaContrato();
    expect(formatarInstante(criadoEm, fuso, 'dataHora').replace(',', '')).toBe(texto);
    expect(diaDoInstante(criadoEm, fuso)).toBe(dia);
  });

  it('proximoAgendamento é lido como horário de calendário, igual em qualquer fuso', () => {
    const { proximoAgendamento } = pacienteContrato();
    expect(parseDataHoraCalendario(proximoAgendamento)).toMatchObject({ dataIso: '2026-10-05', hhmm: '14:30' });
    expect(formatarInstante(proximoAgendamento, 'America/Rio_Branco')).toBe('');
  });

  it('dataAgendamento e dataNascimento não deslocam de dia', () => {
    expect(formatarDataCalendario(agendaContrato().dataAgendamento, 'curta')).toBe('05/10/2026');
    expect(formatarDataCalendario(pacienteContrato().dataNascimento, 'curta')).toBe('10/05/1990');
  });
});
