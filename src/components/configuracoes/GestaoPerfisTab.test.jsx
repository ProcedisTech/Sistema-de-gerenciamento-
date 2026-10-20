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
    for (const modulo of ['Documentos', 'Catálogo']) {
      expect(button(modulo, 'Ver e editar')).toBeDisabled();
      expect(button(modulo, 'Ver e editar')).toHaveAttribute('title', `O módulo ${modulo} não possui nível intermediário de edição`);
    }
    for (const modulo of ['Atendimento', 'Clínica']) {
      expect(button(modulo, 'Só ver')).toBeDisabled();
      expect(button(modulo, 'Só ver')).toHaveAttribute('title', `O módulo ${modulo} não possui nível somente visualização`);
    }
    for (const nivel of ['Só ver', 'Ver e editar']) {
      expect(button('Agenda', nivel)).toBeEnabled();
      expect(button('Agenda', nivel)).not.toHaveAttribute('title');
      expect(button('Pacientes', nivel)).toBeEnabled();
      expect(button('Pacientes', nivel)).not.toHaveAttribute('title');
    }
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

