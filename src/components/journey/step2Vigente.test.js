import {
  escolherPreenchimentoDaFicha,
  historicoTimestamp,
  isPreenchimentoEmBrancoDoPaciente,
  resolveFichaTemplateIdFromEntry,
  resolveStatusCodigo,
  resumirPreenchimentosPorFicha,
} from './step2Vigente.js';

const FICHA = 'f1';
const OUTRA_FICHA = 'f2';
const fichas = [
  { id: FICHA, nome: 'Estética' },
  { id: OUTRA_FICHA, nome: 'Odontologia' },
];

const A = (over = {}) => ({
  id: 'A',
  anamneseId: FICHA,
  status: 'finalizada',
  preenchidoPorPaciente: false,
  quantidadeRespostas: 12,
  assinaturaPaciente: 'data:image/png;base64,xx',
  dataHora: '2026-08-01T10:00:00Z',
  ...over,
});

const B = (over = {}) => ({
  id: 'B',
  anamneseId: FICHA,
  status: 'aguardando_paciente',
  preenchidoPorPaciente: true,
  quantidadeRespostas: 0,
  dataHora: '2026-09-01T10:00:00Z',
  ...over,
});

const vigente = (lista) => resumirPreenchimentosPorFicha(lista, fichas)[0]?.ultimo ?? null;

/** Algoritmo atual do Step2 (antes da regra A2), para comparar a cópia. */
function resumoLegado(lista, fichasLista) {
  if (!Array.isArray(lista) || lista.length === 0) return [];
  const ultimoPorFicha = new Map();
  for (const h of lista) {
    const fid = resolveFichaTemplateIdFromEntry(h);
    if (!fid) continue;
    const prev = ultimoPorFicha.get(fid);
    if (!prev || historicoTimestamp(h) >= historicoTimestamp(prev)) ultimoPorFicha.set(fid, h);
  }
  const rows = Array.from(ultimoPorFicha.entries()).map(([fichaId, ultimo]) => {
    const f = fichasLista.find((x) => String(x.id) === fichaId);
    const nome = f?.nome ?? ultimo.anamneseNome ?? ultimo.fichaNome ?? ultimo.nomeFicha ?? ultimo.nome ?? 'Ficha de anamnese';
    const dataHora = ultimo.dataHora ?? ultimo.dataPreenchimento ?? ultimo.createdAt ?? ultimo.dataCriacao ?? null;
    return { fichaId, nome, dataHora, ultimo };
  });
  rows.sort((a, b) => historicoTimestamp(b.ultimo) - historicoTimestamp(a.ultimo));
  return rows;
}

describe('resumirPreenchimentosPorFicha — matriz do vigente (A2)', () => {
  it('a) só A: vigente é A', () => {
    expect(vigente([A()])?.id).toBe('A');
  });

  it('b) A + B pendente: vigente é A', () => {
    expect(vigente([B(), A()])?.id).toBe('A');
  });

  it('c) A + B cancelado: vigente é A', () => {
    expect(vigente([B({ status: 'cancelada' }), A()])?.id).toBe('A');
  });

  it.each(['aguardando_paciente', 'cancelada'])('d) A + B expirado (%s): vigente é A', (status) => {
    expect(vigente([B({ status }), A()])?.id).toBe('A');
  });

  it('e) A + B recusado (cancelada): vigente é A', () => {
    expect(vigente([B({ status: { codigo: 'cancelada' } }), A()])?.id).toBe('A');
  });

  it('f) A vencida (8 meses) + B pendente: vigente é a vencida', () => {
    const oitoMeses = new Date(Date.now() - 8 * 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(vigente([B({ dataHora: new Date().toISOString() }), A({ dataHora: oitoMeses })])?.id).toBe('A');
  });

  it('g) A + três B (um de outra ficha): só a linha de A', () => {
    const rows = resumirPreenchimentosPorFicha(
      [
        B({ id: 'B1' }),
        B({ id: 'B2', status: 'cancelada' }),
        B({ id: 'B3', status: 'cancelada', anamneseId: OUTRA_FICHA }),
        A(),
      ],
      fichas,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].ultimo.id).toBe('A');
    expect(rows[0].nome).toBe('Estética');
  });

  it('h) só B (dois): resultado vazio e vigente null', () => {
    const lista = [B({ id: 'B1' }), B({ id: 'B2', status: 'cancelada' })];
    expect(resumirPreenchimentosPorFicha(lista, fichas)).toEqual([]);
    expect(vigente(lista)).toBeNull();
  });

  it('i) B concluído (finalizada, 7 respostas) mais novo que A: vira o vigente', () => {
    expect(vigente([B({ id: 'Bok', status: 'finalizada', quantidadeRespostas: 7 }), A()])?.id).toBe('Bok');
  });

  it('j) do paciente, aguardando_paciente com 3 respostas: mantido e vigente', () => {
    expect(vigente([B({ id: 'Bparcial', quantidadeRespostas: 3 }), A()])?.id).toBe('Bparcial');
  });

  it.each([
    ['rascunho', 0],
    ['rascunho', 5],
    ['cancelada', 0],
    ['cancelada', 5],
  ])('k) rascunho do profissional (%s, %i respostas): mantido e vigente', (status, q) => {
    const rascunho = B({ id: 'R', preenchidoPorPaciente: false, status, quantidadeRespostas: q });
    expect(vigente([rascunho, A()])?.id).toBe('R');
  });

  it('l) hub aguardando_assinatura mais novo que A: vira o vigente', () => {
    const hub = B({ id: 'H', preenchidoPorPaciente: false, status: 'aguardando_assinatura', quantidadeRespostas: 4 });
    expect(vigente([hub, A()])?.id).toBe('H');
  });

  it.each([
    ['ausente', {}],
    ['null', { quantidadeRespostas: null }],
    ['"0"', { quantidadeRespostas: '0' }],
    ['NaN', { quantidadeRespostas: Number.NaN }],
  ])('m) fallback com quantidadeRespostas %s: nada escondido', (_rotulo, extra) => {
    const b = B({ status: 'cancelada', ...extra });
    if (!('quantidadeRespostas' in extra)) delete b.quantidadeRespostas;
    expect(isPreenchimentoEmBrancoDoPaciente(b)).toBe(false);
    expect(vigente([b, A()])?.id).toBe('B');
  });

  it.each([[[]], [null], [undefined]])('n) lista %p: resultado vazio', (lista) => {
    expect(resumirPreenchimentosPorFicha(lista, fichas)).toEqual([]);
  });

  describe('o) empate de data/hora', () => {
    const mesmo = '2026-08-01T10:00:00Z';

    it('mesma ficha: vence o que vem depois na lista (>=)', () => {
      const lista = [A({ id: 'A1', dataHora: mesmo }), A({ id: 'A2', dataHora: mesmo })];
      expect(vigente(lista)?.id).toBe('A2');
    });

    it('fichas diferentes: ordem de primeira aparição (sort estável)', () => {
      const lista = [
        A({ id: 'X', anamneseId: OUTRA_FICHA, dataHora: mesmo }),
        A({ id: 'Y', dataHora: mesmo }),
      ];
      expect(resumirPreenchimentosPorFicha(lista, fichas).map((r) => r.ultimo.id)).toEqual(['X', 'Y']);
    });

    it('A e B com o mesmo dataHora: B sai e o vigente é A', () => {
      expect(vigente([A({ dataHora: mesmo }), B({ dataHora: mesmo })])?.id).toBe('A');
    });

    it('escolherPreenchimentoDaFicha com dois mantidos empatados: o primeiro na ordem da API', () => {
      const lista = [A({ id: 'A1', dataHora: mesmo }), A({ id: 'A2', dataHora: mesmo })];
      expect(escolherPreenchimentoDaFicha(lista, FICHA)?.id).toBe('A1');
    });
  });
});

describe('complementares', () => {
  it('status Finalizada (maiúscula) com 0 respostas não é em branco', () => {
    expect(isPreenchimentoEmBrancoDoPaciente(B({ status: 'Finalizada' }))).toBe(false);
  });

  it('isPreenchimentoEmBrancoDoPaciente: B é em branco; null/undefined não', () => {
    expect(isPreenchimentoEmBrancoDoPaciente(B())).toBe(true);
    expect(isPreenchimentoEmBrancoDoPaciente(null)).toBe(false);
    expect(isPreenchimentoEmBrancoDoPaciente(undefined)).toBe(false);
  });

  it('escolherPreenchimentoDaFicha com A + B na mesma ficha devolve A', () => {
    expect(escolherPreenchimentoDaFicha([B(), A()], FICHA)?.id).toBe('A');
  });

  it('escolherPreenchimentoDaFicha sem candidatos devolve undefined', () => {
    expect(escolherPreenchimentoDaFicha([B()], FICHA)).toBeUndefined();
    expect(escolherPreenchimentoDaFicha(null, FICHA)).toBeUndefined();
  });

  it('resolveStatusCodigo aceita texto, objeto e statusCodigo', () => {
    expect(resolveStatusCodigo({ status: 'finalizada' })).toBe('finalizada');
    expect(resolveStatusCodigo({ status: { codigo: 'cancelada' } })).toBe('cancelada');
    expect(resolveStatusCodigo({ statusCodigo: 'rascunho' })).toBe('rascunho');
    expect(resolveStatusCodigo(null)).toBe('');
  });

  it('lista sem itens em branco: mesmo resultado do algoritmo atual', () => {
    const lista = [
      A({ id: 'A1', dataHora: '2026-01-01T10:00:00Z' }),
      A({ id: 'A2', dataHora: '2026-03-01T10:00:00Z' }),
      A({ id: 'O1', anamneseId: OUTRA_FICHA, dataHora: '2026-02-01T10:00:00Z' }),
      { id: 'semFicha', dataHora: '2026-05-01T10:00:00Z' },
      { id: 'N1', fichaId: 'f3', nomeFicha: 'Capilar', dataPreenchimento: '2026-04-01T10:00:00Z' },
    ];
    const novo = resumirPreenchimentosPorFicha(lista, fichas);
    const legado = resumoLegado(lista, fichas);
    expect(novo.map((r) => [r.ultimo.id, r.nome, r.fichaId])).toEqual(
      legado.map((r) => [r.ultimo.id, r.nome, r.fichaId]),
    );
    expect(novo.map((r) => r.ultimo.id)).toEqual(['N1', 'A2', 'O1']);
  });
});
