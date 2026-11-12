/**
 * Supabase falso COM ESTADO para os testes de rota/sessão: a sessão liga e desliga, e onAuthStateChange emite.
 * Uso (por arquivo): vi.mock('../../lib/supabaseClient.js', async () => (await import('./supabaseComEstado.js')).supabaseComEstado());
 * e controle `sessaoFalsa` importado normalmente (mesmo módulo, mesma instância).
 */
const ouvintes = new Set();
let sessao = null;

const novaSessao = (id) => ({ access_token: `token-${id}`, user: { id, email: `${id}@teste.com` } });
const emitir = (evento) => ouvintes.forEach((fn) => fn(evento, sessao));

export const sessaoFalsa = {
  /** Estado inicial de cada teste: logado como `id`, ou deslogado com null. */
  definir(id) {
    sessao = id ? novaSessao(id) : null;
  },
  ouvintes: () => ouvintes.size,
};

export function supabaseComEstado() {
  return {
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: sessao } }),
        refreshSession: async () => ({ data: { session: sessao }, error: null }),
        onAuthStateChange: (fn) => {
          ouvintes.add(fn);
          return { data: { subscription: { unsubscribe: () => ouvintes.delete(fn) } } };
        },
        signOut: async () => {
          sessao = null;
          emitir('SIGNED_OUT');
          return { error: null };
        },
        signInWithPassword: async ({ email }) => {
          sessao = novaSessao(String(email).split('@')[0] || 'usr-1');
          emitir('SIGNED_IN');
          return { data: { session: sessao, user: sessao.user }, error: null };
        },
      },
    },
  };
}
