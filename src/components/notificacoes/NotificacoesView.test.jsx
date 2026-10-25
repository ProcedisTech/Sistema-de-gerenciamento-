import React from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NotificacoesView from './NotificacoesView.jsx';
import { formatarMensagemNotificacao } from '../../utils/notificacaoFormat.js';
import { PAYLOAD_REAL } from '../../utils/notificacaoPayloadsReais.js';

vi.mock('../../services/api.js', () => ({
  notificacoesApi: {
    contarNaoLidas: vi.fn(),
    listar: vi.fn(),
    marcarLida: vi.fn(),
    marcarTodasLidas: vi.fn(),
    deletar: vi.fn(),
    limparLidas: vi.fn(),
  },
}));
// Sem ToastProvider o useToast devolve funções novas a cada render e o loadData recarregaria sem parar.
const toastEstavel = { error: vi.fn() };
vi.mock('../../contexts/useToast.js', () => ({ useToast: () => toastEstavel }));
vi.mock('../hooks/useFusoClinica.js', () => ({
  useFusoClinica: () => ({ fuso: 'America/Sao_Paulo', pronto: true }),
}));

import { notificacoesApi } from '../../services/api.js';

// Quarta-feira 21/10/2026, 12:00 em São Paulo (UTC-3).
const AGORA = '2026-10-21T15:00:00Z';

let seq = 0;
const item = (tipo, extra = {}) => ({
  id: `n${++seq}`,
  tipo,
  nivel: 'NORMAL',
  acendeSino: true,
  lida: false,
  motivo: 'PAPEL_NO_FATO',
  autorNome: null,
  paciente: { id: 'p1', nome: 'Maria' },
  payload: PAYLOAD_REAL[tipo],
  criadoEm: '2026-10-21T14:00:00Z',
  ...extra,
});

function montar(items, props = {}, count = items.filter((i) => !i.lida).length) {
  notificacoesApi.contarNaoLidas.mockResolvedValue({ count });
  notificacoesApi.listar.mockResolvedValue({ content: items });
  render(<NotificacoesView onVoltar={() => {}} {...props} />);
}

describe('NotificacoesView', () => {
  beforeEach(() => {
    seq = 0;
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(AGORA));
    window.matchMedia = window.matchMedia || (() => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  });
  afterEach(() => vi.useRealTimers());

  const ICONES = {
    AGENDA_NOVO: 'calendar-plus',
    AGENDA_CANCELADO: 'calendar-x',
    AGENDA_REAGENDADO: 'calendar-clock',
    CONFIRMACAO_CONFIRMOU: 'circle-check-big',
    CONFIRMACAO_RECUSOU: 'circle-x',
    CONFIRMACAO_SEM_RESPOSTA: 'circle-question-mark',
    ANAMNESE_RESPONDIDA: 'clipboard-check',
    ANAMNESE_VENCIDA: 'clipboard-x',
    TERMO_ASSINADO: 'pen-line',
    TERMO_LINK_EXPIRADO: 'link-2-off',
    CONSULTA_ENCERRADA: 'stethoscope',
    EQUIPE_NOVO_MEMBRO: 'user-plus',
    RETORNO_LEMBRETE_VENCIDO: 'rotate-ccw',
  };

  it.each(Object.entries(ICONES))('%s mostra o ícone %s e o texto', async (tipo, icone) => {
    const n = item(tipo);
    montar([n]);
    const texto = formatarMensagemNotificacao(n);
    expect(texto).toBeTruthy();
    expect(texto).not.toContain('undefined');
    const card = (await screen.findByText(texto, { exact: false })).closest('button');
    expect(card.querySelector(`svg.lucide-${icone}`)).toBeInTheDocument();
  });

  it('chips mostram a contagem e filtram a lista', async () => {
    const itens = [
      item('AGENDA_NOVO'),
      item('AGENDA_CANCELADO'),
      item('CONFIRMACAO_CONFIRMOU'),
      item('TERMO_ASSINADO'),
    ];
    montar(itens);
    await screen.findByText(formatarMensagemNotificacao(itens[0]), { exact: false });
    for (const rotulo of ['Todas (4)', 'Agenda (2)', 'Confirmações (1)', 'Termos (1)', 'Fichas (0)']) {
      expect(screen.getByRole('button', { name: rotulo })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: /Sugestões/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Agenda (2)' }));
    expect(screen.getByText(formatarMensagemNotificacao(itens[0]), { exact: false })).toBeInTheDocument();
    expect(screen.getByText(formatarMensagemNotificacao(itens[1]), { exact: false })).toBeInTheDocument();
    expect(screen.queryByText(formatarMensagemNotificacao(itens[2]), { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText(formatarMensagemNotificacao(itens[3]), { exact: false })).not.toBeInTheDocument();
  });

  it('agrupa em Hoje, Ontem, Esta semana e Anteriores pelo dia da clínica', async () => {
    const hoje = item('AGENDA_NOVO', { payload: { ...PAYLOAD_REAL.AGENDA_NOVO, pacienteNome: 'PHoje' } });
    // 02:00Z de 21/10 ainda é 23:00 de 20/10 em São Paulo: ontem, não hoje.
    const ontem = item('AGENDA_NOVO', { payload: { ...PAYLOAD_REAL.AGENDA_NOVO, pacienteNome: 'POntem' }, criadoEm: '2026-10-21T02:00:00Z' });
    const semana = item('AGENDA_NOVO', { payload: { ...PAYLOAD_REAL.AGENDA_NOVO, pacienteNome: 'PSemana' }, criadoEm: '2026-10-19T15:00:00Z' });
    const antes = item('AGENDA_NOVO', { payload: { ...PAYLOAD_REAL.AGENDA_NOVO, pacienteNome: 'PAntes' }, criadoEm: '2026-10-18T15:00:00Z' });
    montar([hoje, ontem, semana, antes]);
    await screen.findByText('PHoje', { exact: false });
    const secao = (titulo) => screen.getByRole('heading', { name: titulo }).closest('section');
    expect(within(secao('Hoje')).getByText('PHoje', { exact: false })).toBeInTheDocument();
    expect(within(secao('Ontem')).getByText('POntem', { exact: false })).toBeInTheDocument();
    expect(within(secao('Esta semana')).getByText('PSemana', { exact: false })).toBeInTheDocument();
    expect(within(secao('Anteriores')).getByText('PAntes', { exact: false })).toBeInTheDocument();
  });

  it('mostra "por <autor>" e a linha do motivo', async () => {
    const n = item('AGENDA_CANCELADO', { autorNome: 'Ana', motivo: 'PESSOA_EXTRA' });
    montar([n]);
    const card = (await screen.findByText(formatarMensagemNotificacao(n), { exact: false })).closest('button');
    expect(within(card).getByText(/· por Ana/)).toBeInTheDocument();
    expect(within(card).getByText('A clínica incluiu você neste aviso')).toBeInTheDocument();
  });

  it('sem autor não mostra "por"', async () => {
    const n = item('AGENDA_CANCELADO');
    montar([n]);
    const card = (await screen.findByText(formatarMensagemNotificacao(n), { exact: false })).closest('button');
    expect(within(card).queryByText(/por /)).not.toBeInTheDocument();
    expect(within(card).getByText('Você recebe porque o horário é seu')).toBeInTheDocument();
  });

  it('selo Urgente só aparece em nível URGENTE', async () => {
    const urgente = item('CONSULTA_ENCERRADA', { nivel: 'URGENTE' });
    const normal = item('AGENDA_NOVO');
    montar([urgente, normal]);
    const cu = (await screen.findByText(formatarMensagemNotificacao(urgente), { exact: false })).closest('button');
    const cn = screen.getByText(formatarMensagemNotificacao(normal), { exact: false }).closest('button');
    expect(within(cu).getByText('Urgente')).toBeInTheDocument();
    expect(within(cn).queryByText('Urgente')).not.toBeInTheDocument();
  });

  it('destaque de não lida só quando acende o sino (SILENCIOSA sem destaque)', async () => {
    const normal = item('AGENDA_NOVO');
    const silenciosa = item('RETORNO_LEMBRETE_VENCIDO', { nivel: 'SILENCIOSA', acendeSino: false });
    const lidaNormal = item('AGENDA_CANCELADO', { lida: true });
    montar([normal, silenciosa, lidaNormal]);
    const c = async (n) => (await screen.findByText(formatarMensagemNotificacao(n), { exact: false })).closest('button');
    expect(await c(normal)).toHaveClass('border-l-4');
    expect(await c(silenciosa)).not.toHaveClass('border-l-4');
    expect(await c(lidaNormal)).not.toHaveClass('border-l-4');
  });

  it('Limpar lidas abre o diálogo e só limpa ao confirmar', async () => {
    notificacoesApi.limparLidas.mockResolvedValue({ removidas: 1 });
    const lida = item('AGENDA_NOVO', { lida: true });
    montar([lida]);
    const texto = formatarMensagemNotificacao(lida);
    await screen.findByText(texto, { exact: false });

    await userEvent.click(screen.getByRole('button', { name: /Limpar lidas/ }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Remover todas as notificações lidas? Esta ação não pode ser desfeita.')).toBeInTheDocument();
    expect(notificacoesApi.limparLidas).not.toHaveBeenCalled();

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(notificacoesApi.limparLidas).not.toHaveBeenCalled();
    expect(screen.getByText(texto, { exact: false })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Limpar lidas/ }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remover lidas' }));
    await waitFor(() => expect(notificacoesApi.limparLidas).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText(texto, { exact: false })).not.toBeInTheDocument());
  });

  it('abrir ou excluir SILENCIOSA não decrementa; "Marcar todas" só some sem não lida que acende o sino', async () => {
    notificacoesApi.marcarLida.mockResolvedValue(null);
    notificacoesApi.deletar.mockResolvedValue(null);
    const normal = item('AGENDA_NOVO');
    const sil1 = item('RETORNO_LEMBRETE_VENCIDO', { nivel: 'SILENCIOSA', acendeSino: false });
    const sil2 = item('RETORNO_LEMBRETE_VENCIDO', { nivel: 'SILENCIOSA', acendeSino: false });
    montar([normal, sil1, sil2], {}, 1); // o servidor só conta a que acende o sino
    const card = async (n) => (await screen.findByText(formatarMensagemNotificacao(n), { exact: false })).closest('button');
    // As duas silenciosas têm o mesmo texto: pega os cartões por posição.
    const silenciosas = async () => (await screen.findAllByText(formatarMensagemNotificacao(sil1), { exact: false })).map((e) => e.closest('button'));
    await card(normal);

    await userEvent.click((await silenciosas())[0]);
    await waitFor(() => expect(notificacoesApi.marcarLida).toHaveBeenCalledTimes(1));
    await userEvent.click(within((await silenciosas())[1]).getByLabelText('Excluir notificação'));
    await waitFor(() => expect(notificacoesApi.deletar).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Marcar todas como lidas' })).toBeInTheDocument();

    await userEvent.click(await card(normal));
    await waitFor(() => expect(notificacoesApi.marcarLida).toHaveBeenCalledWith(normal.id));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Marcar todas como lidas' })).not.toBeInTheDocument());
  });
});
