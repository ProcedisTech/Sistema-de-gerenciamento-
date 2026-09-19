import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SessionTimeoutWarningModal from './SessionTimeoutWarningModal';

describe('SessionTimeoutWarningModal', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('quando montado, exibe título e countdown (visibilidade é do pai)', () => {
    render(
      <SessionTimeoutWarningModal
        deadlineTs={Date.now() + 60000}
        onStay={vi.fn()}
        onLogout={vi.fn()}
      />,
    );
    expect(screen.getByText(/Sessão prestes a expirar/)).toBeInTheDocument();
    expect(screen.getByText(/60s/)).toBeInTheDocument();
  });

  it('renderiza countdown a partir do deadlineTs', () => {
    render(
      <SessionTimeoutWarningModal
        deadlineTs={Date.now() + 30000}
        onStay={vi.fn()}
        onLogout={vi.fn()}
      />,
    );
    expect(screen.getByText(/Sessão prestes a expirar/)).toBeInTheDocument();
    expect(screen.getByText(/30s/)).toBeInTheDocument();
  });

  it('countdown decrementa a cada segundo', () => {
    render(
      <SessionTimeoutWarningModal
        deadlineTs={Date.now() + 30000}
        onStay={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText(/29s/)).toBeInTheDocument();
  });

  it('"Continuar conectado" chama onStay', async () => {
    vi.useRealTimers();
    const onStay = vi.fn();
    render(
      <SessionTimeoutWarningModal
        deadlineTs={Date.now() + 60000}
        onStay={onStay}
        onLogout={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByText('Continuar conectado'));
    expect(onStay).toHaveBeenCalledTimes(1);
  });

  it('"Sair agora" chama onLogout', async () => {
    vi.useRealTimers();
    const onLogout = vi.fn();
    render(
      <SessionTimeoutWarningModal
        deadlineTs={Date.now() + 60000}
        onStay={vi.fn()}
        onLogout={onLogout}
      />,
    );

    await userEvent.click(screen.getByText('Sair agora'));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
