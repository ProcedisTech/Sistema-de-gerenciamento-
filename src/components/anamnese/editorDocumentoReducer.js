import {
  applyEnter,
  applyEsc,
  applyTab,
  canCommitCompose,
  composeHasPending,
  cloneSecoesFromDocumento,
  DECL_PADRAO,
  emptyPergunta,
  emptySecao,
  groupItensToSecoes,
  reindexPerguntas,
  reindexSecoes,
  reconcileDocumentoFromApi,
} from './editorDocumentoState.js';

export const EDITOR_ACTIONS = {
  LOAD: 'LOAD',
  INIT_BLANK: 'INIT_BLANK',
  SET_META: 'SET_META',
  SET_FICHA_ID: 'SET_FICHA_ID',
  SET_PADRAO: 'SET_PADRAO',
  ADD_SECAO: 'ADD_SECAO',
  RENAME_SECAO: 'RENAME_SECAO',
  SET_SECAO_SEXO: 'SET_SECAO_SEXO',
  REMOVE_SECAO: 'REMOVE_SECAO',
  ADD_PERGUNTA: 'ADD_PERGUNTA',
  ADD_BANK: 'ADD_BANK',
  UPDATE_PERGUNTA: 'UPDATE_PERGUNTA',
  SET_PAI: 'SET_PAI',
  REMOVE_PERGUNTA: 'REMOVE_PERGUNTA',
  REORDER_SECOES: 'REORDER_SECOES',
  REORDER_PERGUNTAS: 'REORDER_PERGUNTAS',
  APPEND_SECOES: 'APPEND_SECOES',
  MERGE_FICHA: 'MERGE_FICHA',
  REPLACE_DOCUMENTO: 'REPLACE_DOCUMENTO',
  OPEN_COMPOSE: 'OPEN_COMPOSE',
  SET_COMPOSE_TEXT: 'SET_COMPOSE_TEXT',
  SET_COMPOSE_ALTERNATIVAS: 'SET_COMPOSE_ALTERNATIVAS',
  TOGGLE_COMPOSE_CHILD: 'TOGGLE_COMPOSE_CHILD',
  CLOSE_COMPOSE: 'CLOSE_COMPOSE',
  COMMIT_COMPOSE: 'COMMIT_COMPOSE',
  KEY_ENTER: 'KEY_ENTER',
  KEY_TAB: 'KEY_TAB',
  KEY_ESC: 'KEY_ESC',
  SET_FOCUS: 'SET_FOCUS',
  SET_STICKY_TIPO: 'SET_STICKY_TIPO',
  MARK_CLEAN: 'MARK_CLEAN',
  REPLACE_FROM_API: 'REPLACE_FROM_API',
  SAVE_SUCCESS: 'SAVE_SUCCESS',
};

export function createInitialEditorState() {
  return {
    fichaId: null,
    nome: '',
    especialidadeId: '',
    textoDeclaracao: DECL_PADRAO,
    origemCodigo: null,
    editavel: true,
    secoes: [],
    padrao: false,
    compose: null,
    focusKey: null,
    focusSecaoKey: null,
    tabPaiMode: false,
    stickyTipo: 'sim_nao_naosei',
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
        textoDeclaracao: ficha.textoDeclaracao || DECL_PADRAO,
        origemCodigo: ficha.origemCodigo ?? null,
        editavel: ficha.editavel !== false,
        secoes,
        padrao: Boolean(action.padrao),
        compose: null,
        dirty: false,
        loaded: true,
        focusKey: null,
        focusSecaoKey: null,
        tabPaiMode: false,
      };
    }
    case EDITOR_ACTIONS.INIT_BLANK:
      return { ...createInitialEditorState(), loaded: true };
    case EDITOR_ACTIONS.SET_META:
      return {
        ...state,
        ...action.patch,
        dirty: true,
      };
    case EDITOR_ACTIONS.SET_FICHA_ID:
      return {
        ...state,
        fichaId: action.fichaId,
      };
    case EDITOR_ACTIONS.SET_PADRAO:
      return {
        ...state,
        padrao: Boolean(action.padrao),
        dirty: true,
      };
    case EDITOR_ACTIONS.ADD_SECAO: {
      const nova = emptySecao(state.secoes.length + 1);
      return {
        ...state,
        secoes: reindexSecoes([...state.secoes, nova]),
        focusSecaoKey: nova.clientKey,
        dirty: true,
      };
    }
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
        compose: state.compose?.secKey === action.secaoKey ? null : state.compose,
        dirty: true,
      };
    case EDITOR_ACTIONS.ADD_PERGUNTA: {
      let secoes = state.secoes;
      let secaoKey = action.secaoKey;
      if (!secaoKey || !secoes.some((s) => s.clientKey === secaoKey)) {
        if (secoes.length === 0) {
          secoes = reindexSecoes([emptySecao(1)]);
          secaoKey = secoes[0].clientKey;
        } else {
          secaoKey = secoes[secoes.length - 1].clientKey;
        }
      }
      const tipo = action.tipoRespostaCodigo || state.stickyTipo || 'texto';
      let newKey = null;
      const nextSecoes = reindexPerguntas(
        secoes.map((s) => {
          if (s.clientKey !== secaoKey) return s;
          const ordem = s.perguntas.length + 1;
          const nova = { ...emptyPergunta(ordem, tipo), ...(action.initialPatch || {}) };
          newKey = nova.clientKey;
          return { ...s, perguntas: [...s.perguntas, nova] };
        })
      );
      return {
        ...state,
        secoes: nextSecoes,
        focusKey: action.focusNew !== false ? newKey : state.focusKey,
        dirty: true,
      };
    }
    case EDITOR_ACTIONS.ADD_BANK: {
      let secoes = state.secoes;
      if (secoes.length === 0) {
        secoes = reindexSecoes([emptySecao(1)]);
      }
      const last = secoes[secoes.length - 1];
      const tipo = action.patch?.tipoRespostaCodigo || action.tipoRespostaCodigo || state.stickyTipo || 'texto';
      const nova = {
        ...emptyPergunta((last.perguntas?.length || 0) + 1, tipo),
        ...(action.patch || {}),
        perguntaPaiClientKey: null,
        perguntaPaiId: null,
        id: null,
      };
      const nextSecoes = reindexPerguntas(
        secoes.map((s, i) =>
          i === secoes.length - 1 ? { ...s, perguntas: [...s.perguntas, nova] } : s
        )
      );
      return {
        ...state,
        secoes: nextSecoes,
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
            perguntas: s.perguntas.filter(
              (q) => q.clientKey !== action.clientKey && q.perguntaPaiClientKey !== action.clientKey
            ),
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
      const appended = cloneSecoesFromDocumento(action.secoes || []);
      return {
        ...state,
        secoes: reindexSecoes([...state.secoes, ...appended]),
        dirty: true,
      };
    }
    case EDITOR_ACTIONS.MERGE_FICHA: {
      const cloned = cloneSecoesFromDocumento(action.ficha?.secoes || groupItensToSecoes(action.ficha));
      return {
        ...state,
        secoes: reindexSecoes([...state.secoes, ...cloned]),
        dirty: true,
      };
    }
    case EDITOR_ACTIONS.REPLACE_DOCUMENTO: {
      const doc = action.documento || {};
      const secoes = cloneSecoesFromDocumento(doc.secoes || []);
      return {
        ...state,
        nome: doc.nome || '',
        textoDeclaracao: doc.textoDeclaracao || DECL_PADRAO,
        especialidadeId: doc.especialidadeId || '',
        secoes: reindexSecoes(secoes),
        compose: null,
        dirty: true,
        focusKey: null,
        focusSecaoKey: null,
      };
    }
    case EDITOR_ACTIONS.OPEN_COMPOSE:
      return {
        ...state,
        compose: {
          secKey: action.secKey,
          afterKey: action.afterKey ?? null,
          child: false,
          texto: '',
          alternativasDraft: [],
        },
      };
    case EDITOR_ACTIONS.SET_COMPOSE_TEXT:
      if (!state.compose) return state;
      return {
        ...state,
        compose: { ...state.compose, texto: action.texto },
      };
    case EDITOR_ACTIONS.SET_COMPOSE_ALTERNATIVAS:
      if (!state.compose) return state;
      return {
        ...state,
        compose: { ...state.compose, alternativasDraft: action.alternativas || [] },
      };
    case EDITOR_ACTIONS.TOGGLE_COMPOSE_CHILD:
      if (!state.compose) return state;
      return {
        ...state,
        compose: { ...state.compose, child: !state.compose.child },
      };
    case EDITOR_ACTIONS.CLOSE_COMPOSE:
      return { ...state, compose: null };
    case EDITOR_ACTIONS.COMMIT_COMPOSE: {
      if (!state.compose) return state;
      const texto = String(state.compose.texto || '').trim();
      if (!canCommitCompose(state.compose, state.stickyTipo)) {
        if (!texto && !composeHasPending(state.compose)) {
          return { ...state, compose: null };
        }
        return state;
      }
      const { secKey, afterKey, child, alternativasDraft } = state.compose;
      const tipo = state.stickyTipo || 'texto';
      const isEscolha = tipo === 'escolha_unica' || tipo === 'multipla_escolha';
      const secoes = reindexPerguntas(
        state.secoes.map((s) => {
          if (s.clientKey !== secKey) return s;
          const last = s.perguntas[s.perguntas.length - 1] || null;
          const nova = {
            ...emptyPergunta(s.perguntas.length + 1, tipo),
            descricao: texto,
            prioridade: child && last ? last.prioridade : 'NORMAL',
            perguntaPaiClientKey: child && last ? last.clientKey : null,
            perguntaPaiId: child && last ? last.id ?? null : null,
            alternativas: isEscolha ? (alternativasDraft || []) : [],
          };
          const perguntas = [...s.perguntas];
          if (afterKey == null) {
            perguntas.push(nova);
          } else {
            const idx = perguntas.findIndex((q) => q.clientKey === afterKey);
            if (idx >= 0) perguntas.splice(idx + 1, 0, nova);
            else perguntas.push(nova);
          }
          return { ...s, perguntas };
        })
      );
      return {
        ...state,
        secoes,
        dirty: true,
        compose: { secKey, afterKey: null, child: false, texto: '', alternativasDraft: [] },
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
      return {
        ...state,
        focusKey: action.focusKey === undefined ? state.focusKey : action.focusKey,
        tabPaiMode: action.tabPaiMode ?? state.tabPaiMode,
        focusSecaoKey: action.focusSecaoKey === undefined ? state.focusSecaoKey : action.focusSecaoKey,
      };
    case EDITOR_ACTIONS.SET_STICKY_TIPO:
      return { ...state, stickyTipo: action.tipo };
    case EDITOR_ACTIONS.MARK_CLEAN:
      return { ...state, dirty: false };
    case EDITOR_ACTIONS.REPLACE_FROM_API: {
      const ficha = action.ficha;
      return reconcileDocumentoFromApi(state, ficha);
    }
    case EDITOR_ACTIONS.SAVE_SUCCESS: {
      return reconcileDocumentoFromApi(state, action.ficha);
    }
    default:
      return state;
  }
}
