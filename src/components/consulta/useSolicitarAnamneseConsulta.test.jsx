import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { useSolicitarAnamneseConsulta } from './useSolicitarAnamneseConsulta.jsx';

const captured = vi.hoisted(() => ({ escolha: null, solicitar: null }));

vi.mock('../assinaturas/ModalEscolhaAssinatura.jsx', () => ({
  ModalEscolhaAssinatura: (props) => {
    captured.escolha = props;
    if (!props.open) return null;
    return (
      <div data-testid="escolha">
        <button type="button" onClick={props.onSelectQrCode}>QR</button>
        <button type="button" onClick={props.onSelectLink}>WhatsApp</button>
        <button type="button" onClick={props.onClose}>Fechar escolha</button>
      </div>
    );
  },
}));

vi.mock('../anamnese/SolicitarAnamneseModal.jsx', () => ({
  SolicitarAnamneseModal: (props) => {
    captured.solicitar = props;
    if (!props.open) return null;
    return (
      <div data-testid="solicitar">
        <button type="button" onClick={props.onClose}>X</button>
        <button type="button" onClick={props.onCancelar}>Cancelar</button>
        <button type="button" onClick={() => props.onEnvioGerado({ envioId: 'env1', expiraEm: null })}>Gerado</button>
        <button type="button" onClick={props.onEnvioExpirado}>Expirado</button>
        <button type="button" onClick={props.onConcluido}>Concluido</button>
        <button type="button" onClick={props.onRecusado}>Recusado</button>
      </div>
    );
  },
}));

function Harness({ opts }) {
  const { abrirSolicitacao, modaisSolicitacao } = useSolicitarAnamneseConsulta(opts);
  return (
    <>
      <button type="button" onClick={abrirSolicitacao}>Abrir</button>
      {modaisSolicitacao}
    </>
  );
}

function setup(overrides = {}) {
  const toast = { error: vi.fn() };
  const opts = {
    paciente: { pacienteId: 'pac1', nome: 'Marina', cpf: '123', telefone: '11999990000' },
    clinicaSlug: 'clinica-local',
    toast,
    onEnvioGerado: vi.fn(),
    onEnvioLimpo: vi.fn(),
    onRespondido: vi.fn(),
    ...overrides,
  };
  render(<Harness opts={opts} />);
  return { ...opts, toast: overrides.toast ?? toast, user: userEvent.setup() };
}

describe('useSolicitarAnamneseConsulta', () => {
  beforeEach(() => {
    captured.escolha = null;
    captured.solicitar = null;
  });

  it('abre a escolha com payload sem preenchimento/anamneseId e opções da Agenda', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    expect(screen.getByTestId('escolha')).toBeInTheDocument();
    expect(captured.escolha.opcoes).toEqual({ tablet: false, qrCode: true, link: true });

    await user.click(screen.getByRole('button', { name: 'QR' }));
    expect(captured.solicitar.payload).toEqual({
      pacienteId: 'pac1',
      telefonePaciente: '11999990000',
      pacienteNome: 'Marina',
      pacienteCpf: '123',
      escolha: { metodoCodigo: 'DISPOSITIVO_PROPRIO_LOCAL', canalCodigo: null },
    });
    expect(captured.solicitar.payload).not.toHaveProperty('preenchimentoAnamneseId');
    expect(captured.solicitar.payload).not.toHaveProperty('anamneseId');
    expect(screen.queryByTestId('escolha')).not.toBeInTheDocument();
  });

  it('WhatsApp usa DISPOSITIVO_PROPRIO_REMOTO/WHATSAPP', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    await user.click(screen.getByRole('button', { name: 'WhatsApp' }));
    expect(captured.solicitar.escolha).toEqual({ metodoCodigo: 'DISPOSITIVO_PROPRIO_REMOTO', canalCodigo: 'WHATSAPP' });
  });

  it('WhatsApp sem telefone: toast e continua na escolha', async () => {
    const { user, toast } = setup({ paciente: { pacienteId: 'pac1', nome: 'Marina' } });
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    await user.click(screen.getByRole('button', { name: 'WhatsApp' }));
    expect(toast.error).toHaveBeenCalledWith('Paciente sem telefone cadastrado.');
    expect(screen.getByTestId('escolha')).toBeInTheDocument();
    expect(screen.queryByTestId('solicitar')).not.toBeInTheDocument();
  });

  it('sem paciente: toast e nada abre', async () => {
    const { user, toast } = setup({ paciente: {} });
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(toast.error).toHaveBeenCalledWith('Não foi possível identificar o paciente deste agendamento.');
    expect(screen.queryByTestId('escolha')).not.toBeInTheDocument();
  });

  it('sem slug: toast da Agenda e nada abre', async () => {
    const { user, toast } = setup({ clinicaSlug: '' });
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('slug'));
    expect(screen.queryByTestId('escolha')).not.toBeInTheDocument();
  });

  it('onEnvioGerado repassa os dados; expirado chama onEnvioLimpo', async () => {
    const { user, onEnvioGerado, onEnvioLimpo } = setup();
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    await user.click(screen.getByRole('button', { name: 'QR' }));
    await user.click(screen.getByRole('button', { name: 'Gerado' }));
    expect(onEnvioGerado).toHaveBeenCalledWith({ envioId: 'env1', expiraEm: null });
    await user.click(screen.getByRole('button', { name: 'Expirado' }));
    expect(onEnvioLimpo).toHaveBeenCalledTimes(1);
  });

  it('Cancelar volta para a escolha e chama onEnvioLimpo', async () => {
    const { user, onEnvioLimpo, onRespondido } = setup();
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    await user.click(screen.getByRole('button', { name: 'QR' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onEnvioLimpo).toHaveBeenCalledTimes(1);
    expect(onRespondido).not.toHaveBeenCalled();
    expect(screen.getByTestId('escolha')).toBeInTheDocument();
    expect(screen.queryByTestId('solicitar')).not.toBeInTheDocument();
  });

  it('X fecha sem chamar callbacks', async () => {
    const { user, onEnvioLimpo, onRespondido } = setup();
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    await user.click(screen.getByRole('button', { name: 'QR' }));
    await user.click(screen.getByRole('button', { name: 'X' }));
    expect(screen.queryByTestId('solicitar')).not.toBeInTheDocument();
    expect(onEnvioLimpo).not.toHaveBeenCalled();
    expect(onRespondido).not.toHaveBeenCalled();
  });

  it.each(['Concluido', 'Recusado'])('%s fecha e chama onRespondido', async (nome) => {
    const { user, onRespondido } = setup();
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    await user.click(screen.getByRole('button', { name: 'QR' }));
    await user.click(screen.getByRole('button', { name: nome }));
    expect(onRespondido).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('solicitar')).not.toBeInTheDocument();
  });
});
