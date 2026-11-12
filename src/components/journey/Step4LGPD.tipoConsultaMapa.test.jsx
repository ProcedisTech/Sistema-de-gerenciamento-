/** O mapa de aplicação não recebe a linha Consulta sem catálogo; a de catálogo passa. */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';

const capturado = vi.hoisted(() => ({ props: [] }));

vi.mock('../../hooks/useProcedimentosOptions', () => ({
  useProcedimentosOptions: () => ({ options: [], loading: false }),
}));
vi.mock('./mapa-aplicacao/MapaAplicacaoPanel.jsx', () => ({
  MapaAplicacaoPanel: (p) => { capturado.props.push(p); return <div data-testid="mapa-panel">mapa</div>; },
}));
vi.mock('./PhotoCarouselLane.jsx', () => ({ PhotoCarouselLane: () => <div /> }));

const { Step4Procedimento } = await import('./Step4LGPD.jsx');
const { linhaDoItemServidor } = await import('../consulta/consultaServidor.js');
const api = await import('../../services/api');

const item = (codigo, extras = {}) => ({
  id: 'i', ordem: 1, agendaId: 'ag-1', agendaTipoProcedimentoCodigo: codigo,
  catalogoProcedimentoSaudeId: null, procedimentoNome: null, nomeLivre: null, ...extras,
});

describe('Step4 -> MapaAplicacaoPanel', () => {
  it('só o procedimento de catálogo chega ao mapa', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({}) });
    const consulta = linhaDoItemServidor(item('CONSULTA', { id: 'i-c' }));
    const cat = linhaDoItemServidor(item('PROCEDIMENTO', { id: 'i-p', catalogoProcedimentoSaudeId: 'cat-1', procedimentoNome: 'Botox' }));
    render(<Step4Procedimento mapaState={{}} procedimentosSessao={[consulta, cat]} nomeProcedimento="Botox" />);
    expect(await screen.findByTestId('mapa-panel')).toBeInTheDocument();
    const ultima = capturado.props.at(-1).procedimentosSessao;
    expect(ultima).toHaveLength(1);
    expect(ultima[0].itemId).toBe('i-p');
    expect(ultima.some((l) => l.tipoAgendaCodigo === 'CONSULTA')).toBe(false);
    const chamadas = [...fetchSpy.mock.calls.map((c) => String(c[0])), ...Object.values(api).flatMap((o) => (o && o.mock ? o.mock.calls.map(String) : []))];
    expect(chamadas.some((u) => u.includes('catalogos/idx_'))).toBe(false);
  });
});
