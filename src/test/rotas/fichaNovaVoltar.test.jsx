/** Correção Onda 3 (🔴1): ficha nova digitada + Voltar do navegador não pode sumir sem aviso. */
import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { assentarMuito, montarApp, TIMEOUT } from '../consulta/appConsulta.jsx';
import { ultimoRoteador } from './montarComRoteador.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());
vi.mock('../../components/anamnese/AnamneseDocumentoEditor.jsx', () => ({
  AnamneseDocumentoEditor: ({ onDirtyChange, onBack }) => (
    <div>
      <button type="button" onClick={onBack}>Voltar-editor</button>
      <input aria-label="campo-ficha" onChange={() => onDirtyChange?.(true)} />
    </div>
  ),
}));

const rotas = [['GET', /^\/api\/v1\/anamnese\/fichas$/, () => [{ id: 5, nome: 'Ficha Cinco', totalPerguntas: 1 }]]];
const avisos = () => screen.queryAllByRole('heading', { name: 'Alterações não salvas' });
const campo = () => screen.queryByLabelText('campo-ficha');
const botaoFichas = () => screen.getAllByRole('button', { name: /^Fichas/ }).find((b) => b.closest('aside'));
const clicar = async (el) => { fireEvent.click(el); await assentarMuito(); };

afterEach(() => {
  limparAmbienteSnapshot();
  sessionStorage.clear();
  localStorage.clear();
});

async function abrirNovaFicha() {
  await clicar(await screen.findByRole('button', { name: /Nova Ficha/i }));
}

describe('ficha nova + Voltar do navegador', () => {
  it('Voltar do editor, nova ficha, digita, Voltar do navegador: avisa e o texto fica', async () => {
    await montarApp({ caminho: '/configuracoes/fichas/5', rotas });
    await clicar(await screen.findByRole('button', { name: 'Voltar-editor' })); // lista; a ficha 5 fica como entrada anterior
    await abrirNovaFicha();
    await clicar(screen.getByRole('button', { name: 'Voltar-editor' }));
    expect(campo()).toBeNull();
    await abrirNovaFicha();
    fireEvent.change(campo(), { target: { value: 'texto' } });
    await assentarMuito();
    ultimoRoteador().navigate(-1);
    await assentarMuito();
    expect(avisos()).toHaveLength(1);
    expect(campo()).not.toBeNull();
    await clicar(screen.getByRole('button', { name: /continuar editando/i }));
    expect(avisos()).toHaveLength(0);
    expect(campo().value).toBe('texto');
    ultimoRoteador().navigate(-1);
    await assentarMuito();
    await clicar(screen.getByRole('button', { name: 'Sair sem salvar' }));
    expect(ultimoRoteador().state.location.pathname).toBe('/configuracoes/fichas/5');
    expect(avisos()).toHaveLength(0);
  }, TIMEOUT);

  it('clicar "Fichas" na lateral estando em Fichas não empilha endereço repetido', async () => {
    await montarApp({ caminho: '/configuracoes/fichas', rotas });
    const entradas = () => ultimoRoteador().state.historyAction;
    await clicar(botaoFichas());
    expect(entradas()).not.toBe('PUSH');
  }, TIMEOUT);

  it('sem alteração: Voltar do editor e Voltar do navegador saem direto, sem aviso', async () => {
    await montarApp({ caminho: '/configuracoes/fichas', rotas });
    await abrirNovaFicha();
    await clicar(screen.getByRole('button', { name: 'Voltar-editor' }));
    await abrirNovaFicha();
    ultimoRoteador().navigate(-1);
    await assentarMuito();
    expect(avisos()).toHaveLength(0);
  }, TIMEOUT);
});
