/** Onda 3B-2: clicar "Fichas" estando em Fichas com ficha (aberta ou nova) suja mostra o aviso do App, uma vez. */
import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { assentarMuito, montarApp, TIMEOUT } from '../consulta/appConsulta.jsx';
import { ultimoRoteador } from './montarComRoteador.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());
// Editor falso: só um campo que avisa "sujo" ao pai e guarda o que foi digitado.
vi.mock('../../components/anamnese/AnamneseDocumentoEditor.jsx', () => ({
  AnamneseDocumentoEditor: ({ onDirtyChange }) => (
    <input aria-label="campo-ficha" onChange={() => onDirtyChange?.(true)} />
  ),
}));

const rotas = [['GET', /^\/api\/v1\/anamnese\/fichas$/, () => [{ id: 5, nome: 'Ficha Cinco', totalPerguntas: 1 }]]];
const caminho = () => ultimoRoteador().state.location.pathname;
const avisos = () => screen.queryAllByRole('heading', { name: 'Alterações não salvas' });
const botaoFichas = () => screen.getAllByRole('button', { name: /^Fichas/ }).find((b) => b.closest('aside'));
const campo = () => screen.queryByLabelText('campo-ficha');

afterEach(() => {
  limparAmbienteSnapshot();
  sessionStorage.clear();
  localStorage.clear();
});

async function sujarEClicarFichas() {
  fireEvent.change(campo(), { target: { value: 'x' } });
  await assentarMuito();
  fireEvent.click(botaoFichas());
  await assentarMuito();
}

describe.each([
  ['aberta', '/configuracoes/fichas/5', null],
  ['nova', '/configuracoes/fichas', /Nova Ficha/i],
])('ficha %s suja + clicar "Fichas"', (_nome, url, botaoNova) => {
  it('avisa uma vez, continuar mantém a ficha, sair sem salvar volta à lista', async () => {
    await montarApp({ caminho: url, rotas });
    if (botaoNova) {
      fireEvent.click(await screen.findByRole('button', { name: botaoNova }));
      await assentarMuito();
    }
    expect(campo()).not.toBeNull();
    await sujarEClicarFichas();
    expect(avisos()).toHaveLength(1);
    expect(campo()).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /continuar editando/i }));
    await assentarMuito();
    expect(avisos()).toHaveLength(0);
    expect(campo()).not.toBeNull();
    expect(campo().value).toBe('x');
    fireEvent.click(botaoFichas());
    await assentarMuito();
    fireEvent.click(screen.getByRole('button', { name: 'Sair sem salvar' }));
    await assentarMuito();
    expect(avisos()).toHaveLength(0);
    expect(campo()).toBeNull();
    expect(caminho()).toBe('/configuracoes/fichas');
  }, TIMEOUT);
});
