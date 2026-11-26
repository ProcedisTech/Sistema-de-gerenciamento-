import React, { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import '@testing-library/jest-dom';
import { ConsultaEncerrarConfirmModal } from '../consulta/ConsultaEncerrarConfirmModal.jsx';
import { PlanoConcluidoClinicaModal } from './PlanoConcluidoClinicaModal.jsx';
import {
  aplicarCenaAntesDoPlanoConcluido,
  extrairPlanejamentoIdDoLote,
  isPlanoProntoParaConcluir,
  loteConcluiuPlano,
} from './planoConcluidoClinica.js';

describe('loteConcluiuPlano', () => {
  it('abre uma vez se qualquer resposta concluiu', () => {
    expect(
      loteConcluiuPlano([
        { planoConcluidoNesteFinalizar: false },
        { planoConcluidoNesteFinalizar: true },
        { planoConcluidoNesteFinalizar: true },
      ]),
    ).toBe(true);
  });

  it('false quando nenhuma concluiu', () => {
    expect(loteConcluiuPlano([null, { planoConcluidoNesteFinalizar: false }])).toBe(false);
  });
});

describe('extrairPlanejamentoIdDoLote', () => {
  it('extrai planejamentoId do item que sinalizou planoConcluidoNesteFinalizar', () => {
    expect(
      extrairPlanejamentoIdDoLote([
        { planoConcluidoNesteFinalizar: false, planejamentoId: 'outro' },
        { planoConcluidoNesteFinalizar: true, planejamentoId: 'plano-2' },
      ]),
    ).toBe('plano-2');
  });

  it('usa fallback do contexto da jornada com chaves variadas (planejamentoId, id, planoId)', () => {
    expect(extrairPlanejamentoIdDoLote([{ planoConcluidoNesteFinalizar: true }], { id: 'ctx-1' })).toBe('ctx-1');
    expect(extrairPlanejamentoIdDoLote([{ planoConcluidoNesteFinalizar: true }], { planoId: 'ctx-2' })).toBe('ctx-2');
    expect(extrairPlanejamentoIdDoLote([{ planoConcluidoNesteFinalizar: true }], null)).toBeNull();
  });
});

describe('isPlanoProntoParaConcluir', () => {
  it('retorna true apenas para plano ativo com itens não-cancelados 100% finalizados e sem sessões abertas', () => {
    expect(
      isPlanoProntoParaConcluir({
        statusCodigo: 'ativo',
        itens: [
          { id: '1', statusItem: 'finalizado' },
          { id: '2', statusItem: 'cancelado' },
        ],
      }),
    ).toBe(true);

    expect(
      isPlanoProntoParaConcluir({
        statusCodigo: 'ativo',
        itens: [
          { id: '1', statusItem: 'finalizado', sessaoRetornoAtiva: { agendaId: 'ag-1' } },
        ],
      }),
    ).toBe(false);

    expect(
      isPlanoProntoParaConcluir({
        statusCodigo: 'concluido',
        itens: [{ id: '1', statusItem: 'finalizado' }],
      }),
    ).toBe(false);

    expect(
      isPlanoProntoParaConcluir({
        statusCodigo: 'ativo',
        itens: [{ id: '1', statusItem: 'cancelado' }],
      }),
    ).toBe(false);
  });
});

describe('aplicarCenaAntesDoPlanoConcluido', () => {
  it('fecha Encerrar/Sair e limpa finishingMode antes do pop-up', () => {
    const setEncerrarConsultaOpen = vi.fn();
    const setFinishingMode = vi.fn();
    aplicarCenaAntesDoPlanoConcluido({ setEncerrarConsultaOpen, setFinishingMode });
    expect(setEncerrarConsultaOpen).toHaveBeenCalledWith(false);
    expect(setFinishingMode).toHaveBeenCalledWith(null);
  });

  it('depois da cena, abre Passo 1 e transiciona para Passo 2 ao concluir o plano', async () => {
    const onConcluirPlano = vi.fn().mockResolvedValue(undefined);
    const onAceitar = vi.fn();
    function Scene() {
      const [encerrarOpen, setEncerrarConsultaOpen] = useState(true);
      const [finishingMode, setFinishingMode] = useState('finalizar');
      const [planoOpen, setPlanoOpen] = useState(false);
      return (
        <>
          <button
            type="button"
            onClick={() => {
              aplicarCenaAntesDoPlanoConcluido({ setEncerrarConsultaOpen, setFinishingMode });
              setPlanoOpen(true);
            }}
          >
            abrir plano
          </button>
          <ConsultaEncerrarConfirmModal
            open={encerrarOpen}
            message="O que deseja fazer?"
            finishingMode={finishingMode}
            onCancel={() => {}}
            onConfirm={() => {}}
          />
          <PlanoConcluidoClinicaModal
            open={planoOpen}
            pacienteNome="Maria"
            planejamentoId="plano-1"
            onConcluirPlano={onConcluirPlano}
            onAnalisarPlano={vi.fn()}
            onAceitar={onAceitar}
            onRecusar={vi.fn()}
          />
        </>
      );
    }

    render(<Scene />);
    expect(screen.getByRole('dialog', { name: /Encerrar ou Sair da consulta/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'abrir plano' }));
    expect(screen.queryByRole('dialog', { name: /Encerrar ou Sair da consulta/i })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /Todos os procedimentos foram realizados/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Encerrar \/ Concluir plano/i }));
    expect(onConcluirPlano).toHaveBeenCalledWith('plano-1');
    expect(await screen.findByRole('dialog', { name: /Plano concluído com êxito/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Marcar retorno à clínica/i }));
    expect(onAceitar).toHaveBeenCalledTimes(1);
  });
});

describe('PlanoConcluidoClinicaModal', () => {
  it('Passo 1 não fecha no backdrop e Analisar chama onAnalisarPlano sem concluir', async () => {
    const onConcluirPlano = vi.fn();
    const onAnalisarPlano = vi.fn();
    const onRecusar = vi.fn();
    render(
      <PlanoConcluidoClinicaModal
        open
        pacienteNome="Maria"
        onConcluirPlano={onConcluirPlano}
        onAnalisarPlano={onAnalisarPlano}
        onAceitar={vi.fn()}
        onRecusar={onRecusar}
      />,
    );
    expect(screen.getByRole('dialog', { name: /Todos os procedimentos foram realizados/i })).toBeInTheDocument();
    expect(screen.getByText(/Maria/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('dialog'));
    expect(onRecusar).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /Analisar plano uma última vez/i }));
    expect(onAnalisarPlano).toHaveBeenCalledTimes(1);
    expect(onConcluirPlano).not.toHaveBeenCalled();
  });

  it('Passo 1 exibe erro inline sem avançar ao Passo 2 quando onConcluirPlano falha e bloqueia duplo clique em loading', async () => {
    let rejeitar;
    const onConcluirPlano = vi
      .fn()
      .mockImplementationOnce(() => new Promise((_, rej) => { rejeitar = rej; }));
    const onRecusar = vi.fn();

    render(
      <PlanoConcluidoClinicaModal
        open
        pacienteNome="Maria"
        planejamentoId="plano-1"
        onConcluirPlano={onConcluirPlano}
        onAnalisarPlano={vi.fn()}
        onAceitar={vi.fn()}
        onRecusar={onRecusar}
      />,
    );

    const btnConcluir = screen.getByRole('button', { name: /Encerrar \/ Concluir plano/i });
    await userEvent.click(btnConcluir);
    await userEvent.click(btnConcluir);
    expect(onConcluirPlano).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Analisar plano uma última vez/i })).toBeDisabled();

    // Escape bloqueado durante conclusão em andamento
    await userEvent.keyboard('{Escape}');
    expect(onRecusar).not.toHaveBeenCalled();

    rejeitar(new Error('Falha de rede simulada'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha de rede simulada');
    expect(screen.getByRole('dialog', { name: /Todos os procedimentos foram realizados/i })).toBeInTheDocument();
  });

  it('initialStep="retorno" abre direto no Passo 2 oferecendo retorno à clínica', async () => {
    const onAceitar = vi.fn();
    const onRecusar = vi.fn();
    render(
      <PlanoConcluidoClinicaModal
        open
        initialStep="retorno"
        pacienteNome="Maria"
        onAceitar={onAceitar}
        onRecusar={onRecusar}
      />,
    );
    expect(screen.getByRole('dialog', { name: /Plano concluído com êxito/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Marcar retorno à clínica/i }));
    expect(onAceitar).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onRecusar).not.toHaveBeenCalled());
  });
});
