import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlanoVisitasTimeline } from './PlanoVisitasTimeline.jsx';

vi.mock('../../contexts/OrgContext.jsx', () => ({
  useAgoraDaClinica: () => ({ hojeIso: '2026-10-24', fuso: 'America/Sao_Paulo' }),
  useOrg: () => ({ currentOrg: { id: 'org-1' } }),
}));

vi.mock('../patients/galeria/GaleriaMapaThumb.jsx', () => ({
  GaleriaMapaThumb: () => <div data-testid="galeria-mapa-thumb" />,
}));

describe('PlanoVisitasTimeline — Regressão cod is not defined', () => {
  it('renderiza com fotos contendo categorias variadas sem estourar ReferenceError', () => {
    const plano = {
      id: 'plano-1',
      criadoEm: '2026-10-24T14:00:00Z',
      itens: [
        {
          id: 'item-1',
          catalogoNome: 'Biópsia de Pele',
          statusItem: 'PLANEJADO',
          dataPlanejada: '2026-10-24',
        },
      ],
    };

    // Foto com categoria 'antes' anteriormente fazia o short-circuit avançar para cod === 'AVALIACAO' e quebrar
    const fotosDoPlano = [
      { id: 'f-1', categoria: 'antes', url: 'https://exemplo.com/antes.jpg' },
      { id: 'f-2', categoria: 'depois', url: 'https://exemplo.com/depois.jpg' },
      { id: 'f-3', tipoFotoCodigo: 'AVALIACAO', url: 'https://exemplo.com/av.jpg' },
      { id: 'f-4', categoria: 'avaliacao', url: 'https://exemplo.com/av2.jpg' },
      { id: 'f-5', mapaOverlay: { tipoMapaCodigo: 'avaliacao' }, url: 'https://exemplo.com/map.jpg' },
    ];

    expect(() => {
      render(
        <PlanoVisitasTimeline
          plano={plano}
          fotosDoPlano={fotosDoPlano}
        />
      );
    }).not.toThrow();

    expect(screen.getByText('Biópsia de Pele')).toBeInTheDocument();
  });
});
