// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AlteracoesNaoEntraram } from './AlteracoesNaoEntraram.jsx';

const itens = [
  { chave: 'a', rotulo: 'Anamnese', texto: 'Alergia a dipirona' },
  { chave: 'b', rotulo: 'Evolução', texto: 'Paciente bem' },
];
const noop = () => {};

afterEach(() => vi.useRealTimers());

describe('AlteracoesNaoEntraram', () => {
  it('renderiza quantidade, subtítulo e itens (plural)', () => {
    render(<AlteracoesNaoEntraram quantidade={2} itens={itens} onCopiar={noop} onDescartar={noop} />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('2 alterações não entraram')).toBeTruthy();
    expect(screen.getByText(/encerrada em outro aparelho/)).toBeTruthy();
    expect(screen.getByText('Anamnese')).toBeTruthy();
    expect(screen.getByText('Alergia a dipirona').getAttribute('title')).toBe('Alergia a dipirona');
  });

  it('singular', () => {
    render(<AlteracoesNaoEntraram quantidade={1} itens={itens.slice(0, 1)} onCopiar={noop} onDescartar={noop} />);
    expect(screen.getByText('1 alteração não entrou')).toBeTruthy();
  });

  it('copiar chama onCopiar 1x e mostra Copiado!', async () => {
    vi.useFakeTimers();
    const onCopiar = vi.fn();
    render(<AlteracoesNaoEntraram quantidade={1} itens={itens} onCopiar={onCopiar} onDescartar={noop} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Copiar/ }));
    });
    expect(onCopiar).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Copiado!')).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(screen.queryByText('Copiado!')).toBeNull();
  });

  it('descartar chama onDescartar 1x', () => {
    const onDescartar = vi.fn();
    render(<AlteracoesNaoEntraram quantidade={1} itens={itens} onCopiar={noop} onDescartar={onDescartar} />);
    fireEvent.click(screen.getByRole('button', { name: /Descartar/ }));
    expect(onDescartar).toHaveBeenCalledTimes(1);
  });

  it('quantidade 0 não renderiza nada', () => {
    const { container } = render(
      <AlteracoesNaoEntraram quantidade={0} itens={itens} onCopiar={noop} onDescartar={noop} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('mais de 5 itens: mostra 5 e "e mais N"', () => {
    const muitos = Array.from({ length: 8 }, (_, i) => ({ chave: `k${i}`, rotulo: `R${i}`, texto: `T${i}` }));
    render(<AlteracoesNaoEntraram quantidade={8} itens={muitos} onCopiar={noop} onDescartar={noop} />);
    expect(screen.getByText('R4')).toBeTruthy();
    expect(screen.queryByText('R5')).toBeNull();
    expect(screen.getByText('e mais 3')).toBeTruthy();
  });
});
