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
} from './editorDocumentoState.js';
import {
  EDITOR_ACTIONS,
  createInitialEditorState,
  editorDocumentoReducer,
} from './editorDocumentoReducer.js';

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
  it('vincula pergunta anterior como pai', () => {
    const q1 = { ...emptyPergunta(1), clientKey: 'q1', id: 'uuid-pai' };
    const q2 = { ...emptyPergunta(2), clientKey: 'q2' };
    const secoes = [{ ...emptySecao(1), clientKey: 's1', perguntas: [q1, q2] }];
    const result = applyTab(secoes, 'q2');
    expect(result.secoes[0].perguntas[1].perguntaPaiClientKey).toBe('q1');
    expect(result.secoes[0].perguntas[1].perguntaPaiId).toBe('uuid-pai');
    expect(result.tabPaiMode).toBe(true);
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
