import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { limparAmbienteSnapshot, prepararAmbienteSnapshot, assentar } from '../../test/snapshotConsulta.jsx';
import { termosApi, termoAssinaturaApi, organizacaoApi } from '../../services/api.js';
import { Step3Termos } from './Step4LGPD.jsx';

vi.mock('../../services/api.js', async (importOriginal) => {
  const { apiVazia } = await import('../../test/snapshotConsulta.jsx');
  return apiVazia(await importOriginal());
});
vi.mock('../../contexts/OrgContext', async (importOriginal) => {
  const { orgComTodasPermissoes } = await import('../../test/snapshotConsulta.jsx');
  const { PERMISSOES } = await import('../../constants/permissoes.js');
  return orgComTodasPermissoes(await importOriginal(), Object.values(PERMISSOES));
});

const toastMock = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), success: vi.fn(), warning: vi.fn() }));
vi.mock('../../contexts/useToast.js', () => ({ useToast: () => toastMock }));

const noop = () => {};
const TITULO = 'Termo de consentimento — Toxina';
const termo = { id: 't1', titulo: TITULO, conteudo: 'Declaro que fui informada.', ativo: true };
const DTO = { id: 'ass-real', termoId: 't1', statusCodigo: 'ASSINADO' };

function Harness({ extra = {} }) {
  const [assinados, setAssinados] = useState([]);
  const [pendentes, setPendentes] = useState(['t1']);
  return (
    <Step3Termos
      setTermoLido={noop}
      termoAssinaturaDataUrl=""
      setTermoAssinaturaDataUrl={noop}
      setTermoAssinado={noop}
      profissionalAssinaturaDataUrl="data:image/png;base64,PROF"
      setProfissionalAssinaturaDataUrl={noop}
      setStep4Errors={noop}
      termosAssinados={assinados}
      setTermosAssinados={setAssinados}
      termosPendentesIds={pendentes}
      setTermosPendentesIds={setPendentes}
      termoTitulo=""
      termoConteudo=""
      onTermoChange={noop}
      onAssinaturaSalva={noop}
      pacienteId="pac-1"
      procedimentoFeitoId={null}
      roleUserId="ru-1"
      pacienteCtx={{ nome: 'Ana', cpf: '1', telefone: '1' }}
      clinicaCtx={{ nome: 'Clínica', cnpj: '1', endereco: 'R', telefone: '1' }}
      profissionalCtx={{ nome: 'Dra', cpf: '1', telefone: '1' }}
      onConcluir={noop}
      catalogoIds={[]}
      exigirFilaVinculo={false}
      atendimentoId="at-1"
      {...extra}
    />
  );
}

function stubCanvas() {
  const ctx = {
    setTransform: noop, clearRect: noop, beginPath: noop, moveTo: noop, lineTo: noop, stroke: noop, drawImage: noop,
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,PAC');
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('sem rede'))));
}

async function abrirTermo() {
  fireEvent.click(await screen.findByRole('button', { name: 'Ler e Assinar' }));
  await assentar();
}

async function assinarNoTablet() {
  fireEvent.click(await screen.findByRole('button', { name: 'Solicitar Assinatura' }));
  fireEvent.click(await screen.findByText('Neste Dispositivo'));
  const canvas = document.querySelector('canvas');
  fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5 });
  fireEvent.pointerMove(canvas, { clientX: 20, clientY: 20 });
  fireEvent.pointerUp(canvas);
  const confirmar = await screen.findByRole('button', { name: 'Confirmar assinatura' });
  await waitFor(() => expect(confirmar).toBeEnabled());
  await act(async () => {
    fireEvent.click(confirmar);
  });
  await assentar();
}

async function rodar(retorno, extra = {}) {
  const enviarAssinaturaPelaFila = vi.fn(async () => retorno);
  const onAssinaturaSalva = vi.fn();
  render(<Harness extra={{ termosDaConsulta: [], enviarAssinaturaPelaFila, onAssinaturaSalva, ...extra }} />);
  await abrirTermo();
  await assinarNoTablet();
  expect(enviarAssinaturaPelaFila).toHaveBeenCalledTimes(1);
  return { enviarAssinaturaPelaFila, onAssinaturaSalva };
}

describe('Step3Termos — tablet com o envelope da fila', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prepararAmbienteSnapshot();
    stubCanvas();
    termosApi.list.mockResolvedValue([termo]);
    termosApi.resolver.mockResolvedValue(null);
    organizacaoApi.getMinhas.mockResolvedValue([]);
    termoAssinaturaApi.listarPorPaciente.mockResolvedValue([]);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    limparAmbienteSnapshot();
  });

  it('(a) ok: registra a assinatura REAL (DTO com id), não o envelope', async () => {
    const { onAssinaturaSalva } = await rodar({ ok: true, assinatura: DTO, naFila: false, status: 201, erro: null });
    expect(onAssinaturaSalva).toHaveBeenCalledTimes(1);
    expect(onAssinaturaSalva.mock.calls[0][0]).toEqual(DTO);
    expect(onAssinaturaSalva.mock.calls[0][0].id).toBe('ass-real');
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it('(b) naFila: toast.info, modal fecha, nada registrado, sem erro', async () => {
    const { onAssinaturaSalva } = await rodar({ ok: false, assinatura: null, naFila: true, status: null, erro: null });
    expect(toastMock.info).toHaveBeenCalledWith('Assinatura guardada; será enviada quando a internet voltar.');
    expect(screen.queryByRole('button', { name: 'Confirmar assinatura' })).not.toBeInTheDocument();
    expect(onAssinaturaSalva).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it('(c) 409: toast.info "já foi registrado", relê (sem hub: listarPorPaciente) e sem erro', async () => {
    const { onAssinaturaSalva } = await rodar(
      { ok: false, assinatura: null, naFila: false, status: 409, erro: new Error('x') },
      { termosDaConsulta: undefined },
    );
    expect(toastMock.info).toHaveBeenCalledWith('Este termo já foi registrado nesta consulta.');
    expect(termoAssinaturaApi.listarPorPaciente.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(onAssinaturaSalva).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it('(c2) 409 com hub: toast.info, não relê por listarPorPaciente (a prop traz)', async () => {
    await rodar({ ok: false, assinatura: null, naFila: false, status: 409, erro: new Error('x') });
    expect(toastMock.info).toHaveBeenCalledWith('Este termo já foi registrado nesta consulta.');
    expect(termoAssinaturaApi.listarPorPaciente).not.toHaveBeenCalled();
  });

  it('(d) naoEntrou: toast.warning e fecha o modal', async () => {
    const { onAssinaturaSalva } = await rodar({
      ok: false, assinatura: null, naFila: false, status: 409, erro: new Error('x'), naoEntrou: true,
    });
    expect(toastMock.warning).toHaveBeenCalledWith('A consulta já foi encerrada; a assinatura não entrou.');
    expect(screen.queryByRole('button', { name: 'Confirmar assinatura' })).not.toBeInTheDocument();
    expect(onAssinaturaSalva).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it('(e) 422: mantém o erro no modal, sem registrar', async () => {
    const { onAssinaturaSalva } = await rodar({
      ok: false, assinatura: null, naFila: false, status: 422, erro: new Error('inválido'),
    });
    expect(onAssinaturaSalva).not.toHaveBeenCalled();
    expect(screen.getByText(/Erro ao salvar assinatura/)).toBeInTheDocument();
    expect(toastMock.info).not.toHaveBeenCalledWith('Este termo já foi registrado nesta consulta.');
  });

  it('(f) formato cru (a própria assinatura) continua funcionando', async () => {
    const { onAssinaturaSalva } = await rodar(DTO);
    expect(onAssinaturaSalva).toHaveBeenCalledTimes(1);
    expect(onAssinaturaSalva.mock.calls[0][0]).toEqual(DTO);
  });
});
