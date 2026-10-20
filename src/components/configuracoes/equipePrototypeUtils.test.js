import {describe,it,expect} from 'vitest';
import {
  profileType,
  effectiveProfilePermissions,
  summarizeModules,
  sortPrototypeProfiles,
  permissionLevel,
  PROTOTYPE_MODULES,
  getPermissionHierarchyRank,
  sortPermissionsByHierarchy,
} from './equipePrototypeUtils';
const catalog = [
 {permissaoId:'ver',codigo:'PACIENTE_VER',modulo:'Pacientes'},
 {permissaoId:'criar',codigo:'PACIENTE_CRIAR',modulo:'Pacientes'},
 {permissaoId:'editar',codigo:'PACIENTE_EDITAR',modulo:'Pacientes'},
 {permissaoId:'excluir',codigo:'PACIENTE_EXCLUIR',modulo:'Pacientes'},
 {permissaoId:'aparecer',codigo:'AGENDA_APARECER',modulo:'Agenda'},
 {permissaoId:'multi',codigo:'AGENDA_MULTI_VER',modulo:'Agenda'},
];
describe('mapeamento do protótipo para permissões reais',()=>{
 it('preserva cores e agrupamento de proprietário, perfis locais e modelos',()=>{
  expect(profileType({codigo:'DONO'})).toBe('dono');
  expect(profileType({organizacaoSaudeDonaId:'clinica'})).toBe('cli');
  expect(profileType({codigo:'ADMINISTRADOR'})).toBe('tpl');
 });
 it('distingue visualização, edição, acesso total e escolha parcial',()=>{
  const summary = ids => summarizeModules(catalog,ids).find(m=>m.key==='pacientes');
  expect(summary([]).k).toBe('0');expect(summary(['ver']).k).toBe('1');
  expect(summary(['ver','criar','editar']).k).toBe('2');
  expect(summary(['ver','criar','editar','excluir']).k).toBe('3');
  expect(summary(['ver','criar']).k).toBe('c');
 });
 it('não concede funções configuráveis da agenda ao exibir proprietário',()=>{
  expect(effectiveProfilePermissions({codigo:'DONO'},[],catalog)).toEqual(['ver','criar','editar','excluir']);
  expect(effectiveProfilePermissions({codigo:'DONO'},['multi'],catalog)).toContain('multi');
 });
});

it('ordena modelos como no protótipo, independentemente do retorno da API',()=>{
 const profiles=[{id:5,codigo:'APOIO'},{id:3,codigo:'PROFISSIONAL_CLINICO'},{id:2,codigo:'SOCIO'},{id:4,codigo:'SECRETARIA'},{id:1,codigo:'ADMINISTRADOR'},{id:0,codigo:'DONO'},{id:6,nome:'Secretaria-1',organizacaoSaudeDonaId:'org'}];
 expect(sortPrototypeProfiles(profiles).map(p=>p.id)).toEqual([0,6,1,2,3,4,5]);
});

it('mantém confirmações operacionais em Ver e editar',()=>{
 const c=[{permissaoId:'v',codigo:'AGENDA_VER',modulo:'Agenda'},{permissaoId:'c',codigo:'CONFIRMACAO_GERENCIAR',modulo:'Agenda'},{permissaoId:'d',codigo:'AGENDA_EXCLUIR',modulo:'Agenda'}];
 expect(summarizeModules(c,['v','c'])[0].k).toBe('2');
});

it('reconhece os níveis da Agenda sem exigir encaixe fora da disponibilidade para Ver e editar', () => {
 const agendaCatalog = [
  'AGENDA_VER',
  'AGENDA_PROPRIA_VER',
  'AGENDA_MULTI_VER',
  'AGENDA_CRIAR',
  'AGENDA_EDITAR',
  'CONFIRMACAO_GERENCIAR',
  'AGENDA_EXCLUIR',
  'AGENDA_BLOQUEIO_GERENCIAR',
  'AGENDA_FORA_DISP_ENCAIXAR',
  'AGENDA_APARECER',
 ].map(codigo => ({ permissaoId: codigo, codigo, modulo: 'Agenda' }));
 const summary = ids => summarizeModules(agendaCatalog, ids).find(m => m.key === 'agenda');
 expect(summary([
  'AGENDA_VER', 'AGENDA_PROPRIA_VER', 'AGENDA_MULTI_VER',
  'AGENDA_CRIAR', 'AGENDA_EDITAR', 'CONFIRMACAO_GERENCIAR',
 ])).toMatchObject({ k: '2', t: 'Ver e editar' });
 expect(summary(agendaCatalog.map(p => p.permissaoId))).toMatchObject({ k: '3', t: 'Tudo' });
 expect(summary(['AGENDA_VER', 'AGENDA_PROPRIA_VER'])).toMatchObject({ k: '1', t: 'Só ver' });
});

it.each([
 ['AGENDA_FORA_DISP_ENCAIXAR', 3],
 ['CATALOGO_EDITAR', 3],
 ['USUARIO_CRIAR', 3],
 ['AGENDA_MULTI_VER', 1],
 ['AGENDA_CRIAR', 2],
 ['CONFIRMACAO_GERENCIAR', 2],
])('classifica %s no nível %i', (codigo, level) => {
 expect(permissionLevel({ codigo })).toBe(level);
});

it('mantém exatamente os 9 módulos canônicos sem anamnese isolada', () => {
 expect(PROTOTYPE_MODULES.map((m) => m.key)).toEqual([
  'agenda',
  'pacientes',
  'atendimento',
  'prontuario',
  'documentos',
  'catalogo',
  'equipe',
  'clinica',
  'sistema',
 ]);
});

describe('hierarquia de permissões (Ver no topo, Criar, Editar, Gerenciar, Excluir)', () => {
  it('classifica rank de acordo com a hierarquia de 5 níveis', () => {
    // 1: Ver / Visualizar (Topo)
    expect(getPermissionHierarchyRank({ codigo: 'AGENDA_VER' })).toBe(1);
    expect(getPermissionHierarchyRank({ codigo: 'AGENDA_PROPRIA_VER' })).toBe(1);
    expect(getPermissionHierarchyRank({ codigo: 'PACIENTE_GALERIA_VER' })).toBe(1);

    // 2: Criar / Cadastrar
    expect(getPermissionHierarchyRank({ codigo: 'AGENDA_CRIAR' })).toBe(2);
    expect(getPermissionHierarchyRank({ codigo: 'PACIENTE_CRIAR' })).toBe(2);
    expect(getPermissionHierarchyRank({ codigo: 'ANAMNESE_PREENCHIMENTO_CRIAR' })).toBe(2);

    // 3: Editar / Alterar
    expect(getPermissionHierarchyRank({ codigo: 'AGENDA_EDITAR' })).toBe(3);
    expect(getPermissionHierarchyRank({ codigo: 'PACIENTE_EDITAR' })).toBe(3);
    expect(getPermissionHierarchyRank({ codigo: 'CLINICA_HORARIO_ALTERAR' })).toBe(3);

    // 4: Gerenciar / Executar / Exportar / Encaixar
    expect(getPermissionHierarchyRank({ codigo: 'CONFIRMACAO_GERENCIAR' })).toBe(4);
    expect(getPermissionHierarchyRank({ codigo: 'HUB_PROCEDIMENTO_EXECUTAR' })).toBe(4);
    expect(getPermissionHierarchyRank({ codigo: 'AGENDA_FORA_DISP_ENCAIXAR' })).toBe(4);
    expect(getPermissionHierarchyRank({ codigo: 'AGENDA_APARECER' })).toBe(4);

    // 5: Excluir / Cancelar / Deletar (Rodapé / destrutivas)
    expect(getPermissionHierarchyRank({ codigo: 'AGENDA_EXCLUIR' })).toBe(5);
    expect(getPermissionHierarchyRank({ codigo: 'PACIENTE_EXCLUIR' })).toBe(5);
  });

  it('ordena permissões determinísticamente colocando Ver no topo e Excluir no rodapé', () => {
    const mixed = [
      { permissaoId: 5, codigo: 'AGENDA_EXCLUIR', nome: 'Excluir agendamentos' },
      { permissaoId: 4, codigo: 'CONFIRMACAO_GERENCIAR', nome: 'Gerenciar confirmações' },
      { permissaoId: 3, codigo: 'AGENDA_EDITAR', nome: 'Editar agendamentos' },
      { permissaoId: 2, codigo: 'AGENDA_CRIAR', nome: 'Criar agendamentos' },
      { permissaoId: 1, codigo: 'AGENDA_MULTI_VER', nome: 'Ver grade de todos' },
      { permissaoId: 0, codigo: 'AGENDA_VER', nome: 'Ver agenda' },
    ];

    const sorted = sortPermissionsByHierarchy(mixed);
    expect(sorted.map((p) => p.codigo)).toEqual([
      'AGENDA_VER',        // Rank 1 (raiz vem primeiro)
      'AGENDA_MULTI_VER',  // Rank 1
      'AGENDA_CRIAR',      // Rank 2
      'AGENDA_EDITAR',     // Rank 3
      'CONFIRMACAO_GERENCIAR', // Rank 4
      'AGENDA_EXCLUIR',    // Rank 5
    ]);
  });
});


