import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import NotificacoesConfigView from './NotificacoesConfigView.jsx';

const papel = vi.hoisted(() => ({ canConfigurarNotificacoes: true, roleUserId: 'eu' }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
const api = vi.hoisted(() => ({
  tipos: vi.fn(), extras: vi.fn(), salvarExtras: vi.fn(), preferencias: vi.fn(), silenciar: vi.fn(),
  deixarDeSilenciar: vi.fn(), acompanhar: vi.fn(), deixarDeAcompanhar: vi.fn(), opcoes: vi.fn(), profissionais: vi.fn(),
}));

vi.mock('../../hooks/usePapel', () => ({ usePapel: () => papel }));
vi.mock('../../contexts/useToast.js', () => ({ useToast: () => toast }));
vi.mock('../../services/api.js', () => ({ notificacoesConfigApi: api }));

const TIPO = {
  codigo: 'AGENDA_NOVO', nome: 'Novo agendamento', descricao: 'Quando alguém agenda',
  modulo: { codigo: 'AGENDA', nome: 'Agenda' }, nivel: { codigo: 'NORMAL', apareceNaHora: false, acendeSino: true },
  papel: { codigo: 'PROFISSIONAL_DO_HORARIO', nome: 'Profissional do horário' },
};

// Chega por ser o horário dela (fixo) e por perfil extra (silenciável).
const PREF_AGENDA = { codigo: 'AGENDA_NOVO', nome: 'Novo agendamento', nivel: TIPO.nivel, motivos: ['PAPEL_NO_FATO', 'PERFIL_EXTRA'], silenciado: false };
const PREF_FIXO = { codigo: 'TERMO_ASSINADO', nome: 'Termo assinado', nivel: TIPO.nivel, motivos: ['PAPEL_NO_FATO'], silenciado: false };

beforeEach(() => {
  vi.clearAllMocks();
  papel.canConfigurarNotificacoes = true;
  api.tipos.mockResolvedValue([TIPO]);
  api.extras.mockResolvedValue({ perfis: [{ id: 'p1', nome: 'Recepção' }], pessoas: [] });
  api.salvarExtras.mockResolvedValue(null);
  api.preferencias.mockResolvedValue({ tipos: [PREF_AGENDA], acompanhando: [] });
  api.opcoes.mockResolvedValue({
    perfis: [{ id: 'p1', nome: 'Recepção', pessoas: 1 }, { id: 'p2', nome: 'Gerência', pessoas: 3 }],
    pessoas: [{ roleUserId: 'u2', nome: 'Ana Souza', perfilNome: 'Recepção' }],
  });
  api.silenciar.mockResolvedValue(null);
  api.deixarDeSilenciar.mockResolvedValue(null);
  api.acompanhar.mockResolvedValue(null);
  api.deixarDeAcompanhar.mockResolvedValue(null);
  api.profissionais.mockResolvedValue([{ roleUserId: 'u2', nome: 'Ana Souza', perfilNome: 'Dentista' }]);
});

describe('aba Quem recebe cada aviso', () => {
  it('mostra o caminho "Configurações › Notificações" e o ícone do módulo no título', async () => {
    render(<NotificacoesConfigView abaInicial="clinica" />);
    expect(await screen.findByText('Configurações › Notificações')).toBeInTheDocument();
    const titulo = screen.getByRole('heading', { level: 2, name: 'Agenda' });
    expect(titulo.querySelector('[data-testid="icone-modulo"]')).not.toBeNull();
  });

  it('sem permissão é só leitura: aviso e nenhum botão de editar', async () => {
    papel.canConfigurarNotificacoes = false;
    render(<NotificacoesConfigView abaInicial="clinica" />);
    expect(await screen.findByText('Recepção')).toBeInTheDocument();
    expect(screen.getByText('Também recebem')).toBeInTheDocument();
    expect(screen.getByText(/Só quem tem a permissão "Configurar notificações"/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Adicionar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Remover/ })).toBeNull();
    expect(api.extras).toHaveBeenCalledWith('AGENDA_NOVO');
    expect(api.opcoes).not.toHaveBeenCalled();
  });

  it('sem permissão e sem ninguém extra mostra "Ninguém" só leitura', async () => {
    papel.canConfigurarNotificacoes = false;
    api.extras.mockResolvedValue({ perfis: [], pessoas: [] });
    render(<NotificacoesConfigView abaInicial="clinica" />);
    expect(await screen.findByText('Ninguém')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Adicionar/ })).toBeNull();
  });

  it('adicionar perfil e pessoa chama o PUT com o conjunto certo', async () => {
    const user = userEvent.setup();
    render(<NotificacoesConfigView abaInicial="clinica" />);
    await screen.findByText('Recepção');
    await user.click(screen.getByRole('button', { name: /Adicionar a Novo agendamento/ }));
    await user.click(screen.getByText('Gerência'));
    expect(api.salvarExtras).toHaveBeenLastCalledWith('AGENDA_NOVO', ['p1', 'p2'], []);
    await user.click(screen.getByRole('button', { name: /Adicionar a Novo agendamento/ }));
    await user.click(screen.getByText('Ana Souza'));
    expect(api.salvarExtras).toHaveBeenLastCalledWith('AGENDA_NOVO', ['p1', 'p2'], ['u2']);
    expect(await screen.findByText('Tudo salvo')).toBeInTheDocument();
  });

  it('o seletor usa as opções da rota e mostra as linhas de apoio', async () => {
    const user = userEvent.setup();
    render(<NotificacoesConfigView abaInicial="clinica" />);
    await screen.findByText('Recepção');
    await user.click(screen.getByRole('button', { name: /Adicionar a Novo agendamento/ }));
    expect(api.opcoes).toHaveBeenCalledTimes(1);
    expect(screen.getByText('3 pessoas')).toBeInTheDocument(); // Gerência, no seletor
    expect(screen.getByText('Ana Souza').parentElement).toHaveTextContent('Recepção'); // perfil da pessoa
  });

  it('chip de perfil mostra "· N pessoas" (singular e plural)', async () => {
    api.extras.mockResolvedValue({ perfis: [{ id: 'p1', nome: 'Recepção' }, { id: 'p2', nome: 'Gerência' }], pessoas: [] });
    render(<NotificacoesConfigView abaInicial="clinica" />);
    expect(await screen.findByText('· 1 pessoa')).toBeInTheDocument();
    expect(screen.getByText('· 3 pessoas')).toBeInTheDocument();
  });

  it('perfil sem "Ver notificações" mostra aviso âmbar no chip e no seletor', async () => {
    const user = userEvent.setup();
    api.opcoes.mockResolvedValue({
      perfis: [{ id: 'p1', nome: 'Recepção', pessoas: 0, temVer: false }, { id: 'p2', nome: 'Gerência', pessoas: 3, temVer: true }],
      pessoas: [],
    });
    render(<NotificacoesConfigView abaInicial="clinica" />);
    await screen.findByText('Recepção');
    const aviso = "ninguém deste perfil recebe: o perfil não tem 'Ver notificações'";
    expect(screen.getAllByText(new RegExp(aviso))).toHaveLength(1); // só o chip gravado (Recepção)
    await user.click(screen.getByRole('button', { name: /Adicionar a Novo agendamento/ }));
    expect(screen.getAllByText(new RegExp(aviso))).toHaveLength(1); // Recepção já é chip: o seletor só lista Gerência (com VER)
  });

  it('seletor avisa no perfil sem VER que ainda não foi adicionado', async () => {
    const user = userEvent.setup();
    api.extras.mockResolvedValue({ perfis: [], pessoas: [] });
    api.opcoes.mockResolvedValue({ perfis: [{ id: 'p2', nome: 'Apoio', pessoas: 0, temVer: false }], pessoas: [] });
    render(<NotificacoesConfigView abaInicial="clinica" />);
    await user.click(await screen.findByRole('button', { name: /Adicionar a Novo agendamento/ }));
    expect(screen.getByText("ninguém deste perfil recebe: o perfil não tem 'Ver notificações'")).toBeInTheDocument();
  });

  it('lembrete de retorno inativo aparece como cartão Desligado, sem edição e sem buscar extras', async () => {
    api.tipos.mockResolvedValue([TIPO, { ...TIPO, codigo: 'RETORNO_LEMBRETE_VENCIDO', nome: 'Lembrete de retorno', modulo: { codigo: 'RETORNO', nome: 'Retorno' }, ativo: false }]);
    render(<NotificacoesConfigView abaInicial="clinica" />);
    const cartao = await screen.findByTestId('cfg-RETORNO_LEMBRETE_VENCIDO');
    expect(cartao).toHaveTextContent('Desligado');
    expect(cartao).toHaveTextContent('Liga sozinho quando o lembrete de retorno existir no sistema.');
    expect(cartao.querySelector('button')).toBeNull();
    expect(api.tipos).toHaveBeenCalledWith(true);
    expect(api.extras).not.toHaveBeenCalledWith('RETORNO_LEMBRETE_VENCIDO');
  });

  it('erro ao carregar as opções mostra aviso (não some calado)', async () => {
    api.opcoes.mockRejectedValue(new Error('x'));
    render(<NotificacoesConfigView abaInicial="clinica" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar perfis e pessoas');
  });

  it('remover perfil chama o PUT sem ele', async () => {
    const user = userEvent.setup();
    render(<NotificacoesConfigView abaInicial="clinica" />);
    await user.click(await screen.findByRole('button', { name: 'Remover Recepção' }));
    expect(api.salvarExtras).toHaveBeenCalledWith('AGENDA_NOVO', [], []);
  });

  it('erro no PUT desfaz o chip e avisa', async () => {
    const user = userEvent.setup();
    api.salvarExtras.mockRejectedValue(new Error('x'));
    render(<NotificacoesConfigView abaInicial="clinica" />);
    await user.click(await screen.findByRole('button', { name: 'Remover Recepção' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByText('Recepção')).toBeInTheDocument();
    expect(screen.getByText('Não salvou')).toBeInTheDocument();
  });
});

describe('aba Minhas preferências', () => {
  it('silenciar e voltar a receber chamam PUT e DELETE do tipo', async () => {
    const user = userEvent.setup();
    render(<NotificacoesConfigView abaInicial="prefs" />);
    const sw = await screen.findByRole('switch', { name: 'Receber Novo agendamento' });
    await user.click(sw);
    expect(api.silenciar).toHaveBeenCalledWith('AGENDA_NOVO');
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await user.click(sw);
    expect(api.deixarDeSilenciar).toHaveBeenCalledWith('AGENDA_NOVO');
  });

  it('mostra só os tipos que chegam, com o motivo em texto', async () => {
    api.tipos.mockResolvedValue([TIPO, { ...TIPO, codigo: 'AGENDA_CANCELADO', nome: 'Agendamento cancelado' }]);
    render(<NotificacoesConfigView abaInicial="prefs" />);
    expect(await screen.findByText('Novo agendamento')).toBeInTheDocument();
    expect(screen.queryByText('Agendamento cancelado')).toBeNull();
    expect(screen.getByText('Sempre que o horário for seu · Pelo seu perfil')).toBeInTheDocument();
  });

  it('perfil extra mostra "Pelo perfil <nome>" e a aba traz a frase fixa do autor', async () => {
    api.preferencias.mockResolvedValue({
      tipos: [{ ...PREF_AGENDA, motivos: ['PERFIL_EXTRA'], perfilNome: 'Recepção' }],
      acompanhando: [],
    });
    render(<NotificacoesConfigView abaInicial="prefs" />);
    expect(await screen.findByText('Pelo perfil Recepção')).toBeInTheDocument();
    expect(screen.getByText('Você nunca recebe aviso do que você mesmo fez.')).toBeInTheDocument();
  });

  it('só PAPEL_NO_FATO mostra "Sempre" com cadeado e sem interruptor', async () => {
    api.preferencias.mockResolvedValue({ tipos: [PREF_FIXO], acompanhando: [] });
    api.tipos.mockResolvedValue([{ ...TIPO, codigo: 'TERMO_ASSINADO', nome: 'Termo assinado', papel: { codigo: 'QUEM_ENVIOU_O_LINK', nome: 'Quem enviou o link' } }]);
    render(<NotificacoesConfigView abaInicial="prefs" />);
    expect(await screen.findByText('Sempre que você enviar o link')).toBeInTheDocument();
    expect(screen.getByText('Sempre')).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Receber Termo assinado' })).toBeNull();
  });

  it('sem nenhum tipo mostra o texto de vazio', async () => {
    api.preferencias.mockResolvedValue({ tipos: [], acompanhando: [] });
    render(<NotificacoesConfigView abaInicial="prefs" />);
    expect(await screen.findByText('Nenhum aviso chega para você hoje.')).toBeInTheDocument();
  });

  it('pessoa extra e acompanhamento são silenciáveis e mostram o texto', async () => {
    api.preferencias.mockResolvedValue({
      tipos: [{ ...PREF_AGENDA, motivos: ['PESSOA_EXTRA', 'ACOMPANHAMENTO'], silenciado: true }],
      acompanhando: [{ roleUserId: 'u2', nome: 'Ana Souza' }],
    });
    render(<NotificacoesConfigView abaInicial="prefs" />);
    expect(await screen.findByText('A clínica incluiu você · Porque acompanha Ana Souza')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Receber Novo agendamento' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Silenciado')).toBeInTheDocument();
  });

  it('acompanhar e deixar de acompanhar chamam as rotas do profissional (a lista vem da rota de profissionais)', async () => {
    const user = userEvent.setup();
    render(<NotificacoesConfigView abaInicial="prefs" />);
    expect(await screen.findByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('Dentista')).toBeInTheDocument(); // perfil de acesso abaixo do nome
    const sw = screen.getByRole('switch', { name: 'Acompanhar Ana Souza' });
    await user.click(sw);
    expect(api.acompanhar).toHaveBeenCalledWith('u2');
    await user.click(sw);
    expect(api.deixarDeAcompanhar).toHaveBeenCalledWith('u2');
  });

  it('lista de acompanhar vazia mostra texto', async () => {
    api.profissionais.mockResolvedValue([]);
    render(<NotificacoesConfigView abaInicial="prefs" />);
    expect(await screen.findByText('Nenhum profissional para acompanhar.')).toBeInTheDocument();
  });

  it('erro ao carregar os profissionais mostra aviso, não a mensagem de lista vazia', async () => {
    api.profissionais.mockRejectedValue(new Error('x'));
    render(<NotificacoesConfigView abaInicial="prefs" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar a lista de profissionais');
    expect(screen.queryByText('Nenhum profissional para acompanhar.')).toBeNull();
  });

  it('erro ao silenciar desfaz o interruptor e avisa', async () => {
    const user = userEvent.setup();
    api.silenciar.mockRejectedValue(new Error('x'));
    render(<NotificacoesConfigView abaInicial="prefs" />);
    const sw = await screen.findByRole('switch', { name: 'Receber Novo agendamento' });
    await user.click(sw);
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });
});
