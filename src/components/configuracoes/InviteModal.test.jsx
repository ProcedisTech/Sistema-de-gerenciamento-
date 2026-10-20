import React from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { InviteModal } from './InviteModal';

vi.mock('../../contexts/useToast.js', () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn() }) }));
vi.mock('../hooks/useAgoraDaClinica.js', () => ({ useAgoraDaClinica: () => ({ hojeIso: '2026-10-04' }) }));
vi.mock('../../hooks/useEstadosCivis.js', () => ({ useEstadosCivis: () => ({ estadosCivis: [{ id: 'civil', nome: 'Solteiro(a)' }], loading: false }) }));

const defaultProps = {
  roles: [{ id: 'dentista', nome: 'DENTISTA' }, { id: 'recepcao', nome: 'RECEPCIONISTA' }],
  perfisAcesso: [{ id: 'dono', codigo: 'DONO', nome: 'Dono' }, { id: 'clinico', codigo: 'PROFISSIONAL_CLINICO', nome: 'Clínico' }],
  permissoes: [],
  especialidadesList: [{ id: 'odonto', nome: 'Odontologia' }],
  onClose: vi.fn(), onSuccess: vi.fn(), fetchHeaders: vi.fn(async () => ({})), onEditarPerfilNaAba: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [] })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('InviteModal', () => {
  it('mantém o cadastro completo e cargo independente do perfil, sem oferecer Dono', async () => {
    render(<InviteModal {...defaultProps} />);
    expect(screen.getByRole('dialog', { name: 'Convidar pessoa' })).toHaveFocus();
    expect(screen.getByLabelText('CPF')).toBeRequired();
    expect(screen.getByLabelText(/Senha inicial/)).toHaveAttribute('minlength', '8');
    expect(screen.getByLabelText(/Estado Civil/)).toBeInTheDocument();
    expect(screen.getByLabelText('CEP')).toBeInTheDocument();
    expect(screen.getByLabelText('Odontologia')).toBeInTheDocument();
    const profile = screen.getByLabelText('Perfil de acesso');
    expect(profile.querySelector('option[value="dono"]')).toBeNull();
    fireEvent.change(profile, { target: { value: 'clinico' } });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText('Cargo na Clínica'), { target: { value: 'recepcao' } });
    expect(profile).toHaveValue('clinico');
    expect(defaultProps.onSuccess).not.toHaveBeenCalled();
  });

  it('limita Tab ao diálogo, permite Escape e devolve foco ao gatilho', () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    const { unmount } = render(<InviteModal {...defaultProps} />);
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Fechar convite' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Criar acesso' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Fechar convite' })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalledOnce();
    unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it('preserva rascunho ao usar modelo como base sem confirmação extra', async () => {
    const onEditarPerfilNaAba = vi.fn();
    render(<InviteModal {...defaultProps} onEditarPerfilNaAba={onEditarPerfilNaAba} />);
    fireEvent.change(screen.getByLabelText('Nome Completo'), {target:{value:'Pessoa do convite'}});
    fireEvent.change(screen.getByLabelText('Perfil de acesso'), {target:{value:'clinico'}});
    await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button',{name:'Usar como base'}));
    expect(onEditarPerfilNaAba).toHaveBeenCalledWith('copy:clinico', expect.objectContaining({form:expect.objectContaining({nome:'Pessoa do convite',perfilAcessoId:'clinico'})}));
    expect(screen.queryByText('Sair sem salvar?')).not.toBeInTheDocument();
  });
  it('mostra erro de permissões sem apresentar acesso vazio', async () => {
    fetch.mockResolvedValue({ok:false});
    render(<InviteModal {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Perfil de acesso'), {target:{value:'clinico'}});
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar as permissões');
    expect(screen.getByRole('button',{name:'Criar acesso'})).toBeDisabled();
  });
});

it('sugere o perfil configurado no cargo e atualiza sua prévia', async () => {
  render(<InviteModal {...defaultProps}
    roles={[{ id: 'medico', nome: 'MEDICO', perfilAcessoPadraoId: 'clinico' }, { id: 'recepcao', nome: 'RECEPCIONISTA', perfilAcessoPadraoId: 'secretaria' }]}
    perfisAcesso={[...defaultProps.perfisAcesso, { id: 'secretaria', codigo: 'SECRETARIA', nome: 'Recepção' }]} />);
  fireEvent.change(screen.getByLabelText('Cargo na Clínica'), { target: { value: 'medico' } });
  expect(screen.getByLabelText('Perfil de acesso')).toHaveValue('clinico');
  await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/clinico/permissoes'), expect.anything()));
  fireEvent.change(screen.getByLabelText('Cargo na Clínica'), { target: { value: 'recepcao' } });
  expect(screen.getByLabelText('Perfil de acesso')).toHaveValue('secretaria');
  await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/secretaria/permissoes'), expect.anything()));
});

it('preserva o perfil escolhido manualmente ao trocar cargo com sugestão', () => {
  render(<InviteModal {...defaultProps} roles={[{ id: 'medico', nome: 'MEDICO', perfilAcessoPadraoId: 'clinico' }]}
    perfisAcesso={[...defaultProps.perfisAcesso, { id: 'custom', nome: 'Personalizado', organizacaoSaudeDonaId: 1 }]} />);
  fireEvent.change(screen.getByLabelText('Perfil de acesso'), { target: { value: 'custom' } });
  fireEvent.change(screen.getByLabelText('Cargo na Clínica'), { target: { value: 'medico' } });
  expect(screen.getByLabelText('Perfil de acesso')).toHaveValue('custom');
});

it('remove sugestão automática quando novo cargo não tem padrão disponível e nunca sugere Dono', () => {
  render(<InviteModal {...defaultProps} roles={[{ id: 'medico', nome: 'MEDICO', perfilAcessoPadraoId: 'clinico' }, { id: 'outro', nome: 'OUTRO', perfilAcessoPadraoId: 'dono' }]} />);
  fireEvent.change(screen.getByLabelText('Cargo na Clínica'), { target: { value: 'medico' } });
  expect(screen.getByLabelText('Perfil de acesso')).toHaveValue('clinico');
  fireEvent.change(screen.getByLabelText('Cargo na Clínica'), { target: { value: 'outro' } });
  expect(screen.getByLabelText('Perfil de acesso')).toHaveValue('');
});
