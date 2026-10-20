// Regressão prevenida: Seletor de procedimentos da Agenda deve exibir seções claras "No Plano de Tratamento"
// e "Outros Procedimentos da Clínica" apenas quando o paciente tem plano ativo, garantindo exclusão mútua
// e zero ruído/cabeçalhos quando o paciente não tem plano.
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProcedimentoSearchInput } from './ProcedimentoSearchInput.jsx';

describe('ProcedimentoSearchInput — Seções Plano vs Clínica e Exclusão Mútua', () => {
  const mockProcedimentoOptions = [
    { id: 'cat-toxina', nome: 'Toxina Botulínica', duracaoMin: 30, tipoCodigo: 'procedimento' },
    { id: 'cat-preenchimento', nome: 'Preenchimento Labial', duracaoMin: 45, tipoCodigo: 'procedimento' },
    { id: 'cat-bioestimulador', nome: 'Bioestimulador de Colágeno', duracaoMin: 60, tipoCodigo: 'procedimento' },
  ];

  it('renderiza lista plana clássica sem cabeçalhos quando paciente não tem itens no plano (zero ruído)', () => {
    render(
      <ProcedimentoSearchInput
        procedimentoOptions={mockProcedimentoOptions}
        procedimentosSelecionados={[]}
        itensPlano={[]}
        onToggle={vi.fn()}
        onRemover={vi.fn()}
      />,
    );

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);

    // Assert: Nenhum cabeçalho de seção renderizado
    expect(screen.queryByText(/No Plano de Tratamento/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Outros Procedimentos da Clínica/i)).not.toBeInTheDocument();

    // Procedimentos da clínica aparecem normalmente
    expect(screen.getByText('Toxina Botulínica')).toBeInTheDocument();
    expect(screen.getByText('Preenchimento Labial')).toBeInTheDocument();
  });

  it('renderiza seções distintas "No Plano de Tratamento" e "Outros Procedimentos da Clínica" com badge Plano', () => {
    const itensPlano = [
      {
        rowKey: 'plano:item-1',
        catalogoProcedimentoSaudeId: 'cat-toxina',
        planejamentoItemId: 'item-1',
        nome: 'Toxina Botulínica',
        sessaoNumero: 2,
        numeroSessoesTotal: 3,
        dataPlanejada: '2026-10-25',
        duracaoMin: 30,
      },
    ];

    render(
      <ProcedimentoSearchInput
        procedimentoOptions={mockProcedimentoOptions}
        procedimentosSelecionados={[]}
        itensPlano={itensPlano}
        onToggle={vi.fn()}
        onRemover={vi.fn()}
      />,
    );

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);

    // Assert: Cabeçalhos das seções estão presentes
    expect(screen.getByText(/No Plano de Tratamento \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Outros Procedimentos da Clínica \(3\)/i)).toBeInTheDocument();

    // Linha do plano exibe metadados de sessão e data prevista
    expect(screen.getByText(/Sessão 2 de 3/i)).toBeInTheDocument();
  });

  it('aplica exclusão mútua por catálogo: ao selecionar item do plano, o procedimento gêmeo da clínica fica desabilitado', () => {
    const itensPlano = [
      {
        rowKey: 'plano:item-toxina-1',
        catalogoProcedimentoSaudeId: 'cat-toxina',
        planejamentoItemId: 'item-toxina-1',
        nome: 'Toxina Botulínica',
        duracaoMin: 30,
      },
    ];

    const procedimentosSelecionados = [
      {
        id: 'cat-toxina',
        nome: 'Toxina Botulínica',
        planejamentoItemId: 'item-toxina-1',
        isPlano: true,
      },
    ];

    const onToggleMock = vi.fn();

    render(
      <ProcedimentoSearchInput
        procedimentoOptions={mockProcedimentoOptions}
        procedimentosSelecionados={procedimentosSelecionados}
        itensPlano={itensPlano}
        onToggle={onToggleMock}
        onRemover={vi.fn()}
      />,
    );

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);

    // O item gêmeo da clínica deve exibir o aviso de desabilitado
    expect(screen.getByText('Já selecionado do plano')).toBeInTheDocument();

    // Clicar no botão desabilitado da clínica não deve chamar o onToggle
    const botaoClinicaDesabilitado = screen.getByText('Já selecionado do plano').closest('button');
    expect(botaoClinicaDesabilitado).toBeDisabled();
    fireEvent.click(botaoClinicaDesabilitado);
    expect(onToggleMock).not.toHaveBeenCalled();
  });

  it('ao selecionar item da clínica, o item gêmeo do plano fica desabilitado', () => {
    const itensPlano = [
      {
        rowKey: 'plano:item-toxina-1',
        catalogoProcedimentoSaudeId: 'cat-toxina',
        planejamentoItemId: 'item-toxina-1',
        nome: 'Toxina Botulínica',
        duracaoMin: 30,
      },
    ];

    const procedimentosSelecionados = [
      {
        id: 'cat-toxina',
        nome: 'Toxina Botulínica',
        planejamentoItemId: null,
        isPlano: false,
      },
    ];

    const onToggleMock = vi.fn();

    render(
      <ProcedimentoSearchInput
        procedimentoOptions={mockProcedimentoOptions}
        procedimentosSelecionados={procedimentosSelecionados}
        itensPlano={itensPlano}
        onToggle={onToggleMock}
        onRemover={vi.fn()}
      />,
    );

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);

    // O item gêmeo do plano deve exibir aviso de desabilitado
    expect(screen.getByText('Já selecionado da clínica')).toBeInTheDocument();

    const botaoPlanoDesabilitado = screen.getByText('Já selecionado da clínica').closest('button');
    expect(botaoPlanoDesabilitado).toBeDisabled();
    fireEvent.click(botaoPlanoDesabilitado);
    expect(onToggleMock).not.toHaveBeenCalled();
  });

  it('remove a etiqueta/badge textual "Avulso" dos chips do agendamento para não confundir com atendimento avulso', () => {
    const procedimentosSelecionados = [
      {
        id: 'cat-toxina',
        nome: 'Toxina Botulínica',
        isPlano: false,
      },
      {
        id: 'cat-preenchimento',
        nome: 'Preenchimento Labial',
        planejamentoItemId: 'item-2',
        isPlano: true,
      },
    ];

    render(
      <ProcedimentoSearchInput
        procedimentoOptions={mockProcedimentoOptions}
        procedimentosSelecionados={procedimentosSelecionados}
        selectedVariant="chips"
        selectionMode="multi"
        itensPlano={[]}
        onToggle={vi.fn()}
        onRemover={vi.fn()}
      />,
    );

    // O item de plano tem o badge Plano
    expect(screen.getByText('Plano')).toBeInTheDocument();

    // A palavra "Avulso" NÃO deve aparecer no chip
    expect(screen.queryByText('Avulso')).not.toBeInTheDocument();
  });
});
