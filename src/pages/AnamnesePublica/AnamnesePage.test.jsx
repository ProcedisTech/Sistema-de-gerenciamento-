import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import '@testing-library/jest-dom';
import { AnamnesePage } from './AnamnesePage.jsx';

vi.mock('../../config/apiEnv', () => ({
  resolveApiUrl: (path) => path,
}));

function mockLookup(payload) {
  fetch.mockImplementation((url) => {
    if (String(url).includes('/api/public/anamnese/lookup')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(payload) });
    }
    return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
  });
}

async function abrirComCpf() {
  render(<AnamnesePage />);
  await userEvent.click(await screen.findByRole('button', { name: 'Continuar' }));
}

describe('AnamnesePage — datas no fuso da clínica', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    window.history.pushState({}, '', '/anamnese?clinic=clinica-x&cpf=12345678901');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/');
  });

  it('validadeAte (LocalDate) aparece como data de calendário, sem deslocar o dia', async () => {
    mockLookup({ status: 'VALIDA', pacienteNome: 'Ana', validadeAte: '2026-12-31' });
    await abrirComCpf();
    expect(await screen.findByText('31/12/2026')).toBeInTheDocument();
  });

  it('"Data do preenchimento" usa o agora no fusoHorario do payload', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 00:30 UTC = 21:30 em Brasília (dia 30) = 19:30 em Rio Branco (dia 30).
    vi.setSystemTime(new Date('2026-10-01T00:30:00Z'));
    mockLookup({
      status: 'PENDENTE',
      pacienteNome: 'Ana',
      fusoHorario: 'America/Rio_Branco',
      modelo: { nome: 'Ficha', anamneseId: 'a1', categorias: [] },
    });
    await abrirComCpf();
    await userEvent.click(await screen.findByRole('button', { name: /Continuar para assinatura/ }));
    await screen.findByText('Declaração do Paciente');
    expect(document.body.textContent).toContain('Data do preenchimento: 30/09/2026 às 19:30');
  });

  it('sem fusoHorario no payload cai no FUSO_PADRAO', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T00:30:00Z'));
    mockLookup({
      status: 'PENDENTE',
      pacienteNome: 'Ana',
      modelo: { nome: 'Ficha', anamneseId: 'a1', categorias: [] },
    });
    await abrirComCpf();
    await userEvent.click(await screen.findByRole('button', { name: /Continuar para assinatura/ }));
    await screen.findByText('Declaração do Paciente');
    expect(document.body.textContent).toContain('Data do preenchimento: 30/09/2026 às 21:30');
  });
});
