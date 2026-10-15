/**
 * Apoio aos snapshots de HTML das telas da consulta (Etapa 0 da fatia 2).
 * Tudo determinístico: API vazia, fetch falso, data congelada e efeitos assentados antes de ler o HTML.
 */
import { act, render } from '@testing-library/react';
import { vi } from 'vitest';
import { INSTANTE_FIXO } from './fixtures/consultaFixtures.js';

/** Troca cada objeto de API (`xxxApi`) por funções que respondem vazio; helpers soltos ficam reais. */
export function apiVazia(real) {
  const falsa = {};
  for (const [nome, valor] of Object.entries(real)) {
    if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
      const obj = {};
      for (const [k, v] of Object.entries(valor)) {
        obj[k] = typeof v === 'function' ? vi.fn(async () => []) : v;
      }
      falsa[nome] = obj;
    } else {
      falsa[nome] = valor;
    }
  }
  return falsa;
}

/** `useOrg` com todas as permissões, para os cartões e botões aparecerem destravados. */
export function orgComTodasPermissoes(real, permissoes) {
  return {
    ...real,
    useOrg: () => ({
      ...real.useOrg(),
      orgId: 'org-1',
      roleUserId: 'ru-1',
      papel: 'DONO',
      permissoes,
      contextStatus: 'ready',
    }),
  };
}

export function prepararAmbienteSnapshot() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(INSTANTE_FIXO));
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })),
  );
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })),
  );
  if (!URL.createObjectURL) URL.createObjectURL = () => 'blob:teste';
  if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {};
}

export function limparAmbienteSnapshot() {
  vi.useRealTimers();
  vi.unstubAllGlobals();
}

/** Deixa promessas e efeitos pendentes assentarem. */
export async function assentar() {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

/** Renderiza, deixa promessas e efeitos assentarem e devolve o HTML. */
export async function htmlEstavel(ui) {
  const { container } = render(ui);
  await assentar();
  return container.innerHTML;
}
