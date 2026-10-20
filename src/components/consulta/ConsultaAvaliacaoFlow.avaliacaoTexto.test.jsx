import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { ConsultaAvaliacaoFlow } from './ConsultaAvaliacaoFlow.jsx';
import { ToastContext } from '../../contexts/toastContext.js';

function renderFluxo(props = {}) {
  const p = {
    setQueixa: vi.fn(),
    setExpectativas: vi.fn(),
    setObservacoesAvaliacao: vi.fn(),
    onCampoAvaliacaoBlur: vi.fn(),
    ...props,
  };
  render(<ConsultaAvaliacaoFlow {...p} />);
  return p;
}

const campos = [
  { rotulo: 'Queixa Principal', setter: 'setQueixa', campo: 'queixa', chave: 'avaliacao:queixa' },
  { rotulo: 'Expectativas do Paciente', setter: 'setExpectativas', campo: 'expectativas', chave: 'avaliacao:expectativas' },
  {
    rotulo: 'Observações da avaliação',
    setter: 'setObservacoesAvaliacao',
    campo: 'observacoesAvaliacao',
    chave: 'avaliacao:observacoes',
  },
];

describe('ConsultaAvaliacaoFlow — texto da avaliação', () => {
  it.each(campos)('$campo: set* a cada tecla e onCampoAvaliacaoBlur só no blur', ({ rotulo, setter, campo }) => {
    const p = renderFluxo();
    const el = screen.getByLabelText(rotulo);
    fireEvent.change(el, { target: { value: 'a' } });
    fireEvent.change(el, { target: { value: 'ab' } });
    fireEvent.change(el, { target: { value: 'abc' } });
    expect(p[setter]).toHaveBeenCalledTimes(3);
    expect(p[setter]).toHaveBeenLastCalledWith('abc');
    expect(p.onCampoAvaliacaoBlur).not.toHaveBeenCalled();
    fireEvent.blur(el);
    expect(p.onCampoAvaliacaoBlur).toHaveBeenCalledTimes(1);
    expect(p.onCampoAvaliacaoBlur).toHaveBeenCalledWith(campo);
  });

  it('os 3 campos têm o data-campo-consulta certo', () => {
    renderFluxo();
    for (const { rotulo, chave } of campos) {
      expect(screen.getByLabelText(rotulo)).toHaveAttribute('data-campo-consulta', chave);
    }
  });

  it('sem as props renderiza e aceita digitar e sair sem erro', () => {
    render(<ConsultaAvaliacaoFlow />);
    for (const { rotulo } of campos) {
      const el = screen.getByLabelText(rotulo);
      expect(el).toHaveValue('');
      fireEvent.change(el, { target: { value: 'x' } });
      fireEvent.blur(el);
    }
  });
});

describe('ConsultaAvaliacaoFlow — Concluir Avaliação espera a fila', () => {
  const warning = vi.fn();
  const wrapper = ({ children }) => (
    <ToastContext.Provider
      value={{ toast: vi.fn(), success: vi.fn(), error: vi.fn(), warning, info: vi.fn(), dismiss: vi.fn() }}
    >
      {children}
    </ToastContext.Provider>
  );
  const botao = () => screen.getByRole('button', { name: 'Concluir Avaliação' });

  it('não prossegue até a fila resolver; depois prossegue', async () => {
    let liberar;
    const esperarFilaAvaliacao = vi.fn(
      () =>
        new Promise((r) => {
          liberar = r;
        }),
    );
    const onConcluirAvaliacao = vi.fn();
    render(
      <ConsultaAvaliacaoFlow esperarFilaAvaliacao={esperarFilaAvaliacao} onConcluirAvaliacao={onConcluirAvaliacao} />,
      { wrapper },
    );
    fireEvent.click(botao());
    expect(esperarFilaAvaliacao).toHaveBeenCalledTimes(1);
    expect(onConcluirAvaliacao).not.toHaveBeenCalled();
    await act(async () => liberar({ ok: true, preenchimentoAnamneseId: 'p1' }));
    await waitFor(() => expect(onConcluirAvaliacao).toHaveBeenCalledTimes(1));
  });

  it('ok:false mostra o aviso e não prossegue', async () => {
    const onConcluirAvaliacao = vi.fn();
    render(
      <ConsultaAvaliacaoFlow esperarFilaAvaliacao={async () => ({ ok: false })} onConcluirAvaliacao={onConcluirAvaliacao} />,
      { wrapper },
    );
    fireEvent.click(botao());
    await waitFor(() => expect(warning).toHaveBeenCalledWith('Aguarde: ainda enviando a avaliação…'));
    expect(onConcluirAvaliacao).not.toHaveBeenCalled();
  });

  it('sem esperarFilaAvaliacao segue direto', () => {
    const onConcluirAvaliacao = vi.fn();
    render(<ConsultaAvaliacaoFlow onConcluirAvaliacao={onConcluirAvaliacao} />, { wrapper });
    fireEvent.click(botao());
    expect(onConcluirAvaliacao).toHaveBeenCalledTimes(1);
  });
});
