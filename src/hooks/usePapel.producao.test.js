import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePapel, PERMISSOES } from './usePapel';
import * as OrgContextModule from '../contexts/OrgContext';

vi.mock('../contexts/OrgContext', () => ({ useOrg: vi.fn() }));

const ETAPAS = ['anamnese', 'avaliacao', 'planejamento', 'termos', 'procedimento', 'retorno', 'retorno-avulso'];

// Formato real de produção: códigos canônicos de V181 (sem HUB_*/legados inativos).
const PROFISSIONAL = [
  'ATENDIMENTO_REALIZAR', 'ATENDIMENTO_ANAMNESE_VER', 'ATENDIMENTO_AVALIACAO_VER', 'ATENDIMENTO_TERMOS_VER',
  'ATENDIMENTO_PROCEDIMENTO_EXECUTAR', 'ATENDIMENTO_RETORNO_VER', 'ATENDIMENTO_RETORNO_GERENCIAR',
  'PACIENTE_ORCAMENTO_VER', 'PACIENTE_ORCAMENTO_EDITAR',
];
const SECRETARIA = [
  'ATENDIMENTO_ANAMNESE_VER', 'ATENDIMENTO_AVALIACAO_VER', 'ATENDIMENTO_RETORNO_VER', 'ATENDIMENTO_TERMOS_VER',
];

function papel(papelNome, permissoes) {
  vi.mocked(OrgContextModule.useOrg).mockReturnValue({ papel: papelNome, permissoes, roleUserId: 'ru-1' });
  return renderHook(() => usePapel()).result.current;
}

describe('usePapel.getEstadoEtapaAtendimento com permissões reais de produção', () => {
  it.each(ETAPAS)('profissional: etapa %s não é bloqueada', (etapa) => {
    const p = papel('PROFISSIONAL', PROFISSIONAL);
    expect(p.canRealizarAtendimento).toBe(true);
    expect(p.getEstadoEtapaAtendimento(etapa)).not.toBe('bloqueado');
  });

  it.each(ETAPAS)('secretária (sem ATENDIMENTO_REALIZAR): etapa %s bloqueada', (etapa) => {
    const p = papel('SECRETARIA', SECRETARIA);
    expect(p.canSeeAtendimentoAnamnese).toBe(true); // sinal positivo: ela enxerga as permissões
    expect(p.getEstadoEtapaAtendimento(etapa)).toBe('bloqueado');
  });
});

describe('Notas do paciente (PRONTUARIO_VER / PRONTUARIO_EDITAR)', () => {
  it('PRONTUARIO_VER vê notas, mas não cria nem edita', () => {
    const p = papel('PROFISSIONAL', [PERMISSOES.PRONTUARIO_VER]);
    expect(PERMISSOES.PACIENTE_NOTA_VER).toBe('PRONTUARIO_VER');
    expect(p.canSeeNotasPaciente).toBe(true);
    expect(p.canCreateNotaPaciente).toBe(false);
    expect(p.canEditNotaPaciente).toBe(false);
  });

  it('PRONTUARIO_EDITAR cria e edita notas', () => {
    const p = papel('PROFISSIONAL', [PERMISSOES.PRONTUARIO_EDITAR]);
    expect(p.canCreateNotaPaciente).toBe(true);
    expect(p.canEditNotaPaciente).toBe(true);
  });

  it('sem nenhuma das duas: nada de notas', () => {
    const p = papel('PROFISSIONAL', ['AGENDA_VER']);
    expect(p.hasPerm('AGENDA_VER')).toBe(true);
    expect(p.canSeeNotasPaciente).toBe(false);
    expect(p.canCreateNotaPaciente).toBe(false);
    expect(p.canEditNotaPaciente).toBe(false);
  });
});
