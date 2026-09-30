import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { SolicitacaoPendenteFaixa } from './SolicitacaoPendenteFaixa.jsx';

describe('SolicitacaoPendenteFaixa', () => {
  it('sem pedido não renderiza', () => {
    const { container } = render(<SolicitacaoPendenteFaixa pedido={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('mostra texto, horários e as duas ações', async () => {
    const user = userEvent.setup();
    const onVerQr = vi.fn();
    const onCancelar = vi.fn();
    const enviadoEm = '2026-09-01T13:00:00Z';
    const expiraEm = '2026-09-02T13:00:00Z';
    render(
      <SolicitacaoPendenteFaixa
        pedido={{ envioId: 'e1', enviadoEm, expiraEm }}
        onVerQr={onVerQr}
        onCancelar={onCancelar}
      />,
    );
    const fmt = (v) => new Date(v).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const faixa = screen.getByTestId('solicitacao-pendente-faixa');
    expect(faixa).toHaveTextContent('Anamnese solicitada ao paciente · aguardando resposta');
    expect(faixa).toHaveTextContent(`enviada ${fmt(enviadoEm)}`);
    expect(faixa).toHaveTextContent(`expira ${fmt(expiraEm)}`);

    await user.click(screen.getByRole('button', { name: 'Ver QR / link' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar solicitação' }));
    expect(onVerQr).toHaveBeenCalledTimes(1);
    expect(onCancelar).toHaveBeenCalledTimes(1);
  });

  it('sem horários omite enviada/expira', () => {
    render(<SolicitacaoPendenteFaixa pedido={{ envioId: 'e1' }} onCancelar={vi.fn()} />);
    const faixa = screen.getByTestId('solicitacao-pendente-faixa');
    expect(faixa).not.toHaveTextContent('enviada');
    expect(faixa).not.toHaveTextContent('expira');
  });
});
