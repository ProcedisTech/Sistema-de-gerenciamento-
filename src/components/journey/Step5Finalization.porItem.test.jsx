// @vitest-environment jsdom
/**
 * Step5Finalization — orientações por item da consulta.
 * `orient === null` carrega o modelo do nome (1 chamada por item); `[]` não recarrega;
 * marcar/editar grava a lista inteira do item; legado é só leitura; sem campo de retorno.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  toast: vi.fn(),
  dismiss: vi.fn(),
}));
const perfilMock = vi.hoisted(() => ({ getOrientacoesTemplate: vi.fn() }));

vi.mock('../../contexts/useToast.js', () => ({ useToast: () => toastMock }));
vi.mock('../../services/api.js', () => ({ perfilApi: perfilMock }));
vi.mock('../hooks/useAgoraDaClinica.js', () => ({
  useAgoraDaClinica: () => ({ pronto: true, fuso: 'America/Sao_Paulo', hojeIso: '2026-10-06' }),
}));

import { Step5Finalization } from './Step5Finalization.jsx';

const base = {
  procedureDateIso: '2026-10-06',
  pacienteNome: 'Ana',
  telefonePaciente: '11999990000',
  nomeProcedimento: 'Toxina botulínica',
  step5Errors: {},
  setStep5Errors: () => {},
};

function item(nome, orient, extra = {}) {
  return { itemId: `item-${nome}`, nome, orient, legado: false, ...extra };
}

describe('Step5Finalization — orientações por item', () => {
  beforeEach(() => {
    perfilMock.getOrientacoesTemplate.mockReset();
    perfilMock.getOrientacoesTemplate.mockImplementation(async (nome) => [
      { descricao: `Modelo de ${nome}`, ordem: 0 },
    ]);
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('(a) 2 itens com orient null: busca o modelo de cada nome e grava cada item', async () => {
    const setOrientacoesDoItem = vi.fn();
    render(
      <Step5Finalization
        {...base}
        itensOrientacoes={[item('Toxina', null), item('Preenchimento', null)]}
        setOrientacoesDoItem={setOrientacoesDoItem}
        itensSemOrientacaoMarcada={[0, 1]}
      />,
    );
    await waitFor(() => expect(setOrientacoesDoItem).toHaveBeenCalledTimes(2));
    expect(perfilMock.getOrientacoesTemplate).toHaveBeenCalledTimes(2);
    expect(perfilMock.getOrientacoesTemplate).toHaveBeenCalledWith('Toxina');
    expect(perfilMock.getOrientacoesTemplate).toHaveBeenCalledWith('Preenchimento');

    const porIndice = Object.fromEntries(setOrientacoesDoItem.mock.calls.map(([i, lista]) => [i, lista]));
    expect(porIndice[0]).toEqual([
      expect.objectContaining({ descricao: 'Modelo de Toxina', ordem: 0, checado: false }),
    ]);
    expect(porIndice[1]).toEqual([
      expect.objectContaining({ descricao: 'Modelo de Preenchimento', ordem: 0, checado: false }),
    ]);
  });

  it('(a2) modelo ausente (404): usa a lista fixa como reserva', async () => {
    perfilMock.getOrientacoesTemplate.mockRejectedValue(Object.assign(new Error('nf'), { status: 404 }));
    const setOrientacoesDoItem = vi.fn();
    render(
      <Step5Finalization
        {...base}
        itensOrientacoes={[item('Toxina botulínica', null)]}
        setOrientacoesDoItem={setOrientacoesDoItem}
        itensSemOrientacaoMarcada={[0]}
      />,
    );
    await waitFor(() => expect(setOrientacoesDoItem).toHaveBeenCalledTimes(1));
    const [indice, lista] = setOrientacoesDoItem.mock.calls[0];
    expect(indice).toBe(0);
    expect(lista.length).toBeGreaterThan(0);
    expect(lista[0].descricao).toMatch(/4 horas/);
  });

  it('(b) item com orient [] (pessoa limpou) não recarrega o modelo', async () => {
    const setOrientacoesDoItem = vi.fn();
    render(
      <Step5Finalization
        {...base}
        itensOrientacoes={[item('Toxina', [])]}
        setOrientacoesDoItem={setOrientacoesDoItem}
        itensSemOrientacaoMarcada={[0]}
      />,
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(perfilMock.getOrientacoesTemplate).not.toHaveBeenCalled();
    expect(setOrientacoesDoItem).not.toHaveBeenCalled();
    expect(screen.getByText(/Nenhuma orientação/)).toBeInTheDocument();
  });

  it('(c) marcar no item 2 chama setOrientacoesDoItem(1, …) com checado true e ordem renumerada', async () => {
    const setOrientacoesDoItem = vi.fn();
    render(
      <Step5Finalization
        {...base}
        itensOrientacoes={[
          item('Toxina', [{ id: 'a', descricao: 'Não deitar', checado: true, ordem: 0 }]),
          item('Preenchimento', [
            { id: 'b', descricao: 'Gelo', checado: false, ordem: 1 },
            { id: 'c', descricao: 'Sem massagem', checado: false, ordem: 2 },
          ]),
        ]}
        setOrientacoesDoItem={setOrientacoesDoItem}
        itensSemOrientacaoMarcada={[1]}
      />,
    );
    const bloco2 = document.querySelector('[data-item-orientacoes="1"]');
    const caixas = bloco2.querySelectorAll('[role="checkbox"]');
    expect(caixas).toHaveLength(2);
    fireEvent.click(caixas[1]);
    expect(setOrientacoesDoItem).toHaveBeenCalledTimes(1);
    const [indice, lista] = setOrientacoesDoItem.mock.calls[0];
    expect(indice).toBe(1);
    expect(lista).toEqual([
      { id: 'b', descricao: 'Gelo', checado: false, ordem: 0 },
      { id: 'c', descricao: 'Sem massagem', checado: true, ordem: 1 },
    ]);
    expect(perfilMock.getOrientacoesTemplate).not.toHaveBeenCalled();
  });

  it('(c2) adicionar e remover gravam a lista inteira do item', () => {
    const setOrientacoesDoItem = vi.fn();
    render(
      <Step5Finalization
        {...base}
        itensOrientacoes={[
          item('Toxina', [
            { id: 'a', descricao: 'Um', checado: true, ordem: 0 },
            { id: 'b', descricao: 'Dois', checado: false, ordem: 1 },
          ]),
        ]}
        setOrientacoesDoItem={setOrientacoesDoItem}
        itensSemOrientacaoMarcada={[]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Adicionar orientação/ }));
    let [indice, lista] = setOrientacoesDoItem.mock.calls[0];
    expect(indice).toBe(0);
    expect(lista).toHaveLength(3);
    expect(lista[2]).toEqual(expect.objectContaining({ descricao: '', checado: false, ordem: 2 }));

    fireEvent.click(screen.getAllByRole('button', { name: 'Remover orientação' })[0]);
    [indice, lista] = setOrientacoesDoItem.mock.calls[1];
    expect(indice).toBe(0);
    expect(lista).toEqual([{ id: 'b', descricao: 'Dois', checado: false, ordem: 0 }]);
  });

  it('(d) item legado é só leitura: sem checkbox editável, sem adicionar/remover, com a linha de aviso', async () => {
    const setOrientacoesDoItem = vi.fn();
    render(
      <Step5Finalization
        {...base}
        itensOrientacoes={[
          item('Toxina', [{ id: 'a', descricao: 'Não deitar', checado: true, ordem: 0 }]),
          item('Antigo', [{ id: 'z', descricao: 'Orientação antiga', checado: true, ordem: 0 }], {
            legado: true,
          }),
        ]}
        setOrientacoesDoItem={setOrientacoesDoItem}
        itensSemOrientacaoMarcada={[]}
      />,
    );
    expect(screen.getByText('Orientações do procedimento já registrado')).toBeInTheDocument();
    const bloco = document.querySelector('[data-item-orientacoes="1"]');
    expect(bloco.textContent).toContain('Orientação antiga');
    expect(bloco.querySelector('button')).toBeNull();
    const caixa = bloco.querySelector('[role="checkbox"]');
    expect(caixa.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(caixa);
    expect(setOrientacoesDoItem).not.toHaveBeenCalled();
    // Legado com orient null também não busca modelo.
    expect(perfilMock.getOrientacoesTemplate).not.toHaveBeenCalled();
    // O item não legado tem o botão de adicionar.
    expect(document.querySelector('[data-item-orientacoes="0"] button')).not.toBeNull();
  });

  it('(d2) legado com orient null não pede modelo nem grava', async () => {
    const setOrientacoesDoItem = vi.fn();
    render(
      <Step5Finalization
        {...base}
        itensOrientacoes={[item('Antigo', null, { legado: true })]}
        setOrientacoesDoItem={setOrientacoesDoItem}
        itensSemOrientacaoMarcada={[]}
      />,
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(perfilMock.getOrientacoesTemplate).not.toHaveBeenCalled();
    expect(setOrientacoesDoItem).not.toHaveBeenCalled();
    expect(screen.getByText('Sem orientações registradas.')).toBeInTheDocument();
  });

  it('(e) um item só: sem título de item; vários: um título por item', () => {
    const { unmount } = render(
      <Step5Finalization
        {...base}
        itensOrientacoes={[item('Toxina', [{ id: 'a', descricao: 'Um', checado: true, ordem: 0 }])]}
        itensSemOrientacaoMarcada={[]}
      />,
    );
    expect(screen.queryByRole('heading', { level: 5 })).toBeNull();
    unmount();

    render(
      <Step5Finalization
        {...base}
        itensOrientacoes={[
          item('Toxina', [{ id: 'a', descricao: 'Um', checado: true, ordem: 0 }]),
          item('Preenchimento', [{ id: 'b', descricao: 'Dois', checado: true, ordem: 0 }]),
        ]}
        itensSemOrientacaoMarcada={[]}
      />,
    );
    const titulos = screen.getAllByRole('heading', { level: 5 }).map((h) => h.textContent);
    expect(titulos).toEqual(['Toxina', 'Preenchimento']);
  });

  it('(f) o campo de próximo retorno não existe mais', () => {
    render(
      <Step5Finalization
        {...base}
        itensOrientacoes={[item('Toxina', [{ id: 'a', descricao: 'Um', checado: true, ordem: 0 }])]}
        itensSemOrientacaoMarcada={[]}
      />,
    );
    expect(document.querySelector('#next-return-date')).toBeNull();
    expect(screen.queryByText(/próximo retorno/i)).toBeNull();
    expect(screen.queryByPlaceholderText('DD/MM/AAAA')).toBeNull();
  });

  it('(g) erro aparece só no item sem orientação marcada', () => {
    render(
      <Step5Finalization
        {...base}
        step5Errors={{ orientacoes: true }}
        itensOrientacoes={[
          item('Toxina', [{ id: 'a', descricao: 'Um', checado: true, ordem: 0 }]),
          item('Preenchimento', [{ id: 'b', descricao: 'Dois', checado: false, ordem: 0 }]),
        ]}
        itensSemOrientacaoMarcada={[1]}
      />,
    );
    const alertas = screen.getAllByRole('alert');
    expect(alertas).toHaveLength(1);
    expect(alertas[0].closest('[data-item-orientacoes]').getAttribute('data-item-orientacoes')).toBe('1');
  });

  it('(h) WhatsApp junta as marcadas de todos os itens com o nome do item como título', () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    render(
      <Step5Finalization
        {...base}
        itensOrientacoes={[
          item('Toxina', [{ id: 'a', descricao: 'Não deitar', checado: true, ordem: 0 }]),
          item('Preenchimento', [
            { id: 'b', descricao: 'Gelo', checado: true, ordem: 0 },
            { id: 'c', descricao: 'Fora', checado: false, ordem: 1 },
          ]),
        ]}
        itensSemOrientacaoMarcada={[]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Enviar por WhatsApp/ }));
    expect(open).toHaveBeenCalledTimes(1);
    const url = open.mock.calls[0][0];
    const texto = decodeURIComponent(url.split('text=')[1]);
    expect(texto).toContain('*Toxina*\n• Não deitar');
    expect(texto).toContain('*Preenchimento*\n• Gelo');
    expect(texto).not.toContain('Fora');
    vi.unstubAllGlobals();
  });
});
