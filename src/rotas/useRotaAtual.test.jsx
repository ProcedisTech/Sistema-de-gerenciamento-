import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { lerRota, useRotaAtual } from './useRotaAtual';
import { ROTAS } from './tabela';

const L = lerRota;

describe('lerRota', () => {
  it('cobre todas as rotas da tabela com id e sem naoEncontrado', () => {
    const exemplos = {
      entrar: '/entrar', consulta: '/consulta', pacientes: '/pacientes', pacienteNovo: '/pacientes/novo',
      paciente: '/pacientes/1', pacienteAba: '/pacientes/1/avulsos',
      pacienteAnamnese: '/pacientes/1/anamnese/2', pacienteAnamneseEditar: '/pacientes/1/anamnese/2/editar',
      pacientePlano: '/pacientes/1/planos/3', agenda: '/agenda', agendaItem: '/agenda/9',
      notificacoes: '/notificacoes', equipe: '/equipe', equipePerfis: '/equipe/perfis',
      equipeAuditoria: '/equipe/auditoria', membro: '/equipe/5', auditoria: '/auditoria', configuracoes: '/configuracoes',
      termoNovo: '/configuracoes/termos/novo', termo: '/configuracoes/termos/7',
      ficha: '/configuracoes/fichas/8', secao: '/configuracoes/meu-perfil',
    };
    expect(Object.keys(exemplos).sort()).toEqual(ROTAS.map((r) => r.id).sort());
    for (const [id, path] of Object.entries(exemplos)) {
      const r = L(path, '');
      expect(r.rotaId, path).toBe(id);
      expect(r.naoEncontrado, path).toBe(false);
      expect(r.redirecionar, path).toBeNull();
    }
  });

  it('activeView e patientView', () => {
    expect(L('/pacientes').activeView).toBe('pacientes');
    expect(L('/pacientes').patientView).toBe('list');
    expect(L('/pacientes/novo').patientView).toBe('create');
    expect(L('/pacientes/1').patientView).toBe('profile');
    expect(L('/agenda/9').activeView).toBe('agenda');
    expect(L('/equipe/5').activeView).toBe('gestao-equipe');
    expect(L('/auditoria').activeView).toBe('auditoria');
    expect(L('/configuracoes/termos/novo').activeView).toBe('configuracoes');
    expect(L('/entrar').activeView).toBe('pacientes');
    expect(L('/entrar').entrar).toBe(true);
    expect(L('/consulta').activeView).toBe('consulta');
    expect(L('/notificacoes').activeView).toBe('notificacoes');
    expect(L('/xyz').activeView).toBeNull();
  });

  it('paciente: abas, anamnese, plano e ids', () => {
    expect(L('/pacientes/1').patientDetailTab).toBeNull();
    expect(L('/pacientes/1/prontuario').patientDetailTab).toBe('prontuario');
    const a = L('/pacientes/1/anamnese/2/editar');
    expect(a).toMatchObject({ pacienteId: '1', anamneseId: '2', editar: true, patientDetailTab: 'anamnese' });
    expect(L('/pacientes/1/anamnese/2').editar).toBe(false);
    expect(L('/pacientes/1/planos/3')).toMatchObject({ planejamentoId: '3', patientDetailTab: 'planos' });
    expect(L('/pacientes/1/planos').redirecionar).toBe('/pacientes/1');
    expect(L('/pacientes/1/foo').naoEncontrado).toBe(true);
  });

  it('equipe e agenda', () => {
    expect(L('/equipe').equipeAba).toBe('membros');
    expect(L('/equipe/5')).toMatchObject({ equipeAba: 'membros', membroId: '5' });
    expect(L('/equipe/perfis').equipeAba).toBe('perfis');
    expect(L('/equipe/auditoria').equipeAba).toBe('auditoria');
    expect(L('/agenda').equipeAba).toBeNull();
    expect(L('/agenda/9').agendaId).toBe('9');
  });

  it('configuracoes: slug novo, legados e desconhecido', () => {
    expect(L('/configuracoes').configSection).toBeNull();
    expect(L('/configuracoes/meu-perfil').configSection).toBe('perfil');
    expect(L('/configuracoes/horarios').configSection).toBe('horarios-funcionamento');
    expect(L('/configuracoes/termos').configSection).toBe('termos');
    expect(L('/configuracoes/termos/novo')).toMatchObject({ configSection: 'termos', termoNovo: true });
    expect(L('/configuracoes/termos/7')).toMatchObject({ configSection: 'termos', termoId: '7' });
    expect(L('/configuracoes/fichas/8')).toMatchObject({ configSection: 'fichas', fichaId: '8' });
    expect(L('/configuracoes/agenda-horarios').redirecionar).toBe('/configuracoes/horarios');
    expect(L('/configuracoes/categorias').redirecionar).toBe('/configuracoes/fichas');
    expect(L('/configuracoes/perguntas-categorias').redirecionar).toBe('/configuracoes/fichas');
    expect(L('/configuracoes/usuarios-acessos').redirecionar).toBe('/equipe');
    expect(L('/configuracoes/gestao-equipe').redirecionar).toBe('/equipe');
    expect(L('/configuracoes/perfil').redirecionar).toBe('/configuracoes/meu-perfil');
    expect(L('/configuracoes/horarios-funcionamento').redirecionar).toBe('/configuracoes/horarios');
    expect(L('/configuracoes/zzz').naoEncontrado).toBe(true);
  });

  it('fora da tabela, raiz e públicas', () => {
    expect(L('/xyz')).toMatchObject({ rotaId: null, naoEncontrado: true, publico: false });
    expect(L('/')).toMatchObject({ rotaId: null, naoEncontrado: false, publico: false });
    for (const p of ['/c/abc', '/anamnese/tok', '/assinar/tok']) {
      expect(L(p)).toMatchObject({ publico: true, naoEncontrado: false, rotaId: null });
    }
  });

  it('query só em /pacientes', () => {
    const q = L('/pacientes', '?filtro=menor,sem-plano,novos&ordem=nome-desc&pagina=3&resumo=42').query;
    expect(q).toMatchObject({
      quickFilter: 'menor', statusPlano: 'sem_plano', ehNovo: true, ordem: 'nome-desc', pagina: 2, resumoId: '42',
    });
    expect(L('/agenda', '?filtro=menor').query.quickFilter).toBeNull();
    expect(L('/pacientes').query).toMatchObject({ ordem: 'nome-asc', pagina: 0, resumoId: null });
  });
});

describe('useRotaAtual', () => {
  it('lê a localização do roteador', () => {
    const { result } = renderHook(() => useRotaAtual(), {
      wrapper: ({ children }) => <MemoryRouter initialEntries={['/pacientes/1/avulsos']}>{children}</MemoryRouter>,
    });
    expect(result.current).toMatchObject({ rotaId: 'pacienteAba', patientDetailTab: 'avulsos' });
  });
});
