import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { PlanoVisitasTimeline } from './PlanoVisitasTimeline.jsx';
import { parseGaleriaLegenda, formatGaleriaLegendaForUpload, GALERIA_CATEGORIA } from '../../utils/pacienteGaleria.js';
import { resolverFotosEPlanos } from '../../utils/planoGaleriaResolver.js';

vi.mock('../../contexts/OrgContext.jsx', () => ({
  useAgoraDaClinica: () => ({ hojeIso: '2026-11-02', fuso: 'America/Sao_Paulo' }),
  useOrg: () => ({ currentOrg: { id: 'org-1' } }),
}));

vi.mock('../patients/galeria/GaleriaMapaThumb.jsx', () => ({
  GaleriaMapaThumb: () => <div data-testid="galeria-mapa-thumb" />,
}));

describe('Correção de Fotos e Mapas em Retornos de Planos', () => {
  it('legenda parse e format aceitam pos_imediato sem rebaixar para antes', () => {
    const formatted = formatGaleriaLegendaForUpload('pos-imediato', 'Foto pós');
    expect(formatted).toContain('[pos_imediato]');
    expect(formatted).not.toContain('[antes]');

    const parsed = parseGaleriaLegenda(formatted);
    expect(parsed.categoria).toBe(GALERIA_CATEGORIA.POS_IMEDIATO);
  });

  it('resolverFotosEPlanos não descarta foto de retorno como avulsa se tiver vínculo com procedimento do plano', () => {
    const planos = [
      {
        id: 'plano-1',
        itens: [
          {
            id: 'item-1',
            catalogoNome: 'Infiltração',
            sessaoRealizada: { procedimentoFeitoId: 'pf-pai-1' },
            sessaoRetornoRealizada: { procedimentoFeitoId: 'pf-ret-1' },
          },
        ],
      },
    ];

    const fotos = [
      {
        id: 'foto-ret-resultado',
        procedimentoFeitoId: 'pf-ret-1',
        legenda: '[depois] [avulso] Resultado do retorno', // tag acidental [avulso]
        categoria: 'depois',
      },
    ];

    const { fotosPorPlanoId, fotosAvulsas } = resolverFotosEPlanos(planos, fotos, []);
    expect(fotosAvulsas).toHaveLength(0);
    expect(fotosPorPlanoId['plano-1']).toHaveLength(1);
    expect(fotosPorPlanoId['plano-1'][0].isRetorno).toBe(true);
  });

  it('isola mapas de retornos de dias e atendimentos diferentes na timeline', () => {
    const plano = {
      id: 'plano-1',
      criadoEm: '2026-10-20T10:00:00Z',
      itens: [
        {
          id: 'item-1',
          catalogoNome: 'Infiltração',
          statusItem: 'finalizado',
          sessoes: [
            {
              id: 'sessao-pai',
              tipoProcedimentoCodigo: 'procedimento',
              dataAgendamento: '2026-10-25',
              horaInicio: '10:00',
              statusCodigo: 'realizado',
              procedimentoFeitoId: 'pf-pai',
            },
            {
              id: 'sessao-ret-1',
              tipoProcedimentoCodigo: 'retorno',
              dataAgendamento: '2026-10-30',
              horaInicio: '09:00',
              statusCodigo: 'realizado',
              agendaId: 'agenda-ret-1',
              procedimentoFeitoId: 'pf-ret-1',
            },
            {
              id: 'sessao-ret-2',
              tipoProcedimentoCodigo: 'retorno',
              dataAgendamento: '2026-11-01',
              horaInicio: '15:00',
              statusCodigo: 'realizado',
              agendaId: 'agenda-ret-2',
              procedimentoFeitoId: 'pf-ret-2',
            },
          ],
        },
      ],
    };

    const fotosDoPlano = [
      {
        id: 'mapa-ret-1',
        categoria: 'mapa',
        agendaId: 'agenda-ret-1',
        procedimentoFeitoId: 'pf-ret-1',
        dataISO: '2026-10-30',
        isRetorno: true,
        matchedItemId: 'item-1_retorno',
        mapaOverlay: { tipoMapaCodigo: 'retorno' },
        url: 'https://exemplo.com/map1.jpg',
      },
      {
        id: 'mapa-ret-2',
        categoria: 'mapa',
        agendaId: 'agenda-ret-2',
        procedimentoFeitoId: 'pf-ret-2',
        dataISO: '2026-11-01',
        isRetorno: true,
        matchedItemId: 'item-1_retorno',
        mapaOverlay: { tipoMapaCodigo: 'retorno' },
        url: 'https://exemplo.com/map2.jpg',
      },
      {
        id: 'foto-antes-ret-2',
        categoria: 'antes',
        tipoFotoCodigo: 'ANTES',
        agendaId: 'agenda-ret-2',
        procedimentoFeitoId: 'pf-ret-2',
        dataISO: '2026-11-01',
        isRetorno: true,
        matchedItemId: 'item-1_retorno',
        url: 'https://exemplo.com/antes2.jpg',
      },
      {
        id: 'foto-pos-ret-2',
        categoria: 'pos_imediato',
        tipoFotoCodigo: 'POS_IMEDIATO',
        agendaId: 'agenda-ret-2',
        procedimentoFeitoId: 'pf-ret-2',
        dataISO: '2026-11-01',
        isRetorno: true,
        matchedItemId: 'item-1_retorno',
        url: 'https://exemplo.com/pos2.jpg',
      },
    ];

    render(<PlanoVisitasTimeline plano={plano} fotosDoPlano={fotosDoPlano} />);

    // Deve exibir as visitas separadas
    expect(screen.getByText(/30 de out/i)).toBeInTheDocument();
    expect(screen.getByText(/01 de nov|1 de nov|Ontem/i)).toBeInTheDocument();

    // Rótulos clínicos de retoque devem estar presentes (renderizados com contagem "· 1 foto")
    expect(screen.getByText(/Antes \(Retoque\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Pós-Imediato \(Retoque\)/i)).toBeInTheDocument();
  });

  it('agrupa múltiplos procedimentos de retorno da mesma sessão em 1 única visita', () => {
    const plano = {
      id: 'plano-1',
      criadoEm: '2026-10-20T10:00:00Z',
      itens: [
        {
          id: 'item-1',
          catalogoNome: 'Biópsia de Pele',
          statusItem: 'finalizado',
          dataRealizacao: '2026-10-20',
          sessoes: [
            {
              id: 'sessao-ret-1',
              tipoProcedimentoCodigo: 'retorno',
              dataAgendamento: '2026-11-02',
              horaInicio: '15:00',
              statusCodigo: 'realizado',
              agendaId: 'agenda-sessao-compartilhada',
              procedimentoFeitoId: 'pf-ret-1',
            },
          ],
        },
        {
          id: 'item-2',
          catalogoNome: 'Sutura de Ferida',
          statusItem: 'finalizado',
          dataRealizacao: '2026-10-20',
          sessoes: [
            {
              id: 'sessao-ret-2',
              tipoProcedimentoCodigo: 'retorno',
              dataAgendamento: '2026-11-02',
              horaInicio: '15:02',
              statusCodigo: 'realizado',
              agendaId: 'agenda-sessao-compartilhada',
              procedimentoFeitoId: 'pf-ret-2',
            },
          ],
        },
        {
          id: 'item-3',
          catalogoNome: 'Drenagem de Abscesso',
          statusItem: 'finalizado',
          dataRealizacao: '2026-10-20',
          sessoes: [
            {
              id: 'sessao-ret-3',
              tipoProcedimentoCodigo: 'retorno',
              dataAgendamento: '2026-11-02',
              horaInicio: '15:05',
              statusCodigo: 'realizado',
              agendaId: 'agenda-sessao-compartilhada',
              procedimentoFeitoId: 'pf-ret-3',
            },
          ],
        },
      ],
    };

    render(<PlanoVisitasTimeline plano={plano} fotosDoPlano={[]} />);

    // Deve exibir APENAS 1 card de visita de retorno contendo os 3 procedimentos agrupados
    const retornoHeaders = screen.getAllByText(/Visita \d+ · Retorno Clínico/i);
    expect(retornoHeaders).toHaveLength(1);

    // Todos os 3 procedimentos de retorno devem estar presentes no documento
    expect(screen.getByText(/Retorno Clínico · Biópsia de Pele/i)).toBeInTheDocument();
    expect(screen.getByText(/Retorno Clínico · Sutura de Ferida/i)).toBeInTheDocument();
    expect(screen.getByText(/Retorno Clínico · Drenagem de Abscesso/i)).toBeInTheDocument();
  });
});
