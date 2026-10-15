import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import '@testing-library/jest-dom';
import { ConsultaProcedimentoFlow } from './ConsultaProcedimentoFlow.jsx';

const step4Props = vi.hoisted(() => ({ ultimo: null }));
vi.mock('../journey/Step4LGPD.jsx', () => ({
  Step4Procedimento: (props) => {
    step4Props.ultimo = props;
    return <div>step4-procedimento</div>;
  },
}));
vi.mock('../journey/Step5Finalization.jsx', () => ({
  Step5Finalization: () => <div>step5-finalizacao</div>,
}));

const baseProps = {
  nomeProcedimento: 'Botox',
  setNomeProcedimento: () => {},
  setNomeProcedimentoCatalogoId: () => {},
  setProcedimentoDoCatalogo: () => {},
  catalogoId: 'cat-1',
  observacoesExecucao: '',
  setObservacoesExecucao: () => {},
  procedureCapturedPhotos: [],
  procedurePhotoMax: 8,
  step4Errors: {},
  setStep4Errors: () => {},
  toast: { error: vi.fn(), success: vi.fn() },
};

describe('ConsultaProcedimentoFlow — gate de termos', () => {
  it('Ir para Finalização e Orientações permanece bloqueado sem termo', async () => {
    render(
      <ConsultaProcedimentoFlow
        {...baseProps}
        execucaoBloqueadaPorTermos
        onValidarTermosCatalogo={vi.fn()}
      />
    );
    const btn = screen.getByRole('button', { name: /Ir para Finalização e Orientações/i });
    expect(btn).toBeDisabled();
  });

  it('Ir para Finalização habilita quando o parent já tem PF do catálogo (gate derivado false)', () => {
    render(
      <ConsultaProcedimentoFlow
        {...baseProps}
        execucaoBloqueadaPorTermos={false}
        onValidarTermosCatalogo={vi.fn()}
      />
    );
    const btn = screen.getByRole('button', { name: /Ir para Finalização e Orientações/i });
    expect(btn).not.toBeDisabled();
  });
});

describe('ConsultaProcedimentoFlow — F5 urlArquivoReserva', () => {
  it('repassa urlArquivoReserva ao Step4Procedimento (foto do módulo Procedimento recebe blob: via reserva)', () => {
    const urlArquivoReserva = vi.fn(() => 'blob:reserva-1');
    render(<ConsultaProcedimentoFlow {...baseProps} urlArquivoReserva={urlArquivoReserva} />);
    expect(step4Props.ultimo.urlArquivoReserva).toBe(urlArquivoReserva);
    expect(step4Props.ultimo.urlArquivoReserva({ id: 'f1' })).toBe('blob:reserva-1');
  });
});
