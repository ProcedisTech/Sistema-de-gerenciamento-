import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePapel, PERMISSOES, PERFIS_ACESSO, PESOS_PERFIL } from './usePapel';
import * as OrgContextModule from '../contexts/OrgContext';

vi.mock('../contexts/OrgContext', () => ({
  useOrg: vi.fn(),
}));

describe('Catálogo de Permissões e usePapel', () => {
  it('deve conter exatamente 54 permissões canônicas ativas', () => {
    const codigos = Object.values(PERMISSOES);
    expect(codigos).toHaveLength(54);
    expect(PERMISSOES.AGENDA_APARECER).toBe('AGENDA_APARECER');
  });

  it('deve conter os perfis padrão globais em PERFIS_ACESSO incluindo PROFISSIONAL_CLINICO', () => {
    expect(PERFIS_ACESSO.DONO).toBe('DONO');
    expect(PERFIS_ACESSO.PROFISSIONAL_CLINICO).toBe('PROFISSIONAL_CLINICO');
    expect(PERFIS_ACESSO.NIVEL_5).toBe('NIVEL_5');
    expect(PERFIS_ACESSO.NIVEL_4).toBe('NIVEL_4');
    expect(PERFIS_ACESSO.NIVEL_3).toBe('NIVEL_3');
    expect(PERFIS_ACESSO.NIVEL_2).toBe('NIVEL_2');
    expect(PERFIS_ACESSO.NIVEL_1).toBe('NIVEL_1');
  });

  it('deve garantir que DONO tem bypass total em todas as permissões', () => {
    vi.mocked(OrgContextModule.useOrg).mockReturnValue({
      papel: 'DONO',
      permissoes: [], // mesmo sem permissões explícitas
    });

    const { result } = renderHook(() => usePapel());

    expect(result.current.isDono).toBe(true);
    expect(result.current.canSeeAgenda).toBe(true);
    expect(result.current.canSeeGaleria).toBe(true);
    expect(result.current.canSeeRespostasAnamnese).toBe(true);
    expect(result.current.canManageUsers).toBe(true);
    expect(result.current.hasPerm(PERMISSOES.AGENDA_BLOQUEIO_GERENCIAR)).toBe(true);
  });

  it('deve garantir que NIVEL_2 (Recepção) NÃO tem acesso à Galeria nem Anamnese por padrão', () => {
    vi.mocked(OrgContextModule.useOrg).mockReturnValue({
      papel: 'NIVEL_2',
      permissoes: [
        PERMISSOES.AGENDA_VER,
        PERMISSOES.AGENDA_CRIAR,
        PERMISSOES.AGENDA_EDITAR,
        PERMISSOES.CONFIRMACAO_GERENCIAR,
        PERMISSOES.PACIENTE_VER,
        PERMISSOES.PACIENTE_CRIAR,
        PERMISSOES.PACIENTE_EDITAR,
        PERMISSOES.DOCUMENTO_ASSINATURA_CRIAR,
        PERMISSOES.CATALOGO_VER,
        PERMISSOES.NOTIFICACAO_VER,
      ],
    });

    const { result } = renderHook(() => usePapel());

    expect(result.current.canSeeAgenda).toBe(true);
    expect(result.current.canSeePacientes).toBe(true);
    expect(result.current.canManageConfirmacoes).toBe(true);

    // Bloqueios clínicos essenciais para sigilo e LGPD:
    expect(result.current.canSeeGaleria).toBe(false);
    expect(result.current.canSeeRespostasAnamnese).toBe(false);
    expect(result.current.canStartAnamnese).toBe(false);
    expect(result.current.canSeeProntuario).toBe(false);
  });

  it('deve garantir que NIVEL_3 (Clínico) tem acesso ao Prontuário, Galeria e Anamnese', () => {
    vi.mocked(OrgContextModule.useOrg).mockReturnValue({
      papel: 'NIVEL_3',
      permissoes: [
        PERMISSOES.AGENDA_VER,
        PERMISSOES.PACIENTE_VER,
        PERMISSOES.PACIENTE_GALERIA_VER,
        PERMISSOES.ANAMNESE_PREENCHIMENTO_VER,
        PERMISSOES.ANAMNESE_PREENCHIMENTO_CRIAR,
        PERMISSOES.PRONTUARIO_VER,
        PERMISSOES.PRONTUARIO_CRIAR,
        PERMISSOES.EVOLUCAO_GERENCIAR,
        PERMISSOES.ORIENTACAO_GERENCIAR,
      ],
    });

    const { result } = renderHook(() => usePapel());

    expect(result.current.canSeeGaleria).toBe(true);
    expect(result.current.canSeeRespostasAnamnese).toBe(true);
    expect(result.current.canStartAnamnese).toBe(true);
    expect(result.current.canSeeProntuario).toBe(true);
    expect(result.current.canManageEvolucoes).toBe(true);
    expect(result.current.canManageOrientacoes).toBe(true);
  });

  it('deve suportar hasAllPerms e hasAnyPerm', () => {
    vi.mocked(OrgContextModule.useOrg).mockReturnValue({
      papel: 'NIVEL_2',
      permissoes: [PERMISSOES.AGENDA_VER, PERMISSOES.PACIENTE_VER],
    });

    const { result } = renderHook(() => usePapel());

    expect(result.current.hasAllPerms([PERMISSOES.AGENDA_VER, PERMISSOES.PACIENTE_VER])).toBe(true);
    expect(result.current.hasAllPerms([PERMISSOES.AGENDA_VER, PERMISSOES.PACIENTE_GALERIA_VER])).toBe(false);

    expect(result.current.hasAnyPerm([PERMISSOES.AGENDA_VER, PERMISSOES.PACIENTE_GALERIA_VER])).toBe(true);
    expect(result.current.hasAnyPerm([PERMISSOES.PACIENTE_GALERIA_VER, PERMISSOES.USUARIO_EXCLUIR])).toBe(false);
  });

  it('deve identificar corretamente profissional clinico e canAparecerNaAgenda', () => {
    vi.mocked(OrgContextModule.useOrg).mockReturnValue({
      papel: 'PROFISSIONAL_CLINICO',
      permissoes: [PERMISSOES.AGENDA_APARECER, PERMISSOES.AGENDA_VER],
    });

    const { result } = renderHook(() => usePapel());

    expect(result.current.isProfissionalClinico).toBe(true);
    expect(result.current.canAparecerNaAgenda).toBe(true);
  });
});
