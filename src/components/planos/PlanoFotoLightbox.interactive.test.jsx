import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlanoFotoLightbox } from './PlanoFotoLightbox.jsx';
import { marcacoesApiToOverlayPontos } from '../journey/mapeamento/mapaMarcacoesOverlayUtils.js';

vi.mock('../patients/GaleriaArquivoImage.jsx', () => ({
  GaleriaArquivoImage: ({ alt }) => <img alt={alt} data-testid="galeria-arquivo-img" />,
}));

vi.mock('../patients/galeria/GaleriaMapaThumb.jsx', () => ({
  GaleriaMapaThumb: ({
    alt,
    interactive,
    filtroProcedimentoId,
    procedimentosOcultosIds,
    hoveredPontoId,
    onMarkerHover,
    onMarkerClick,
    ocultarMarcacoes,
  }) => (
    <div
      data-testid="galeria-mapa-thumb"
      data-interactive={String(interactive)}
      data-filtro={filtroProcedimentoId || ''}
      data-ocultos={(procedimentosOcultosIds || []).join(',')}
      data-hovered={hoveredPontoId || ''}
      data-ocultar={String(ocultarMarcacoes)}
      onClick={() => onMarkerClick?.({ id: 'p1', mapaProcedimentoId: 'proc-1' })}
      onMouseEnter={() => onMarkerHover?.({ id: 'p1', mapaProcedimentoId: 'proc-1' })}
      onMouseLeave={() => onMarkerHover?.(null)}
    >
      <span>{alt}</span>
    </div>
  ),
}));

describe('PlanoFotoLightbox - Mapa Interativo & Sidebar de Insumos', () => {
  const mockFotoMapa = {
    id: 'foto-1',
    url: 'https://exemplo.com/foto.jpg',
    categoria: 'mapa',
    descricaoLegenda: 'Aplicação Face Completa',
    dataISO: '2026-03-20T10:00:00.000Z',
    mapaOverlay: {
      mapaId: 'mapa-123',
      procedimentos: [
        {
          id: 'proc-1',
          catalogoNome: 'Toxina Botulínica',
          corHex: '#06b6d4',
          unidade: 'u',
        },
        {
          id: 'proc-2',
          catalogoNome: 'Ácido Hialurônico',
          corHex: '#ec4899',
          unidade: 'ml',
        },
      ],
      marcacoes: [
        {
          id: 'm1',
          mapaProcedimentoId: 'proc-1',
          tipoGeometria: 'ponto',
          quantidade: 2.0,
          vertices: [{ posX: 30, posY: 40, ordem: 1 }],
        },
        {
          id: 'm2',
          mapaProcedimentoId: 'proc-1',
          tipoGeometria: 'ponto',
          quantidade: 1.5,
          vertices: [{ posX: 35, posY: 45, ordem: 2 }],
        },
        {
          id: 'm3',
          mapaProcedimentoId: 'proc-2',
          tipoGeometria: 'ponto',
          quantidade: 0.8,
          vertices: [{ posX: 60, posY: 70, ordem: 1 }],
        },
      ],
    },
  };

  it('enriquece marcacoes com procedimentos via marcacoesApiToOverlayPontos', () => {
    const overlayPontos = marcacoesApiToOverlayPontos(
      mockFotoMapa.mapaOverlay.marcacoes,
      mockFotoMapa.mapaOverlay.procedimentos
    );

    expect(overlayPontos).toHaveLength(3);
    expect(overlayPontos[0].nomeProcedimento).toBe('Toxina Botulínica');
    expect(overlayPontos[0].cor).toBe('#06b6d4');
    expect(overlayPontos[0].unidadeMedida).toBe('u');
    expect(overlayPontos[0].ordemPonto).toBe(1);

    expect(overlayPontos[2].nomeProcedimento).toBe('Ácido Hialurônico');
    expect(overlayPontos[2].cor).toBe('#ec4899');
    expect(overlayPontos[2].unidadeMedida).toBe('ml');
  });

  it('renderiza os chips rápidos no cabeçalho com nomes e doses totais', () => {
    render(<PlanoFotoLightbox foto={mockFotoMapa} pacienteId="pac-1" onClose={vi.fn()} />);

    // Deve exibir chips para ambos os procedimentos
    const toxinaChips = screen.getAllByText(/Toxina Botulínica/i);
    expect(toxinaChips.length).toBeGreaterThanOrEqual(1);

    const acidoChips = screen.getAllByText(/Ácido Hialurônico/i);
    expect(acidoChips.length).toBeGreaterThanOrEqual(1);

    // Doses calculadas (2.0 + 1.5 = 3.5 u e 0.8 ml)
    expect(screen.getAllByText(/3.5 u/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/0.8 ml/i).length).toBeGreaterThanOrEqual(1);
  });

  it('alterna o modo Foto Limpa pelo botão no cabeçalho', () => {
    render(<PlanoFotoLightbox foto={mockFotoMapa} pacienteId="pac-1" onClose={vi.fn()} />);

    const thumb = screen.getByTestId('galeria-mapa-thumb');
    expect(thumb.getAttribute('data-ocultar')).toBe('false');

    const btnFotoLimpa = screen.getByTitle(/Ver foto original sem marcações/i);
    fireEvent.click(btnFotoLimpa);

    expect(thumb.getAttribute('data-ocultar')).toBe('true');
  });

  it('alterna visibilidade de procedimentos ao clicar no chip do cabeçalho', () => {
    render(<PlanoFotoLightbox foto={mockFotoMapa} pacienteId="pac-1" onClose={vi.fn()} />);

    const thumb = screen.getByTestId('galeria-mapa-thumb');
    expect(thumb.getAttribute('data-ocultos')).toBe('');

    const [btnToxinaChip] = screen.getAllByTitle(/Ocultar Toxina Botulínica/i);
    fireEvent.click(btnToxinaChip);

    expect(thumb.getAttribute('data-ocultos')).toContain('proc-1');
  });

  it('renderiza os pontos individuais com numeração neutra e sem nomes anatômicos fictícios', () => {
    render(<PlanoFotoLightbox foto={mockFotoMapa} pacienteId="pac-1" onClose={vi.fn()} />);

    // Deve conter Ponto #1 e Ponto #2 da Toxina, e Ponto #1 do Ácido
    expect(screen.getAllByText(/Ponto #1/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Ponto #2/i).length).toBeGreaterThanOrEqual(1);

    // Não deve conter termos inventados como molar/testa/bochecha
    expect(screen.queryByText(/molar/i)).toBeNull();
    expect(screen.queryByText(/testa/i)).toBeNull();
    expect(screen.queryByText(/bochecha/i)).toBeNull();
  });

  it('renderiza os cards de procedimentos com borda lateral colorida de identificação', () => {
    render(<PlanoFotoLightbox foto={mockFotoMapa} pacienteId="pac-1" onClose={vi.fn()} />);

    // Localiza os cards de procedimento com borda-l-4 na sidebar
    const nomesToxina = screen.getAllByText('Toxina Botulínica');
    const cardToxina = nomesToxina.map((el) => el.closest('.border-l-4')).find(Boolean);
    expect(cardToxina).not.toBeNull();
    expect(cardToxina.style.borderLeftColor).toBe('rgb(6, 182, 212)'); // #06b6d4

    const nomesAcido = screen.getAllByText('Ácido Hialurônico');
    const cardAcido = nomesAcido.map((el) => el.closest('.border-l-4')).find(Boolean);
    expect(cardAcido).not.toBeNull();
    expect(cardAcido.style.borderLeftColor).toBe('rgb(236, 72, 153)'); // #ec4899
  });

  it('exibe no máximo 2 chips no cabeçalho e condensa os demais no botão de overflow popover (+N outros)', () => {
    const mockFotoMultiplos = {
      ...mockFotoMapa,
      mapaOverlay: {
        procedimentos: [
          { id: 'p1', catalogoNome: 'Toxina Botulínica', corHex: '#06b6d4', unidade: 'u' },
          { id: 'p2', catalogoNome: 'Ácido Hialurônico', corHex: '#ec4899', unidade: 'ml' },
          { id: 'p3', catalogoNome: 'Bioestimulador', corHex: '#10b981', unidade: 'amp' },
          { id: 'p4', catalogoNome: 'Fios de PDO', corHex: '#8b5cf6', unidade: 'un' },
        ],
        marcacoes: [
          { id: 'm1', mapaProcedimentoId: 'p1', quantidade: 2.0, vertices: [{ posX: 10, posY: 10 }] },
          { id: 'm2', mapaProcedimentoId: 'p2', quantidade: 1.0, vertices: [{ posX: 20, posY: 20 }] },
          { id: 'm3', mapaProcedimentoId: 'p3', quantidade: 1.0, vertices: [{ posX: 30, posY: 30 }] },
          { id: 'm4', mapaProcedimentoId: 'p4', quantidade: 4.0, vertices: [{ posX: 40, posY: 40 }] },
        ],
      },
    };

    const onCloseMock = vi.fn();
    render(<PlanoFotoLightbox foto={mockFotoMultiplos} pacienteId="pac-1" onClose={onCloseMock} />);

    // Botão de overflow deve aparecer com "+2 outros"
    const btnOverflow = screen.getByText('+2 outros');
    expect(btnOverflow).not.toBeNull();

    // Antes de abrir o popover, os itens excedentes não estão no popover
    expect(screen.queryByText('Outros Procedimentos')).toBeNull();

    // Clica para abrir o popover
    fireEvent.click(btnOverflow);

    // Agora o cabeçalho do popover deve ser visível
    expect(screen.getByText('Outros Procedimentos')).not.toBeNull();

    // Clica em Fios de PDO dentro do popover para alternar visibilidade
    const itemFios = screen.getAllByText('Fios de PDO').find((el) => el.closest('.shadow-xl'));
    expect(itemFios).toBeDefined();
    fireEvent.click(itemFios);

    // O procedimento deve ter sido adicionado aos ocultos
    const thumb = screen.getByTestId('galeria-mapa-thumb');
    expect(thumb.getAttribute('data-ocultos')).toContain('p4');
  });

  it('permite alternar a visibilidade do procedimento clicando em qualquer área do card (inclusive no rótulo Pontos de aplicação)', () => {
    render(<PlanoFotoLightbox foto={mockFotoMapa} pacienteId="pac-1" onClose={vi.fn()} />);

    const thumb = screen.getByTestId('galeria-mapa-thumb');
    expect(thumb.getAttribute('data-ocultos')).toBe('');

    // Clica no texto "Pontos de aplicação (2):" da Toxina
    const labelPontos = screen.getByText(/Pontos de aplicação \(2\):/i);
    fireEvent.click(labelPontos);

    // Deve adicionar Toxina aos procedimentos ocultos
    expect(thumb.getAttribute('data-ocultos')).toContain('proc-1');

    // Clica novamente na mesma área para desocultar
    fireEvent.click(labelPontos);
    expect(thumb.getAttribute('data-ocultos')).toBe('');
  });

  it('exibe o botão Mostrar todos no resumo de insumos apenas quando houver procedimentos desmarcados', () => {
    render(<PlanoFotoLightbox foto={mockFotoMapa} pacienteId="pac-1" onClose={vi.fn()} />);

    const thumb = screen.getByTestId('galeria-mapa-thumb');
    expect(thumb.getAttribute('data-ocultos')).toBe('');

    // Inicialmente com todos visíveis, o cabeçalho fica limpo (sem botão Ocultar todos redundante)
    expect(screen.queryByRole('button', { name: /Ocultar todos/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Mostrar todos/i })).toBeNull();

    // Desmarca a Toxina
    const labelPontos = screen.getByText(/Pontos de aplicação \(2\):/i);
    fireEvent.click(labelPontos);
    expect(thumb.getAttribute('data-ocultos')).toContain('proc-1');

    // Agora o botão Mostrar todos deve surgir com o background estilizado
    const btnMostrarTodos = screen.getByRole('button', { name: /Mostrar todos/i });
    expect(btnMostrarTodos).not.toBeNull();

    // Clica em Mostrar todos para restaurar a visão completa
    fireEvent.click(btnMostrarTodos);
    expect(thumb.getAttribute('data-ocultos')).toBe('');

    // Volta a ficar limpo após restaurar
    expect(screen.queryByRole('button', { name: /Mostrar todos/i })).toBeNull();
  });

  it('reativa automaticamente o procedimento oculto ao clicar no botão de um ponto específico', () => {
    render(<PlanoFotoLightbox foto={mockFotoMapa} pacienteId="pac-1" onClose={vi.fn()} />);

    const thumb = screen.getByTestId('galeria-mapa-thumb');

    // Oculta a Toxina
    const labelPontos = screen.getByText(/Pontos de aplicação \(2\):/i);
    fireEvent.click(labelPontos);
    expect(thumb.getAttribute('data-ocultos')).toContain('proc-1');

    // Clica diretamente no Ponto #1 da Toxina
    const [ponto1Toxina] = screen.getAllByRole('button', { name: /Ponto #1/i });
    fireEvent.click(ponto1Toxina);

    // O procedimento deve ser reativado
    expect(thumb.getAttribute('data-ocultos')).toBe('');
    expect(thumb.getAttribute('data-hovered')).toBe('m1');
  });

  it('exibe Procedimentos Planejados com Diagnóstico e doses quando for Mapa de Avaliação', () => {
    const mockFotoAvaliacao = {
      id: 'foto-aval-1',
      url: 'https://exemplo.com/foto-aval.jpg',
      categoria: 'avaliacao',
      descricaoLegenda: 'Avaliação Facial',
      dataISO: '2026-10-12T10:00:00.000Z',
      mapaOverlay: {
        mapaId: 'mapa-aval-1',
        procedimentos: [
          {
            id: 'proc-bio',
            catalogoNome: 'Biópsia de Pele',
            corHex: '#d946ef',
            unidade: 'u',
          },
          {
            id: 'proc-dren',
            catalogoNome: 'Drenagem de Abscesso',
            corHex: '#64748b',
            unidade: 'u',
          },
          {
            id: 'proc-ret',
            catalogoNome: 'Retirada de Pontos',
            corHex: '#3b82f6',
            unidade: 'u',
          },
        ],
        marcacoes: [
          {
            id: 'm-bio-1',
            mapaProcedimentoId: 'proc-bio',
            tipoGeometria: 'ponto',
            quantidade: 1.0,
            vertices: [{ posX: 35, posY: 45, ordem: 1 }],
          },
          {
            id: 'm-ret-1',
            mapaProcedimentoId: 'proc-ret',
            tipoGeometria: 'traco',
            quantidade: 1.0,
            vertices: [
              { posX: 40, posY: 40, ordem: 1 },
              { posX: 50, posY: 40, ordem: 2 },
            ],
          },
        ],
      },
    };

    render(<PlanoFotoLightbox foto={mockFotoAvaliacao} pacienteId="pac-1" onClose={vi.fn()} />);

    // Deve exibir o cabeçalho de avaliação
    expect(screen.getByText(/Procedimentos Planejados/i)).not.toBeNull();
    expect(screen.getByText(/Diagnóstico/i)).not.toBeNull();

    // Deve listar os procedimentos reais planejados tanto nos chips quanto no card lateral
    expect(screen.getAllByText(/Biópsia de Pele/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Retirada de Pontos/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Drenagem de Abscesso/i).length).toBeGreaterThan(0);

    // Deve indicar pontos planejados
    expect(screen.getAllByText(/Pontos planejados \(1\):/i).length).toBeGreaterThan(0);
  });

  it('alterna o botão Foto Limpa e passa data-ocultar para o thumb', () => {
    render(<PlanoFotoLightbox foto={mockFotoMapa} pacienteId="pac-1" onClose={vi.fn()} />);

    const thumb = screen.getByTestId('galeria-mapa-thumb');
    expect(thumb.getAttribute('data-ocultar')).toBe('false');

    const btnFotoLimpa = screen.getByRole('button', { name: /Foto Limpa/i });
    fireEvent.click(btnFotoLimpa);

    expect(thumb.getAttribute('data-ocultar')).toBe('true');

    fireEvent.click(btnFotoLimpa);
    expect(thumb.getAttribute('data-ocultar')).toBe('false');
  });
});



