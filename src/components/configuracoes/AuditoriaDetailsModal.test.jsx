import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AuditoriaDetailsModal } from './AuditoriaDetailsModal';
vi.mock('../hooks/useFusoClinica', () => ({ useFusoClinica: () => ({ fuso: 'America/Sao_Paulo' }) }));
afterEach(cleanup);
const registro = { id: 'r1', nomeUsuario: 'Pessoa A', criadoEm: '2026-10-04T13:00:00Z', acao: 'PACIENTE_EDITAR', entidade: 'PACIENTE', permissaoNome: 'Editar paciente', permissaoCodigo: 'PACIENTE_EDITAR', permissaoModulo: 'Pacientes', dadosAntigos: '{"nome":"Antes","ativo":false}', dadosNovos: '{"nome":"Depois","ativo":true}', ipOrigem: '192.0.2.1', userAgent: 'Navegador de teste' };
describe('AuditoriaDetailsModal', () => {
  it('preserva alterações estruturadas, autorização e origem', () => {
    render(<AuditoriaDetailsModal registro={registro} onClose={vi.fn()} />);
    expect(screen.getAllByText('Antes')).toHaveLength(3);
    expect(screen.getAllByText('Depois')).toHaveLength(3);
    expect(screen.getByText('Sim (Ativo)')).toBeInTheDocument();
    expect(screen.getByText('Não (Inativo)')).toBeInTheDocument();
    expect(screen.getByText('PACIENTE_EDITAR')).toBeInTheDocument();
    expect(screen.getByText('192.0.2.1')).toBeInTheDocument();
    expect(screen.getByText('Navegador de teste')).toBeInTheDocument();
  });
  it('mantém foco no diálogo, fecha com Escape e devolve foco ao gatilho', () => {
    const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
    const onClose = vi.fn();
    const { unmount } = render(<AuditoriaDetailsModal registro={registro} onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: 'Detalhes do registro' });
    expect(dialog).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Fechar', exact: true })).toHaveFocus();
    fireEvent.keyDown(document.activeElement, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Fechar detalhes' })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Escape' }); expect(onClose).toHaveBeenCalledOnce();
    unmount(); expect(trigger).toHaveFocus(); trigger.remove();
  });
});
