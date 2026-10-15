/**
 * F3 (testador independente): faixa "Procedimento bloqueado até a assinatura" POR ITEM, no AppRefactored real.
 * Item A (CATALOGO_1) exige TERMO_1; item B (CATALOGO_2) não exige nada. A resolução é respondida por catálogo.
 * Também a prova do índice ativo: a mescla reordena as linhas e o item ativo continua o mesmo itemId.
 */
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS, agendaDto } from '../encerrar/cenariosEncerrar.js';
import { limparMidia } from '../encerrar/ambienteMidia.js';
import { avisos } from '../consulta/canalAvisosTeste.jsx';
import {
  ATENDIMENTO_ID,
  TIMEOUT,
  assentarMuito,
  consultaDto,
  clicarBotao,
  montarApp,
  resumoDto,
} from '../consulta/appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());

const FAIXA = /Procedimento bloqueado até a assinatura de/;
const TITULO_A = 'Termo exclusivo do item A';

const itemDto = (id, ordem, catalogoId, nome) => ({
  id,
  ordem,
  agendaId: null,
  agendaTipoProcedimentoCodigo: null,
  agendaProcedimentoFeitoOrigemId: null,
  catalogoProcedimentoSaudeId: catalogoId,
  procedimentoNome: nome,
  planejamentoItemId: null,
  nomeLivre: null,
  observacaoExecucao: null,
  orientacoes: null,
});
const ITEM_A = itemDto('i-a', 0, IDS.CATALOGO_1, 'Toxina botulínica');
const ITEM_B = itemDto('i-b', 1, IDS.CATALOGO_2, 'Preenchimento labial');
const linhaTermo = (extras) => ({
  termoId: IDS.TERMO_1,
  titulo: TITULO_A,
  ordem: 0,
  lido: true,
  lidoEm: '2026-10-06T12:40:00Z',
  escolhido: true,
  termoAssinaturaId: null,
  statusAssinatura: null,
  ...extras,
});

/** O estado do servidor falso fica no teste: `dto` e `resolucao` (por catálogo) mudam no meio do caso. */
async function montar({ termos = [], itens = [ITEM_A, ITEM_B], resolucaoFalha = false, modulo = 'procedimento' } = {}) {
  const estado = {
    dto: consultaDto({ agendaPrincipalId: IDS.AGENDA_1, modulo, itens, termos }),
    resolucaoFalha,
    resolucoes: [],
  };
  const srv = await montarApp({
    agendas: [agendaDto({ id: IDS.AGENDA_1 })],
    rotas: [
      ['POST', /^\/api\/v1\/atendimentos$/, () => estado.dto],
      ['GET', /^\/api\/v1\/atendimentos\/minhas$/, () => [resumoDto(estado.dto)]],
      ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => estado.dto],
      ['GET', /^\/api\/v1\/termos\/resolucao$/, ({ query }) => {
        estado.resolucoes.push(query);
        if (estado.resolucaoFalha) return { status: 500, corpo: { title: 'erro', status: 500 } };
        const eh = (cat) => query.includes(cat);
        if (eh(IDS.CATALOGO_1)) {
          return {
            faltantes: [{ termoId: IDS.TERMO_1, titulo: TITULO_A }],
            termosExigidos: [{ termoId: IDS.TERMO_1, titulo: TITULO_A, vigente: false }],
            procedimentosSemVinculo: [],
          };
        }
        return { faltantes: [], termosExigidos: [], procedimentosSemVinculo: [] };
      }],
    ],
  });
  // Reentrada no módulo gravado no servidor (modulo = 'procedimento'): o gate do hub não participa.
  await assentarMuito();
  clicarBotao('Voltar à consulta de Maria Souza');
  await assentarMuito(6);
  return { srv, estado };
}

const aba = (n) => screen.getAllByRole('button').find((b) => new RegExp(`^${n}\\.`).test((b.textContent || '').trim()));
async function irParaAba(n) {
  const b = aba(n);
  if (!b) throw new Error(`aba ${n} não encontrada`);
  fireEvent.click(b);
  await assentarMuito();
}
const faixa = () => screen.queryByText(FAIXA);
async function releitura() {
  act(() => {
    avisos.emitirAviso('ATENDIMENTO.SESSAO_ALTERADA', ATENDIMENTO_ID, { atendimentoId: ATENDIMENTO_ID });
  });
  await assentarMuito(6);
}

describe('faixa de termos por item (F3), AppRefactored real', () => {
  afterEach(() => {
    limparMidia();
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('A exige termo e B não: a faixa aparece só na aba do A e traz o título do termo', async () => {
    await montar({ termos: [linhaTermo({})] });
    expect(aba(1)).toBeTruthy();
    expect(aba(2)).toBeTruthy();
    expect(faixa()).toBeTruthy();
    expect(screen.getByText(new RegExp(TITULO_A))).toBeTruthy();

    await irParaAba(2);
    expect(faixa()).toBeNull();

    await irParaAba(1);
    expect(faixa()).toBeTruthy();
  }, TIMEOUT);

  it('assina em outra aba (aviso + releitura ASSINADO): a faixa do A some, mesmo com a resolução ainda velha', async () => {
    const { estado } = await montar({ termos: [linhaTermo({})] });
    expect(faixa()).toBeTruthy();
    estado.dto = {
      ...estado.dto,
      termos: [linhaTermo({ termoAssinaturaId: 'as-1', statusAssinatura: 'ASSINADO' })],
    };
    await releitura();
    expect(faixa()).toBeNull();
  }, TIMEOUT);

  it('termo PENDENTE continua bloqueando depois de uma releitura', async () => {
    const { estado } = await montar({ termos: [linhaTermo({})] });
    estado.dto = { ...estado.dto, termos: [linhaTermo({ statusAssinatura: 'PENDENTE', termoAssinaturaId: 'as-9' })] };
    await releitura();
    expect(faixa()).toBeTruthy();
  }, TIMEOUT);

  it('termo RECUSADO continua bloqueando', async () => {
    const { estado } = await montar({ termos: [linhaTermo({})] });
    estado.dto = { ...estado.dto, termos: [linhaTermo({ statusAssinatura: 'RECUSADO', termoAssinaturaId: 'as-8' })] };
    await releitura();
    expect(faixa()).toBeTruthy();
  }, TIMEOUT);

  it('sem HUB_TERMOS_VER (termos: []): vale o piso do servidor e a faixa aparece', async () => {
    await montar({ termos: [] });
    expect(faixa()).toBeTruthy();
    await irParaAba(2);
    expect(faixa()).toBeNull();
  }, TIMEOUT);

  it('a rede da resolução falha: não bloqueia (nenhuma faixa em nenhum item)', async () => {
    const { estado } = await montar({ termos: [linhaTermo({})], resolucaoFalha: true });
    expect(estado.resolucoes.length).toBeGreaterThan(0);
    expect(faixa()).toBeNull();
    await irParaAba(2);
    expect(faixa()).toBeNull();
  }, TIMEOUT);
});

describe('índice ativo ao reordenar por mudança remota (F3)', () => {
  afterEach(() => {
    limparMidia();
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  /** Servidor passa a ordenar B antes de A (outra aba reordenou) e envia o aviso. */
  async function inverterNoServidor(estado) {
    estado.dto = {
      ...estado.dto,
      itens: [
        { ...ITEM_B, ordem: 0 },
        { ...ITEM_A, ordem: 1 },
      ],
    };
    await releitura();
  }

  it('usuário na aba do A (1º): depois de B passar para a frente, o ativo continua A (agora 2º) e a faixa do A segue', async () => {
    const { estado } = await montar({ termos: [linhaTermo({})] });
    expect(faixa()).toBeTruthy();
    await inverterNoServidor(estado);

    const abas = screen.getAllByRole('button').map((b) => (b.textContent || '').trim());
    expect(abas.some((t) => /^1\. Preenchimento labial/.test(t))).toBe(true);
    expect(abas.some((t) => /^2\. Toxina botulínica/.test(t))).toBe(true);
    // O item ativo é o A: a faixa do A continua e a aba "2. Toxina" está marcada como ativa.
    expect(faixa()).toBeTruthy();
    expect(aba(2).className).toMatch(/text-\[#00a88e\]/);
    expect(aba(1).className).not.toMatch(/border-\[#00a88e\]/);
  }, TIMEOUT);

  it('usuário na aba do B (2º): depois de B passar para a frente, o ativo continua B (agora 1º) e não há faixa', async () => {
    const { estado } = await montar({ termos: [linhaTermo({})] });
    await irParaAba(2);
    expect(faixa()).toBeNull();
    await inverterNoServidor(estado);
    expect(aba(1).textContent).toMatch(/Preenchimento labial/);
    expect(faixa()).toBeNull();
    expect(aba(1).className).toMatch(/border-\[#00a88e\]/);
  }, TIMEOUT);

  it('usuário que troca de aba depois da reordenação não é arrastado de volta', async () => {
    const { estado } = await montar({ termos: [linhaTermo({})] });
    await inverterNoServidor(estado);
    // ativo = A (2º). O usuário clica na 1ª (agora B): fica nela.
    await irParaAba(1);
    expect(aba(1).className).toMatch(/border-\[#00a88e\]/);
    expect(faixa()).toBeNull();
    // Outra releitura sem mudança de ordem não o move.
    await releitura();
    expect(aba(1).className).toMatch(/border-\[#00a88e\]/);
    expect(faixa()).toBeNull();
  }, TIMEOUT);
});
