import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

describe('ConsultaProcedimentoFlow — gate de termos e Review Gate Modal', () => {
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

  it('quando 1 procedimento avulso é finalizado, encerra direto sem abrir modal', async () => {
    const encerrarAtendimento = vi.fn();
    render(
      <ConsultaProcedimentoFlow
        {...baseProps}
        procedimentosLote={[
          { catalogoProcedimentoSaudeId: 'cat-1', nomeProcedimento: 'Botox', isAvulso: true },
        ]}
        orientacoes="Aplicar gelo"
        encerrarAtendimento={encerrarAtendimento}
      />
    );
    // 1. Vai para orientações
    const btnContinuar = screen.getByRole('button', { name: /Ir para Finalização e Orientações/i });
    fireEvent.click(btnContinuar);

    // 2. Clica em Finalizar
    const btnFinalizar = screen.getByRole('button', { name: /Finalizar Atendimento/i });
    fireEvent.click(btnFinalizar);

    // 3. Deve chamar encerrarAtendimento direto sem abrir o modal
    expect(encerrarAtendimento).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Conferência de Procedimentos do Atendimento/i)).not.toBeInTheDocument();
  });

  it('quando há múltiplos procedimentos na sessão, abre o Review Gate Modal antes de finalizar', async () => {
    const encerrarAtendimento = vi.fn();
    render(
      <ConsultaProcedimentoFlow
        {...baseProps}
        procedimentosLote={[
          { catalogoProcedimentoSaudeId: 'cat-drenagem', nomeProcedimento: 'Drenagem de Abscesso', isAvulso: false, planejamentoItemId: 'item-1' },
          { catalogoProcedimentoSaudeId: 'cat-infiltracao', nomeProcedimento: 'Infiltração Intralesional', isAvulso: false, planejamentoItemId: 'item-2' },
        ]}
        orientacoes="Repouso e curativo"
        encerrarAtendimento={encerrarAtendimento}
      />
    );
    // 1. Vai para orientações
    fireEvent.click(screen.getByRole('button', { name: /Ir para Finalização e Orientações/i }));

    // 2. Clica em Finalizar
    fireEvent.click(screen.getByRole('button', { name: /Finalizar Atendimento/i }));

    // 3. NÃO deve encerrar direto; deve abrir o modal de conferência
    expect(encerrarAtendimento).not.toHaveBeenCalled();
    expect(screen.getByText(/Conferência de Procedimentos do Atendimento/i)).toBeInTheDocument();
    expect(screen.getByText('Drenagem de Abscesso')).toBeInTheDocument();
    expect(screen.getByText('Infiltração Intralesional')).toBeInTheDocument();
    expect(screen.getAllByText('Plano de Tratamento')).toHaveLength(2);

    // 4. Ao confirmar no modal, chama encerrarAtendimento
    fireEvent.click(screen.getByRole('button', { name: /Confirmar e Finalizar Atendimento/i }));
    expect(encerrarAtendimento).toHaveBeenCalledTimes(1);
  });

  it('permite remover um procedimento indesejado do lote diretamente pelo Review Gate Modal', async () => {
    const setProcedimentosLote = vi.fn();
    const onValidarTermosCatalogo = vi.fn().mockResolvedValue(true);
    render(
      <ConsultaProcedimentoFlow
        {...baseProps}
        procedimentosLote={[
          { catalogoProcedimentoSaudeId: 'cat-drenagem', nomeProcedimento: 'Drenagem de Abscesso', isAvulso: false },
          { catalogoProcedimentoSaudeId: 'cat-infiltracao', nomeProcedimento: 'Infiltração Intralesional', isAvulso: false },
        ]}
        setProcedimentosLote={setProcedimentosLote}
        onValidarTermosCatalogo={onValidarTermosCatalogo}
        orientacoes="Curativo"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Ir para Finalização e Orientações/i }));
    const btnFinalizar = await screen.findByRole('button', { name: /Finalizar Atendimento/i });
    fireEvent.click(btnFinalizar);

    // Clica para remover a Infiltração
    const removeButtons = await screen.findAllByRole('button', { name: /Remover/i });
    fireEvent.click(removeButtons[1]);

    await waitFor(() => {
      expect(setProcedimentosLote).toHaveBeenCalledWith([
        expect.objectContaining({ catalogoProcedimentoSaudeId: 'cat-drenagem' }),
      ]);
    });
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
