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
    const catToxinaId = 'a0000000-0000-4000-8000-000000000001';
    const planItemId = 'b0000000-0000-4000-8000-000000000002';
    const pacienteUuid = 'c0000000-0000-4000-8000-000000000003';
    const planoAtivoId = 'd0000000-0000-4000-8000-000000000004';
    const itemPlanoId = 'e0000000-0000-4000-8000-000000000005';

    const activePhoto = {
      id: 'foto-1',
      url: 'blob:http://localhost/clean-photo-1',
      cleanUrl: 'blob:http://localhost/clean-photo-1',
      procedimentosMapeados: [
        {
          id: catToxinaId,
          catalogoProcedimentoSaudeId: catToxinaId,
          nome: 'Toxina Botulínica',
          corHex: customCor,
          planejamentoItemId: planItemId,
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
          catalogoProcedimentoSaudeId: catToxinaId,
          quantidade: 2,
        },
      ],
    };

    // Plano ativo retornado pelo backend
    planejamentosApi.listarPorPaciente.mockResolvedValue([
      {
        id: planoAtivoId,
        statusCodigo: 'ativo',
        itens: [
          {
            id: itemPlanoId,
            catalogoProcedimentoSaudeId: catToxinaId,
            catalogoNome: 'Toxina Botulínica',
            planejamentoItemId: planItemId,
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
        pacienteId={pacienteUuid}
        procedimentosIniciais={activePhoto.procedimentosMapeados}
        onAnnotatedCaptureSaved={onSaved}
        onClose={() => {}}
      />
    );

    // Aguarda o effect de carregar itens do plano rodar
    await waitFor(() => {
      expect(planejamentosApi.listarPorPaciente).toHaveBeenCalledWith(pacienteUuid);
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
    expect(callPayload.marcacoes[0].catalogoProcedimentoSaudeId).toBe(catToxinaId);
    // Deve preservar o vínculo com o planejamentoItemId
    expect(callPayload.procedimentos[0].planejamentoItemId).toBe(planItemId);
    expect(callPayload.planejamentoItemId).toBe(planItemId);

    expect(onSaved).toHaveBeenCalled();
    const savedCapture = onSaved.mock.calls[0][0];
    expect(savedCapture.pontos[0].corHex).toBe(customCor);
    expect(savedCapture.mapaOverlay.marcacoes[0].corHex).toBe(customCor);
  });

  it('atualiza corHex dos pontos e do mapaOverlay para a cor do procedimento ao salvar fotos em memória', async () => {
    // Foto com ponto antigo carregando cor cinza legada (#64748b)
    // Mas o procedimento do mapa foi configurado para Laranja (#f97316)
    const activePhoto = {
      id: 'foto-2',
      url: 'blob:http://localhost/clean-photo-2',
      cleanUrl: 'blob:http://localhost/clean-photo-2',
      procedimentosMapeados: [
        {
          id: 'cat-biopsia-1',
          catalogoProcedimentoSaudeId: 'cat-biopsia-1',
          nome: 'Biópsia de Pele',
          corHex: '#f97316', // Laranja
        },
      ],
      pontos: [
        {
          id: 'pt-antigo-1',
          tipoGeometria: 'ponto',
          posX: 30,
          posY: 40,
          cor: '#64748b', // Cinza antigo
          corHex: '#64748b', // Cinza antigo
          catalogoProcedimentoSaudeId: 'cat-biopsia-1',
          quantidade: 1,
        },
      ],
    };

    planejamentosApi.listarPorPaciente.mockResolvedValue([]);
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

    const btnSalvar = screen.getByRole('button', { name: /Salvar Avaliação/i });
    fireEvent.click(btnSalvar);

    const btnGerarPlano = await screen.findByRole('button', { name: /Sim, gerar Plano de Tratamento/i });
    fireEvent.click(btnGerarPlano);

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });

    const savedCapture = onSaved.mock.calls[0][0];
    // A cor entregue ao Hub em memória deve ser o Laranja (#f97316), NÃO o cinza antigo
    expect(savedCapture.pontos[0].corHex).toBe('#f97316');
    expect(savedCapture.mapaOverlay.marcacoes[0].corHex).toBe('#f97316');
  });
});
