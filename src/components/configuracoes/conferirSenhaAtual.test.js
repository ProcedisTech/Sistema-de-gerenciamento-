import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ getSession: vi.fn(), signInWithPassword: vi.fn() }));
vi.mock('../../lib/supabaseClient', () => ({ supabase: { auth } }));

import { conferirSenha, conferirSenhaAtual } from './conferirSenhaAtual';

beforeEach(() => {
  auth.getSession.mockReset();
  auth.signInWithPassword.mockReset();
});

describe('conferirSenhaAtual', () => {
  it('sem sessão devolve false e não tenta entrar', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    expect(await conferirSenhaAtual('x')).toBe(false);
    expect(await conferirSenha('x')).toBe('indisponivel');
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('sessão sem e-mail devolve false', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: {} } } });
    expect(await conferirSenhaAtual('x')).toBe(false);
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('e-mail ok e senha errada devolve false', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { email: 'a@b.com' } } } });
    auth.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid' } });
    expect(await conferirSenhaAtual('errada')).toBe(false);
    expect(await conferirSenha('errada')).toBe('errada');
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'errada' });
  });

  it('senha certa devolve true', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { email: 'a@b.com' } } } });
    auth.signInWithPassword.mockResolvedValue({ error: null });
    expect(await conferirSenhaAtual('certa')).toBe(true);
  });
});
