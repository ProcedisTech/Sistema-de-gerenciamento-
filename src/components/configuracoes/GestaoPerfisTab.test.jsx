import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { GestaoPerfisTab } from './GestaoPerfisTab';
vi.mock('../../contexts/useToast.js', () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn() }) }));
vi.mock('../../services/api', () => ({ getApiErrorDetail: () => '' }));
vi.mock('../../config/apiEnv', () => ({ resolveApiUrl: path => path }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const catalogo = [
  { permissaoId: 1, codigo: 'AGENDA_VER', modulo: 'Agenda', nome: 'Ver agenda' },
  { permissaoId: 2, codigo: 'AGENDA_CRIAR', modulo: 'Agenda', nome: 'Criar agendamentos' },
  { permissaoId: 3, codigo: 'AGENDA_EXCLUIR', modulo: 'Agenda', nome: 'Excluir agendamentos' },
  { permissaoId: 4, codigo: 'AGENDA_APARECER', modulo: 'Agenda', nome: 'Aparecer na agenda' },
];
const perfis = [{ id: 10, nome: 'Recepção', organizacaoSaudeDonaId: 5 }, { id: 20, nome: 'Profissional', codigo: 'PROFISSIONAL_CLINICO' }];
const props = { perfisAcesso: perfis, permissoes: catalogo, usuarios: [], fetchHeaders: async () => ({}), onReload: vi.fn(), onBack: vi.fn() };
const setupFetch = () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [1, 2] });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};
describe('Editor de perfil do protótipo', () => {
  it('desativa níveis sem ações associadas e mantém os níveis da Agenda disponíveis', () => {
    const permissoes = [
      ...catalogo,
      { permissaoId: 5, codigo: 'DOC_MODELO_VER', modulo: 'Documentos', nome: 'Ver modelos' },
      { permissaoId: 6, codigo: 'DOC_MODELO_EDITAR', modulo: 'Documentos', nome: 'Editar modelos' },
      { permissaoId: 7, codigo: 'PACIENTE_DOCUMENTO_VER', modulo: 'Documentos', nome: 'Ver documentos assinados' },
      { permissaoId: 8, codigo: 'HUB_PROCEDIMENTO_EXECUTAR', modulo: 'Atendimento', nome: 'Executar procedimento' },
      { permissaoId: 9, codigo: 'CLINICA_EDITAR', modulo: 'Clínica', nome: 'Editar clínica' },
      { permissaoId: 10, codigo: 'CATALOGO_VER', modulo: 'Catálogo', nome: 'Ver catálogo' },
      { permissaoId: 11, codigo: 'CATALOGO_EDITAR', modulo: 'Catálogo', nome: 'Editar catálogo' },
      { permissaoId: 12, codigo: 'PACIENTE_VER', modulo: 'Pacientes', nome: 'Ver pacientes' },
      { permissaoId: 13, codigo: 'PACIENTE_CRIAR', modulo: 'Pacientes', nome: 'Cadastrar pacientes' },
    ];
    render(<GestaoPerfisTab {...props} permissoes={permissoes} canEdit criarNovoNonce={1} />);
    const button = (modulo, nivel) => within(screen.getByRole('group', { name: `Nível em ${modulo}` })).getByRole('button', { name: nivel });
    const queryButton = (modulo, nivel) => within(screen.getByRole('group', { name: `Nível em ${modulo}` })).queryByRole('button', { name: nivel });

    // Documentos, Catálogo, Agenda e Pacientes possuem 'Ver e editar' ativo
    for (const modulo of ['Documentos', 'Catálogo', 'Agenda', 'Pacientes']) {
      expect(button(modulo, 'Ver e editar')).toBeEnabled();
      expect(button(modulo, 'Ver e editar')).not.toHaveAttribute('title');
    }

    // Atendimento adapta botões e não exibe o nível redundante 'Ver e editar'
    expect(queryButton('Atendimento', 'Ver e editar')).not.toBeInTheDocument();
    expect(button('Atendimento', 'Tudo')).toBeEnabled();
    expect(button('Atendimento', 'Sem acesso')).toBeEnabled();
  });

  it('seleciona níveis reais sem liberar função destrutiva no intermediário', () => {
    const fetchMock = setupFetch();
    render(<GestaoPerfisTab {...props} canEdit criarNovoNonce={1} />);
    const grupo = screen.getByRole('group', { name: 'Nível em Agenda' });
    fireEvent.click(within(grupo).getByRole('button', { name: 'Ver e editar' }));
    fireEvent.click(screen.getByRole('button', { name: /Escolher funções uma a uma/ }));
    expect(screen.getByRole('checkbox', { name: 'Criar agendamentos' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Excluir agendamentos' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: /Sim, atende na agenda/ }));
    expect(screen.getByRole('radio', { name: /Sim, atende na agenda/ })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(within(grupo).getByRole('button', { name: 'Sem acesso' }));
    expect(screen.getByRole('radio', { name: /Não atende/ })).toHaveAttribute('aria-checked', 'true');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('abre cópia local com permissões reais e sem listagem intermediária', async () => {
    const fetchMock = setupFetch();
    render(<GestaoPerfisTab {...props} canEdit perfilParaAbrir="copy:10" criarNovoNonce={7} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Só ver' })).toBeEnabled());
    expect(screen.getByLabelText('Nome do perfil')).toHaveValue('Cópia de Recepção');
    expect(screen.queryByRole('heading', { name: 'Perfis da clínica' })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/perfis-acesso/10/permissoes');
    expect(fetchMock.mock.calls[0][1].method).toBeUndefined();
  });
  it('nega abertura e mutações sem canEdit e retorna pelo botão cancelar', () => {
    const fetchMock = setupFetch();
    const onBack = vi.fn();
    render(<GestaoPerfisTab {...props} onBack={onBack} perfilParaAbrir={10} criarNovoNonce={1} />);
    expect(screen.getByLabelText('Nome do perfil')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Salvar perfil' })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
  it('impede salvar depois de falha na leitura das permissões', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    render(<GestaoPerfisTab {...props} canEdit perfilParaAbrir={10} />);
    await screen.findByRole('alert');
    screen.getAllByRole('button', { name: 'Salvar perfil' }).forEach(button => expect(button).toBeDisabled());
  });
  it('exibe modal ao desativar visualização com função dependente e permite cancelar ou desativar em cascata', () => {
    setupFetch();
    render(<GestaoPerfisTab {...props} canEdit criarNovoNonce={1} />);
    fireEvent.click(screen.getByRole('button', { name: /Escolher funções uma a uma/ }));

    const chkCriar = screen.getByRole('checkbox', { name: 'Criar agendamentos' });
    const chkVer = screen.getByRole('checkbox', { name: 'Ver agenda' });
    fireEvent.click(chkCriar);
    expect(chkCriar).toBeChecked();
    expect(chkVer).toBeChecked();

    fireEvent.click(chkVer);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: /Desativar visualização em Agenda\?/ })).toBeInTheDocument();
    expect(within(dialog).getByText(/Criar agendamentos/)).toBeInTheDocument();
    expect(chkVer).toBeChecked();
    expect(chkCriar).toBeChecked();

    // Fecha via "Manter visualização"
    fireEvent.click(within(dialog).getByRole('button', { name: 'Manter visualização' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(chkVer).toBeChecked();
    expect(chkCriar).toBeChecked();

    // Tenta desativar novamente e fecha via teclado Escape
    fireEvent.click(chkVer);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(chkVer).toBeChecked();
    expect(chkCriar).toBeChecked();

    // Tenta desativar novamente e confirma "Desativar funções dependentes"
    fireEvent.click(chkVer);
    const dialogConfirm = screen.getByRole('dialog');
    expect(dialogConfirm).toBeInTheDocument();
    fireEvent.click(within(dialogConfirm).getByRole('button', { name: 'Desativar funções dependentes' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(chkVer).not.toBeChecked();
    expect(chkCriar).not.toBeChecked();

    // Desmarcar permissão raiz sem dependentes não deve abrir modal
    fireEvent.click(chkVer);
    expect(chkVer).toBeChecked();
    expect(chkCriar).not.toBeChecked();
    fireEvent.click(chkVer);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(chkVer).not.toBeChecked();
  });
});

it('reutiliza o perfil criado se atribuição de permissões falhar',async()=>{
 const mock=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({id:99,nome:'Novo',organizacaoSaudeDonaId:5})}).mockResolvedValueOnce({ok:false}).mockResolvedValueOnce({ok:true,json:async()=>({id:99,nome:'Novo',organizacaoSaudeDonaId:5})}).mockResolvedValueOnce({ok:true});
 vi.stubGlobal('fetch',mock);
 render(<GestaoPerfisTab {...props} canEdit criarNovoNonce={1} />);
 fireEvent.change(screen.getByLabelText('Nome do perfil'),{target:{value:'Novo'}});
 fireEvent.submit(document.querySelector('form'));
 await waitFor(()=>expect(mock).toHaveBeenCalledTimes(2));
 await waitFor(()=>expect(screen.getAllByRole('button',{name:'Salvar perfil'})[0]).toBeEnabled());
 fireEvent.submit(document.querySelector('form'));
 await waitFor(()=>expect(mock).toHaveBeenCalledTimes(4));
 expect(mock.mock.calls[0][1].method).toBe('POST');expect(mock.mock.calls[2][1].method).toBe('PUT');expect(mock.mock.calls[2][0]).toBe('/api/v1/perfis-acesso/99');
});

it('não apaga o rascunho nem aceita modelo global sem permissões', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
  render(<GestaoPerfisTab {...props} perfisAcesso={[{ id: 30, nome: 'Administrador', codigo: 'ADMINISTRADOR' }]} canEdit criarNovoNonce={1} />);
  fireEvent.change(screen.getByLabelText('Nome do perfil'), { target: { value: 'Meu perfil' } });
  fireEvent.click(within(screen.getByRole('group', { name: 'Nível em Agenda' })).getByRole('button', { name: 'Ver e editar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Administrador', exact: true }));
  expect(await screen.findByRole('alert')).toHaveTextContent('modelo está sem permissões');
  expect(screen.getByLabelText('Nome do perfil')).toHaveValue('Meu perfil');
  fireEvent.click(screen.getByRole('button', { name: /Escolher funções uma a uma/ }));
  expect(screen.getByRole('checkbox', { name: 'Criar agendamentos' })).toBeChecked();
  screen.getAllByRole('button', { name: 'Salvar perfil' }).forEach(button => expect(button).toBeDisabled());
});

it.each([
  ['SECRETARIA', 'Recepção / Secretária', [1, 2], false],
  ['PROFISSIONAL_CLINICO', 'Profissional Clínico', [1, 2, 4], true],
  ['ADMINISTRADOR', 'Administrador', [1, 2, 3], false],
])('aplica as funções da base %s sem substituir nome e descrição', async (codigo, nome, ids, atende) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ids }));
  render(<GestaoPerfisTab {...props} perfisAcesso={[{ id: 50, nome, codigo }]} canEdit criarNovoNonce={1} />);
  fireEvent.change(screen.getByLabelText('Nome do perfil'), { target: { value: 'Meu perfil' } });
  fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Minha descrição' } });
  fireEvent.click(screen.getByRole('button', { name: nome, exact: true }));
  await waitFor(() => expect(screen.getByRole('radio', { name: /Sim, atende na agenda/ })).toHaveAttribute('aria-checked', String(atende)));
  await waitFor(() => expect(within(screen.getByRole('group', { name: 'Nível em Agenda' })).getByRole('button', { name: 'Só ver' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: /Escolher funções uma a uma/ }));
  expect(screen.getByRole('checkbox', { name: 'Criar agendamentos' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Excluir agendamentos' })).toHaveProperty('checked', ids.includes(3));
  expect(screen.getByLabelText('Nome do perfil')).toHaveValue('Meu perfil');
  expect(screen.getByLabelText('Descrição')).toHaveValue('Minha descrição');
  fireEvent.click(screen.getByRole('button', { name: 'Em branco', exact: true }));
  expect(screen.getByRole('checkbox', { name: 'Criar agendamentos' })).not.toBeChecked();
});

it('renderiza os botões segmentados de nível na ordem prioritária: Só ver, Ver e editar, Tudo, Sem acesso', () => {
  render(<GestaoPerfisTab {...props} canEdit criarNovoNonce={1} />);
  const grupo = screen.getByRole('group', { name: 'Nível em Agenda' });
  const buttons = within(grupo).getAllByRole('button');
  const labels = buttons.map(b => b.textContent.trim());
  expect(labels).toEqual(['Só ver', 'Ver e editar', 'Tudo', 'Sem acesso']);
});

it('renderiza as funções individuais na ordem de hierarquia com Ver no topo e Excluir no rodapé', () => {
  const permissoesDesordenadas = [
    { permissaoId: 3, codigo: 'AGENDA_EXCLUIR', modulo: 'Agenda', nome: 'Excluir agendamentos' },
    { permissaoId: 2, codigo: 'AGENDA_CRIAR', modulo: 'Agenda', nome: 'Criar agendamentos' },
    { permissaoId: 1, codigo: 'AGENDA_VER', modulo: 'Agenda', nome: 'Ver agenda' },
  ];
  render(<GestaoPerfisTab {...props} permissoes={permissoesDesordenadas} canEdit criarNovoNonce={1} />);
  fireEvent.click(screen.getByRole('button', { name: /Escolher funções uma a uma/ }));
  const checkboxes = screen.getAllByRole('checkbox');
  const labels = checkboxes.map(c => c.closest('label')?.textContent.trim() || c.getAttribute('aria-label'));
  expect(labels).toEqual(['Ver agenda', 'Criar agendamentos', 'Excluir agendamentos']);
});

it('permite selecionar preset canônico como modelo (Profissional Clínico) ativando permissões e atendimento na agenda', async () => {
  const permissoesCatalogo = [
    { permissaoId: 1, codigo: 'AGENDA_VER', modulo: 'Agenda', nome: 'Ver agenda' },
    { permissaoId: 2, codigo: 'AGENDA_APARECER', modulo: 'Agenda', nome: 'Aparecer na agenda' },
    { permissaoId: 3, codigo: 'PACIENTE_VER', modulo: 'Pacientes', nome: 'Ver pacientes' },
    { permissaoId: 4, codigo: 'AGENDA_PROPRIA_VER', modulo: 'Agenda', nome: 'Ver agenda própria' },
  ];
  setupFetch();
  render(<GestaoPerfisTab {...props} permissoes={permissoesCatalogo} canEdit criarNovoNonce={1} />);

  const btnProfissional = screen.getByRole('button', { name: /Profissional/i });
  expect(btnProfissional).toBeInTheDocument();
  fireEvent.click(btnProfissional);

  expect(screen.getByRole('radio', { name: /Sim, atende na agenda/ })).toHaveAttribute('aria-checked', 'true');

  fireEvent.click(screen.getAllByRole('button', { name: /Escolher funções uma a uma/ })[0]);
  await waitFor(() => {
    expect(screen.getByRole('checkbox', { name: 'Ver agenda' })).toBeChecked();
  });
});

it('renderiza as permissões de forma limpa sem badges ou ícones extras', () => {
  const permissoesComBadges = [
    { permissaoId: 1, codigo: 'PACIENTE_INATIVAR', modulo: 'Pacientes', nome: 'Inativar paciente' },
    { permissaoId: 2, codigo: 'PACIENTE_VER', modulo: 'Pacientes', nome: 'Ver pacientes' },
    { permissaoId: 3, codigo: 'AGENDA_PROPRIA_VER', modulo: 'Agenda', nome: 'Ver agenda própria' },
  ];
  render(<GestaoPerfisTab {...props} permissoes={permissoesComBadges} canEdit criarNovoNonce={1} />);

  const expandButtons = screen.getAllByRole('button', { name: /Escolher funções uma a uma/ });
  expandButtons.forEach(btn => fireEvent.click(btn));

  expect(screen.queryByText('🔒 Senha')).not.toBeInTheDocument();
  expect(screen.queryByText('📜 LGPD')).not.toBeInTheDocument();
  expect(screen.queryByText('👤 Próprio')).not.toBeInTheDocument();
  expect(screen.getByText('Inativar paciente')).toBeInTheDocument();
  expect(screen.getByText('Ver pacientes')).toBeInTheDocument();
  expect(screen.getByText('Ver agenda própria')).toBeInTheDocument();
});

it('renderiza o rótulo canônico Recepção / Secretária em Começar a partir de mesmo se o perfil vier renomeado como secretaria 2', () => {
  const perfisComNomeMutado = [
    { id: 101, codigo: 'SECRETARIA', nome: 'secretaria 2', organizacaoSaudeId: 'org-1' },
    { id: 102, codigo: 'PROFISSIONAL_CLINICO', nome: 'Dr Clinico', organizacaoSaudeId: 'org-1' },
    { id: 103, codigo: 'ADMINISTRADOR', nome: 'Admin Chefe', organizacaoSaudeId: 'org-1' },
  ];
  render(<GestaoPerfisTab {...props} perfisAcesso={perfisComNomeMutado} canEdit criarNovoNonce={1} />);

  expect(screen.getByRole('button', { name: 'Recepção / Secretária' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'secretaria 2' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Profissional Clínico' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Administrador' })).toBeInTheDocument();
});

it('desabilita o campo de Nome ao editar um perfil padrão e exibe aviso de nome fixo', async () => {
  setupFetch();
  const perfisPadrao = [
    { id: 50, codigo: 'SECRETARIA', nome: 'secretaria 2', organizacaoSaudeId: 'org-1' },
  ];
  render(<GestaoPerfisTab {...props} perfisAcesso={perfisPadrao} canEdit perfilParaAbrir={50} />);

  await waitFor(() => expect(screen.getByRole('button', { name: 'Só ver' })).toBeEnabled());
  const inputNome = screen.getByLabelText('Nome do perfil');
  expect(inputNome).toBeDisabled();
  expect(inputNome).toHaveValue('Recepção / Secretária');
  expect(screen.getByText(/Perfis padrão do sistema possuem nome fixo/i)).toBeInTheDocument();
});

it('mantém o campo de Nome habilitado ao editar um perfil customizado CST_', async () => {
  setupFetch();
  const perfisCustom = [
    { id: 60, codigo: 'CST_abc123', nome: 'Secretária da Noite', organizacaoSaudeId: 'org-1' },
  ];
  render(<GestaoPerfisTab {...props} perfisAcesso={perfisCustom} canEdit perfilParaAbrir={60} />);

  await waitFor(() => expect(screen.getByRole('button', { name: 'Só ver' })).toBeEnabled());
  const inputNome = screen.getByLabelText('Nome do perfil');
  expect(inputNome).not.toBeDisabled();
  expect(inputNome).toHaveValue('Secretária da Noite');
  expect(screen.queryByText(/Perfis padrão do sistema possuem nome fixo/i)).not.toBeInTheDocument();
});

it('exibe banner contextual ao editar perfil existente detalhando colaboradores vinculados', async () => {
  setupFetch();
  const perfisCustom = [
    { id: 60, codigo: 'CST_abc123', nome: 'Secretária da Noite', organizacaoSaudeId: 'org-1' },
  ];
  const usuarios = [
    { id: 'u1', nomeCompleto: 'Mariana Lima', perfilAcessoId: 60, ativo: true },
    { id: 'u2', nomeCompleto: 'Beatriz Silva', perfilAcessoId: 60, ativo: true },
  ];
  render(
    <GestaoPerfisTab
      {...props}
      perfisAcesso={perfisCustom}
      usuarios={usuarios}
      canEdit
      perfilParaAbrir={60}
    />,
  );

  await waitFor(() => expect(screen.getByRole('button', { name: 'Só ver' })).toBeEnabled());
  const banner = document.querySelector('.perfil-custom-banner');
  expect(banner).toBeInTheDocument();
  expect(banner).toHaveTextContent(/Você está editando o perfil Secretária da Noite/i);
  expect(banner).toHaveTextContent(/Este perfil é utilizado por 2 colaboradores \(Mariana, Beatriz\)/i);

  // Bloco de colaboradores na coluna de resumo lateral deve estar no topo (antes da lista de módulos)
  const sumMembros = document.querySelector('.sum-membros-bloco');
  expect(sumMembros).toBeInTheDocument();
  expect(sumMembros).toHaveTextContent(/2 pessoas usam este perfil/i);
  expect(sumMembros).toHaveTextContent(/Mariana, Beatriz/i);
  const sumCard = document.querySelector('.card.sum');
  const modulosList = sumCard.querySelector('ul');
  expect(sumCard.contains(sumMembros)).toBe(true);
  expect(sumMembros.compareDocumentPosition(modulosList) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it('ao editar perfil existente e clicar em Salvar perfil, abre modal de governança com colaboradores e permite criar novo perfil', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => [1, 2] }) // GET permissoes perfil 60
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 77, nome: 'Secretária Avançada' }) }) // POST novo perfil
    .mockResolvedValueOnce({ ok: true, json: async () => [] }); // PUT permissoes novo perfil
  vi.stubGlobal('fetch', fetchMock);

  const perfisCustom = [
    { id: 60, codigo: 'CST_abc123', nome: 'Secretária da Noite', organizacaoSaudeId: 'org-1' },
  ];
  const usuarios = [
    { id: 'u1', nomeCompleto: 'Mariana Lima', perfilAcessoId: 60, ativo: true },
  ];
  render(
    <GestaoPerfisTab
      {...props}
      perfisAcesso={perfisCustom}
      usuarios={usuarios}
      canEdit
      perfilParaAbrir={60}
    />,
  );

  await waitFor(() => expect(screen.getByRole('button', { name: 'Só ver' })).toBeEnabled());

  // Clica em 'Salvar perfil' (topo)
  const btnSalvar = screen.getAllByRole('button', { name: 'Salvar perfil' })[0];
  fireEvent.click(btnSalvar);

  // Modal de governança deve abrir
  const dialog = screen.getByRole('dialog');
  expect(dialog).toBeInTheDocument();
  expect(within(dialog).getByRole('heading', { name: /Salvar Alterações do Perfil/i })).toBeInTheDocument();
  expect(within(dialog).getByText(/Utilizado por 1 colaborador/i)).toBeInTheDocument();
  expect(within(dialog).getByText(/Mariana/i)).toBeInTheDocument();

  // Seleciona Opção B: Criar um novo perfil
  const optNovo = within(dialog).getByText(/Criar um novo perfil com as edições feitas/i);
  fireEvent.click(optNovo);

  const inputNovoNome = within(dialog).getByLabelText(/Nome do novo perfil/i);
  // Deve ter sugerido automaticamente com sufixo (Personalizado)
  expect(inputNovoNome.value).toBe('Secretária da Noite (Personalizado)');

  // Se o usuário digitar o nome de um perfil que já existe (ex: 'Secretária da Noite')
  fireEvent.change(inputNovoNome, { target: { value: 'Secretária da Noite' } });
  expect(within(dialog).getByText(/Já existe um perfil com este nome nesta clínica/i)).toBeInTheDocument();
  const btnConfirmar = within(dialog).getByRole('button', { name: 'Confirmar e salvar' });
  expect(btnConfirmar).toBeDisabled();

  // Ao alterar para um nome inédito, o erro desaparece e o botão é habilitado
  fireEvent.change(inputNovoNome, { target: { value: 'Secretária Avançada' } });
  expect(within(dialog).queryByText(/Já existe um perfil com este nome nesta clínica/i)).not.toBeInTheDocument();
  expect(btnConfirmar).toBeEnabled();

  // Confirma e salva
  fireEvent.click(btnConfirmar);

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/perfis-acesso');
  expect(fetchMock.mock.calls[1][1].method).toBe('POST');
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).nome).toBe('Secretária Avançada');
});



