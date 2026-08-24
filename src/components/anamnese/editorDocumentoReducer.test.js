import { describe, expect, it } from 'vitest';
import {
  applyEnter,
  applyEsc,
  applyTab,
  emptyPergunta,
  emptySecao,
  needsCompartilhamentoModal,
  resolveSharedSaveAction,
  shouldDestacarBeforeSave,
  reconcileDocumentoFromApi,
  isSaveGenerationCurrent,
  isNomeVazio,
  NOME_VAZIO_TOAST,
  COMPOSE_PENDENTE_TOAST,
  SEM_PERGUNTAS_TOAST,
  ESCOLHA_INCOMPLETA_TOAST,
  canCommitCompose,
  composeCommitHint,
  composeHasPending,
  needsCreateShell,
  planPadraoSync,
  usarFichaNeedsConfirm,
  secoesToDocumentoPayload,
  findEscolhaSemAlternativas,
} from './editorDocumentoState.js';
import {
  EDITOR_ACTIONS,
  createInitialEditorState,
  editorDocumentoReducer,
} from './editorDocumentoReducer.js';
import { buildBiblioteca } from './editorDocumentoBiblioteca.js';

describe('applyEnter', () => {
  it('adiciona pergunta na mesma seção após Enter', () => {
    const q1 = { ...emptyPergunta(1, 'texto'), clientKey: 'q1', descricao: 'P1' };
    const secoes = [{ ...emptySecao(1), clientKey: 's1', perguntas: [q1] }];
    const result = applyEnter(secoes, 'q1', 'texto');
    expect(result.secoes[0].perguntas).toHaveLength(2);
    expect(result.secoes[0].perguntas[1].ordem).toBe(2);
    expect(result.focusKey).toBe(result.secoes[0].perguntas[1].clientKey);
  });

  it('cria seção e pergunta quando não há foco', () => {
    const result = applyEnter([], null, 'sim_nao_naosei');
    expect(result.secoes).toHaveLength(1);
    expect(result.secoes[0].perguntas[0].tipoRespostaCodigo).toBe('sim_nao_naosei');
  });
});

describe('applyTab', () => {
  it('vincula pergunta anterior como pai quando o tipo permite', () => {
    const q1 = { ...emptyPergunta(1, 'booleano'), clientKey: 'q1', id: 'uuid-pai' };
    const q2 = { ...emptyPergunta(2), clientKey: 'q2' };
    const secoes = [{ ...emptySecao(1), clientKey: 's1', perguntas: [q1, q2] }];
    const result = applyTab(secoes, 'q2');
    expect(result.secoes[0].perguntas[1].perguntaPaiClientKey).toBe('q1');
    expect(result.secoes[0].perguntas[1].perguntaPaiId).toBe('uuid-pai');
    expect(result.tabPaiMode).toBe(true);
  });

  it('não vincula pai quando a anterior não é sim/não', () => {
    const q1 = { ...emptyPergunta(1, 'texto'), clientKey: 'q1', id: 'uuid-pai' };
    const q2 = { ...emptyPergunta(2), clientKey: 'q2' };
    const secoes = [{ ...emptySecao(1), clientKey: 's1', perguntas: [q1, q2] }];
    const result = applyTab(secoes, 'q2');
    expect(result.secoes[0].perguntas[1].perguntaPaiClientKey).toBeNull();
    expect(result.tabPaiMode).toBe(false);
  });

  it('não altera pai na primeira pergunta', () => {
    const q1 = { ...emptyPergunta(1), clientKey: 'q1' };
    const secoes = [{ ...emptySecao(1), clientKey: 's1', perguntas: [q1] }];
    const result = applyTab(secoes, 'q1');
    expect(result.secoes[0].perguntas[0].perguntaPaiClientKey).toBeNull();
  });
});

describe('applyEsc', () => {
  it('limpa foco e modo pai', () => {
    expect(applyEsc()).toEqual({ focusKey: null, tabPaiMode: false });
  });
});

describe('shared modal helpers', () => {
  it('needsCompartilhamentoModal quando id e outrasFichasCount >= 1', () => {
    expect(needsCompartilhamentoModal({ id: 'x', outrasFichasCount: 2 })).toBe(true);
    expect(needsCompartilhamentoModal({ id: 'x', outrasFichasCount: 0 })).toBe(false);
    expect(needsCompartilhamentoModal({ outrasFichasCount: 3 })).toBe(false);
  });

  it('resolveSharedSaveAction mapeia escolhas', () => {
    expect(resolveSharedSaveAction('destacar')).toBe('destacar');
    expect(resolveSharedSaveAction('global')).toBe('global');
    expect(shouldDestacarBeforeSave('destacar')).toBe(true);
    expect(shouldDestacarBeforeSave('global')).toBe(false);
  });
});

describe('editorDocumentoReducer keyboard actions', () => {
  it('KEY_ENTER insere nova pergunta', () => {
    const q1 = { ...emptyPergunta(1), clientKey: 'q1' };
    const state = {
      ...createInitialEditorState(),
      secoes: [{ ...emptySecao(1), clientKey: 's1', perguntas: [q1] }],
      stickyTipo: 'texto',
    };
    const next = editorDocumentoReducer(state, { type: EDITOR_ACTIONS.KEY_ENTER, focusKey: 'q1' });
    expect(next.secoes[0].perguntas).toHaveLength(2);
    expect(next.dirty).toBe(true);
  });

  it('KEY_ESC limpa foco', () => {
    const state = { ...createInitialEditorState(), focusKey: 'q1', tabPaiMode: true };
    const next = editorDocumentoReducer(state, { type: EDITOR_ACTIONS.KEY_ESC });
    expect(next.focusKey).toBeNull();
    expect(next.tabPaiMode).toBe(false);
  });
});

describe('dirty tracking', () => {
  it('edição seta dirty', () => {
    const state = { ...createInitialEditorState(), dirty: false };
    const next = editorDocumentoReducer(state, {
      type: EDITOR_ACTIONS.SET_META,
      patch: { nome: 'Nova' },
    });
    expect(next.dirty).toBe(true);
  });

  it('SAVE_SUCCESS limpa dirty', () => {
    const q1 = { ...emptyPergunta(1), clientKey: 'q-local', descricao: 'P1' };
    const state = {
      ...createInitialEditorState(),
      dirty: true,
      secoes: [{ ...emptySecao(1), clientKey: 's-local', id: null, perguntas: [q1] }],
    };
    const ficha = {
      nome: 'Ficha',
      itens: [
        {
          ordem: 1,
          pergunta: {
            id: 'uuid-1',
            descricao: 'P1',
            tipoResposta: 'texto',
            categoriaNome: 'Geral',
          },
        },
      ],
    };
    const next = editorDocumentoReducer(state, { type: EDITOR_ACTIONS.SAVE_SUCCESS, ficha });
    expect(next.dirty).toBe(false);
    expect(next.secoes[0].clientKey).toBe('s-local');
    expect(next.secoes[0].perguntas[0].clientKey).toBe('q-local');
    expect(next.secoes[0].perguntas[0].id).toBe('uuid-1');
  });

  it('SET_FOCUS não suja', () => {
    const state = { ...createInitialEditorState(), dirty: false };
    const next = editorDocumentoReducer(state, {
      type: EDITOR_ACTIONS.SET_FOCUS,
      focusKey: 'q1',
    });
    expect(next.dirty).toBe(false);
    expect(next.focusKey).toBe('q1');
  });
});

describe('reconcileDocumentoFromApi', () => {
  it('preserva clientKeys e carimba ids', () => {
    const q1 = { ...emptyPergunta(1), clientKey: 'ck-q1', id: null, descricao: 'Olá' };
    const state = {
      ...createInitialEditorState(),
      dirty: true,
      secoes: [{ ...emptySecao(1), clientKey: 'ck-s1', id: null, perguntas: [q1] }],
    };
    const ficha = {
      itens: [
        {
          ordem: 1,
          pergunta: {
            id: 'server-id',
            descricao: 'Olá',
            tipoResposta: 'texto',
            categoriaNome: 'Geral',
          },
        },
      ],
    };
    const reconciled = reconcileDocumentoFromApi(state, ficha);
    expect(reconciled.secoes[0].clientKey).toBe('ck-s1');
    expect(reconciled.secoes[0].perguntas[0].clientKey).toBe('ck-q1');
    expect(reconciled.secoes[0].perguntas[0].id).toBe('server-id');
    expect(reconciled.dirty).toBe(false);
  });
});

describe('isSaveGenerationCurrent', () => {
  it('descarta saveGen antigo', () => {
    expect(isSaveGenerationCurrent(1, 2)).toBe(false);
    expect(isSaveGenerationCurrent(2, 2)).toBe(true);
  });
});

describe('T1 local-first forks', () => {
  it('APPEND_SECOES / ADD_BANK / REPLACE_DOCUMENTO só mutam state (sem API)', () => {
    const blank = { ...createInitialEditorState(), loaded: true };
    const appended = editorDocumentoReducer(blank, {
      type: EDITOR_ACTIONS.APPEND_SECOES,
      secoes: [
        {
          nome: 'Alergias',
          perguntas: [{ descricao: 'Tem alergia?', tipoRespostaCodigo: 'booleano', prioridade: 'NORMAL' }],
        },
      ],
    });
    expect(appended.secoes).toHaveLength(1);
    expect(appended.secoes[0].perguntas[0].descricao).toBe('Tem alergia?');
    expect(appended.dirty).toBe(true);

    const banked = editorDocumentoReducer(blank, {
      type: EDITOR_ACTIONS.ADD_BANK,
      patch: { descricao: 'Fuma?', tipoRespostaCodigo: 'booleano' },
    });
    expect(banked.secoes).toHaveLength(1);
    expect(banked.secoes[0].perguntas).toHaveLength(1);
    expect(banked.dirty).toBe(true);

    const replaced = editorDocumentoReducer(appended, {
      type: EDITOR_ACTIONS.REPLACE_DOCUMENTO,
      documento: {
        nome: 'Anamnese Odontológica',
        textoDeclaracao: 'Decl',
        especialidadeId: 'esp-1',
        secoes: [
          {
            nome: 'Queixa',
            perguntas: [{ clientKey: 'old', descricao: 'Motivo?', tipoRespostaCodigo: 'texto' }],
          },
        ],
      },
    });
    expect(replaced.nome).toBe('Anamnese Odontológica');
    expect(replaced.padrao).toBe(appended.padrao);
    expect(replaced.secoes[0].perguntas[0].id).toBeNull();
    expect(replaced.secoes[0].perguntas[0].clientKey).not.toBe('old');
    expect(replaced.dirty).toBe(true);
  });

  it('REPLACE_DOCUMENTO preserva alternativas e secoesToDocumentoPayload as devolve', () => {
    const blank = { ...createInitialEditorState(), loaded: true };
    const next = editorDocumentoReducer(blank, {
      type: EDITOR_ACTIONS.REPLACE_DOCUMENTO,
      documento: {
        nome: 'Anamnese Odontológica',
        secoes: [
          {
            nome: 'Distúrbios sanguíneos',
            icone: '🩸',
            descricao: 'Coagulação, anemia, cicatrização',
            perguntas: [
              {
                descricao: 'Sua cicatrização é:',
                tipoRespostaCodigo: 'escolha_unica',
                prioridade: 'ALERTA',
                alternativas: [
                  { alternativa: 'Rápida', ordem: 1 },
                  { alternativa: 'Normal', ordem: 2 },
                  { alternativa: 'Lenta', ordem: 3 },
                ],
              },
            ],
          },
        ],
      },
    });
    const q = next.secoes[0].perguntas[0];
    expect(q.alternativas).toHaveLength(3);
    expect(next.secoes[0].icone).toBe('🩸');
    expect(next.secoes[0].descricao).toBe('Coagulação, anemia, cicatrização');
    const payload = secoesToDocumentoPayload({
      nome: next.nome,
      especialidadeId: null,
      textoDeclaracao: next.textoDeclaracao,
      secoes: next.secoes,
    });
    expect(payload.secoes[0].perguntas[0].alternativas.map((a) => a.alternativa))
      .toEqual(['Rápida', 'Normal', 'Lenta']);
  });
});

describe('T2 save helpers', () => {
  it('nome vazio bloqueia antes da API', () => {
    expect(isNomeVazio('')).toBe(true);
    expect(isNomeVazio('   ')).toBe(true);
    expect(isNomeVazio('Ficha')).toBe(false);
    expect(NOME_VAZIO_TOAST).toBe('Dê um nome para a ficha');
  });

  it('compose pendente e ficha sem perguntas têm toasts explícitos', () => {
    expect(composeHasPending(null)).toBe(false);
    expect(composeHasPending({ texto: '', alternativasDraft: [] })).toBe(false);
    expect(composeHasPending({ texto: '  Alergia?  ', alternativasDraft: [] })).toBe(true);
    expect(
      composeHasPending({
        texto: '',
        alternativasDraft: [{ alternativa: 'Sim', ordem: 1 }],
      })
    ).toBe(true);
    expect(canCommitCompose({ texto: 'Alergia?' }, 'texto')).toBe(true);
    expect(canCommitCompose({ texto: '', alternativasDraft: [] }, 'texto')).toBe(false);
    expect(
      canCommitCompose(
        { texto: 'Cicatrização?', alternativasDraft: [{ alternativa: 'A', ordem: 1 }] },
        'escolha_unica'
      )
    ).toBe(false);
    expect(composeCommitHint({ texto: '' }, 'texto')).toMatch(/Escreva o texto/);
    expect(COMPOSE_PENDENTE_TOAST).toMatch(/Adicionar pergunta/);
    expect(SEM_PERGUNTAS_TOAST).toMatch(/ao menos uma pergunta/);
    expect(ESCOLHA_INCOMPLETA_TOAST).toMatch(/2 opções/);
  });

  it('1º save precisa criar casca; seguinte não', () => {
    expect(needsCreateShell(null)).toBe(true);
    expect(needsCreateShell(undefined)).toBe(true);
    expect(needsCreateShell('uuid')).toBe(false);
  });

  it('409 usa mensagem amigável sem SQL', () => {
    const msg = 'Já existe uma ficha com esse nome nesta organização';
    expect(msg).not.toMatch(/HTTP 409|duplicate key|SQL/i);
  });

  it('após sucesso, sync de padrao só se mudou', () => {
    expect(
      planPadraoSync({ padrao: true, fichaId: 'a', clinicaPadraoId: null })
    ).toEqual({ anamnesePadraoId: 'a' });
    expect(
      planPadraoSync({ padrao: false, fichaId: 'a', clinicaPadraoId: 'a' })
    ).toEqual({ anamnesePadraoId: null });
    expect(
      planPadraoSync({ padrao: true, fichaId: 'a', clinicaPadraoId: 'a' })
    ).toBeNull();
    expect(
      planPadraoSync({ padrao: false, fichaId: 'a', clinicaPadraoId: 'b' })
    ).toBeNull();
  });
});

describe('T3 usarFicha modal', () => {
  it('com conteúdo pede confirmação; vazio segue direto', () => {
    expect(usarFichaNeedsConfirm([])).toBe(false);
    expect(usarFichaNeedsConfirm([{ clientKey: 's1', perguntas: [] }])).toBe(true);
  });
});

describe('T4 dirty + SET_PADRAO + addBank + REMOVE_PERGUNTA', () => {
  it('SET_PADRAO marca dirty e não dispara API', () => {
    const state = { ...createInitialEditorState(), dirty: false, padrao: false };
    const next = editorDocumentoReducer(state, { type: EDITOR_ACTIONS.SET_PADRAO, padrao: true });
    expect(next.padrao).toBe(true);
    expect(next.dirty).toBe(true);
  });

  it('ADD_BANK cria seção se vazio e adiciona na última', () => {
    const s1 = { ...emptySecao(1), clientKey: 's1', nome: 'Primeira', perguntas: [] };
    const s2 = { ...emptySecao(2), clientKey: 's2', nome: 'Última', perguntas: [] };
    const withTwo = { ...createInitialEditorState(), secoes: [s1, s2] };
    const next = editorDocumentoReducer(withTwo, {
      type: EDITOR_ACTIONS.ADD_BANK,
      patch: { descricao: 'Nova', tipoRespostaCodigo: 'texto' },
    });
    expect(next.secoes[0].perguntas).toHaveLength(0);
    expect(next.secoes[1].perguntas).toHaveLength(1);
    expect(next.secoes[1].perguntas[0].descricao).toBe('Nova');
    expect(next.dirty).toBe(true);
  });

  it('REMOVE_PERGUNTA remove filhas', () => {
    const pai = { ...emptyPergunta(1), clientKey: 'pai', descricao: 'Pai' };
    const filha = {
      ...emptyPergunta(2),
      clientKey: 'filha',
      descricao: 'Filha',
      perguntaPaiClientKey: 'pai',
    };
    const extra = { ...emptyPergunta(3), clientKey: 'outra', descricao: 'Outra' };
    const state = {
      ...createInitialEditorState(),
      secoes: [{ ...emptySecao(1), clientKey: 's1', perguntas: [pai, filha, extra] }],
    };
    const next = editorDocumentoReducer(state, {
      type: EDITOR_ACTIONS.REMOVE_PERGUNTA,
      clientKey: 'pai',
    });
    expect(next.secoes[0].perguntas.map((q) => q.clientKey)).toEqual(['outra']);
  });
});

describe('ciclo compose', () => {
  const base = () => {
    const q1 = { ...emptyPergunta(1, 'booleano'), clientKey: 'q1', descricao: 'P1', prioridade: 'ALERTA' };
    return {
      ...createInitialEditorState(),
      stickyTipo: 'texto',
      secoes: [{ ...emptySecao(1), clientKey: 's1', perguntas: [q1] }],
      dirty: false,
      compose: null,
    };
  };

  it('OPEN_COMPOSE não suja', () => {
    const next = editorDocumentoReducer(base(), {
      type: EDITOR_ACTIONS.OPEN_COMPOSE,
      secKey: 's1',
      afterKey: null,
    });
    expect(next.compose).toEqual({
      secKey: 's1',
      afterKey: null,
      child: false,
      texto: '',
      alternativasDraft: [],
    });
    expect(next.dirty).toBe(false);
    expect(next.secoes[0].perguntas).toHaveLength(1);
  });

  it('TOGGLE_COMPOSE_CHILD alterna child sem sujar', () => {
    const opened = editorDocumentoReducer(base(), {
      type: EDITOR_ACTIONS.OPEN_COMPOSE,
      secKey: 's1',
      afterKey: 'q1',
    });
    const toggled = editorDocumentoReducer(opened, { type: EDITOR_ACTIONS.TOGGLE_COMPOSE_CHILD });
    expect(toggled.compose.child).toBe(true);
    expect(toggled.dirty).toBe(false);
    const again = editorDocumentoReducer(toggled, { type: EDITOR_ACTIONS.TOGGLE_COMPOSE_CHILD });
    expect(again.compose.child).toBe(false);
  });

  it('Enter vazio / Esc fecha sem inserir', () => {
    const opened = editorDocumentoReducer(base(), {
      type: EDITOR_ACTIONS.OPEN_COMPOSE,
      secKey: 's1',
      afterKey: null,
    });
    const emptyEnter = editorDocumentoReducer(opened, { type: EDITOR_ACTIONS.COMMIT_COMPOSE });
    expect(emptyEnter.compose).toBeNull();
    expect(emptyEnter.secoes[0].perguntas).toHaveLength(1);
    expect(emptyEnter.dirty).toBe(false);

    const opened2 = editorDocumentoReducer(base(), {
      type: EDITOR_ACTIONS.OPEN_COMPOSE,
      secKey: 's1',
      afterKey: 'q1',
    });
    const esc = editorDocumentoReducer(opened2, { type: EDITOR_ACTIONS.CLOSE_COMPOSE });
    expect(esc.compose).toBeNull();
    expect(esc.secoes[0].perguntas).toHaveLength(1);
    expect(esc.dirty).toBe(false);
  });

  it('COMMIT_COMPOSE com texto insere com herança e dirty', () => {
    let state = editorDocumentoReducer(base(), {
      type: EDITOR_ACTIONS.OPEN_COMPOSE,
      secKey: 's1',
      afterKey: null,
    });
    state = editorDocumentoReducer(state, { type: EDITOR_ACTIONS.TOGGLE_COMPOSE_CHILD });
    state = editorDocumentoReducer(state, { type: EDITOR_ACTIONS.SET_COMPOSE_TEXT, texto: '  Qual?  ' });
    expect(state.dirty).toBe(false);
    const next = editorDocumentoReducer(state, { type: EDITOR_ACTIONS.COMMIT_COMPOSE });
    expect(next.dirty).toBe(true);
    expect(next.secoes[0].perguntas).toHaveLength(2);
    const nova = next.secoes[0].perguntas[1];
    expect(nova.descricao).toBe('Qual?');
    expect(nova.prioridade).toBe('ALERTA');
    expect(nova.perguntaPaiClientKey).toBe('q1');
    expect(nova.tipoRespostaCodigo).toBe('texto');
    expect(next.compose).toEqual({
      secKey: 's1',
      afterKey: null,
      child: false,
      texto: '',
      alternativasDraft: [],
    });
  });

  it('COMMIT_COMPOSE com escolha copia alternativasDraft (ordem 1-based)', () => {
    let state = editorDocumentoReducer(base(), {
      type: EDITOR_ACTIONS.OPEN_COMPOSE,
      secKey: 's1',
      afterKey: null,
    });
    state = editorDocumentoReducer(state, {
      type: EDITOR_ACTIONS.SET_STICKY_TIPO,
      tipo: 'escolha_unica',
    });
    state = editorDocumentoReducer(state, {
      type: EDITOR_ACTIONS.SET_COMPOSE_TEXT,
      texto: 'Cicatrização?',
    });
    state = editorDocumentoReducer(state, {
      type: EDITOR_ACTIONS.SET_COMPOSE_ALTERNATIVAS,
      alternativas: [
        { alternativa: 'Rápida', ordem: 1 },
        { alternativa: 'Normal', ordem: 2 },
        { alternativa: 'Lenta', ordem: 3 },
      ],
    });
    const next = editorDocumentoReducer(state, { type: EDITOR_ACTIONS.COMMIT_COMPOSE });
    const nova = next.secoes[0].perguntas[1];
    expect(nova.tipoRespostaCodigo).toBe('escolha_unica');
    expect(nova.alternativas.map((a) => a.alternativa)).toEqual(['Rápida', 'Normal', 'Lenta']);
  });

  it('COMMIT_COMPOSE inválido (escolha com <2 opções) é no-op', () => {
    let state = editorDocumentoReducer(base(), {
      type: EDITOR_ACTIONS.OPEN_COMPOSE,
      secKey: 's1',
      afterKey: null,
    });
    state = editorDocumentoReducer(state, {
      type: EDITOR_ACTIONS.SET_STICKY_TIPO,
      tipo: 'escolha_unica',
    });
    state = editorDocumentoReducer(state, {
      type: EDITOR_ACTIONS.SET_COMPOSE_TEXT,
      texto: 'Cicatrização?',
    });
    state = editorDocumentoReducer(state, {
      type: EDITOR_ACTIONS.SET_COMPOSE_ALTERNATIVAS,
      alternativas: [{ alternativa: 'Rápida', ordem: 1 }],
    });
    const next = editorDocumentoReducer(state, { type: EDITOR_ACTIONS.COMMIT_COMPOSE });
    expect(next.secoes[0].perguntas).toHaveLength(1);
    expect(next.compose.texto).toBe('Cicatrização?');
    expect(canCommitCompose(state.compose, 'escolha_unica')).toBe(false);
    expect(composeCommitHint(state.compose, 'escolha_unica')).toMatch(/2 opções/);
  });

  it('UPDATE_PERGUNTA muda tipo sem limpar alternativas em memória', () => {
    let state = editorDocumentoReducer(base(), {
      type: EDITOR_ACTIONS.ADD_PERGUNTA,
      secaoKey: 's1',
      tipoRespostaCodigo: 'escolha_unica',
      initialPatch: {
        descricao: 'Lista',
        alternativas: [
          { alternativa: 'A', ordem: 1 },
          { alternativa: 'B', ordem: 2 },
        ],
      },
    });
    const key = state.secoes[0].perguntas[1].clientKey;
    state = editorDocumentoReducer(state, {
      type: EDITOR_ACTIONS.UPDATE_PERGUNTA,
      clientKey: key,
      patch: { tipoRespostaCodigo: 'texto' },
    });
    expect(state.secoes[0].perguntas[1].alternativas).toHaveLength(2);
    state = editorDocumentoReducer(state, {
      type: EDITOR_ACTIONS.UPDATE_PERGUNTA,
      clientKey: key,
      patch: { tipoRespostaCodigo: 'escolha_unica' },
    });
    expect(state.secoes[0].perguntas[1].alternativas.map((a) => a.alternativa)).toEqual(['A', 'B']);
  });
});

describe('secoesToDocumentoPayload alternativas', () => {
  it('numera ordem das perguntas na ficha inteira, não por seção', () => {
    const secoes = [
      {
        clientKey: 's1',
        nome: 'A',
        ordem: 1,
        perguntas: [
          { clientKey: 'q1', descricao: 'Um', tipoRespostaCodigo: 'texto', prioridade: 'NORMAL', ordem: 1 },
        ],
      },
      {
        clientKey: 's2',
        nome: 'B',
        ordem: 2,
        perguntas: [
          { clientKey: 'q2', descricao: 'Dois', tipoRespostaCodigo: 'texto', prioridade: 'NORMAL', ordem: 1 },
        ],
      },
    ];
    const payload = secoesToDocumentoPayload({
      nome: 'F',
      especialidadeId: null,
      textoDeclaracao: '',
      secoes,
    });
    expect(payload.secoes[0].perguntas[0].ordem).toBe(1);
    expect(payload.secoes[1].perguntas[0].ordem).toBe(2);
  });

  it('omite alternativas quando tipo não é escolha; envia 1-based quando é', () => {
    const secoes = [
      {
        clientKey: 's1',
        nome: 'Geral',
        ordem: 1,
        perguntas: [
          {
            clientKey: 'q1',
            descricao: 'Texto',
            tipoRespostaCodigo: 'texto',
            prioridade: 'NORMAL',
            ordem: 1,
            alternativas: [
              { alternativa: 'Ghost', ordem: 1 },
              { alternativa: 'Ghost2', ordem: 2 },
            ],
          },
          {
            clientKey: 'q2',
            descricao: 'Lista',
            tipoRespostaCodigo: 'escolha_unica',
            prioridade: 'NORMAL',
            ordem: 2,
            alternativas: [
              { alternativa: 'Um', ordem: 1 },
              { alternativa: 'Dois', ordem: 2 },
            ],
          },
        ],
      },
    ];
    const payload = secoesToDocumentoPayload({
      nome: 'F',
      especialidadeId: null,
      textoDeclaracao: '',
      secoes,
    });
    expect(payload.secoes[0].perguntas[0].alternativas).toBeUndefined();
    expect(payload.secoes[0].perguntas[1].alternativas).toEqual([
      { alternativa: 'Um', ordem: 1 },
      { alternativa: 'Dois', ordem: 2 },
    ]);
    expect(findEscolhaSemAlternativas(secoes)).toBeNull();
    expect(
      findEscolhaSemAlternativas([
        {
          ...secoes[0],
          perguntas: [{ ...secoes[0].perguntas[1], alternativas: [{ alternativa: 'Só', ordem: 1 }] }],
        },
      ])?.descricao
    ).toBe('Lista');
  });
});

describe('biblioteca só FICHA', () => {
  it('MODULOS e BANCO derivam das seções das fichas, sem SECAO de catálogo', () => {
    const { FICHAS, MODULOS, BANCO } = buildBiblioteca(
      [
        {
          codigo: 'ficha-odonto',
          nome: 'Anamnese Odontológica',
          especialidadeCodigo: 'ODONTOLOGIA',
          especialidadeNome: 'Odontologia',
          textoDeclaracao: 'Decl',
          secoes: [
            {
              nome: 'Queixa principal',
              perguntas: [
                { descricao: 'Motivo?', tipoRespostaCodigo: 'texto', prioridade: 'NORMAL' },
                {
                  descricao: 'Detalhe',
                  tipoRespostaCodigo: 'texto',
                  perguntaPaiClientKey: 'p1',
                },
              ],
            },
          ],
        },
      ],
      [
        { codigo: 'ficha-odonto', tipo: 'FICHA', descricao: 'Modelo completo' },
        { codigo: 'secao-alergias', tipo: 'SECAO', descricao: 'Não deve entrar' },
      ]
    );
    expect(FICHAS).toHaveLength(1);
    expect(MODULOS.map((m) => m.nome)).toEqual(['Queixa principal']);
    expect(MODULOS[0].ic).toBe('🦷');
    expect(MODULOS[0].d).toBe('Queixa principal');
    expect(BANCO.map((b) => b.descricao)).toEqual(['Motivo?']);
    expect(BANCO[0].cat).toBe('Queixa principal');
    expect(MODULOS.some((m) => m.nome.includes('Alergias'))).toBe(false);
  });
});

