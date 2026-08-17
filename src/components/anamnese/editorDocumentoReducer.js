import {
  applyEnter,
  applyEsc,
  applyTab,
  cloneSecoesFromFicha,
  emptyPergunta,
  emptySecao,
  groupItensToSecoes,
  newClientKey,
  reindexPerguntas,
  reindexSecoes,
} from './editorDocumentoState.js';

export const EDITOR_ACTIONS = {
  LOAD: 'LOAD',
  SET_META: 'SET_META',
  ADD_SECAO: 'ADD_SECAO',
  RENAME_SECAO: 'RENAME_SECAO',
  SET_SECAO_SEXO: 'SET_SECAO_SEXO',
  REMOVE_SECAO: 'REMOVE_SECAO',
  ADD_PERGUNTA: 'ADD_PERGUNTA',
  UPDATE_PERGUNTA: 'UPDATE_PERGUNTA',
  SET_PAI: 'SET_PAI',
  REMOVE_PERGUNTA: 'REMOVE_PERGUNTA',
  REORDER_SECOES: 'REORDER_SECOES',
  REORDER_PERGUNTAS: 'REORDER_PERGUNTAS',
  APPEND_SECOES: 'APPEND_SECOES',
  MERGE_FICHA: 'MERGE_FICHA',
  KEY_ENTER: 'KEY_ENTER',
  KEY_TAB: 'KEY_TAB',
  KEY_ESC: 'KEY_ESC',
  SET_FOCUS: 'SET_FOCUS',
  SET_STICKY_TIPO: 'SET_STICKY_TIPO',
  MARK_CLEAN: 'MARK_CLEAN',
  REPLACE_FROM_API: 'REPLACE_FROM_API',
};

export function createInitialEditorState() {
  return {
    fichaId: null,
    nome: '',
    especialidadeId: '',
    textoDeclaracao: '',
    origemCodigo: null,
    editavel: true,
    secoes: [emptySecao(1)],
    focusKey: null,
    tabPaiMode: false,
    stickyTipo: 'texto',
    dirty: false,
    loaded: false,
  };
}

export function editorDocumentoReducer(state, action) {
  switch (action.type) {
    case EDITOR_ACTIONS.LOAD: {
      const ficha = action.ficha;
      const secoes = groupItensToSecoes(ficha);
      return {
        ...state,
        fichaId: ficha.id,
        nome: ficha.nome || '',
        especialidadeId: ficha.especialidadeId || '',
        textoDeclaracao: ficha.textoDeclaracao || '',
        origemCodigo: ficha.origemCodigo ?? null,
        editavel: ficha.editavel !== false,
        secoes,
        dirty: false,
        loaded: true,
        focusKey: null,
        tabPaiMode: false,
      };
    }
    case EDITOR_ACTIONS.SET_META:
      return {
        ...state,
        ...action.patch,
        dirty: true,
      };
    case EDITOR_ACTIONS.ADD_SECAO:
      return {
        ...state,
        secoes: reindexSecoes([...state.secoes, emptySecao(state.secoes.length + 1)]),
        dirty: true,
      };
    case EDITOR_ACTIONS.RENAME_SECAO:
      return {
        ...state,
        secoes: state.secoes.map((s) =>
          s.clientKey === action.secaoKey ? { ...s, nome: action.nome } : s
        ),
        dirty: true,
      };
    case EDITOR_ACTIONS.SET_SECAO_SEXO:
      return {
        ...state,
        secoes: state.secoes.map((s) =>
          s.clientKey === action.secaoKey ? { ...s, sexoAplicavel: action.sexoAplicavel } : s
        ),
        dirty: true,
      };
    case EDITOR_ACTIONS.REMOVE_SECAO:
      return {
        ...state,
        secoes: reindexSecoes(state.secoes.filter((s) => s.clientKey !== action.secaoKey)),
        dirty: true,
      };
    case EDITOR_ACTIONS.ADD_PERGUNTA: {
      const secaoKey = action.secaoKey;
      const tipo = action.tipoRespostaCodigo || state.stickyTipo || 'texto';
      let newKey = null;
      const secoes = reindexPerguntas(
        state.secoes.map((s) => {
          if (s.clientKey !== secaoKey) return s;
          const ordem = s.perguntas.length + 1;
          const nova = { ...emptyPergunta(ordem, tipo), ...(action.initialPatch || {}) };
          newKey = nova.clientKey;
          return { ...s, perguntas: [...s.perguntas, nova] };
        })
      );
      return {
        ...state,
        secoes,
        focusKey: action.focusNew !== false ? newKey : state.focusKey,
        dirty: true,
      };
    }
    case EDITOR_ACTIONS.UPDATE_PERGUNTA:
      return {
        ...state,
        secoes: state.secoes.map((s) => ({
          ...s,
          perguntas: s.perguntas.map((q) =>
            q.clientKey === action.clientKey ? { ...q, ...action.patch } : q
          ),
        })),
        dirty: true,
      };
    case EDITOR_ACTIONS.SET_PAI:
      return {
        ...state,
        secoes: state.secoes.map((s) => ({
          ...s,
          perguntas: s.perguntas.map((q) =>
            q.clientKey === action.clientKey
              ? {
                  ...q,
                  perguntaPaiId: action.perguntaPaiId ?? null,
                  perguntaPaiClientKey: action.perguntaPaiClientKey ?? null,
                }
              : q
          ),
        })),
        dirty: true,
      };
    case EDITOR_ACTIONS.REMOVE_PERGUNTA:
      return {
        ...state,
        secoes: reindexPerguntas(
          state.secoes.map((s) => ({
            ...s,
            perguntas: s.perguntas.filter((q) => q.clientKey !== action.clientKey),
          }))
        ),
        focusKey: state.focusKey === action.clientKey ? null : state.focusKey,
        dirty: true,
      };
    case EDITOR_ACTIONS.REORDER_SECOES:
      return {
        ...state,
        secoes: reindexSecoes(action.secoes),
        dirty: true,
      };
    case EDITOR_ACTIONS.REORDER_PERGUNTAS:
      return {
        ...state,
        secoes: state.secoes.map((s) =>
          s.clientKey === action.secaoKey
            ? { ...s, perguntas: reindexPerguntas([{ ...s, perguntas: action.perguntas }])[0].perguntas }
            : s
        ),
        dirty: true,
      };
    case EDITOR_ACTIONS.APPEND_SECOES: {
      const appended = (action.secoes || []).map((sec, i) => ({
        ...sec,
        clientKey: newClientKey('sec'),
        ordem: state.secoes.length + i + 1,
        perguntas: sec.perguntas.map((q) => ({
          ...q,
          clientKey: newClientKey('pq'),
          id: null,
          outrasFichasCount: 0,
        })),
      }));
      return {
        ...state,
        secoes: reindexSecoes([...state.secoes, ...appended]),
        dirty: true,
      };
    }
    case EDITOR_ACTIONS.MERGE_FICHA: {
      const cloned = cloneSecoesFromFicha(action.ficha);
      return {
        ...state,
        secoes: reindexSecoes([...state.secoes, ...cloned]),
        dirty: true,
      };
    }
    case EDITOR_ACTIONS.KEY_ENTER: {
      const result = applyEnter(state.secoes, action.focusKey, state.stickyTipo);
      return { ...state, ...result, dirty: true };
    }
    case EDITOR_ACTIONS.KEY_TAB: {
      const result = applyTab(state.secoes, action.focusKey);
      return { ...state, ...result, dirty: true };
    }
    case EDITOR_ACTIONS.KEY_ESC: {
      const result = applyEsc();
      return { ...state, ...result };
    }
    case EDITOR_ACTIONS.SET_FOCUS:
      return { ...state, focusKey: action.focusKey, tabPaiMode: action.tabPaiMode ?? state.tabPaiMode };
    case EDITOR_ACTIONS.SET_STICKY_TIPO:
      return { ...state, stickyTipo: action.tipo };
    case EDITOR_ACTIONS.MARK_CLEAN:
      return { ...state, dirty: false };
    case EDITOR_ACTIONS.REPLACE_FROM_API: {
      const ficha = action.ficha;
      return {
        ...state,
        secoes: groupItensToSecoes(ficha),
        dirty: false,
      };
    }
    default:
      return state;
  }
}
