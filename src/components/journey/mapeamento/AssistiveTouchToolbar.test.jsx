import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssistiveTouchToolbar } from './AssistiveTouchToolbar.jsx';

describe('AssistiveTouchToolbar', () => {
  const defaultProps = {
    modo: 'ponto',
    setModo: vi.fn(),
    mostrarDoses: true,
    setMostrarDoses: vi.fn(),
    onUndo: vi.fn(),
    canUndo: true,
    activeCor: '#06b6d4',
    activeProc: { id: 'proc-1', nome: 'Toxina Botulínica' },
    procedimentos: [
      { id: 'proc-1', nome: 'Toxina Botulínica', corHex: '#06b6d4' },
      { id: 'proc-2', nome: 'Ácido Hialurônico', corHex: '#ef4444' },
    ],
    onMudarCor: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renderiza a bolinha AssistiveTouch fechada inicialmente com o rótulo do modo', () => {
    render(<AssistiveTouchToolbar {...defaultProps} />);

    const orb = screen.getByTestId('assistive-touch-orb');
    expect(orb).toBeInTheDocument();
    expect(screen.getByText('PONTO')).toBeInTheDocument();
    expect(screen.queryByTestId('assistive-touch-capsule')).not.toBeInTheDocument();
  });

  it('abre a cápsula vertical ao clicar na bolinha', () => {
    render(<AssistiveTouchToolbar {...defaultProps} />);

    const orb = screen.getByTestId('assistive-touch-orb');
    fireEvent.pointerDown(orb, { clientX: 100, clientY: 100 });
    fireEvent.pointerUp(orb, { clientX: 100, clientY: 100 });

    const capsule = screen.getByTestId('assistive-touch-capsule');
    expect(capsule).toBeInTheDocument();
    expect(screen.getByTestId('btn-capsule-ponto')).toBeInTheDocument();
    expect(screen.getByTestId('btn-capsule-traco')).toBeInTheDocument();
    expect(screen.getByTestId('btn-capsule-borracha')).toBeInTheDocument();
    expect(screen.getByTestId('btn-capsule-undo')).toBeInTheDocument();
    expect(screen.getByTestId('btn-capsule-doses')).toBeInTheDocument();
    expect(screen.getByTestId('btn-capsule-color')).toBeInTheDocument();
  });

  it('permite trocar de ferramenta sem fechar a cápsula (regra ergonômica)', () => {
    const setModo = vi.fn();
    render(<AssistiveTouchToolbar {...defaultProps} setModo={setModo} />);

    // Abre cápsula
    const orb = screen.getByTestId('assistive-touch-orb');
    fireEvent.pointerDown(orb, { clientX: 100, clientY: 100 });
    fireEvent.pointerUp(orb, { clientX: 100, clientY: 100 });

    // Clica em Traço
    const btnTraco = screen.getByTestId('btn-capsule-traco');
    fireEvent.click(btnTraco);
    expect(setModo).toHaveBeenCalledWith('traco');

    // A cápsula DEVE continuar aberta
    expect(screen.getByTestId('assistive-touch-capsule')).toBeInTheDocument();

    // Clica em Borracha
    const btnBorracha = screen.getByTestId('btn-capsule-borracha');
    fireEvent.click(btnBorracha);
    expect(setModo).toHaveBeenCalledWith('borracha');

    // A cápsula AINDA continua aberta
    expect(screen.getByTestId('assistive-touch-capsule')).toBeInTheDocument();
  });

  it('permite alternar doses e desfazer mantendo a cápsula aberta', () => {
    const setMostrarDoses = vi.fn();
    const onUndo = vi.fn();
    render(
      <AssistiveTouchToolbar
        {...defaultProps}
        setMostrarDoses={setMostrarDoses}
        onUndo={onUndo}
        canUndo={true}
      />
    );

    // Abre cápsula
    const orb = screen.getByTestId('assistive-touch-orb');
    fireEvent.pointerDown(orb, { clientX: 100, clientY: 100 });
    fireEvent.pointerUp(orb, { clientX: 100, clientY: 100 });

    // Alternar Doses
    const btnDoses = screen.getByTestId('btn-capsule-doses');
    fireEvent.click(btnDoses);
    expect(setMostrarDoses).toHaveBeenCalled();
    expect(screen.getByTestId('assistive-touch-capsule')).toBeInTheDocument();

    // Desfazer
    const btnUndo = screen.getByTestId('btn-capsule-undo');
    fireEvent.click(btnUndo);
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('assistive-touch-capsule')).toBeInTheDocument();
  });

  it('abre popover de cores, seleciona cor e chama onMudarCor sem fechar a cápsula', () => {
    const onMudarCor = vi.fn();
    render(<AssistiveTouchToolbar {...defaultProps} onMudarCor={onMudarCor} />);

    // Abre cápsula
    const orb = screen.getByTestId('assistive-touch-orb');
    fireEvent.pointerDown(orb, { clientX: 100, clientY: 100 });
    fireEvent.pointerUp(orb, { clientX: 100, clientY: 100 });

    // Clica no botão de cor para abrir a paleta
    const btnColor = screen.getByTestId('btn-capsule-color');
    fireEvent.click(btnColor);

    const popover = screen.getByTestId('color-picker-popover');
    expect(popover).toBeInTheDocument();

    // Seleciona a cor vermelha (#ef4444)
    const redButton = screen.getByTitle('Em uso por: Ácido Hialurônico');
    fireEvent.click(redButton);

    expect(onMudarCor).toHaveBeenCalledWith('#ef4444');
    // O popover de cor fecha, mas a cápsula permanece aberta!
    expect(screen.queryByTestId('color-picker-popover')).not.toBeInTheDocument();
    expect(screen.getByTestId('assistive-touch-capsule')).toBeInTheDocument();
  });

  // Regressão prevenida: Ao clicar na cor pertencente a outro procedimento na paleta,
  // deve armar/selecionar aquele procedimento em vez de forçar mutação da cor atual
  it('quando onArmar é fornecido e clica em cor em uso por outro procedimento, aciona onArmar', () => {
    const onArmar = vi.fn();
    const onMudarCor = vi.fn();
    render(
      <AssistiveTouchToolbar
        {...defaultProps}
        onArmar={onArmar}
        onMudarCor={onMudarCor}
      />
    );

    // Abre cápsula
    const orb = screen.getByTestId('assistive-touch-orb');
    fireEvent.pointerDown(orb, { clientX: 100, clientY: 100 });
    fireEvent.pointerUp(orb, { clientX: 100, clientY: 100 });

    // Abre paleta
    fireEvent.click(screen.getByTestId('btn-capsule-color'));

    // Clica no botão com a cor do Ácido Hialurônico (proc-2)
    const redButton = screen.getByTitle('Em uso por: Ácido Hialurônico');
    fireEvent.click(redButton);

    expect(onArmar).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'proc-2', nome: 'Ácido Hialurônico' })
    );
    expect(onMudarCor).not.toHaveBeenCalled();
  });

  it('restaura posição salva do localStorage', () => {
    localStorage.setItem(
      'procedi_canvas_assistive_touch_pos',
      JSON.stringify({ x: 150, y: 250 })
    );

    render(<AssistiveTouchToolbar {...defaultProps} />);

    const container = screen.getByTestId('assistive-touch-container');
    expect(container).toHaveStyle({ left: '150px', top: '250px' });
  });

  it('mantém a cápsula aberta durante o arrasto livre e fecha apenas no clique manual', () => {
    render(<AssistiveTouchToolbar {...defaultProps} />);

    // Abre cápsula
    const orb = screen.getByTestId('assistive-touch-orb');
    fireEvent.pointerDown(orb, { clientX: 100, clientY: 100 });
    fireEvent.pointerUp(orb, { clientX: 100, clientY: 100 });
    expect(screen.getByTestId('assistive-touch-capsule')).toBeInTheDocument();

    // Arrasta a bolinha por mais de 5px
    fireEvent.pointerDown(orb, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(orb, { clientX: 120, clientY: 130 });

    // A cápsula permanece aberta durante o arraste (controle manual do usuário)
    expect(screen.getByTestId('assistive-touch-capsule')).toBeInTheDocument();

    fireEvent.pointerUp(orb, { clientX: 120, clientY: 130 });
    // Salva nova posição no localStorage
    expect(localStorage.getItem('procedi_canvas_assistive_touch_pos')).toBeTruthy();

    // Clique simples fecha manualmente a cápsula
    fireEvent.pointerDown(orb, { clientX: 120, clientY: 130 });
    fireEvent.pointerUp(orb, { clientX: 120, clientY: 130 });
    expect(screen.queryByTestId('assistive-touch-capsule')).not.toBeInTheDocument();
  });
});
