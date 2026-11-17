// Regressão prevenida: tocar fora/Esc com o agendamento preenchido não pode descartar sem confirmar.
import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AgendaFormModal } from './AgendaFormModal.jsx';

vi.mock('../../contexts/OrgContext', () => ({
  useOrg: () => ({ roleUserId: 'prof-1', roleNome: 'Dra. Teste', orgId: 'org-1', apareceNaAgenda: true }),
}));
vi.mock('../../contexts/useToast.js', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock('../../hooks/useMediaQuery.js', () => ({ useMediaQuery: () => true }));

beforeAll(() => {
  // jsdom não tem matchMedia; o ViewportDialog consulta prefers-reduced-motion
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  });
});

const formBase = {
  pacienteId: 'pac-1',
  pacienteNome: 'Maria Silva',
  tipoAtendimento: 'procedimento',
  tipoAtendimentoLocked: false,
  catalogoProcedimentoSaudeIds: [],
  data: '2026-10-25',
  horaInicio: '09:00',
  horaFimSlot: '09:30',
  observacao: '',
};

function makeAgenda(form = {}, overrides = {}) {
  return {
    modalMode: 'create',
    isModoPlanejamento: false,
    patientSelectLocked: false,
    roleUserIdAgenda: 'prof-1',
    procedimentoOptions: [],
    itensPlanoDisponiveis: [],
    planoItemEscolhidoPorCatalogo: {},
    setPlanoItemEscolhidoPorCatalogo: vi.fn(),
    form: { ...formBase, ...form },
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
}

const fundo = () => document.querySelector('[role="dialog"] > div[aria-hidden]');
const TITULO = 'Descartar o agendamento?';

// Abre o modal com o formulário base e depois "digita" uma observação.
function abrirEPreencher(modalMode = 'create') {
  const inicial = makeAgenda({}, { modalMode });
  const { rerender } = render(<AgendaFormModal agenda={inicial} />);
  const editado = { ...inicial, form: { ...inicial.form, observacao: 'algo digitado' } };
  rerender(<AgendaFormModal agenda={editado} />);
  return editado;
}

describe('AgendaFormModal — confirmar antes de descartar', () => {
  it('preenchido + toque fora abre a confirmação e não fecha', () => {
    const agenda = abrirEPreencher();
    fireEvent.click(fundo());
    expect(screen.getByText(TITULO)).toBeInTheDocument();
    expect(agenda.closeModal).not.toHaveBeenCalled();
  });

  it('"Continuar editando" mantém o modal', async () => {
    const agenda = abrirEPreencher();
    fireEvent.click(fundo());
    fireEvent.click(screen.getByRole('button', { name: 'Continuar editando' }));
    await waitFor(() => expect(screen.queryByText(TITULO)).not.toBeInTheDocument());
    expect(agenda.closeModal).not.toHaveBeenCalled();
  });

  it('"Descartar" fecha uma vez', () => {
    const agenda = abrirEPreencher();
    fireEvent.click(fundo());
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(agenda.closeModal).toHaveBeenCalledTimes(1);
  });

  it('vazio (aberto já com horário e paciente) fecha direto', () => {
    const agenda = makeAgenda();
    render(<AgendaFormModal agenda={agenda} />);
    // sinal positivo: o modal está aberto
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(fundo());
    expect(agenda.closeModal).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(TITULO)).not.toBeInTheDocument();
  });

  it('Esc com algo preenchido abre a confirmação e não fecha o modal', () => {
    const agenda = abrirEPreencher();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByText(TITULO)).toBeInTheDocument();
    // 2º Esc: o diálogo da confirmação o consome (volta a editar); o modal nunca fecha por ele
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(agenda.closeModal).not.toHaveBeenCalled();
  });

  it('reagendar com algo alterado abre a confirmação', () => {
    const agenda = abrirEPreencher('reagendar');
    fireEvent.click(fundo());
    expect(screen.getByText(TITULO)).toBeInTheDocument();
    expect(agenda.closeModal).not.toHaveBeenCalled();
  });
});

// O dia do formulário deixa de caber (heatmap): a limpeza automática não é edição do usuário.
function AgendaViva({ cells, spies }) {
  const [form, setForm] = useState(formBase);
  const agenda = {
    ...makeAgenda(),
    form,
    closeModal: spies.closeModal,
    updateForm: (campo, valor) => {
      spies.updates.push(campo);
      setForm((f) => ({ ...f, [campo]: valor }));
    },
    clearRangeSelection: () => setForm((f) => ({ ...f, horaInicio: '', horaFimSlot: '' })),
    dispCalendarioHeatmap: { cells },
  };
  return <AgendaFormModal agenda={agenda} />;
}
const celulaFechada = [{ iso: formBase.data, inCurrentMonth: true, clickable: false }];
const novosSpies = () => ({ closeModal: vi.fn(), updates: [] });

describe('AgendaFormModal — limpeza automática do dia não conta como edição', () => {
  it('heatmap com o dia fechado já ao abrir: fechar não pergunta', async () => {
    const spies = novosSpies();
    render(<AgendaViva cells={celulaFechada} spies={spies} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await waitFor(() => expect(spies.updates).toContain('data'));
    fireEvent.click(fundo());
    await waitFor(() => expect(spies.closeModal).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(TITULO)).not.toBeInTheDocument();
  });

  it('heatmap chega depois de abrir: fechar não pergunta', async () => {
    const spies = novosSpies();
    const { rerender } = render(<AgendaViva cells={[]} spies={spies} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(spies.updates).toHaveLength(0);
    rerender(<AgendaViva cells={celulaFechada} spies={spies} />);
    await waitFor(() => expect(spies.updates).toContain('data'));
    fireEvent.click(fundo());
    await waitFor(() => expect(spies.closeModal).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(TITULO)).not.toBeInTheDocument();
  });
});
