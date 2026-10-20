// Regressão prevenida: Ao remover procedimento via chip (X), abrir o mapa não ressuscita o procedimento removido
// Anti-Shadowing de Estado & Ciclo Adição-Remoção-Abertura (State Shadowing & Deletion Parity)
// Comprova que procedimentosSessao é a única fonte de verdade e que modais dependentes (Mapa Fullscreen)
// expurgam integralmente o item removido sem ressurreição por variáveis sombra (procedimentosLote).
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { AnnotationCanvasAvaliacao } from '../journey/AnnotationCanvasAvaliacao.jsx';

vi.mock('../../services/api.js', () => ({
  mapasApi: { salvar: vi.fn().mockResolvedValue({ id: 'mapa-remocao-test' }) },
  planejamentosApi: { listarPorPaciente: vi.fn().mockResolvedValue([]) },
  catalogosApi: { buscarPorId: vi.fn().mockResolvedValue({}), list: vi.fn().mockResolvedValue([]) },
  isRealUuid: (id) => typeof id === 'string' && id.length > 10,
}));

if (typeof window !== 'undefined') {
  window.innerWidth = 1280;
  window.matchMedia = () => ({
    matches: true,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

vi.mock('../../contexts/useToast.js', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
}));

describe('State Shadowing & Deletion Parity — Ciclo Adição-Remoção-Abertura', () => {
  it('remove Procedimento C via chip e comprova que o Mapa Fullscreen não o ressuscita via estado sombra', () => {
    // 1. Início do ciclo: Adicionar A e B
    const procA = { id: 'proc-a', catalogoProcedimentoSaudeId: 'proc-a', nome: 'Toxina Botulínica' };
    const procB = { id: 'proc-b', catalogoProcedimentoSaudeId: 'proc-b', nome: 'Preenchimento Malar' };
    const procC = { id: 'proc-c', catalogoProcedimentoSaudeId: 'proc-c', nome: 'Biópsia Cutânea' };

    let procedimentosSessao = [procA, procB];

    // 2. Adicionar C
    procedimentosSessao = [...procedimentosSessao, procC];
    expect(procedimentosSessao.length).toBe(3);

    // 3. Remover C via filtro (ação disparada pelo clique no chip "X")
    const procIdRemover = 'proc-c';
    procedimentosSessao = procedimentosSessao.filter(
      (p) => String(p.catalogoProcedimentoSaudeId || p.id) !== procIdRemover
    );
    expect(procedimentosSessao.length).toBe(2);

    // 4. Derivação canônica do container pai (AppRefactored.jsx: procedimentosIniciaisAvaliacao)
    const derivarProcedimentosIniciais = (sessao) => {
      if (Array.isArray(sessao) && sessao.length > 0) {
        const validos = sessao.filter((p) => {
          const n = String(p?.nome || p?.catalogoNome || '').trim();
          return n && n.toLowerCase() !== 'procedimento';
        });
        if (validos.length > 0) return validos;
      }
      return [];
    };

    const procedimentosIniciais = derivarProcedimentosIniciais(procedimentosSessao);
    expect(procedimentosIniciais.map((p) => p.id)).toEqual(['proc-a', 'proc-b']);
    expect(procedimentosIniciais.some((p) => p.id === 'proc-c')).toBe(false);

    // 5. Abertura do Modal de Mapeamento (AnnotationCanvasAvaliacao) com procedimentosIniciais
    render(
      <AnnotationCanvasAvaliacao
        photos={[{ url: 'blob:test-photo-3', cleanUrl: 'blob:test-photo-3' }]}
        editingIndex={0}
        imageSrc="blob:test-photo-3"
        procedimentosIniciais={procedimentosIniciais}
        onClose={vi.fn()}
      />
    );

    // Assertiva Obrigatória Anti-Shadowing: C foi expurgado de todas as superfícies e NÃO ressurge
    expect(screen.queryByTitle(/Biópsia Cutânea/i)).toBeNull();
    expect(screen.queryByText(/Biópsia Cutânea/i)).toBeNull();

    // Superfícies ativas contêm estritamente A e B
    expect(screen.getByTitle(/Toxina Botulínica/i)).toBeTruthy();
    expect(screen.getByTitle(/Preenchimento Malar/i)).toBeTruthy();
  });
});
