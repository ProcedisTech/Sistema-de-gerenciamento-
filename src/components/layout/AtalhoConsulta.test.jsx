import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AtalhoConsulta } from './AtalhoConsulta.jsx';

vi.mock('./AtalhoConsultaBusca.jsx', () => ({
  AtalhoConsultaBusca: ({ open, onEscolher }) =>
    open ? (
      <div role="dialog">
        <button type="button" onClick={() => onEscolher({ id: 'p-1', nome: 'Maria Souza' })}>
          escolher Maria
        </button>
      </div>
    ) : null,
}));

const AGORA = '2026-10-06T13:00:00.000Z';

function consulta(extras) {
  return { id: 'c-1', pacienteNome: 'Maria Souza', status: 'aberto', iniciadoEm: '2026-10-06T11:45:00Z', ...extras };
}

describe('AtalhoConsulta (V1)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(AGORA));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sem consulta: abre a busca e entrega o paciente escolhido', () => {
    const onEscolherPaciente = vi.fn();
    render(<AtalhoConsulta minhas={[]} onEntrar={vi.fn()} onEscolherPaciente={onEscolherPaciente} />);
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar consulta' }));
    fireEvent.click(screen.getByRole('button', { name: 'escolher Maria' }));

    expect(onEscolherPaciente).toHaveBeenCalledWith({ id: 'p-1', nome: 'Maria Souza' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('uma consulta aberta: nome e tempo; clicar entra nela', () => {
    const onEntrar = vi.fn();
    const c = consulta();
    render(<AtalhoConsulta minhas={[c]} onEntrar={onEntrar} onEscolherPaciente={vi.fn()} />);
    const botao = screen.getByRole('button', { name: 'Voltar à consulta de Maria Souza' });
    expect(botao.textContent).toContain('Maria Souza');
    expect(botao.textContent).toContain('1h15');

    fireEvent.click(botao);
    expect(onEntrar).toHaveBeenCalledWith(c);
  });

  it('consulta de menos de uma hora mostra minutos', () => {
    render(
      <AtalhoConsulta
        minhas={[consulta({ iniciadoEm: '2026-10-06T12:48:00Z' })]}
        onEntrar={vi.fn()}
        onEscolherPaciente={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Voltar à consulta/ }).textContent).toContain('12 min');
  });

  it('aberta + abandonada: a abandonada some da barra (1 botão com tempo, sem selo nem ícone de pausa)', () => {
    const onEntrar = vi.fn();
    const aberta = consulta();
    const abandonada = consulta({ id: 'c-2', pacienteNome: 'João Lima', status: 'abandonado' });
    const { container } = render(
      <AtalhoConsulta minhas={[aberta, abandonada]} onEntrar={onEntrar} onEscolherPaciente={vi.fn()} />,
    );

    expect(screen.queryByRole('button', { name: /consultas em andamento/ })).toBeNull();
    const botao = screen.getByRole('button', { name: 'Voltar à consulta de Maria Souza' });
    expect(botao.textContent).toContain('1h15');
    expect(container.textContent).not.toContain('Pausada');
    expect(container.textContent).not.toContain('João Lima');
    expect(container.querySelector('.lucide-pause')).toBeNull();

    fireEvent.click(botao);
    expect(onEntrar).toHaveBeenCalledWith(aberta);
  });

  it('só abandonada: a barra mostra "Iniciar consulta"', () => {
    render(
      <AtalhoConsulta minhas={[consulta({ status: 'abandonado' })]} onEntrar={vi.fn()} onEscolherPaciente={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Iniciar consulta' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Voltar à consulta/ })).toBeNull();
  });

  it('duas ou mais abertas: lista com cada consulta e o tempo; escolher entra na escolhida', async () => {
    const onEntrar = vi.fn();
    const b = consulta({ id: 'c-2', pacienteNome: 'João Lima', iniciadoEm: '2026-10-06T12:48:00Z' });
    render(<AtalhoConsulta minhas={[consulta(), b]} onEntrar={onEntrar} onEscolherPaciente={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '2 consultas em andamento' }));
    const itens = screen.getAllByRole('menuitem');
    expect(itens).toHaveLength(2);
    expect(itens[1].textContent).toContain('12 min');
    expect(itens[1].textContent).not.toContain('Pausada');

    fireEvent.click(itens[1]);
    expect(onEntrar).toHaveBeenCalledWith(b);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });
});

describe('AtalhoConsulta — abertura aguardada', () => {
  function pendente() {
    let resolver;
    let rejeitar;
    const promessa = new Promise((res, rej) => {
      resolver = res;
      rejeitar = rej;
    });
    return { promessa, resolver, rejeitar };
  }

  it('dois cliques seguidos chamam onEntrar uma vez; durante: disabled, aria-busy e "Abrindo…"; ao resolver volta ao normal', async () => {
    const p = pendente();
    const onEntrar = vi.fn(() => p.promessa);
    render(<AtalhoConsulta minhas={[consulta()]} onEntrar={onEntrar} onEscolherPaciente={vi.fn()} />);
    const botao = screen.getByRole('button', { name: 'Voltar à consulta de Maria Souza' });

    // Os dois cliques no mesmo lote, sem re-render entre eles: só a trava interna segura o segundo.
    act(() => {
      botao.click();
      botao.click();
    });
    fireEvent.click(botao);
    expect(onEntrar).toHaveBeenCalledTimes(1);
    expect(botao).toBeDisabled();
    expect(botao.getAttribute('aria-busy')).toBe('true');
    expect(botao.textContent).toContain('Abrindo…');

    await act(async () => {
      p.resolver(true);
    });
    expect(botao).not.toBeDisabled();
    expect(botao.getAttribute('aria-busy')).toBeNull();
    expect(botao.textContent).toContain('Maria Souza');
    expect(botao.textContent).not.toContain('Abrindo…');
  });

  it('lista: o item clicado fica "Abrindo…" e os outros também travam; segundo clique é ignorado', async () => {
    const p = pendente();
    const onEntrar = vi.fn(() => p.promessa);
    const b = consulta({ id: 'c-2', pacienteNome: 'João Lima' });
    render(<AtalhoConsulta minhas={[consulta(), b]} onEntrar={onEntrar} onEscolherPaciente={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '2 consultas em andamento' }));
    const [i0, i1] = screen.getAllByRole('menuitem');

    fireEvent.click(i1);
    fireEvent.click(i0);
    expect(onEntrar).toHaveBeenCalledTimes(1);
    expect(onEntrar).toHaveBeenCalledWith(b);
    expect(i1.textContent).toContain('Abrindo…');
    expect(i1.getAttribute('aria-busy')).toBe('true');
    expect(i0).toBeDisabled();
    expect(i1).toBeDisabled();
    expect(i0.textContent).not.toContain('Abrindo…');

    await act(async () => {
      p.resolver(true);
    });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('falha (resolve false ou rejeita): estado limpo e permite nova tentativa', async () => {
    const onEntrar = vi.fn().mockResolvedValueOnce(false).mockRejectedValueOnce(new Error('falhou'));
    render(<AtalhoConsulta minhas={[consulta()]} onEntrar={onEntrar} onEscolherPaciente={vi.fn()} />);
    const botao = screen.getByRole('button', { name: 'Voltar à consulta de Maria Souza' });

    await act(async () => {
      fireEvent.click(botao);
    });
    expect(botao).not.toBeDisabled();
    expect(botao.textContent).not.toContain('Abrindo…');

    await act(async () => {
      fireEvent.click(botao);
    });
    expect(onEntrar).toHaveBeenCalledTimes(2);
    expect(botao).not.toBeDisabled();
    expect(botao.getAttribute('aria-busy')).toBeNull();
  });

  it('desmontar durante a abertura não gera erro ao resolver', async () => {
    const p = pendente();
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = render(
      <AtalhoConsulta minhas={[consulta()]} onEntrar={() => p.promessa} onEscolherPaciente={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Voltar à consulta de Maria Souza' }));
    unmount();
    await act(async () => {
      p.resolver(true);
    });
    expect(erro).not.toHaveBeenCalled();
    erro.mockRestore();
  });
});
