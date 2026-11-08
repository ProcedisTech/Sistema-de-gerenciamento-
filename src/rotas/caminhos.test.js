import { describe, it, expect } from 'vitest';
import { caminhos, lerQueryPacientes } from './caminhos';
import { SLUG_DA_SECAO, SECAO_DO_SLUG, ROTAS } from './tabela';

describe('caminhos', () => {
  it('endereços fixos', () => {
    expect(caminhos.entrar()).toBe('/entrar');
    expect(caminhos.consulta()).toBe('/consulta');
    expect(caminhos.pacienteNovo()).toBe('/pacientes/novo');
    expect(caminhos.notificacoes()).toBe('/notificacoes');
    expect(caminhos.termoNovo()).toBe('/configuracoes/termos/novo');
  });

  it('paciente: aba padrão omitida, ids codificados', () => {
    expect(caminhos.paciente('7')).toBe('/pacientes/7');
    expect(caminhos.paciente('7', null)).toBe('/pacientes/7');
    expect(caminhos.paciente('7', 'planos')).toBe('/pacientes/7');
    expect(caminhos.paciente('7', 'prontuario')).toBe('/pacientes/7/prontuario');
    expect(caminhos.paciente('a/b')).toBe('/pacientes/a%2Fb');
    expect(caminhos.pacienteAnamnese('7', '9')).toBe('/pacientes/7/anamnese/9');
    expect(caminhos.pacienteAnamnese('7', '9', { editar: true })).toBe('/pacientes/7/anamnese/9/editar');
    expect(caminhos.pacientePlano('7', 'p 1')).toBe('/pacientes/7/planos/p%201');
  });

  it('agenda, equipe, membro, termo, ficha', () => {
    expect(caminhos.agenda()).toBe('/agenda');
    expect(caminhos.agenda('3')).toBe('/agenda/3');
    expect(caminhos.equipe()).toBe('/equipe');
    expect(caminhos.equipe('membros')).toBe('/equipe');
    expect(caminhos.equipe('perfis')).toBe('/equipe/perfis');
    expect(caminhos.equipe('auditoria')).toBe('/equipe/auditoria');
    expect(caminhos.membro('m1')).toBe('/equipe/m1');
    expect(caminhos.termo('t1')).toBe('/configuracoes/termos/t1');
    expect(caminhos.ficha('f1')).toBe('/configuracoes/fichas/f1');
  });

  it('configuracoes: 11 slugs e inverso', () => {
    expect(caminhos.configuracoes()).toBe('/configuracoes');
    expect(caminhos.configuracoes(null)).toBe('/configuracoes');
    const esperado = {
      perfil: 'meu-perfil',
      clinica: 'clinica',
      'horarios-funcionamento': 'horarios',
      'agenda-feriados': 'feriados',
      'agenda-templates': 'mensagens',
      procedimentos: 'procedimentos',
      termos: 'termos',
      'metodos-assinatura': 'metodos-de-assinatura',
      fichas: 'fichas',
      'anamnese-publica': 'anamnese-publica',
      'pacientes-inativados': 'pacientes-inativos',
    };
    expect(Object.keys(SLUG_DA_SECAO)).toHaveLength(11);
    for (const [secao, slug] of Object.entries(esperado)) {
      expect(caminhos.configuracoes(secao)).toBe(`/configuracoes/${slug}`);
      expect(SECAO_DO_SLUG[slug]).toBe(secao);
    }
  });

  it('tela(view)', () => {
    expect(caminhos.tela('pacientes')).toBe('/pacientes');
    expect(caminhos.tela('agenda')).toBe('/agenda');
    expect(caminhos.tela('gestao-equipe')).toBe('/equipe');
    expect(caminhos.tela('configuracoes')).toBe('/configuracoes');
    expect(caminhos.tela('notificacoes')).toBe('/notificacoes');
    expect(caminhos.tela('consulta')).toBe('/consulta');
  });

  it('ROTAS sem id repetido', () => {
    expect(ROTAS).toHaveLength(21);
    expect(new Set(ROTAS.map((r) => r.id)).size).toBe(21);
  });
});

describe('pacientes(query)', () => {
  it('sem query ou padrões: sem querystring', () => {
    expect(caminhos.pacientes()).toBe('/pacientes');
    expect(caminhos.pacientes({ ordem: 'nome-asc', pagina: 0, resumoId: null })).toBe('/pacientes');
  });

  it('tokens, ordem, página 1-based, resumo', () => {
    expect(caminhos.pacientes({ quickFilter: 'menor', statusPlano: 'sem_plano' })).toBe(
      '/pacientes?filtro=menor,sem-plano',
    );
    expect(caminhos.pacientes({ statusPlano: 'plano_ativo', ehNovo: true })).toBe(
      '/pacientes?filtro=plano-ativo,novos',
    );
    expect(caminhos.pacientes({ ordem: 'nome-desc' })).toBe('/pacientes?ordem=nome-desc');
    expect(caminhos.pacientes({ pagina: 2 })).toBe('/pacientes?pagina=3');
    expect(caminhos.pacientes({ resumoId: '12' })).toBe('/pacientes?resumo=12');
  });

  it('ida e volta', () => {
    const q = {
      quickFilter: 'menor',
      statusPlano: 'plano_ativo',
      anamneseDesatualizada: true,
      semRetorno: true,
      semAgendamentoFuturo: true,
      ehNovo: true,
      ehAniversariante: true,
      ordem: 'nome-desc',
      pagina: 4,
      resumoId: '99',
    };
    expect(lerQueryPacientes(caminhos.pacientes(q).split('?')[1])).toEqual(q);
    expect(lerQueryPacientes('')).toEqual({
      quickFilter: null,
      statusPlano: null,
      anamneseDesatualizada: false,
      semRetorno: false,
      semAgendamentoFuturo: false,
      ehNovo: false,
      ehAniversariante: false,
      ordem: 'nome-asc',
      pagina: 0,
      resumoId: null,
    });
    expect(lerQueryPacientes('?pagina=abc').pagina).toBe(0);
  });
});
