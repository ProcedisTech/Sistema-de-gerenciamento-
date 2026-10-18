// Regressão prevenida: Ao reabrir foto anotada na Avaliação com cores personalizadas,
// o componente preserva integralmente as cores customizadas e não as sobrescreve com
// a paleta padrão do hash quando os itens do plano são carregados do servidor.
// Também garante que marcacoesPayload inclui corHex e catalogoProcedimentoSaudeId.
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AnnotationCanvasAvaliacao } from './AnnotationCanvasAvaliacao.jsx';
import { mapasApi, planejamentosApi } from '../../services/api.js';

vi.mock('../../services/api.js', () => ({
  mapasApi: {
    salvar: vi.fn().mockResolvedValue({ id: 'mapa-salvo-123' }),
  },
  planejamentosApi: {
    listarPorPaciente: vi.fn(),
  },
  catalogosApi: {
    buscarPorId: vi.fn().mockResolvedValue({}),
    list: vi.fn().mockResolvedValue([]),
  },
  isRealUuid: (id) => typeof id === 'string' && id.length > 5,
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

describe('Regressão Zero — Preservação de Cores e Vínculo de Plano no AnnotationCanvasAvaliacao', () => {
  it('preserva cores customizadas ao reabrir foto existente e não as sobrescreve ao carregar itens do plano', async () => {
    // Foto já anotada com cor customizada (#06b6d4 - ciano)
    const customCor = '#06b6d4';
    const activePhoto = {
      id: 'foto-1',
      url: 'blob:http://localhost/clean-photo-1',
      cleanUrl: 'blob:http://localhost/clean-photo-1',
      procedimentosMapeados: [
        {
          id: 'cat-toxina-1',
          catalogoProcedimentoSaudeId: 'cat-toxina-1',
          nome: 'Toxina Botulínica',
          corHex: customCor,
          planejamentoItemId: 'pi-123',
          unidadeMedida: 'u',
        },
      ],
      pontos: [
        {
          id: 'pt-1',
          tipoGeometria: 'ponto',
          posX: 50,
          posY: 50,
          cor: customCor,
          corHex: customCor,
          catalogoProcedimentoSaudeId: 'cat-toxina-1',
          quantidade: 2,
        },
      ],
    };

    // Plano ativo retornado pelo backend
    planejamentosApi.listarPorPaciente.mockResolvedValue([
      {
        id: 'plano-ativo-1',
        statusCodigo: 'ativo',
        itens: [
          {
            id: 'item-plano-1',
            catalogoProcedimentoSaudeId: 'cat-toxina-1',
            catalogoNome: 'Toxina Botulínica',
            planejamentoItemId: 'pi-123',
          },
        ],
      },
    ]);

    const onSaved = vi.fn();

    render(
      <AnnotationCanvasAvaliacao
        photos={[activePhoto]}
        editingIndex={0}
        setEditingIndex={() => {}}
        imageSrc={activePhoto.url}
        pacienteId="paciente-uuid-1"
        procedimentosIniciais={activePhoto.procedimentosMapeados}
        onAnnotatedCaptureSaved={onSaved}
        onClose={() => {}}
      />
    );

    // Aguarda o effect de carregar itens do plano rodar
    await waitFor(() => {
      expect(planejamentosApi.listarPorPaciente).toHaveBeenCalledWith('paciente-uuid-1');
    });

    // Clica em "Salvar Avaliação" e confirma o destino no modal clínico
    const btnSalvar = screen.getByRole('button', { name: /Salvar Avaliação/i });
    fireEvent.click(btnSalvar);

    const btnGerarPlano = await screen.findByRole('button', { name: /Sim, gerar Plano de Tratamento/i });
    fireEvent.click(btnGerarPlano);

    await waitFor(() => {
      expect(mapasApi.salvar).toHaveBeenCalled();
    });

    const callPayload = mapasApi.salvar.mock.calls[0][0];
    // Procedimento deve ter preservado corHex customizado (#06b6d4), não recalculado pelo hash
    expect(callPayload.procedimentos[0].corHex).toBe(customCor);
    // Marcacao deve conter corHex e catalogoProcedimentoSaudeId
    expect(callPayload.marcacoes[0].corHex).toBe(customCor);
    expect(callPayload.marcacoes[0].catalogoProcedimentoSaudeId).toBe('cat-toxina-1');
    // Deve preservar o vínculo com o planejamentoItemId
    expect(callPayload.procedimentos[0].planejamentoItemId).toBe('pi-123');
    expect(callPayload.planejamentoItemId).toBe('pi-123');
  });
});
