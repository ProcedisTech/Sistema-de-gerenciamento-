import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import '@testing-library/jest-dom';
import { ConsultaEncerrarConfirmModal } from '../consulta/ConsultaEncerrarConfirmModal.jsx';
import { PlanoConcluidoClinicaModal } from './PlanoConcluidoClinicaModal.jsx';
import {
  aplicarCenaAntesDoPlanoConcluido,
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

describe('aplicarCenaAntesDoPlanoConcluido', () => {
  it('fecha Encerrar/Sair e limpa finishingMode antes do pop-up', () => {
    const setEncerrarConsultaOpen = vi.fn();
    const setFinishingMode = vi.fn();
    aplicarCenaAntesDoPlanoConcluido({ setEncerrarConsultaOpen, setFinishingMode });
    expect(setEncerrarConsultaOpen).toHaveBeenCalledWith(false);
    expect(setFinishingMode).toHaveBeenCalledWith(null);
  });

  it('depois da cena, só o pop-up de plano fica visível e clicável', async () => {
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
    expect(screen.getByRole('dialog', { name: /Plano concluído com êxito/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Marcar retorno à clínica/i }));
    expect(onAceitar).toHaveBeenCalledTimes(1);
  });
});

describe('PlanoConcluidoClinicaModal', () => {
  it('não fecha no backdrop', async () => {
    const onAceitar = vi.fn();
    const onRecusar = vi.fn();
    render(
      <PlanoConcluidoClinicaModal
        open
        pacienteNome="Maria"
        onAceitar={onAceitar}
        onRecusar={onRecusar}
      />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Maria/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('dialog'));
    expect(onRecusar).not.toHaveBeenCalled();
    expect(onAceitar).not.toHaveBeenCalled();
  });

  it('Aceitar dispara onAceitar', async () => {
    const onAceitar = vi.fn();
    render(
      <PlanoConcluidoClinicaModal
        open
        pacienteNome="Maria"
        onAceitar={onAceitar}
        onRecusar={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Marcar retorno à clínica/i }));
    expect(onAceitar).toHaveBeenCalledTimes(1);
  });

  it('Agora não dispara onRecusar', async () => {
    const onRecusar = vi.fn();
    render(
      <PlanoConcluidoClinicaModal
        open
        pacienteNome="Maria"
        onAceitar={vi.fn()}
        onRecusar={onRecusar}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /^Agora não$/i }));
    expect(onRecusar).toHaveBeenCalledTimes(1);
  });
});
