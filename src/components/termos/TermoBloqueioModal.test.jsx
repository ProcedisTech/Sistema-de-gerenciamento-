import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import '@testing-library/jest-dom';
import { COPY_BLOQUEIO, TermoBloqueioModal } from './TermoBloqueioModal.jsx';

describe('TermoBloqueioModal', () => {
  it('abre com faltantes e o copy do bloqueio', () => {
    render(
      <TermoBloqueioModal
        open
        nomeProcedimento="Criolipólise"
        faltantes={[{ termoId: 'termo-um', titulo: 'Termo de um' }]}
        onIrParaTermos={() => {}}
      />
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(COPY_BLOQUEIO)).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /Ir para a aba de termos e assinar o termo de Criolipólise/i,
      })
    ).toBeInTheDocument();
  });

  it('CTA navega para a aba termos com o termoId certo selecionado', async () => {
    const onIrParaTermos = vi.fn();
    render(
      <TermoBloqueioModal
        open
        nomeProcedimento="Criolipólise"
        faltantes={[
          { termoId: 'termo-certo', titulo: 'Termo de um' },
          { termoId: 'outro', titulo: 'Outro' },
        ]}
        onIrParaTermos={onIrParaTermos}
      />
    );
    await userEvent.click(
      screen.getByRole('button', { name: /assinar o termo de Criolipólise/i })
    );
    expect(onIrParaTermos).toHaveBeenCalledWith({
      termoId: 'termo-certo',
      termoIds: ['termo-certo', 'outro'],
      nomeProcedimento: 'Criolipólise',
    });
  });

  it('sem faltantes não renderiza', () => {
    const { container } = render(
      <TermoBloqueioModal open nomeProcedimento="Criolipólise" faltantes={[]} />
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
