import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __definirIdDaAbaParaTestes,
  criarLeitorAvisos,
  idDaAba,
  STATUS_LEITOR,
  TEMPOS_PADRAO,
} from './canalAvisos.js';
import {
  criarServidorFalso,
  definirVisibilidade,
  prepararVisibilidade,
  sse,
} from '../../test/servidorAvisosFalso.js';

vi.mock('../api', () => ({
  attemptTokenRefresh: vi.fn(),
  authHeadersForFetch: vi.fn(),
  getFreshToken: vi.fn(),
}));

const passar = (ms = 0) => vi.advanceTimersByTimeAsync(ms);

function montar(servidor, extras = {}) {
  const eventos = { conectado: [], aviso: [], recarregar: [], pendenciaLiberada: [], substituida: 0, status: [] };
  const obterHeaders = vi.fn(async ({ token }) => ({ Authorization: `Bearer ${token ?? 'tok-1'}`, 'X-Org-Id': 'org-1' }));
  const leitor = criarLeitorAvisos({
    orgId: 'org-1',
    url: '/api/v1/eventos/stream',
    fetchImpl: servidor.fetchImpl,
    obterHeaders,
    renovarToken: vi.fn().mockResolvedValue({ tipo: 'ok', token: 'tok-2' }),
    aleatorio: () => 0.5,
    onConectado: (i) => eventos.conectado.push(i),
    onAviso: (a) => eventos.aviso.push(a),
    onRecarregar: (r) => eventos.recarregar.push(r),
    onPendenciaLiberada: (p) => eventos.pendenciaLiberada.push(p),
    onSubstituida: () => {
      eventos.substituida += 1;
    },
    onStatus: (s) => eventos.status.push(s),
    ...extras,
  });
  return { leitor, eventos, obterHeaders };
}

describe('criarLeitorAvisos', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    prepararVisibilidade();
  });

  afterEach(() => {
    vi.useRealTimers();
    __definirIdDaAbaParaTestes(null);
  });

  describe('idDaAba', () => {
    it('é um UUID gerado uma vez por carga e não vai para o sessionStorage/localStorage', () => {
      __definirIdDaAbaParaTestes(null);
      const a = idDaAba();
      expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(idDaAba()).toBe(a);
      expect(Object.keys(sessionStorage)).toHaveLength(0);
      expect(Object.keys(localStorage)).toHaveLength(0);
    });

    it('sem crypto.randomUUID usa o fallback e ainda gera um UUID v4', () => {
      __definirIdDaAbaParaTestes(null);
      const original = globalThis.crypto.randomUUID;
      Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: undefined });
      try {
        expect(idDaAba()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      } finally {
        Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: original });
      }
    });

    it('__definirIdDaAbaParaTestes fixa o id', () => {
      __definirIdDaAbaParaTestes('aba-fixa');
      expect(idDaAba()).toBe('aba-fixa');
    });
  });

  it('manda X-Aba-Id em todo fetch do stream, estável entre reconexões', async () => {
    __definirIdDaAbaParaTestes(null);
    const servidor = criarServidorFalso();
    const { leitor } = montar(servidor);
    leitor.iniciar();
    await passar();
    const esperado = idDaAba();
    expect(servidor.ultima().headers['X-Aba-Id']).toBe(esperado);
    servidor.ultima().enviar(sse.conectado('1'));
    await passar();
    servidor.ultima().fechar();
    await passar(TEMPOS_PADRAO.backoffMs[0]);
    expect(servidor.fetchImpl).toHaveBeenCalledTimes(2);
    expect(servidor.ultima().headers['X-Aba-Id']).toBe(esperado);
    // outro leitor da mesma aba (ex.: troca de clínica) usa o mesmo id
    const segundo = montar(servidor).leitor;
    segundo.iniciar();
    await passar();
    expect(servidor.ultima().headers['X-Aba-Id']).toBe(esperado);
    segundo.parar();
    leitor.parar();
  });

  it('obterIdDaAba injetado substitui o id padrão', async () => {
    const servidor = criarServidorFalso();
    const { leitor } = montar(servidor, { obterIdDaAba: () => 'aba-injetada' });
    leitor.iniciar();
    await passar();
    expect(servidor.ultima().headers['X-Aba-Id']).toBe('aba-injetada');
    leitor.parar();
  });

  it('pendencia-liberada chega ao handler sem mexer em ultimoId nem bloquear avisos', async () => {
    const servidor = criarServidorFalso();
    const { leitor, eventos } = montar(servidor);
    leitor.iniciar();
    await passar();
    const c = servidor.ultima();
    c.enviar(sse.conectado('5'));
    c.enviar('event: pendencia-liberada\ndata: {"atendimentoId":"at-1"}\n\n');
    c.enviar('event: pendencia-liberada\ndata: {"v":1,"atendimentoId":"at-1"}\n\n');
    c.enviar('event: pendencia-liberada\nid: 99\ndata: {"atendimentoId":"at-2"}\n\n');
    c.enviar(sse.aviso('6', 'AGENDA.CRIADO', 'a'));
    await passar();
    expect(eventos.pendenciaLiberada).toEqual([
      { atendimentoId: 'at-1' },
      { atendimentoId: 'at-1' },
      { atendimentoId: 'at-2' },
    ]);
    expect(leitor.ultimoId).toBe('6');
    expect(eventos.aviso.map((a) => a.id)).toEqual(['6']);
    // versão desconhecida é ignorada
    c.enviar('event: pendencia-liberada\ndata: {"v":99,"atendimentoId":"at-3"}\n\n');
    await passar();
    expect(eventos.pendenciaLiberada).toHaveLength(3);
    leitor.parar();
  });

  it('abre com Bearer, X-Org-Id, Accept SSE, credentials omit e sem token na URL', async () => {
    const servidor = criarServidorFalso();
    const { leitor } = montar(servidor);
    leitor.iniciar();
    await passar();
    const [url, init] = servidor.fetchImpl.mock.calls[0];
    expect(url).toBe('/api/v1/eventos/stream');
    expect(url).not.toMatch(/tok/);
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer tok-1',
      'X-Org-Id': 'org-1',
      Accept: 'text/event-stream',
    });
    expect(init.headers['Last-Event-ID']).toBeUndefined();
    expect(init.credentials).toBe('omit');
    leitor.parar();
  });

  it('conectado, recarregar e substituida (com data {"v":1}) chegam aos handlers', async () => {
    const servidor = criarServidorFalso();
    const { leitor, eventos } = montar(servidor);
    leitor.iniciar();
    await passar();
    servidor.ultima().enviar(sse.conectado('5') + sse.recarregar('5') + sse.substituida());
    await passar();
    expect(eventos.conectado).toEqual([{ primeiro: true, id: '5' }]);
    expect(eventos.recarregar).toEqual([{ id: '5' }]);
    expect(eventos.substituida).toBe(1);
    expect(leitor.status).toBe(STATUS_LEITOR.SUBSTITUIDA);
    leitor.parar();
  });

  it('status conectado só depois de event: conectado (200 sem bytes segue conectando)', async () => {
    const servidor = criarServidorFalso();
    const { leitor } = montar(servidor);
    leitor.iniciar();
    await passar(10_000);
    expect(leitor.status).toBe(STATUS_LEITOR.CONECTANDO);
    servidor.ultima().enviar(sse.conectado('1'));
    await passar();
    expect(leitor.status).toBe(STATUS_LEITOR.CONECTADO);
    leitor.parar();
  });

  it('entrega aviso com chunks partidos, comentários e CRLF', async () => {
    const servidor = criarServidorFalso();
    const { leitor, eventos } = montar(servidor);
    leitor.iniciar();
    await passar();
    const c = servidor.ultima();
    c.enviar(sse.conectado('1'));
    const texto = sse.aviso('2', 'AGENDA.CRIADO', 'ag-1', true).replace(/\n/g, '\r\n');
    c.enviar(': hb\r\n\r\n');
    c.enviar(texto.slice(0, 7));
    c.enviar(texto.slice(7, 30));
    c.enviar(texto.slice(30));
    await passar();
    expect(eventos.aviso).toEqual([
      { id: '2', tipo: 'AGENDA.CRIADO', registroId: 'ag-1', atendimentoId: null, porMim: true },
    ]);
    leitor.parar();
  });

  it('ignora id repetido e versão desconhecida', async () => {
    const servidor = criarServidorFalso();
    const { leitor, eventos } = montar(servidor);
    leitor.iniciar();
    await passar();
    const c = servidor.ultima();
    c.enviar(sse.conectado('1'));
    c.enviar(sse.aviso('2', 'AGENDA.CRIADO', 'a'));
    c.enviar(sse.aviso('2', 'AGENDA.CRIADO', 'a'));
    c.enviar('event: aviso\nid: 3\ndata: {"v":2,"tipo":"AGENDA.CRIADO","registroId":"b"}\n\n');
    c.enviar('event: conectado\nid: 9\ndata: {"v":99}\n\n');
    await passar();
    expect(eventos.aviso.map((a) => a.id)).toEqual(['2']);
    expect(eventos.conectado).toHaveLength(1);
    leitor.parar();
  });

  it('reconecta com Last-Event-ID = maior id; conectado/recarregar com id substituem o guardado', async () => {
    const servidor = criarServidorFalso();
    const { leitor } = montar(servidor);
    leitor.iniciar();
    await passar();
    servidor.ultima().enviar(sse.conectado('10') + sse.aviso('12', 'AGENDA.CRIADO') + sse.aviso('11', 'AGENDA.CRIADO'));
    await passar();
    expect(leitor.ultimoId).toBe('12');
    servidor.ultima().fechar();
    await passar(TEMPOS_PADRAO.backoffMs[0]);
    expect(servidor.fetchImpl).toHaveBeenCalledTimes(2);
    expect(servidor.ultima().headers['Last-Event-ID']).toBe('12');

    servidor.ultima().enviar(sse.conectado('40'));
    await passar();
    expect(leitor.ultimoId).toBe('40');
    servidor.ultima().enviar(sse.recarregar('50'));
    await passar();
    expect(leitor.ultimoId).toBe('50');
    leitor.parar();
  });

  it('primeiro: true só no primeiro conectado do leitor; false nas reconexões', async () => {
    const servidor = criarServidorFalso();
    const { leitor, eventos } = montar(servidor);
    leitor.iniciar();
    await passar();
    servidor.ultima().enviar(sse.conectado('1'));
    await passar();
    servidor.ultima().fechar();
    await passar(TEMPOS_PADRAO.backoffMs[0]);
    servidor.ultima().enviar(sse.conectado('2'));
    await passar();
    expect(eventos.conectado.map((c) => c.primeiro)).toEqual([true, false]);
    leitor.parar();
  });

  it('erro de rede usa backoff 1, 2, 5, 10, 30 s (jitter neutro)', async () => {
    const servidor = criarServidorFalso({ responder: () => ({ erro: true }) });
    const { leitor } = montar(servidor);
    leitor.iniciar();
    await passar();
    expect(servidor.fetchImpl).toHaveBeenCalledTimes(1);
    const esperados = [1000, 2000, 5000, 10000, 30000, 30000];
    for (let i = 0; i < esperados.length; i += 1) {
      await passar(esperados[i] - 1);
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(i + 1);
      await passar(1);
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(i + 2);
    }
    expect(leitor.status).toBe(STATUS_LEITOR.ERRO);
    leitor.parar();
  });

  it('jitter varia o atraso dentro de ±20%', async () => {
    const servidor = criarServidorFalso({ responder: () => ({ erro: true }) });
    const { leitor } = montar(servidor, { aleatorio: () => 0 });
    leitor.iniciar();
    await passar();
    await passar(799);
    expect(servidor.fetchImpl).toHaveBeenCalledTimes(1);
    await passar(1);
    expect(servidor.fetchImpl).toHaveBeenCalledTimes(2);
    leitor.parar();
  });

  it('404 entra no backoff', async () => {
    const servidor = criarServidorFalso();
    servidor.responder({ status: 404 });
    const { leitor } = montar(servidor);
    leitor.iniciar();
    await passar();
    expect(leitor.status).toBe(STATUS_LEITOR.ERRO);
    await passar(1000);
    expect(servidor.fetchImpl).toHaveBeenCalledTimes(2);
    leitor.parar();
  });

  it('45 s sem bytes aborta e reconecta; batida mantém viva', async () => {
    const servidor = criarServidorFalso();
    const { leitor } = montar(servidor);
    leitor.iniciar();
    await passar();
    const primeira = servidor.ultima();
    primeira.enviar(sse.conectado('1'));
    await passar(40_000);
    primeira.enviar(sse.batida());
    await passar(40_000);
    expect(primeira.aberta).toBe(true);
    await passar(5_000);
    expect(primeira.aberta).toBe(false);
    expect(leitor.status).toBe(STATUS_LEITOR.ERRO);
    await passar(1000);
    expect(servidor.fetchImpl).toHaveBeenCalledTimes(2);
    leitor.parar();
  });

  it('401 renova o token uma vez e reconecta com o token novo', async () => {
    const servidor = criarServidorFalso();
    servidor.responder({ status: 401 });
    const renovarToken = vi.fn().mockResolvedValue({ tipo: 'ok', token: 'tok-2' });
    const { leitor, obterHeaders } = montar(servidor, { renovarToken });
    leitor.iniciar();
    await passar();
    expect(renovarToken).toHaveBeenCalledTimes(1);
    expect(renovarToken).toHaveBeenCalledWith('tok-1');
    expect(servidor.fetchImpl).toHaveBeenCalledTimes(2);
    expect(obterHeaders).toHaveBeenLastCalledWith({ orgId: 'org-1', token: 'tok-2' });
    expect(servidor.ultima().headers.Authorization).toBe('Bearer tok-2');
    leitor.parar();
  });

  // B-42 FD: antes "renovação falha" (null) → bloqueado. Agora só a falha DEFINITIVA bloqueia (a saída da aba vem
  // do auth:expired que a renovação dispara); falha de rede tem o teste abaixo.
  it('401 seguido de renovação recusada (definitiva) vai para bloqueado sem laço', async () => {
    const servidor = criarServidorFalso({ responder: () => ({ status: 401 }) });
    const renovarToken = vi.fn().mockResolvedValue({ tipo: 'definitiva' });
    const { leitor } = montar(servidor, { renovarToken });
    leitor.iniciar();
    await passar();
    await passar(120_000);
    expect(renovarToken).toHaveBeenCalledTimes(1);
    expect(servidor.fetchImpl).toHaveBeenCalledTimes(1);
    expect(leitor.status).toBe(STATUS_LEITOR.BLOQUEADO);
    leitor.parar();
  });

  it('401 de novo após renovar também bloqueia (sem segunda renovação)', async () => {
    const servidor = criarServidorFalso({ responder: () => ({ status: 401 }) });
    const renovarToken = vi.fn().mockResolvedValue({ tipo: 'ok', token: 'tok-2' });
    const { leitor } = montar(servidor, { renovarToken });
    leitor.iniciar();
    await passar(120_000);
    expect(renovarToken).toHaveBeenCalledTimes(1);
    expect(servidor.fetchImpl).toHaveBeenCalledTimes(2);
    expect(leitor.status).toBe(STATUS_LEITOR.BLOQUEADO);
    leitor.parar();
  });

  it('401 com renovação sem rede → falha de conexão (erro + backoff, nunca bloqueado) e reconecta quando a rede volta', async () => {
    const servidor = criarServidorFalso();
    servidor.responder({ status: 401 });
    servidor.responder({ status: 401 });
    const renovarToken = vi
      .fn()
      .mockResolvedValueOnce({ tipo: 'rede' })
      .mockResolvedValueOnce({ tipo: 'rede' })
      .mockResolvedValueOnce({ tipo: 'ok', token: 'tok-2' });
    const { leitor, eventos } = montar(servidor, { renovarToken });
    leitor.iniciar();
    await passar();
    expect(renovarToken).toHaveBeenCalledTimes(1);
    expect(leitor.status).toBe(STATUS_LEITOR.ERRO);
    expect(eventos.status).not.toContain(STATUS_LEITOR.BLOQUEADO);

    // backoff (1 s): tenta de novo e renova de novo (a renovação anterior não valeu)
    await passar(1000);
    expect(servidor.fetchImpl).toHaveBeenCalledTimes(2);
    expect(renovarToken).toHaveBeenCalledTimes(2);
    expect(leitor.status).toBe(STATUS_LEITOR.ERRO);

    // a rede volta: 'online' reconecta na hora; 401 → renova (ok) → conecta com o token novo
    servidor.responder({ status: 401 });
    window.dispatchEvent(new Event('online'));
    await passar();
    expect(renovarToken).toHaveBeenCalledTimes(3);
    expect(servidor.ultima().headers.Authorization).toBe('Bearer tok-2');
    servidor.ultima().enviar(sse.conectado('1'));
    await passar();
    expect(leitor.status).toBe(STATUS_LEITOR.CONECTADO);
    expect(eventos.status).not.toContain(STATUS_LEITOR.BLOQUEADO);
    leitor.parar();
  });

  it('renovação que rejeita é tratada como falha de rede (nunca bloqueado)', async () => {
    const servidor = criarServidorFalso();
    servidor.responder({ status: 401 });
    const renovarToken = vi.fn().mockRejectedValueOnce(new Error('lock'));
    const { leitor } = montar(servidor, { renovarToken });
    leitor.iniciar();
    await passar();
    expect(leitor.status).toBe(STATUS_LEITOR.ERRO);
    await passar(1000);
    expect(servidor.fetchImpl).toHaveBeenCalledTimes(2);
    leitor.parar();
  });

  it('403 para de reconectar', async () => {
    const servidor = criarServidorFalso({ responder: () => ({ status: 403 }) });
    const { leitor } = montar(servidor);
    leitor.iniciar();
    await passar(120_000);
    expect(servidor.fetchImpl).toHaveBeenCalledTimes(1);
    expect(leitor.status).toBe(STATUS_LEITOR.BLOQUEADO);
    window.dispatchEvent(new Event('online'));
    await passar();
    expect(servidor.fetchImpl).toHaveBeenCalledTimes(1);
    leitor.parar();
  });

  it('503 espera o Retry-After', async () => {
    const servidor = criarServidorFalso();
    servidor.responder({ status: 503, headers: { 'Retry-After': '7' } });
    const { leitor } = montar(servidor);
    leitor.iniciar();
    await passar();
    await passar(6_999);
    expect(servidor.fetchImpl).toHaveBeenCalledTimes(1);
    await passar(1);
    expect(servidor.fetchImpl).toHaveBeenCalledTimes(2);
    leitor.parar();
  });

  it('online reconecta na hora', async () => {
    const servidor = criarServidorFalso();
    servidor.responder({ erro: true });
    servidor.responder({ erro: true });
    const { leitor } = montar(servidor);
    leitor.iniciar();
    await passar(1000);
    expect(servidor.fetchImpl).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new Event('online'));
    await passar();
    expect(servidor.fetchImpl).toHaveBeenCalledTimes(3);
    leitor.parar();
  });

  it('aba oculta por 60 s fecha o stream; visível reconecta com Last-Event-ID', async () => {
    const servidor = criarServidorFalso();
    const { leitor } = montar(servidor);
    leitor.iniciar();
    await passar();
    servidor.ultima().enviar(sse.conectado('8'));
    await passar();
    definirVisibilidade('hidden');
    for (let t = 0; t < 2; t += 1) {
      servidor.ultima().enviar(sse.batida());
      await passar(20_000);
    }
    servidor.ultima().enviar(sse.batida());
    await passar(20_000 - 1);
    expect(servidor.ultima().aberta).toBe(true);
    await passar(1);
    expect(servidor.ultima().aberta).toBe(false);
    expect(leitor.status).toBe(STATUS_LEITOR.OCULTA);
    await passar(120_000);
    expect(servidor.fetchImpl).toHaveBeenCalledTimes(1);

    definirVisibilidade('visible');
    await passar();
    expect(servidor.fetchImpl).toHaveBeenCalledTimes(2);
    expect(servidor.ultima().headers['Last-Event-ID']).toBe('8');
    leitor.parar();
  });

  it('aba oculta por menos de 60 s mantém o stream', async () => {
    const servidor = criarServidorFalso();
    const { leitor } = montar(servidor);
    leitor.iniciar();
    await passar();
    servidor.ultima().enviar(sse.conectado('1'));
    definirVisibilidade('hidden');
    await passar(30_000);
    servidor.ultima().enviar(sse.batida());
    await passar(29_000);
    expect(servidor.ultima().aberta).toBe(true);
    definirVisibilidade('visible');
    await passar(10 * 60_000 - 60_000);
    expect(servidor.fetchImpl.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(leitor.status).not.toBe(STATUS_LEITOR.OCULTA);
    leitor.parar();
  });

  it('substituida não reconecta até focus; depois também volta com visível', async () => {
    const servidor = criarServidorFalso();
    const { leitor } = montar(servidor);
    leitor.iniciar();
    await passar();
    servidor.ultima().enviar(sse.conectado('1') + sse.substituida());
    await passar(120_000);
    expect(servidor.fetchImpl).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('online'));
    await passar();
    expect(servidor.fetchImpl).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('focus'));
    await passar();
    expect(servidor.fetchImpl).toHaveBeenCalledTimes(2);

    servidor.ultima().enviar(sse.conectado('2') + sse.substituida());
    await passar(60_000);
    expect(servidor.fetchImpl).toHaveBeenCalledTimes(2);
    definirVisibilidade('hidden');
    definirVisibilidade('visible');
    await passar();
    expect(servidor.fetchImpl).toHaveBeenCalledTimes(3);
    leitor.parar();
  });

  it('parar aborta o stream e não reconecta', async () => {
    const servidor = criarServidorFalso();
    const { leitor, eventos } = montar(servidor);
    leitor.iniciar();
    await passar();
    leitor.parar();
    expect(servidor.ultima().aberta).toBe(false);
    await passar(120_000);
    expect(servidor.fetchImpl).toHaveBeenCalledTimes(1);
    expect(eventos.status.at(-1)).toBe(STATUS_LEITOR.PARADO);
  });

  describe('reconectar, ociosidade e 503', () => {
    const batidas = async (servidor, ms) => {
      for (let t = 0; t < ms; t += 20_000) {
        servidor.ultima().enviar(sse.batida());
        await passar(20_000);
      }
    };
    const interagir = (tipo = 'pointerdown') => window.dispatchEvent(new Event(tipo));

    it('evento reconectar nunca passa por ERRO e abre nova conexão em até 2 s com o último Last-Event-ID', async () => {
      const servidor = criarServidorFalso();
      const { leitor, eventos } = montar(servidor);
      leitor.iniciar();
      await passar();
      servidor.ultima().enviar(sse.conectado('7') + sse.aviso('9', 'AGENDA.CRIADO', 'a'));
      await passar();
      servidor.ultima().enviar('event: reconectar\ndata: {"v":1}\n\n');
      await passar();
      expect(leitor.status).toBe(STATUS_LEITOR.CONECTANDO);
      expect(servidor.conexoes[0].aberta).toBe(false);
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(1);
      await passar(TEMPOS_PADRAO.reconectarMaxMs);
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(2);
      expect(servidor.ultima().headers['Last-Event-ID']).toBe('9');
      expect(eventos.status).not.toContain(STATUS_LEITOR.ERRO);
      leitor.parar();
    });

    it('leitor bloqueado (403) não reage a 10 min sem interação nem à interação seguinte', async () => {
      const servidor = criarServidorFalso();
      servidor.responder({ status: 403 });
      const { leitor } = montar(servidor);
      leitor.iniciar();
      await passar();
      expect(leitor.status).toBe(STATUS_LEITOR.BLOQUEADO);
      await passar(TEMPOS_PADRAO.ociosoMs + 1000);
      expect(leitor.status).toBe(STATUS_LEITOR.BLOQUEADO);
      interagir();
      await passar(5000);
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(1);
      expect(leitor.status).toBe(STATUS_LEITOR.BLOQUEADO);
      leitor.parar();
    });

    it('10 min sem interação aborta a conexão (OCIOSO); interação reabre com Last-Event-ID', async () => {
      const servidor = criarServidorFalso();
      const { leitor } = montar(servidor);
      leitor.iniciar();
      await passar();
      servidor.ultima().enviar(sse.conectado('4'));
      await passar();
      await batidas(servidor, TEMPOS_PADRAO.ociosoMs - 20_000);
      expect(leitor.status).toBe(STATUS_LEITOR.CONECTADO);
      servidor.ultima().enviar(sse.batida());
      await passar(20_000);
      expect(leitor.status).toBe(STATUS_LEITOR.OCIOSO);
      expect(servidor.conexoes[0].aberta).toBe(false);
      await passar(120_000);
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(1);

      interagir('keydown');
      await passar();
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(2);
      expect(servidor.ultima().headers['Last-Event-ID']).toBe('4');
      leitor.parar();
    });

    it('em OCIOSO, a aba voltar a ficar visível reabre o stream com Last-Event-ID', async () => {
      const servidor = criarServidorFalso();
      const { leitor } = montar(servidor);
      leitor.iniciar();
      await passar();
      servidor.ultima().enviar(sse.conectado('4'));
      await passar();
      await batidas(servidor, TEMPOS_PADRAO.ociosoMs);
      expect(leitor.status).toBe(STATUS_LEITOR.OCIOSO);
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(1);
      definirVisibilidade('hidden');
      definirVisibilidade('visible');
      await passar();
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(2);
      expect(servidor.ultima().headers['Last-Event-ID']).toBe('4');
      leitor.parar();
    });

    it('reconectado após OCIOSO, 10 min sem interação voltam a OCIOSO e abortam a nova conexão', async () => {
      const servidor = criarServidorFalso();
      const { leitor } = montar(servidor);
      leitor.iniciar();
      await passar();
      servidor.ultima().enviar(sse.conectado('4'));
      await passar();
      await batidas(servidor, TEMPOS_PADRAO.ociosoMs);
      expect(leitor.status).toBe(STATUS_LEITOR.OCIOSO);
      definirVisibilidade('hidden');
      definirVisibilidade('visible');
      await passar();
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(2);
      servidor.ultima().enviar(sse.conectado('5'));
      await passar();
      expect(leitor.status).toBe(STATUS_LEITOR.CONECTADO);
      await batidas(servidor, TEMPOS_PADRAO.ociosoMs);
      expect(leitor.status).toBe(STATUS_LEITOR.OCIOSO);
      expect(servidor.conexoes[1].aberta).toBe(false);
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(2);
      leitor.parar();
    });

    it('substituida: 10 min depois o timer de ociosidade não muda o status; wheel não reconecta, focus sim', async () => {
      const servidor = criarServidorFalso();
      const { leitor } = montar(servidor);
      leitor.iniciar();
      await passar();
      servidor.ultima().enviar(sse.conectado('1') + sse.substituida());
      await passar(TEMPOS_PADRAO.ociosoMs + 1000);
      expect(leitor.status).toBe(STATUS_LEITOR.SUBSTITUIDA);
      interagir('wheel');
      await passar(5000);
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(1);
      expect(leitor.status).toBe(STATUS_LEITOR.SUBSTITUIDA);
      window.dispatchEvent(new Event('focus'));
      await passar();
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(2);
      leitor.parar();
    });

    it('parar remove os ouvintes de interação (nem fetch nem timer depois)', async () => {
      const servidor = criarServidorFalso();
      const { leitor } = montar(servidor);
      const espiao = vi.spyOn(window, 'removeEventListener');
      leitor.iniciar();
      await passar();
      leitor.parar();
      for (const tipo of ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll']) {
        expect(espiao.mock.calls.some(([t]) => t === tipo)).toBe(true);
      }
      espiao.mockRestore();
      const antes = vi.getTimerCount();
      ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll'].forEach((t) => interagir(t));
      await passar(TEMPOS_PADRAO.ociosoMs + 1000);
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(antes);
      expect(leitor.status).toBe(STATUS_LEITOR.PARADO);
    });

    it('503 seguidos com Retry-After 30 esperam 30 s, 60 s, 120 s, 240 s e o teto de 300 s', async () => {
      const servidor = criarServidorFalso();
      for (let i = 0; i < 5; i += 1) servidor.responder({ status: 503, headers: { 'Retry-After': '30' } });
      const { leitor } = montar(servidor, { obterOciosoMs: () => 60 * 60_000 });
      leitor.iniciar();
      await passar();
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(1);
      await passar(30_000 - 1);
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(1);
      await passar(1);
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(2);
      await passar(60_000 - 1);
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(2);
      await passar(1);
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(3);
      await passar(120_000 - 1);
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(3);
      await passar(1);
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(4);
      await passar(240_000 - 1);
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(4);
      await passar(1);
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(5);
      await passar(300_000 - 1);
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(5);
      await passar(1);
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(6);
      leitor.parar();
    });

    it('F-q: consulta (ocioso 30 min): reconectar aos 20 min não adia o prazo; OCIOSO aos 30 min desde a interação', async () => {
      const servidor = criarServidorFalso();
      const { leitor } = montar(servidor, { obterOciosoMs: () => 30 * 60_000 });
      leitor.iniciar();
      await passar();
      interagir();
      servidor.ultima().enviar(sse.conectado('1'));
      await passar();
      await batidas(servidor, 20 * 60_000);
      expect(leitor.status).toBe(STATUS_LEITOR.CONECTADO);
      servidor.ultima().enviar('event: reconectar\ndata: {"v":1}\n\n');
      await passar(TEMPOS_PADRAO.reconectarMaxMs);
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(2);
      servidor.ultima().enviar(sse.conectado('2'));
      await passar();
      expect(leitor.status).toBe(STATUS_LEITOR.CONECTADO);
      await batidas(servidor, 9 * 60_000);
      expect(leitor.status).toBe(STATUS_LEITOR.CONECTADO);
      servidor.ultima().enviar(sse.batida());
      await passar(30_000);
      servidor.ultima().enviar(sse.batida());
      await passar(30_000 - TEMPOS_PADRAO.reconectarMaxMs);
      expect(leitor.status).toBe(STATUS_LEITOR.OCIOSO);
      expect(servidor.ultima().aberta).toBe(false);
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(2);
      leitor.parar();
    });

    it('F-r: servidor com erro e aba parada: backoff retenta, aos 10 min OCIOSO e depois nenhum fetch novo', async () => {
      const servidor = criarServidorFalso({ responder: () => ({ erro: true }) });
      const { leitor } = montar(servidor);
      leitor.iniciar();
      await passar(TEMPOS_PADRAO.ociosoMs - 1000);
      expect(servidor.fetchImpl.mock.calls.length).toBeGreaterThan(5);
      expect(leitor.status).not.toBe(STATUS_LEITOR.OCIOSO);
      await passar(1000);
      expect(leitor.status).toBe(STATUS_LEITOR.OCIOSO);
      const antes = servidor.fetchImpl.mock.calls.length;
      await passar(5 * 60_000);
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(antes);
      expect(leitor.status).toBe(STATUS_LEITOR.OCIOSO);
      leitor.parar();
    });

    it('F-s: em OCIOSO o evento online não reconecta; a interação seguinte reconecta', async () => {
      const servidor = criarServidorFalso();
      const { leitor } = montar(servidor);
      leitor.iniciar();
      await passar();
      servidor.ultima().enviar(sse.conectado('4'));
      await passar();
      await batidas(servidor, TEMPOS_PADRAO.ociosoMs);
      expect(leitor.status).toBe(STATUS_LEITOR.OCIOSO);
      window.dispatchEvent(new Event('online'));
      await passar(5000);
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(1);
      expect(leitor.status).toBe(STATUS_LEITOR.OCIOSO);
      interagir();
      await passar();
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(2);
      leitor.parar();
    });

    it('F-u: voltar à aba visível conta como interação: prazo de ociosidade recomeça na volta (9 min + 10 min)', async () => {
      const servidor = criarServidorFalso();
      const { leitor } = montar(servidor);
      leitor.iniciar();
      await passar();
      servidor.ultima().enviar(sse.conectado('1'));
      await passar();
      definirVisibilidade('hidden');
      await batidas(servidor, TEMPOS_PADRAO.ocultaMs);
      expect(leitor.status).toBe(STATUS_LEITOR.OCULTA);
      expect(servidor.conexoes[0].aberta).toBe(false);
      await passar(8 * 60_000);
      definirVisibilidade('visible');
      await passar();
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(2);
      servidor.ultima().enviar(sse.conectado('2'));
      await passar();
      expect(leitor.status).toBe(STATUS_LEITOR.CONECTADO);
      await batidas(servidor, 60_000);
      expect(leitor.status).toBe(STATUS_LEITOR.CONECTADO);
      await batidas(servidor, 8 * 60_000 + 40_000);
      expect(leitor.status).toBe(STATUS_LEITOR.CONECTADO);
      servidor.ultima().enviar(sse.batida());
      await passar(20_000);
      expect(leitor.status).toBe(STATUS_LEITOR.OCIOSO);
      expect(servidor.ultima().aberta).toBe(false);
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(2);
      leitor.parar();
    });

    it('F-v: focus que reconecta de SUBSTITUIDA conta como interação: prazo recomeça no focus (9min30 + 10 min)', async () => {
      const servidor = criarServidorFalso();
      const { leitor } = montar(servidor);
      leitor.iniciar();
      await passar();
      servidor.ultima().enviar(sse.conectado('1'));
      await passar();
      await batidas(servidor, 9 * 60_000);
      servidor.ultima().enviar(sse.substituida());
      await passar();
      expect(leitor.status).toBe(STATUS_LEITOR.SUBSTITUIDA);
      await passar(30_000);
      window.dispatchEvent(new Event('focus'));
      await passar();
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(2);
      servidor.ultima().enviar(sse.conectado('2'));
      await passar();
      expect(leitor.status).toBe(STATUS_LEITOR.CONECTADO);
      await batidas(servidor, 60_000);
      expect(leitor.status).toBe(STATUS_LEITOR.CONECTADO);
      await batidas(servidor, 8 * 60_000 + 40_000);
      expect(leitor.status).toBe(STATUS_LEITOR.CONECTADO);
      servidor.ultima().enviar(sse.batida());
      await passar(20_000);
      expect(leitor.status).toBe(STATUS_LEITOR.OCIOSO);
      expect(servidor.ultima().aberta).toBe(false);
      expect(servidor.fetchImpl).toHaveBeenCalledTimes(2);
      leitor.parar();
    });
  });

  it('sem pingue-pongue com 6 abas contra servidor com limite 5', async () => {
    const LIMITE = 5;
    const abertas = [];
    const servidor = criarServidorFalso({
      responder: () => ({
        status: 200,
        aoAbrir: (c) => {
          abertas.push(c);
          c.enviar(sse.conectado('1'));
          while (abertas.filter((x) => x.aberta).length > LIMITE) {
            const antiga = abertas.find((x) => x.aberta);
            antiga.enviar(sse.substituida());
            antiga.aberta = false;
          }
        },
      }),
    });
    const leitores = Array.from({ length: 6 }, () => montar(servidor).leitor);
    for (const l of leitores) {
      l.iniciar();
      await passar();
    }
    for (let t = 0; t < 15; t += 1) {
      servidor.abertas().forEach((c) => c.enviar(sse.batida()));
      await passar(20_000);
    }
    expect(servidor.fetchImpl).toHaveBeenCalledTimes(6);
    expect(leitores.filter((l) => l.status === STATUS_LEITOR.CONECTADO)).toHaveLength(5);
    expect(leitores.filter((l) => l.status === STATUS_LEITOR.SUBSTITUIDA)).toHaveLength(1);
    leitores.forEach((l) => l.parar());
  });
});
