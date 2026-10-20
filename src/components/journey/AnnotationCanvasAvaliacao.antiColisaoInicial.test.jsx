// Regressão prevenida: Pontos de dois procedimentos com o mesmo hash base recebem cores distintas no mount inicial
// Teste Adversarial de Colisão Forçada em Recursos Finitos (Pigeonhole Collision Test)
// Usa intencionalmente 2 IDs que geram o MESMO hash base (hashUuid(id) % 12), comprovando que o mecanismo
// anti-colisão desvia o segundo item para uma cor livre e que 100% das superfícies renderizam cores distintas.
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { AnnotationCanvasAvaliacao } from './AnnotationCanvasAvaliacao.jsx';
import { corParaProcedimento, MAPEAMENTO_PALETA_CORES } from '../../constants/mapeamentoPaletaCores.js';

vi.mock('../../services/api.js', () => ({
  mapasApi: {
    salvar: vi.fn().mockResolvedValue({ id: 'mapa-colisao-test' }),
  },
  planejamentosApi: {
    listarPorPaciente: vi.fn().mockResolvedValue([]),
  },
  catalogosApi: {
    buscarPorId: vi.fn().mockResolvedValue({}),
    list: vi.fn().mockResolvedValue([]),
  },
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
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}));

describe('Pigeonhole Collision Test — Anti-colisão no Mount Inicial de AnnotationCanvasAvaliacao', () => {
  it('atribui cores estritamente distintas para dois procedimentos com o mesmo hash base (colisão forçada)', () => {
    // 1. Encontra determinísticamente dois IDs que colidem em corParaProcedimento
    const idA = 'proc-hash-base';
    const corBase = corParaProcedimento(idA);
    let idB = null;

    for (let i = 1; i <= 200; i++) {
      const candidate = `proc-candidate-${i}`;
      if (corParaProcedimento(candidate).toLowerCase() === corBase.toLowerCase()) {
        idB = candidate;
        break;
      }
    }

    expect(idB).not.toBeNull();
    // Prova matemática de colisão no algoritmo de hash base:
    expect(corParaProcedimento(idA).toLowerCase()).toBe(corParaProcedimento(idB).toLowerCase());

    const procedimentosIniciais = [
      {
        id: idA,
        catalogoProcedimentoSaudeId: idA,
        nome: 'Procedimento Alfa',
      },
      {
        id: idB,
        catalogoProcedimentoSaudeId: idB,
        nome: 'Procedimento Beta',
      },
    ];

    render(
      <AnnotationCanvasAvaliacao
        photos={[{ url: 'blob:test-photo', cleanUrl: 'blob:test-photo' }]}
        editingIndex={0}
        imageSrc="blob:test-photo"
        procedimentosIniciais={procedimentosIniciais}
        onClose={vi.fn()}
      />
    );

    // Localiza os botões indicadores de cada procedimento na barra lateral
    const btnA = screen.getByTitle(/Procedimento Alfa/i);
    const btnB = screen.getByTitle(/Procedimento Beta/i);

    expect(btnA).toBeTruthy();
    expect(btnB).toBeTruthy();

    const corRenderizadaA = btnA.style.backgroundColor;
    const corRenderizadaB = btnB.style.backgroundColor;

    expect(corRenderizadaA).toBeTruthy();
    expect(corRenderizadaB).toBeTruthy();

    // Assertiva Obrigatória de Desambiguação: as duas cores DEVEM ser diferentes!
    expect(corRenderizadaA.toLowerCase()).not.toBe(corRenderizadaB.toLowerCase());
  });
});
