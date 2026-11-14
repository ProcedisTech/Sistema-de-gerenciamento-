/**
 * Planejamento ao vivo entre abas: duas `PlanosTab` (variant consulta), cada uma com o seu canal de avisos, sobre UM
 * servidor falso com estado compartilhado (`estado.planos`, rotas de /api/v1/planejamentos). "A outra aba gravou" =
 * escrita feita por `planejamentosApi` (as mesmas requisições que a outra aba mandaria) ou pelo `estado` direto; o
 * teste emite o aviso `PLANEJAMENTO.ALTERADO` que o servidor real mandaria pelo SSE só para a aba que deve ouvir.
 *
 * "Rascunho hidratado": a consulta só cria o rascunho depois de uma ação da própria aba; aqui a aba clica no chip
 * "Chip1" (adicionar procedimento), que grava o item no servidor e hidrata o rascunho com o detalhe.
 *
 * O cartão do item não tem botão de editar hoje (`onEdit` não é usado no `PlanoItemCard`); o mock do cartão abaixo
 * acrescenta um botão de teste que chama o `onEdit` que o PlanosTab entrega, para abrir o modal de edição.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanosTab } from '../../components/planos/PlanosTab.jsx';
import { MENSAGEM_ALTERADO_OUTRO_APARELHO } from '../../components/hooks/useAtendimentoServidor.js';
import { PERMISSOES } from '../../constants/permissoes.js';
import { planejamentosApi, setOrgId } from '../../services/api';
import { AVISO } from '../../services/avisos/tiposAviso.js';
import { criarAvisosFalsos } from '../avisosFalsos.jsx';
import { INSTANTE_FIXO } from '../fixtures/consultaFixtures.js';
import { criarServidorEncerrarFalso, ORG_ID } from '../encerrar/servidorEncerrarFalso.js';

const { toastFalso } = vi.hoisted(() => ({
  toastFalso: { toast: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), dismiss: vi.fn() },
}));

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/useToast.js', () => ({ useToast: () => toastFalso }));
vi.mock('../../contexts/OrgContext', async (importOriginal) => {
  const real = await importOriginal();
  const { PERMISSOES: P } = await import('../../constants/permissoes.js');
  return {
    ...real,
    useOrg: () => ({
      ...real.useOrg(),
      orgId: '11111111-1111-4111-8111-111111111111',
      roleUserId: 'ru-1',
      papel: 'DONO',
      permissoes: Object.values(P),
      fusoHorario: 'America/Sao_Paulo',
      contextStatus: 'ready',
    }),
  };
});
vi.mock('../../components/planos/PlanoItemCard.jsx', async (importOriginal) => {
  const real = await importOriginal();
  const Original = real.PlanoItemCard;
  function PlanoItemCard(props) {
    return (
      <>
        <Original {...props} />
        <button type="button" data-testid={`editar-${props.item?.id}`} onClick={() => props.onEdit?.(props.item)}>
          Editar item de teste
        </button>
      </>
    );
  }
  return { ...real, PlanoItemCard };
});

const PACIENTE_ID = 'pac-1';
const PLANO_ID = 'b0000000-0000-4000-8000-000000000001';
const I1 = 'e0000000-0000-4000-8000-000000000001';
const I2 = 'e0000000-0000-4000-8000-000000000002';
const CAT = (n) => `c1000000-0000-4000-8000-00000000000${n}`;
/** Os 5 primeiros viram chips "Rápidos"; os itens do plano usam os de 6 em diante (nome só aparece no cartão). */
const NOMES = {
  [CAT(1)]: 'Chip1',
  [CAT(2)]: 'Chip2',
  [CAT(3)]: 'Chip3',
  [CAT(4)]: 'Chip4',
  [CAT(5)]: 'Chip5',
  [CAT(6)]: 'Alfa',
  [CAT(7)]: 'Beta',
  [CAT(8)]: 'Gama',
  [CAT(9)]: 'Delta',
};
const CATALOGO = Object.entries(NOMES).map(([id, nomeProcedimento]) => ({
  id,
  nomeProcedimento,
  tipoCodigo: 'procedimento',
  duracaoEstimadaMinutos: 30,
}));

const item = (id, cat, extras = {}) => ({
  id,
  planejamentoId: PLANO_ID,
  catalogoProcedimentoSaudeId: cat,
  catalogoNome: NOMES[cat],
  dataPlanejada: null,
  statusItem: 'PLANEJADO',
  statusItemNome: 'Planejado',
  valorOrcado: 100,
  sessaoAtiva: null,
  sessaoRealizada: null,
  sessaoRetornoAtiva: null,
  ...extras,
});
const planoInicial = () => ({
  id: PLANO_ID,
  observacao: 'Obs inicial',
  statusCodigo: 'ativo',
  criadoEm: '2026-09-01T13:00:00.000Z',
  valorTotal: 200,
  itens: [item(I1, CAT(6)), item(I2, CAT(7))],
});

let srv;
let estado;
let abasMontadas;

/** GET /planejamentos/{id} que, armado, segura a 1a resposta (já calculada) até `liberar()` (F-j2). */
const portao = { armado: false, n: 0, liberar: () => {}, espera: Promise.resolve() };
async function detalheComPortao() {
  if (estado.falhasPlano.detalhe > 0) {
    estado.falhasPlano.detalhe -= 1;
    return { status: 500, corpo: { error: 'Erro interno', status: 500 } };
  }
  const instantaneo = JSON.parse(JSON.stringify(estado.planos[0]));
  if (portao.armado) {
    portao.n += 1;
    if (portao.n === 1) await portao.espera;
  }
  return instantaneo;
}

function montarAba(nome) {
  const avisos = criarAvisosFalsos();
  const r = render(
    <avisos.Wrapper>
      <PlanosTab
        variant="consulta"
        pacienteId={PACIENTE_ID}
        roleUserId="ru-1"
        pacienteNome="Ana Souza"
        paciente={{ id: PACIENTE_ID, nome: 'Ana Souza' }}
        onVoltar={() => {}}
        onSelectProcedimentoParaConsulta={() => {}}
        onAgendarItem={(itens, onSaved) => onSaved?.({ dataAgendamento: itens?.[0]?.dataPlanejada || '2026-10-13', resultadosOk: itens })}
        onAgendarRetornoItem={() => {}}
        onConcluirComRetorno={() => {}}
        onPlanoConcluido={() => {}}
      />
    </avisos.Wrapper>,
  );
  const aba = { nome, avisos, ...r, q: within(r.container) };
  abasMontadas.push(aba);
  return aba;
}

async function assentar(ms = 30) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

/** Espera o debounce de 300 ms do `useAviso` vencer e a releitura assentar. */
const esperarAviso = () => assentar(450);

const cartoes = (aba) => aba.q.queryAllByLabelText('Selecionar procedimento');
const temTexto = (aba, texto) => aba.q.queryAllByText(texto).length > 0;

/** Hidrata o rascunho da aba: o chip grava o item `cat` no servidor e o detalhe volta para o rascunho. */
async function hidratar(aba, nomeChip = 'Chip1') {
  await waitFor(() => expect(aba.q.getByText(nomeChip)).toBeTruthy(), { timeout: 3000 });
  await waitFor(() => expect(cartoes(aba).length).toBeGreaterThan(0), { timeout: 3000 });
  const antes = estado.planos[0].itens.length;
  fireEvent.click(aba.q.getByText(nomeChip));
  await waitFor(() => expect(estado.planos[0].itens.length).toBe(antes + 1), { timeout: 3000 });
  await waitFor(() => expect(cartoes(aba).length).toBe(antes + 1), { timeout: 3000 });
  await assentar();
}

const putsDoPlano = () => estado.chamadasPlano.filter((c) => c.method === 'PUT');
const idsDoServidor = () => estado.planos[0].itens.map((i) => i.id);

describe('planejamento ao vivo entre abas (PlanosTab consulta)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    abasMontadas = [];
    estado = { dto: null, planos: [planoInicial()], nomesCatalogo: NOMES };
    srv = criarServidorEncerrarFalso({
      permissoes: Object.values(PERMISSOES),
      estado,
      rotas: [
        ['GET', /^\/api\/v1\/clinica\/procedimentos$/, () => CATALOGO],
        ['GET', /^\/api\/v1\/planejamentos\/[^/]+$/, detalheComPortao],
      ],
    });
    portao.armado = false;
    portao.n = 0;
    portao.espera = new Promise((r) => {
      portao.liberar = r;
    });
    vi.stubGlobal('fetch', srv.fetchFalso);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(INSTANTE_FIXO));
    setOrgId(ORG_ID);
  });
  afterEach(() => {
    abasMontadas.forEach((a) => a.unmount());
    vi.useRealTimers();
    vi.unstubAllGlobals();
    setOrgId(null);
  });

  // F-a
  it('a aba A cria, edita, remove e baixa; a aba B (rascunho hidratado) mostra o resultado sem recarregar', async () => {
    const abaB = montarAba('B');
    await hidratar(abaB);
    expect(cartoes(abaB)).toHaveLength(3);
    expect(temTexto(abaB, 'Alfa')).toBe(true);
    expect(temTexto(abaB, 'Beta')).toBe(true);
    expect(temTexto(abaB, 'Gama')).toBe(false);

    // A grava: cria Gama, move a data de Alfa, baixa o item do chip e remove Beta.
    const criado = await planejamentosApi.adicionarItem(PLANO_ID, {
      catalogoProcedimentoSaudeId: CAT(8),
      valorOrcado: 100,
      dataPlanejada: null,
    });
    await planejamentosApi.atualizarItem(PLANO_ID, I1, { dataPlanejada: '2026-11-20' });
    const doChip = estado.planos[0].itens.find((i) => i.catalogoProcedimentoSaudeId === CAT(1));
    await planejamentosApi.darBaixaItem(PLANO_ID, doChip.id);
    await planejamentosApi.removerItem(PLANO_ID, I2);
    expect(criado.id).toBeTruthy();

    // Sem aviso a B continua como estava.
    await esperarAviso();
    expect(temTexto(abaB, 'Gama')).toBe(false);
    expect(temTexto(abaB, 'Beta')).toBe(true);

    abaB.avisos.emitirAviso(AVISO.PLANEJAMENTO.ALTERADO, PACIENTE_ID);
    await waitFor(() => expect(temTexto(abaB, 'Gama')).toBe(true), { timeout: 3000 });
    expect(temTexto(abaB, 'Beta')).toBe(false);
    expect(temTexto(abaB, 'Alfa')).toBe(true);
    // edição e baixa chegaram ao rascunho: a data nova aparece e o item baixado deixa de ser selecionável.
    expect(abaB.container.textContent).toMatch(/20 de nov/);
    expect(abaB.container.textContent).toContain('Concluída');
    expect(cartoes(abaB)).toHaveLength(2);
  });

  // F-b1
  it('observação em foco na B não muda com o aviso; no blur aplica o remoto e avisa "Alterado em outro aparelho"', async () => {
    const abaB = montarAba('B');
    await hidratar(abaB);
    const area = abaB.container.querySelector('textarea');
    expect(area.value).toBe('Obs inicial');
    fireEvent.focus(area);

    await planejamentosApi.salvar(PLANO_ID, { observacao: 'Obs remota', itens: [], removidos: [] });
    await planejamentosApi.adicionarItem(PLANO_ID, { catalogoProcedimentoSaudeId: CAT(8), valorOrcado: 100 });
    abaB.avisos.emitirAviso(AVISO.PLANEJAMENTO.ALTERADO, PACIENTE_ID);

    await waitFor(() => expect(temTexto(abaB, 'Gama')).toBe(true), { timeout: 3000 });
    expect(area.value).toBe('Obs inicial');
    expect(toastFalso.info).not.toHaveBeenCalled();

    fireEvent.blur(area);
    await waitFor(() => expect(area.value).toBe('Obs remota'), { timeout: 3000 });
    expect(toastFalso.info).toHaveBeenCalledTimes(1);
    expect(toastFalso.info).toHaveBeenCalledWith(MENSAGEM_ALTERADO_OUTRO_APARELHO);
  });

  // F-b2
  it('modal de edição aberto na B mantém os valores; o PATCH leva só o campo alterado', async () => {
    const abaB = montarAba('B');
    await hidratar(abaB);
    fireEvent.click(abaB.q.getByTestId(`editar-${I1}`));
    const dialog = await screen.findByRole('dialog');
    const valor = within(dialog).getByPlaceholderText('Valor orçado (R$)');
    expect(valor.value).toBe('100,00');

    // A move a data do mesmo item enquanto o modal está aberto.
    await planejamentosApi.atualizarItem(PLANO_ID, I1, { dataPlanejada: '2026-11-20' });
    abaB.avisos.emitirAviso(AVISO.PLANEJAMENTO.ALTERADO, PACIENTE_ID);
    await waitFor(() => expect(abaB.container.textContent).toMatch(/20 de nov/), { timeout: 3000 });
    // o modal leu o item uma vez só: nada mudou nele.
    expect(within(screen.getByRole('dialog')).getByPlaceholderText('Valor orçado (R$)').value).toBe('100,00');

    fireEvent.change(valor, { target: { value: '25000' } });
    expect(valor.value).toBe('250,00');
    fireEvent.click(within(dialog).getByText('Aplicar'));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 3000 });
    const patchesDoItem = estado.chamadasPlano.filter((c) => c.method === 'PATCH' && c.path.endsWith(`/itens/${I1}`));
    expect(patchesDoItem.at(-1).body).toEqual({ valorOrcado: 250 });
    const noServidor = estado.planos[0].itens.find((i) => i.id === I1);
    expect(noServidor.valorOrcado).toBe(250);
    expect(noServidor.dataPlanejada).toBe('2026-11-20');
  });

  // F-b2 (fechar)
  it('fechar o modal sem salvar: avisa só se o item mudou no rascunho enquanto estava aberto', async () => {
    const abaB = montarAba('B');
    await hidratar(abaB);

    fireEvent.click(abaB.q.getByTestId(`editar-${I1}`));
    fireEvent.click(within(await screen.findByRole('dialog')).getByText('Cancelar'));
    expect(toastFalso.info).not.toHaveBeenCalled();

    fireEvent.click(abaB.q.getByTestId(`editar-${I1}`));
    const dialog = await screen.findByRole('dialog');
    await planejamentosApi.atualizarItem(PLANO_ID, I1, { dataPlanejada: '2026-11-20' });
    abaB.avisos.emitirAviso(AVISO.PLANEJAMENTO.ALTERADO, PACIENTE_ID);
    await waitFor(() => expect(abaB.container.textContent).toMatch(/20 de nov/), { timeout: 3000 });
    fireEvent.click(within(dialog).getByText('Cancelar'));
    expect(toastFalso.info).toHaveBeenCalledTimes(1);
    expect(toastFalso.info).toHaveBeenCalledWith(MENSAGEM_ALTERADO_OUTRO_APARELHO);
  });

  // F-d
  it('autosave da observação da A, com rascunho velho, não apaga o item que a B criou', async () => {
    const abaA = montarAba('A');
    await hidratar(abaA, 'Chip1');
    const abaB = montarAba('B');
    await hidratar(abaB, 'Chip2');
    // a A não recebeu aviso: o rascunho dela não tem o item da B.
    expect(cartoes(abaA)).toHaveLength(3);
    expect(estado.planos[0].itens).toHaveLength(4);

    fireEvent.change(abaA.container.querySelector('textarea'), { target: { value: 'Obs da A' } });
    await waitFor(() => expect(putsDoPlano()).toHaveLength(1), { timeout: 3000 });
    expect(putsDoPlano()[0].body).toEqual({ observacao: 'Obs da A', itens: [], removidos: [] });
    expect(estado.planos[0].observacao).toBe('Obs da A');
    expect(estado.planos[0].itens).toHaveLength(4);
  });

  // F-d + F-g
  it('"Salvar" da A (agendar em lote), com rascunho velho, manda só os itens alterados e não apaga o da B', async () => {
    const abaA = montarAba('A');
    await hidratar(abaA, 'Chip1');
    const abaB = montarAba('B');
    await hidratar(abaB, 'Chip2');
    const idDaB = estado.planos[0].itens.find((i) => i.catalogoProcedimentoSaudeId === CAT(2)).id;

    const caixas = cartoes(abaA);
    fireEvent.click(caixas[0]);
    fireEvent.click(caixas[1]);
    fireEvent.click(abaA.q.getByRole('button', { name: /Agendar juntos/ }));
    fireEvent.click(abaA.q.getByText('Em 7 dias'));

    await waitFor(() => expect(putsDoPlano()).toHaveLength(1), { timeout: 3000 });
    const { body } = putsDoPlano()[0];
    expect(body.removidos).toEqual([]);
    expect(body.itens).toHaveLength(2);
    expect(body.itens.map((i) => i.id)).not.toContain(idDaB);
    expect(idsDoServidor()).toContain(idDaB);
    expect(idsDoServidor()).toHaveLength(4);
    // depois do Salvar a A relê o detalhe e passa a ver o item da B.
    await waitFor(() => expect(cartoes(abaA)).toHaveLength(4), { timeout: 3000 });
  });

  // F-g
  it('agendar em lote (+7) com 2 itens: o PUT leva dataPlanejada = hoje+7 nos 2, por diferença', async () => {
    const abaA = montarAba('A');
    await hidratar(abaA, 'Chip1');
    expect(cartoes(abaA)).toHaveLength(3);

    const caixas = cartoes(abaA);
    fireEvent.click(caixas[0]);
    fireEvent.click(caixas[1]);
    fireEvent.click(abaA.q.getByRole('button', { name: /Agendar juntos/ }));
    fireEvent.click(abaA.q.getByText('Em 7 dias'));

    await waitFor(() => expect(putsDoPlano()).toHaveLength(1), { timeout: 3000 });
    const { body } = putsDoPlano()[0];
    expect(body.removidos).toEqual([]);
    expect(body.itens).toHaveLength(2);
    expect(body.itens.map((i) => i.dataPlanejada)).toEqual(['2026-10-13', '2026-10-13']);
    expect(estado.planos[0].itens.filter((i) => i.dataPlanejada === '2026-10-13')).toHaveLength(2);
  });

  // F-f
  it('item local sem id real no rascunho da B continua depois do aviso', async () => {
    // id que não é UUID entra no rascunho como item local (sem id real).
    estado.planos[0].itens.push(item('local-1', CAT(9)));
    const abaB = montarAba('B');
    await hidratar(abaB);
    expect(temTexto(abaB, 'Delta')).toBe(true);

    // o servidor não conhece o item local; a A criou outro item.
    estado.planos[0].itens = estado.planos[0].itens.filter((i) => i.id !== 'local-1');
    await planejamentosApi.adicionarItem(PLANO_ID, { catalogoProcedimentoSaudeId: CAT(8), valorOrcado: 100 });
    abaB.avisos.emitirAviso(AVISO.PLANEJAMENTO.ALTERADO, PACIENTE_ID);

    await waitFor(() => expect(temTexto(abaB, 'Gama')).toBe(true), { timeout: 3000 });
    expect(temTexto(abaB, 'Delta')).toBe(true);
  });

  // F-i2
  it('releitura do detalhe que responde 500: os itens do rascunho da B continuam', async () => {
    const abaB = montarAba('B');
    await hidratar(abaB);
    expect(cartoes(abaB)).toHaveLength(3);

    await planejamentosApi.adicionarItem(PLANO_ID, { catalogoProcedimentoSaudeId: CAT(8), valorOrcado: 100 });
    estado.falhasPlano.detalhe = 1;
    abaB.avisos.emitirAviso(AVISO.PLANEJAMENTO.ALTERADO, PACIENTE_ID);
    await esperarAviso();

    expect(estado.falhasPlano.detalhe).toBe(0);
    expect(cartoes(abaB)).toHaveLength(3);
    expect(temTexto(abaB, 'Alfa')).toBe(true);
    expect(temTexto(abaB, 'Beta')).toBe(true);
    expect(temTexto(abaB, 'Gama')).toBe(false);
    expect(toastFalso.error).not.toHaveBeenCalled();
    expect(abaB.container.textContent).not.toMatch(/Erro|Não foi possível/);
  });

  // F-j2
  it('a 1a releitura do detalhe que responde depois da 2a não sobrescreve o rascunho', async () => {
    const abaB = montarAba('B');
    await hidratar(abaB);
    portao.armado = true;

    await planejamentosApi.adicionarItem(PLANO_ID, { catalogoProcedimentoSaudeId: CAT(8), valorOrcado: 100 });
    abaB.avisos.emitirAviso(AVISO.PLANEJAMENTO.ALTERADO, PACIENTE_ID);
    await esperarAviso();
    expect(portao.n).toBe(1); // a 1a releitura ficou presa no servidor (com o plano só até Gama)

    await planejamentosApi.adicionarItem(PLANO_ID, { catalogoProcedimentoSaudeId: CAT(9), valorOrcado: 100 });
    abaB.avisos.emitirAviso(AVISO.PLANEJAMENTO.ALTERADO, PACIENTE_ID);
    await waitFor(() => expect(cartoes(abaB)).toHaveLength(5), { timeout: 3000 });
    expect(portao.n).toBe(2);

    portao.liberar();
    await assentar(100);
    expect(cartoes(abaB)).toHaveLength(5);
    expect(temTexto(abaB, 'Delta')).toBe(true);
    expect(temTexto(abaB, 'Gama')).toBe(true);
    expect(cartoes(abaB)).toHaveLength(5);
  });

  // A1: só autosave pendente (sem foco) não guarda o remoto; foco+blur depois não desfaz o texto local
  it('observação digitada sem foco, com autosave pendente: aviso remoto não vence no blur nem no Salvar', async () => {
    const abaB = montarAba('B');
    await hidratar(abaB);
    const area = abaB.container.querySelector('textarea');
    fireEvent.change(area, { target: { value: 'Obs local' } });
    estado.planos[0].observacao = 'Obs remota';
    abaB.avisos.emitirAviso(AVISO.PLANEJAMENTO.ALTERADO, PACIENTE_ID);
    await esperarAviso(); // 450 ms < 800 ms do autosave: ainda pendente
    expect(putsDoPlano()).toHaveLength(0);
    expect(area.value).toBe('Obs local');

    await waitFor(() => expect(putsDoPlano()).toHaveLength(1), { timeout: 3000 });
    expect(estado.planos[0].observacao).toBe('Obs local');

    fireEvent.focus(area);
    fireEvent.blur(area);
    await assentar();
    expect(area.value).toBe('Obs local');
    expect(toastFalso.info).not.toHaveBeenCalled();

    const caixas = cartoes(abaB);
    fireEvent.click(caixas[0]);
    fireEvent.click(caixas[1]);
    fireEvent.click(abaB.q.getByRole('button', { name: /Agendar juntos/ }));
    fireEvent.click(abaB.q.getByText('Em 7 dias'));
    await waitFor(() => expect(putsDoPlano()).toHaveLength(2), { timeout: 3000 });
    expect(putsDoPlano()[1].body.observacao).toBe('Obs local');
  });

  // A3: o detalhe do Salvar passa pela mesma guarda por plano
  it('detalhe de aviso pedido antes do Salvar e respondido depois não sobrescreve o rascunho do Salvar', async () => {
    const abaB = montarAba('B');
    await hidratar(abaB);
    portao.armado = true;

    await planejamentosApi.adicionarItem(PLANO_ID, { catalogoProcedimentoSaudeId: CAT(8), valorOrcado: 100 });
    abaB.avisos.emitirAviso(AVISO.PLANEJAMENTO.ALTERADO, PACIENTE_ID);
    await esperarAviso();
    expect(portao.n).toBe(1); // detalhe do aviso preso (plano só até Gama)

    await planejamentosApi.adicionarItem(PLANO_ID, { catalogoProcedimentoSaudeId: CAT(9), valorOrcado: 100 });
    const caixas = cartoes(abaB);
    fireEvent.click(caixas[0]);
    fireEvent.click(caixas[1]);
    fireEvent.click(abaB.q.getByRole('button', { name: /Agendar juntos/ }));
    fireEvent.click(abaB.q.getByText('Em 7 dias'));
    await waitFor(() => expect(cartoes(abaB)).toHaveLength(5), { timeout: 3000 });
    expect(portao.n).toBe(2);

    portao.liberar();
    await assentar(100);
    expect(cartoes(abaB)).toHaveLength(5);
    expect(temTexto(abaB, 'Delta')).toBe(true);
    expect(temTexto(abaB, 'Gama')).toBe(true);
  });

  // F-m (N1): o remoto guardado pelo foco sobrevive ao autosave que acabou de vencer no servidor.
  it('autosave grava com sucesso antes do aviso da própria gravação: blur não reaplica o remoto velho', async () => {
    const abaB = montarAba('B');
    await hidratar(abaB);
    const area = abaB.container.querySelector('textarea');
    fireEvent.focus(area);

    // Aviso remoto chega com o campo em foco: fica guardado em obsRemotoRef.
    estado.planos[0].observacao = 'Obs remota';
    abaB.avisos.emitirAviso(AVISO.PLANEJAMENTO.ALTERADO, PACIENTE_ID);
    await esperarAviso();

    // A pessoa digita e o autosave (800 ms) grava com sucesso.
    fireEvent.change(area, { target: { value: 'Obs nova' } });
    await waitFor(() => expect(putsDoPlano()).toHaveLength(1), { timeout: 3000 });
    expect(estado.planos[0].observacao).toBe('Obs nova');

    // Sai do campo antes de chegar o aviso da própria gravação (ou sem mais avisos chegarem).
    fireEvent.blur(area);
    await assentar();

    expect(area.value).toBe('Obs nova');
    expect(toastFalso.info).not.toHaveBeenCalled();

    // Um "Salvar" subsequente (agendar em lote) manda o texto novo, não o remoto velho.
    const caixas = cartoes(abaB);
    fireEvent.click(caixas[0]);
    fireEvent.click(caixas[1]);
    fireEvent.click(abaB.q.getByRole('button', { name: /Agendar juntos/ }));
    fireEvent.click(abaB.q.getByText('Em 7 dias'));
    await waitFor(() => expect(putsDoPlano()).toHaveLength(2), { timeout: 3000 });
    expect(putsDoPlano().at(-1).body.observacao).toBe('Obs nova');
  });

  // F-n (N2): aviso que chega e relê depois do GET do próprio Salvar, com item local no rascunho, não duplica.
  it('aviso respondido depois do GET do próprio Salvar: o item local não duplica (preservarLocais)', async () => {
    // "local-1" existe no servidor só até a hidratação, para entrar no draft com id sem UUID (item local);
    // depois sai do servidor, igual ao F-f, simulando um item que o servidor nunca conheceu.
    estado.planos[0].itens.push(item('local-1', CAT(9)));
    const abaB = montarAba('B');
    await hidratar(abaB);
    expect(temTexto(abaB, 'Delta')).toBe(true);
    estado.planos[0].itens = estado.planos[0].itens.filter((i) => i.id !== 'local-1');
    expect(cartoes(abaB)).toHaveLength(4); // Alfa, Beta, Chip1 (da hidratação), Delta (local)
    portao.armado = true;

    // O Salvar roda: o PUT cria o item local de verdade e o GET do próprio Salvar fica presa no portão.
    const caixas = cartoes(abaB);
    fireEvent.click(caixas[0]);
    fireEvent.click(caixas[1]);
    fireEvent.click(abaB.q.getByRole('button', { name: /Agendar juntos/ }));
    fireEvent.click(abaB.q.getByText('Em 7 dias'));
    await waitFor(() => expect(portao.n).toBe(1), { timeout: 3000 });
    expect(idsDoServidor()).toHaveLength(4); // PUT já criou Delta de verdade (não é mais local)

    // Um aviso chega agora: a releitura dele dispara outra GET, que não é presa (2a chamada ao portão)
    // e vence a guarda por contagem — o Salvar passa a ficar em desvantagem quando a 1a liberar.
    await planejamentosApi.adicionarItem(PLANO_ID, { catalogoProcedimentoSaudeId: CAT(8), valorOrcado: 100 });
    abaB.avisos.emitirAviso(AVISO.PLANEJAMENTO.ALTERADO, PACIENTE_ID);
    await waitFor(() => expect(portao.n).toBe(2), { timeout: 3000 });
    await esperarAviso();
    expect(temTexto(abaB, 'Gama')).toBe(true); // a releitura (preservarLocais) já aplicou, por último

    // O GET do Salvar (preso, 1a chamada) finalmente responde: por contagem, é descartado (não sobrescreve).
    portao.liberar();
    await assentar(100);

    expect(cartoes(abaB)).toHaveLength(5); // Alfa, Beta, Chip1, Gama, Delta — sem duplicar Delta
    expect(abaB.q.queryAllByText('Delta')).toHaveLength(1);
  });

  // F-h
  it('aviso que relê a mesma lista não refaz o GET de termos; catálogo novo refaz 1x', async () => {
    const abaA = montarAba('A');
    await waitFor(() => expect(cartoes(abaA).length).toBeGreaterThan(0), { timeout: 3000 });
    await assentar(100);
    const termos = () => srv.leituras.filter((l) => l.path.includes('/api/v1/termos/resolucao')).length;
    const listas = () => srv.leituras.filter((l) => l.path.startsWith('/api/v1/planejamentos?')).length;
    const termos0 = termos();
    const listas0 = listas();
    expect(termos0).toBeGreaterThan(0);

    abaA.avisos.emitirAviso(AVISO.PLANEJAMENTO.ALTERADO, PACIENTE_ID);
    await esperarAviso();
    expect(listas()).toBe(listas0 + 1); // releu a lista...
    expect(termos()).toBe(termos0); // ...igual: sem GET de termos

    estado.planos[0].itens.push(item('e0000000-0000-4000-8000-000000000009', CAT(8)));
    abaA.avisos.emitirAviso(AVISO.PLANEJAMENTO.ALTERADO, PACIENTE_ID);
    await esperarAviso();
    expect(listas()).toBe(listas0 + 2);
    expect(termos()).toBe(termos0 + 1);
  });
});
