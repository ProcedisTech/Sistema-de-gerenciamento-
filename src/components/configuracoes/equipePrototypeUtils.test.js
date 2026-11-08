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
  getActiveDependentPermissions,
  getPrerequisitesForPermission,
  generateUniqueProfileName,
  isProfileNameDuplicate,
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
 ['CATALOGO_EDITAR', 2],
 ['USUARIO_CRIAR', 2],
 ['AGENDA_MULTI_VER', 1],
 ['AGENDA_CRIAR', 2],
 ['CONFIRMACAO_GERENCIAR', 2],
 ['CATALOGO_EXCLUIR', 3],
 ['ACESSO_COLABORADORES_INATIVAR', 3],
])('classifica %s no nível %i', (codigo, level) => {
 expect(permissionLevel({ codigo })).toBe(level);
});

it('mantém exatamente os 9 módulos canônicos oficiais', () => {
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

it('agrupa permissões de Acesso, Termos e Notificações nos módulos canônicos correspondentes', () => {
  const catalogTest = [
    { permissaoId: '1', codigo: 'ACESSO_CONFIGURACOES_VER', modulo: 'Acesso' },
    { permissaoId: '2', codigo: 'DOC_MODELO_VER', modulo: 'Termos' },
    { permissaoId: '3', codigo: 'NOTIFICACAO_VER', modulo: 'Notificacao' },
    { permissaoId: '4', codigo: 'AUDITORIA_VER', modulo: 'Sistema' },
    { permissaoId: '5', codigo: 'CLINICA_CATALOGO_VER', modulo: 'Clinica' },
  ];
  const summary = summarizeModules(catalogTest, ['1', '2', '3', '4', '5']);
  expect(summary.find((m) => m.key === 'equipe').permissions.map((p) => p.codigo)).toContain('ACESSO_CONFIGURACOES_VER');
  expect(summary.find((m) => m.key === 'documentos').permissions.map((p) => p.codigo)).toContain('DOC_MODELO_VER');
  expect(summary.find((m) => m.key === 'sistema').permissions.map((p) => p.codigo)).toContain('NOTIFICACAO_VER');
  expect(summary.find((m) => m.key === 'sistema').permissions.map((p) => p.codigo)).toContain('AUDITORIA_VER');
  expect(summary.find((m) => m.key === 'clinica').permissions.map((p) => p.codigo)).toContain('CLINICA_CATALOGO_VER');
});

describe('hierarquia de permissões (1: Ver, 2: Criar, 3: Editar/Operar, 4: Excluir/Inativar)', () => {
  it('classifica rank de acordo com a hierarquia canônica de 4 tiers', () => {
    // 1: Ver / Visualizar / Acessar (Topo)
    expect(getPermissionHierarchyRank({ codigo: 'AGENDA_VER', nome: 'Acessar Aba Agenda' })).toBe(1);
    expect(getPermissionHierarchyRank({ codigo: 'AGENDA_PROPRIA_VER', nome: 'Visualizar Agenda Própria' })).toBe(1);
    expect(getPermissionHierarchyRank({ codigo: 'PACIENTE_GALERIA_VER', nome: 'Visualizar Fotos do Prontuário' })).toBe(1);
    expect(getPermissionHierarchyRank({ codigo: 'ACESSO_CONFIGURACOES_VER', nome: 'Acessar Aba Acesso & Equipe' })).toBe(1);

    // 2: Criar / Cadastrar / Convidar
    expect(getPermissionHierarchyRank({ codigo: 'AGENDA_CRIAR', nome: 'Criar Agendamento' })).toBe(2);
    expect(getPermissionHierarchyRank({ codigo: 'PACIENTE_CRIAR', nome: 'Cadastrar Paciente' })).toBe(2);
    expect(getPermissionHierarchyRank({ codigo: 'ACESSO_COLABORADORES_CRIAR', nome: 'Convidar Colaborador' })).toBe(2);
    expect(getPermissionHierarchyRank({ codigo: 'ACESSO_PERFIL_CRIAR', nome: 'Criar Perfil de Acesso Local' })).toBe(2);

    // 3: Editar / Alterar / Operar / Gerenciar / Executar / Atribuir / Preencher / Coletar
    expect(getPermissionHierarchyRank({ codigo: 'AGENDA_EDITAR', nome: 'Editar/Reagendar' })).toBe(3);
    expect(getPermissionHierarchyRank({ codigo: 'PACIENTE_EDITAR', nome: 'Editar Paciente' })).toBe(3);
    expect(getPermissionHierarchyRank({ codigo: 'ACESSO_COLABORADORES_EDITAR', nome: 'Editar Colaborador' })).toBe(3);
    expect(getPermissionHierarchyRank({ codigo: 'ACESSO_PERMISSOES_ATRIBUIR', nome: 'Atribuir Permissões Granulares' })).toBe(3);
    expect(getPermissionHierarchyRank({ codigo: 'CONFIRMACAO_GERENCIAR', nome: 'Gerenciar confirmações' })).toBe(3);
    expect(getPermissionHierarchyRank({ codigo: 'HUB_PROCEDIMENTO_EXECUTAR', nome: 'Executar Procedimento' })).toBe(3);
    expect(getPermissionHierarchyRank({ codigo: 'ATENDIMENTO_REALIZAR', nome: 'Realizar Atendimento Clínico' })).toBe(3);
    expect(getPermissionHierarchyRank({ codigo: 'ATENDIMENTO_ANAMNESE_PREENCHER', nome: 'Preencher Anamnese' })).toBe(3);
    expect(getPermissionHierarchyRank({ codigo: 'ATENDIMENTO_TERMO_COLETAR', nome: 'Coleta de Assinatura' })).toBe(3);

    // 4: Excluir / Inativar / Cancelar / Deletar (Rodapé / Ações destrutivas com senha)
    expect(getPermissionHierarchyRank({ codigo: 'AGENDA_EXCLUIR', nome: 'Cancelamento de Agendamento' })).toBe(4);
    expect(getPermissionHierarchyRank({ codigo: 'PACIENTE_EXCLUIR', nome: 'Excluir Paciente' })).toBe(4);
    expect(getPermissionHierarchyRank({ codigo: 'PACIENTE_INATIVAR', nome: 'Inativar / Reativar Paciente' })).toBe(4);
    expect(getPermissionHierarchyRank({ codigo: 'ACESSO_PERFIL_EXCLUIR', nome: 'Excluir Perfil de Acesso' })).toBe(4);
    expect(getPermissionHierarchyRank({ codigo: 'ACESSO_COLABORADORES_INATIVAR', nome: 'Inativar Matrícula de Colaborador' })).toBe(4);
    expect(getPermissionHierarchyRank({ codigo: 'CLINICA_CATALOGO_EXCLUIR', nome: 'Excluir Procedimento do Catálogo' })).toBe(4);
  });

  it('ordena permissões determinísticamente colocando Ver no topo, Criar, Editar no meio e Excluir/Inativar no rodapé', () => {
    const mixed = [
      { permissaoId: 5, codigo: 'AGENDA_EXCLUIR', nome: 'Cancelamento de Agendamento' },
      { permissaoId: 4, codigo: 'CONFIRMACAO_GERENCIAR', nome: 'Gerenciar confirmações' },
      { permissaoId: 3, codigo: 'AGENDA_EDITAR', nome: 'Editar/Reagendar' },
      { permissaoId: 2, codigo: 'AGENDA_CRIAR', nome: 'Criar agendamentos' },
      { permissaoId: 1, codigo: 'AGENDA_MULTI_VER', nome: 'Visualizar Grade de Todos' },
      { permissaoId: 0, codigo: 'AGENDA_VER', nome: 'Acessar Aba Agenda' },
    ];

    const sorted = sortPermissionsByHierarchy(mixed);
    expect(sorted.map((p) => p.codigo)).toEqual([
      'AGENDA_VER',        // Tier 1 (raiz vem primeiro)
      'AGENDA_MULTI_VER',  // Tier 1
      'AGENDA_CRIAR',      // Tier 2
      'AGENDA_EDITAR',     // Tier 3
      'CONFIRMACAO_GERENCIAR', // Tier 3
      'AGENDA_EXCLUIR',    // Tier 4 (rodapé)
    ]);
  });

  it('garante que no módulo Equipe as permissões de Excluir e Inativar fiquem estritamente no rodapé após Atribuir', () => {
    const equipePerms = [
      { permissaoId: 7, codigo: 'ACESSO_COLABORADORES_INATIVAR', nome: 'Inativar Matrícula de Colaborador' },
      { permissaoId: 6, codigo: 'ACESSO_PERFIL_EXCLUIR', nome: 'Excluir Perfil de Acesso' },
      { permissaoId: 5, codigo: 'ACESSO_PERMISSOES_ATRIBUIR', nome: 'Atribuir Permissões Granulares' },
      { permissaoId: 4, codigo: 'ACESSO_PERFIL_EDITAR', nome: 'Editar Perfil de Acesso Local' },
      { permissaoId: 3, codigo: 'ACESSO_COLABORADORES_EDITAR', nome: 'Editar Colaborador' },
      { permissaoId: 2, codigo: 'ACESSO_PERFIL_CRIAR', nome: 'Criar Perfil de Acesso Local' },
      { permissaoId: 1, codigo: 'ACESSO_COLABORADORES_CRIAR', nome: 'Convidar Colaborador' },
      { permissaoId: 0, codigo: 'ACESSO_CONFIGURACOES_VER', nome: 'Acessar Aba Acesso & Equipe' },
    ];

    const sorted = sortPermissionsByHierarchy(equipePerms);
    expect(sorted.map((p) => p.codigo)).toEqual([
      'ACESSO_CONFIGURACOES_VER',    // Tier 1
      'ACESSO_COLABORADORES_CRIAR', // Tier 2
      'ACESSO_PERFIL_CRIAR',        // Tier 2
      'ACESSO_PERMISSOES_ATRIBUIR', // Tier 3 (Atribuir vem antes de editar alfabeticamente ou junto)
      'ACESSO_COLABORADORES_EDITAR',// Tier 3
      'ACESSO_PERFIL_EDITAR',       // Tier 3
      'ACESSO_PERFIL_EXCLUIR',      // Tier 4 (Rodapé)
      'ACESSO_COLABORADORES_INATIVAR', // Tier 4 (Rodapé)
    ]);
  });

  it('ordena o módulo Atendimento com a permissão raiz (Realizar Atendimento) no topo absoluto (1º lugar), seguida por Visualizar e etapas clínicas', () => {
    const atendimentoPerms = [
      { permissaoId: 12, codigo: 'ATENDIMENTO_RETORNO_GERENCIAR', nome: 'Gerenciar Retorno Clínico (Ciclo Pleno)' },
      { permissaoId: 11, codigo: 'ATENDIMENTO_RETORNO_VER', nome: 'Visualizar Retorno na Consulta' },
      { permissaoId: 10, codigo: 'ATENDIMENTO_PROCEDIMENTO_EXECUTAR', nome: 'Executar Procedimento Clínico (Ciclo Pleno)' },
      { permissaoId: 9, codigo: 'ATENDIMENTO_PROCEDIMENTO_VER', nome: 'Visualizar Procedimento na Consulta' },
      { permissaoId: 8, codigo: 'ATENDIMENTO_TERMO_COLETAR', nome: 'Coleta de Assinatura' },
      { permissaoId: 7, codigo: 'ATENDIMENTO_TERMOS_VER', nome: 'Visualizar Termos na Consulta' },
      { permissaoId: 6, codigo: 'ATENDIMENTO_PLANEJAMENTO_GERENCIAR', nome: 'Gerenciar Planejamento (Ciclo Pleno)' },
      { permissaoId: 5, codigo: 'ATENDIMENTO_PLANEJAMENTO_VER', nome: 'Visualizar Planejamento' },
      { permissaoId: 4, codigo: 'ATENDIMENTO_AVALIACAO_GERENCIAR', nome: 'Gerenciar Avaliação Clínica (Ciclo Pleno)' },
      { permissaoId: 3, codigo: 'ATENDIMENTO_AVALIACAO_VER', nome: 'Visualizar Avaliação Clínica' },
      { permissaoId: 2, codigo: 'ATENDIMENTO_ANAMNESE_PREENCHER', nome: 'Preencher Anamnese (Ciclo Pleno)' },
      { permissaoId: 1, codigo: 'ATENDIMENTO_ANAMNESE_VER', nome: 'Visualizar Anamnese na Consulta' },
      { permissaoId: 0, codigo: 'ATENDIMENTO_REALIZAR', nome: 'Realizar Atendimento Clínico' },
    ];

    const sorted = sortPermissionsByHierarchy(atendimentoPerms);
    // A 1ª permissão DEVE ser a chave-mestra raiz do módulo (ATENDIMENTO_REALIZAR)
    expect(sorted[0].codigo).toBe('ATENDIMENTO_REALIZAR');
    // Em seguida vêm as 6 permissões de Visualizar (Tier 1)
    expect(sorted.slice(1, 7).every((p) => p.codigo.endsWith('_VER'))).toBe(true);
    // E por fim as etapas operacionais clínicas (Tier 3)
    expect(sorted.slice(7).length).toBe(6);
  });

  it('mantém agrupamento visual de Atendimento e Pacientes mesmo com módulos de domínio (Anamnese, Termos, etc.)', () => {
    const domainCatalog = [
      { permissaoId: 1, codigo: 'ATENDIMENTO_REALIZAR', modulo: 'Atendimento', moduloCodigo: 'ATENDIMENTO' },
      { permissaoId: 2, codigo: 'ATENDIMENTO_ANAMNESE_VER', modulo: 'Anamnese', moduloCodigo: 'ANAMNESE' },
      { permissaoId: 3, codigo: 'ATENDIMENTO_TERMOS_VER', modulo: 'Termos', moduloCodigo: 'TERMOS' },
      { permissaoId: 4, codigo: 'PACIENTE_ANAMNESE_VER', modulo: 'Anamnese', moduloCodigo: 'ANAMNESE' },
      { permissaoId: 5, codigo: 'ANAMNESE_MODELO_VER', modulo: 'Anamnese', moduloCodigo: 'ANAMNESE' },
      { permissaoId: 6, codigo: 'AUDITORIA_VER', modulo: 'Auditoria', moduloCodigo: 'AUDITORIA' },
    ];

    const summary = summarizeModules(domainCatalog, [1, 2, 3, 4, 5, 6]);

    const cardAtendimento = summary.find((m) => m.key === 'atendimento');
    expect(cardAtendimento.permissions.map((p) => p.codigo)).toEqual([
      'ATENDIMENTO_REALIZAR',
      'ATENDIMENTO_ANAMNESE_VER',
      'ATENDIMENTO_TERMOS_VER',
    ]);

    const cardPacientes = summary.find((m) => m.key === 'pacientes');
    expect(cardPacientes.permissions.map((p) => p.codigo)).toContain('PACIENTE_ANAMNESE_VER');

    const cardDocumentos = summary.find((m) => m.key === 'documentos');
    expect(cardDocumentos.permissions.map((p) => p.codigo)).toContain('ANAMNESE_MODELO_VER');
    expect(cardDocumentos.permissions.map((p) => p.codigo)).not.toContain('ATENDIMENTO_ANAMNESE_VER');
    expect(cardDocumentos.permissions.map((p) => p.codigo)).not.toContain('PACIENTE_ANAMNESE_VER');

    const cardSistema = summary.find((m) => m.key === 'sistema');
    expect(cardSistema.permissions.map((p) => p.codigo)).toContain('AUDITORIA_VER');
  });

  describe('Pré-requisitos e Dependências Hierárquicas', () => {
    const agendaPermissoes = [
      { permissaoId: 101, codigo: 'AGENDA_VER', nome: 'Acessar Aba Agenda' },
      { permissaoId: 102, codigo: 'AGENDA_PROPRIA_VER', nome: 'Visualizar Agenda Própria' },
      { permissaoId: 103, codigo: 'AGENDA_MULTI_VER', nome: 'Visualizar Grade de Todos' },
      { permissaoId: 104, codigo: 'AGENDA_CRIAR', nome: 'Criar Agendamento' },
      { permissaoId: 105, codigo: 'AGENDA_EDITAR', nome: 'Editar/Reagendar' },
    ];
    const moduloAgenda = {
      key: 'agenda',
      name: 'Agenda',
      permissions: agendaPermissoes,
      raizes: [agendaPermissoes[0]],
    };

    it('identifica que subfunções de agenda dependem da raiz AGENDA_VER ao tentar desmarcá-la', () => {
      const selectedIds = [101, 103, 104]; // AGENDA_VER, AGENDA_MULTI_VER, AGENDA_CRIAR
      const dependentes = getActiveDependentPermissions(agendaPermissoes[0], moduloAgenda, selectedIds);
      expect(dependentes.map((p) => p.codigo)).toEqual(['AGENDA_MULTI_VER', 'AGENDA_CRIAR']);
    });

    it('retorna vazio se nenhuma subfunção do módulo estiver ativa ao desmarcar a raiz', () => {
      const selectedIds = [101]; // Apenas AGENDA_VER
      const dependentes = getActiveDependentPermissions(agendaPermissoes[0], moduloAgenda, selectedIds);
      expect(dependentes).toEqual([]);
    });

    it('retorna os pré-requisitos necessários ao marcar uma subfunção operacional', () => {
      const prereqs = getPrerequisitesForPermission(agendaPermissoes[3], moduloAgenda, agendaPermissoes);
      // AGENDA_CRIAR requer AGENDA_VER
      expect(prereqs).toContain(101);
    });

    it('retorna pré-requisitos específicos em cadeia (ex: PRONTUARIO_EDITAR requer PRONTUARIO_VER e PACIENTE_VER)', () => {
      const pacienteCatalog = [
        { permissaoId: 201, codigo: 'PACIENTE_VER', nome: 'Ver Pacientes' },
        { permissaoId: 202, codigo: 'PRONTUARIO_VER', nome: 'Ver Prontuário' },
        { permissaoId: 203, codigo: 'PRONTUARIO_EDITAR', nome: 'Editar Prontuário' },
      ];
      const moduloPacientes = {
        key: 'pacientes',
        name: 'Pacientes',
        permissions: pacienteCatalog,
      };

      const prereqs = getPrerequisitesForPermission(pacienteCatalog[2], moduloPacientes, pacienteCatalog);
      expect(prereqs).toContain(201); // PACIENTE_VER
      expect(prereqs).toContain(202); // PRONTUARIO_VER
    });
  });

  describe('Geração de Nomes Únicos e Validação de Duplicidade de Perfis', () => {
    const perfis = [
      { id: '1', nome: 'deewfw' },
      { id: '2', nome: 'deewfw (Personalizado)' },
      { id: '3', nome: 'Profissional Clínico' },
    ];

    it('sugere nome com sufixo (Personalizado) quando ainda não existe', () => {
      const nome = generateUniqueProfileName('Profissional Clínico', perfis);
      expect(nome).toBe('Profissional Clínico (Personalizado)');
    });

    it('acrescenta contador incremental se o nome com (Personalizado) já existir', () => {
      const nome = generateUniqueProfileName('deewfw', perfis);
      expect(nome).toBe('deewfw (Personalizado 2)');
    });

    it('detecta duplicidade de nome existente ignorando maiúsculas e espaços', () => {
      expect(isProfileNameDuplicate('deewfw', perfis)).toBe(true);
      expect(isProfileNameDuplicate('  DEEWFW  ', perfis)).toBe(true);
      expect(isProfileNameDuplicate('Profissional Clínico (Personalizado)', perfis)).toBe(false);
      expect(isProfileNameDuplicate('deewfw (Personalizado)', perfis)).toBe(true);
    });

    it('ignora o próprio perfil ao validar duplicidade durante edição de perfil existente', () => {
      expect(isProfileNameDuplicate('deewfw', perfis, '1')).toBe(false);
      expect(isProfileNameDuplicate('deewfw', perfis, '2')).toBe(true);
    });

    it('não considera duplicado nome vazio ou em branco', () => {
      expect(isProfileNameDuplicate('', perfis)).toBe(false);
      expect(isProfileNameDuplicate('   ', perfis)).toBe(false);
    });
  });
});



