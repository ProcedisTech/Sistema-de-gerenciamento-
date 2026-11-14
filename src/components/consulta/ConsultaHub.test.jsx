import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { ConsultaHub } from './ConsultaHub.jsx';

vi.mock('../../hooks/useTermosPendentes', () => ({
  useTermosPendentes: () => ({
    pendentes: [{ id: 't1', titulo: 'Termo B' }],
    count: 1,
    isLoading: false,
    resolucao: { faltantes: [{ termoId: 't1', titulo: 'Termo B' }] },
  }),
}));

vi.mock('../planos/usePlanosPaciente.js', () => ({
  usePlanosPaciente: () => ({ planos: [] }),
}));

vi.mock('../../hooks/useAnamneseStatusPaciente', () => ({
  useAnamneseStatusPaciente: () => ({
    list: [],
    isLoading: false,
    pendente: false,
    desatualizada: false,
  }),
}));

const paciente = { id: 'pac-1', nome: 'Ana' };

function cardProcedimento() {
  return screen.getByRole('button', { name: /^Procedimento/ });
}

describe('ConsultaHub — navegação do card Procedimento', () => {
  it('permite entrar em Procedimento mesmo com termos pendentes para o médico selecionar ou remover itens', async () => {
    const onSelect = vi.fn();
    const onBloqueio = vi.fn();
    render(
      <ConsultaHub
        paciente={paciente}
        catalogoIds={['cat-b']}
        exigirFilaVinculo
        onSelectModule={onSelect}
        onTermosBloqueio={onBloqueio}
      />
    );
    await userEvent.click(cardProcedimento());
    expect(onBloqueio).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith('procedimento');
  });

  it('navega normalmente quando o procedimento já tem PF nesta sessão', async () => {
    const onSelect = vi.fn();
    const onBloqueio = vi.fn();
    render(
      <ConsultaHub
        paciente={paciente}
        catalogoIds={['cat-a']}
        exigirFilaVinculo
        atoJaIniciado
        onSelectModule={onSelect}
        onTermosBloqueio={onBloqueio}
      />
    );
    await userEvent.click(cardProcedimento());
    expect(onBloqueio).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith('procedimento');
  });
});

describe('ConsultaHub — F3 exibição e navegação', () => {
  it('navega para Procedimento quando a consulta já tem o termo ASSINADO', async () => {
    const onSelect = vi.fn();
    const onBloqueio = vi.fn();
    render(
      <ConsultaHub
        paciente={paciente}
        catalogoIds={['cat-b']}
        exigirFilaVinculo
        termosDaConsulta={[{ termoId: 't1', statusAssinatura: 'ASSINADO' }]}
        onSelectModule={onSelect}
        onTermosBloqueio={onBloqueio}
      />
    );
    await userEvent.click(cardProcedimento());
    expect(onBloqueio).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith('procedimento');
  });

  it('navega para Procedimento quando o termo da consulta está PENDENTE (trava interna no módulo)', async () => {
    const onSelect = vi.fn();
    const onBloqueio = vi.fn();
    render(
      <ConsultaHub
        paciente={paciente}
        catalogoIds={['cat-b']}
        exigirFilaVinculo
        termosDaConsulta={[{ termoId: 't1', statusAssinatura: 'PENDENTE' }]}
        onSelectModule={onSelect}
        onTermosBloqueio={onBloqueio}
      />
    );
    await userEvent.click(cardProcedimento());
    expect(onBloqueio).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith('procedimento');
  });
});

describe('ConsultaHub — fluxo de retorno', () => {
  it('exibe cards corretos no retorno: Anamnese, Avaliação, Planejamento, Termos e Retorno/Retoque (Procedimento ausente)', () => {
    render(
      <ConsultaHub
        paciente={paciente}
        isRetorno
        onSelectModule={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /Anamnese/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Avaliação/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Planejamento/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Termos/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retorno \/ Retoque/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Procedimento/ })).not.toBeInTheDocument();
  });

  it('clique em Retorno / Retoque chama onSelectModule("retorno") sem disparar gate de termos mesmo com faltantes', async () => {
    const onSelect = vi.fn();
    const onBloqueio = vi.fn();
    render(
      <ConsultaHub
        paciente={paciente}
        isRetorno
        catalogoIds={['cat-b']}
        exigirFilaVinculo
        onSelectModule={onSelect}
        onTermosBloqueio={onBloqueio}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /^Retorno \/ Retoque/ }));
    expect(onBloqueio).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith('retorno');
  });
});
