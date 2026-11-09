import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const fake = vi.hoisted(() => ({ userId: null, cb: null, flag: false }));

vi.mock('../lib/supabaseClient.js', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: fake.userId ? { user: { id: fake.userId } } : null } })),
      onAuthStateChange: vi.fn((cb) => {
        fake.cb = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
  },
}));
vi.mock('./saidaManual.js', () => ({
  saidaManual: { existe: () => fake.flag, marcar: () => { fake.flag = true; }, limpar: () => { fake.flag = false; } },
}));

import { useChaveDaSessao } from './useChaveDaSessao.js';

const montar = async (id) => {
  fake.userId = id;
  const h = renderHook(() => useChaveDaSessao());
  await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
  return h;
};
const evento = async (id) => {
  fake.userId = id;
  await act(async () => {
    fake.cb('X', null);
    await new Promise((r) => setTimeout(r, 5));
  });
};

describe('useChaveDaSessao', () => {
  beforeEach(() => { fake.userId = null; fake.cb = null; fake.flag = false; });

  it('primeira leitura não muda a chave', async () => {
    const { result } = await montar('A');
    expect(result.current).toBe('inicial');
  });

  it('mesmo id não muda a chave', async () => {
    const { result } = await montar('A');
    await evento('A');
    expect(result.current).toBe('inicial');
  });

  it('mesmo id não gera novo render', async () => {
    let renders = 0;
    fake.userId = 'A';
    renderHook(() => { renders += 1; return useChaveDaSessao(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    await evento('A'); // o React pode render uma vez a mais antes de descartar o estado igual
    const antes = renders;
    await evento('A');
    await evento('A');
    expect(renders).toBe(antes);
  });

  it('saída manual vira anon e novo login do mesmo id volta com o id', async () => {
    const { result } = await montar('A');
    fake.flag = true;
    await evento(null);
    expect(result.current).toBe('anon');
    await evento('A');
    expect(result.current).toBe('A');
  });

  it('saída involuntária e mesmo usuário não muda', async () => {
    const { result } = await montar('A');
    await evento(null);
    await evento('A');
    expect(result.current).toBe('inicial');
  });

  it('troca de pessoa muda a chave', async () => {
    const { result } = await montar('A');
    await evento(null);
    await evento('B');
    expect(result.current).toBe('B');
  });
});
