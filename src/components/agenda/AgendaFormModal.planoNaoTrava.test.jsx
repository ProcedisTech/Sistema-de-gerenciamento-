// Regressão prevenida: Escolher um procedimento do plano no seletor da Agenda NÃO pode travar
// o modal em readOnly nem bloquear o profissional (Prevenção contra Falha F2 da v1).
// Quando aberto pela aba Planos com mapa prévio, o modo travado original continua preservado.
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AgendaFormModal } from './AgendaFormModal.jsx';

vi.mock('../../contexts/OrgContext', () => ({
  useOrg: () => ({
    roleUserId: 'prof-1',
    roleNome: 'Dra. Teste',
    orgId: 'org-1',
    apareceNaAgenda: true,
  }),
}));

vi.mock('../../contexts/useToast.js', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock('../../hooks/useMediaQuery.js', () => ({
  useMediaQuery: () => true, // Desktop
}));

describe('AgendaFormModal — Seleção de Procedimento do Plano Não Trava o Modal (Anti-F2)', () => {
  function makeMockAgenda(overrides = {}) {
    const defaultState = {
      modalMode: 'create',
      isModoPlanejamento: false,
      patientSelectLocked: false,
      roleUserIdAgenda: 'prof-1',
      procedimentoOptions: [
        { id: 'cat-toxina', nome: 'Toxina Botulínica', duracaoMin: 30, tipoCodigo: 'procedimento' },
        { id: 'cat-preenchimento', nome: 'Preenchimento Labial', duracaoMin: 45, tipoCodigo: 'procedimento' },
      ],
      itensPlanoDisponiveis: [
        {
          rowKey: 'plano:item-toxina-1',
          catalogoProcedimentoSaudeId: 'cat-toxina',
          planejamentoItemId: 'item-toxina-1',
          nome: 'Toxina Botulínica',
          duracaoMin: 30,
        },
      ],
      planoItemEscolhidoPorCatalogo: {},
      setPlanoItemEscolhidoPorCatalogo: vi.fn(),
      form: {
        pacienteId: 'pac-1',
        pacienteNome: 'Maria Silva',
        telefone: '11999999999',
        tipoAtendimento: 'procedimento',
        tipoAtendimentoLocked: false,
        catalogoProcedimentoSaudeIds: [],
        data: '2026-10-25',
        horaInicio: '09:00',
        horaFimSlot: '09:30',
        duracaoMin: 30,
      },
      updateForm: vi.fn(),
      saveAppointment: vi.fn(),
      closeModal: vi.fn(),
      selectDispCalendarioDia: vi.fn(),
      selectDispSlot: vi.fn(),
      clearRangeSelection: vi.fn(),
      handleProximoHorarioLivre: vi.fn(),
      dispCalendarioHeatmap: { cells: [] },
      canSeeAgendaMulti: true,
      canEncaixarForaDisp: true,
      ...overrides,
    };
    return defaultState;
  }

  it('o campo de busca de procedimentos NÃO é readOnly ao selecionar item do plano', () => {
    const agenda = makeMockAgenda({ isModoPlanejamento: false });

    render(<AgendaFormModal agenda={agenda} />);

    // O input de busca de procedimentos deve estar presente e editável
    const inputBusca = screen.getByPlaceholderText('Buscar procedimento...');
    expect(inputBusca).toBeInTheDocument();
    expect(inputBusca).not.toHaveAttribute('readonly');

    // Abre o dropdown
    fireEvent.focus(inputBusca);

    // Ambas as opções aparecem
    expect(screen.getByText(/No Plano de Tratamento/i)).toBeInTheDocument();
    expect(screen.getByText(/Outros Procedimentos da Clínica/i)).toBeInTheDocument();
  });

  it('quando aberto a partir da aba Planos com mapa pré-definido (isModoPlanejamento true), preserva o bloqueio readOnly', () => {
    const agenda = makeMockAgenda({
      isModoPlanejamento: true,
      patientSelectLocked: true,
      form: {
        pacienteId: 'pac-1',
        pacienteNome: 'Maria Silva',
        tipoAtendimento: 'procedimento',
        catalogoProcedimentoSaudeIds: ['cat-toxina'],
        data: '2026-10-25',
        horaInicio: '09:00',
        horaFimSlot: '09:30',
      },
    });

    render(<AgendaFormModal agenda={agenda} />);

    // Quando travado pelo modo planejamento de origem, o input de busca NÃO deve estar interativo
    expect(screen.queryByPlaceholderText('Buscar procedimento...')).not.toBeInTheDocument();
  });

  it('ao clicar em um procedimento do plano, sincroniza planoItemEscolhidoPorCatalogo fora do updater funcional', () => {
    const agenda = makeMockAgenda({ isModoPlanejamento: false });

    render(<AgendaFormModal agenda={agenda} />);

    const inputBusca = screen.getByPlaceholderText('Buscar procedimento...');
    fireEvent.focus(inputBusca);

    // Clica no item do plano (primeira ocorrência na lista)
    const itemPlanoBtn = screen.getAllByText('Toxina Botulínica')[0].closest('button');
    fireEvent.click(itemPlanoBtn);

    // Assert: agenda.updateForm foi chamado com o ID do catálogo
    expect(agenda.updateForm).toHaveBeenCalledWith('catalogoProcedimentoSaudeIds', ['cat-toxina']);

    // Assert: setPlanoItemEscolhidoPorCatalogo foi chamado para registrar o vínculo
    expect(agenda.setPlanoItemEscolhidoPorCatalogo).toHaveBeenCalled();
  });

  it('StrictMode + remoção mista: remover item da clínica não apaga plano e desmarcar item do plano chama removePlanejamentoItemLoteAtIndex 1x por ID e limpa vínculo', () => {
    let planoMap = {};
    const removePlanejamentoItemLoteAtIndex = vi.fn();
    const setPlanoItemEscolhidoPorCatalogo = vi.fn((updater) => {
      planoMap = typeof updater === 'function' ? updater(planoMap) : updater;
    });
    const agenda = makeMockAgenda({
      isModoPlanejamento: false,
      removePlanejamentoItemLoteAtIndex,
      setPlanoItemEscolhidoPorCatalogo,
    });

    render(
      <React.StrictMode>
        <AgendaFormModal agenda={agenda} />
      </React.StrictMode>,
    );

    const inputBusca = screen.getByPlaceholderText('Buscar procedimento...');
    fireEvent.focus(inputBusca);

    // 1) Seleciona procedimento da clínica primeiro (Preenchimento Labial — isPlano: false, índice 0)
    fireEvent.click(screen.getByText('Preenchimento Labial').closest('button'));

    // Após selecionar o 1º item, a busca recolhe automaticamente; clica em "Adicionar" para reabrir
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/i }));
    fireEvent.focus(screen.getByPlaceholderText('Buscar procedimento...'));

    // 2) Seleciona item do plano em seguida (Toxina Botulínica — isPlano: true, planejamentoItemId: 'item-toxina-1', índice 1)
    fireEvent.click(screen.getAllByText('Toxina Botulínica')[0].closest('button'));
    expect(planoMap).toEqual({ 'cat-toxina': 'item-toxina-1' });

    // Remove o procedimento da clínica pelo botão X do chip -> NÃO pode remover do lote de planejamento
    fireEvent.click(screen.getByRole('button', { name: 'Remover Preenchimento Labial' }));
    expect(removePlanejamentoItemLoteAtIndex).not.toHaveBeenCalled();

    // Desmarca o procedimento do plano clicando novamente no dropdown -> executa 1x (sem duplicação do StrictMode), por ID, e apaga vínculo
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/i }));
    fireEvent.focus(screen.getByPlaceholderText('Buscar procedimento...'));
    const botaoDropdownToxina = screen
      .getAllByText('Toxina Botulínica')
      .map((el) => el.closest('button'))
      .find(Boolean);
    fireEvent.click(botaoDropdownToxina);
    expect(removePlanejamentoItemLoteAtIndex).toHaveBeenCalledTimes(1);
    expect(removePlanejamentoItemLoteAtIndex).toHaveBeenCalledWith({
      planejamentoItemId: 'item-toxina-1',
      catalogoProcedimentoSaudeId: 'cat-toxina',
      index: 0,
    });
    expect(planoMap).toEqual({});
  });

  it('troca de paciente já com catalogoProcedimentoSaudeIds pré-carregados preserva os chips hidratados', () => {
    const agendaInicial = makeMockAgenda({
      form: {
        ...makeMockAgenda().form,
        pacienteId: 'pac-1',
        catalogoProcedimentoSaudeIds: [],
      },
    });

    const { rerender } = render(<AgendaFormModal agenda={agendaInicial} />);

    const agendaPacienteB = makeMockAgenda({
      form: {
        ...makeMockAgenda().form,
        pacienteId: 'pac-2',
        pacienteNome: 'João Paciente',
        catalogoProcedimentoSaudeIds: ['cat-toxina'],
      },
      planoItemEscolhidoPorCatalogo: { 'cat-toxina': 'item-toxina-1' },
    });

    rerender(<AgendaFormModal agenda={agendaPacienteB} />);

    expect(screen.getByRole('button', { name: 'Remover Toxina Botulínica' })).toBeInTheDocument();
  });
});
