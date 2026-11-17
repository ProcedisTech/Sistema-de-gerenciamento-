import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { PlanoVisitasTimeline } from './PlanoVisitasTimeline.jsx';

vi.mock('../hooks/useAgoraDaClinica.js', () => ({
  useAgoraDaClinica: () => ({ hojeIso: '2026-11-16', fuso: 'America/Sao_Paulo' }),
}));
vi.mock('../hooks/useFusoClinica.js', () => ({
  useFusoClinica: () => ({ fuso: 'America/Sao_Paulo' }),
}));
vi.mock('../patients/galeria/GaleriaMapaThumb.jsx', () => ({
  GaleriaMapaThumb: () => <div data-testid="galeria-mapa-thumb" />,
}));

describe('PlanoVisitasTimeline - hora do procedimento feito em UTC', () => {
  it('02:40Z vira 23:40 do dia 15/11 em Brasília, sem pedaço de data ISO na tela', () => {
    const plano = {
      id: 'plano-1',
      criadoEm: '2026-11-10T12:00:00Z',
      itens: [
        {
          id: 'item-1',
          catalogoNome: 'Infiltração',
          statusItem: 'finalizado',
          sessaoRealizada: { procedimentoFeitoId: 'pf-1' },
        },
      ],
    };
    const procedimentosFeitos = [
      { id: 'pf-1', criadoEm: '2026-11-16T02:40:00Z', horaInicio: '2026-11-16T02:40:00Z' },
    ];

    const { container } = render(
      <PlanoVisitasTimeline plano={plano} procedimentosFeitos={procedimentosFeitos} fotos={[]} />,
    );

    // sinal positivo antes das ausências
    expect(screen.getAllByText(/Realizado em 15\/11\/2026 às 23:40/).length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain('2026-');
    expect(container.textContent).not.toContain('02:40');
  });
  const verificar = (container) => {
    // sinal positivo antes das ausências
    expect(screen.getByText('23:40')).toBeInTheDocument();
    expect(screen.getAllByText(/15 de nov/i).length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain('02:40');
    expect(container.textContent).not.toContain('2026-');
  };

  it(':636 avaliação sem data na foto usa criadoEm do plano (02:40Z -> 23:40 do dia 15/11)', () => {
    const plano = { id: 'plano-1', criadoEm: '2026-11-16T02:40:00Z', itens: [] };
    const fotosDoPlano = [{ id: 'f1', categoria: 'avaliacao', url: 'https://exemplo.com/a.jpg' }];
    const { container } = render(<PlanoVisitasTimeline plano={plano} fotosDoPlano={fotosDoPlano} />);
    verificar(container);
  });

  it(':630 avaliação com data na foto usa registradoEm (02:40Z -> 23:40)', () => {
    const plano = { id: 'plano-1', criadoEm: '2026-11-10T12:00:00Z', itens: [] };
    const fotosDoPlano = [{
      id: 'f1', categoria: 'avaliacao', dataISO: '2026-11-15', registradoEm: '2026-11-16T02:40:00Z', url: 'https://exemplo.com/a.jpg',
    }];
    const { container } = render(<PlanoVisitasTimeline plano={plano} fotosDoPlano={fotosDoPlano} />);
    verificar(container);
  });

  it(':503 retorno sintetizado de fotos usa registradoEm (02:40Z -> 23:40)', () => {
    const plano = {
      id: 'plano-1',
      criadoEm: '2026-11-10T12:00:00Z',
      itens: [{ id: 'item-1', catalogoNome: 'Infiltração', statusItem: 'finalizado' }],
    };
    const fotosPorPlanejamentoItemId = {
      'item-1_retorno': [{
        id: 'fr1', dataISO: '2026-11-15', registradoEm: '2026-11-16T02:40:00Z', isRetorno: true, url: 'https://exemplo.com/r.jpg',
      }],
    };
    const { container } = render(
      <PlanoVisitasTimeline plano={plano} fotosPorPlanejamentoItemId={fotosPorPlanejamentoItemId} />,
    );
    verificar(container);
  });
});
