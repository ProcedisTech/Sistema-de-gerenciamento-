import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
}

async function abrirTermo() {
  fireEvent.click(await screen.findByRole('button', { name: 'Ler e Assinar' }));
  await assentar();
}


describe('Step3Termos — auto-salvar da assinatura na tela', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prepararAmbienteSnapshot();
    stubCanvas();
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('sem rede'))));
    termosApi.list.mockResolvedValue([termo]);
    termosApi.resolver.mockResolvedValue(null);
    organizacaoApi.getMinhas.mockResolvedValue([]);
    termoAssinaturaApi.criar.mockResolvedValue({ id: 'ass-criada', termoId: 't1', statusCodigo: 'ASSINADO' });
    termoAssinaturaApi.listarPorPaciente.mockResolvedValue([]);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    limparAmbienteSnapshot();
  });

  const comAssinaturas = (extra) => (
    <Harness extra={{ termoAssinaturaDataUrl: 'data:image/png;base64,PAT', ...extra }} />
  );

  it('(a) com a fila: chama enviarAssinaturaPelaFila 1x com atendimentoId e não chama criar', async () => {
    const enviarAssinaturaPelaFila = vi.fn(async () => ({
      ok: true, assinatura: { id: 'ass-fila', termoId: 't1', statusCodigo: 'ASSINADO' }, naFila: false,
    }));
    render(comAssinaturas({ termosDaConsulta: [], enviarAssinaturaPelaFila }));
    await abrirTermo();
    await waitFor(() => expect(enviarAssinaturaPelaFila).toHaveBeenCalledTimes(1));
    expect(enviarAssinaturaPelaFila.mock.calls[0][0]).toMatchObject({
      atendimentoId: 'at-1', termoId: 't1', pacienteId: 'pac-1', statusCodigo: 'ASSINADO',
    });
    expect(termoAssinaturaApi.criar).not.toHaveBeenCalled();
  });

  it('(b) naFila: toast.info, sem segunda chamada e sem erro', async () => {
    const enviarAssinaturaPelaFila = vi.fn(async () => ({ ok: false, assinatura: null, naFila: true }));
    render(comAssinaturas({ termosDaConsulta: [], enviarAssinaturaPelaFila }));
    await abrirTermo();
    await waitFor(() => expect(enviarAssinaturaPelaFila).toHaveBeenCalledTimes(1));
    await assentar();
    await assentar();
    expect(enviarAssinaturaPelaFila).toHaveBeenCalledTimes(1);
    expect(termoAssinaturaApi.criar).not.toHaveBeenCalled();
    expect(toastMock.info).toHaveBeenCalledWith('Assinatura guardada; será enviada quando a internet voltar.');
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it('(c1) 409 vindo da fila: toast.info "já foi registrado", sem erro', async () => {
    const enviarAssinaturaPelaFila = vi.fn(async () => ({ ok: false, assinatura: null, naFila: false, status: 409 }));
    render(comAssinaturas({ termosDaConsulta: [], enviarAssinaturaPelaFila }));
    await abrirTermo();
    await waitFor(() => expect(toastMock.info).toHaveBeenCalledWith('Este termo já foi registrado nesta consulta.'));
    await assentar();
    expect(enviarAssinaturaPelaFila).toHaveBeenCalledTimes(1);
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it('(c2) 409 do criar direto (sem hub): toast.info, relê por listarPorPaciente, sem erro', async () => {
    termoAssinaturaApi.criar.mockRejectedValue(Object.assign(new Error('conflito'), { status: 409 }));
    render(comAssinaturas({}));
    await abrirTermo();
    await waitFor(() => expect(toastMock.info).toHaveBeenCalledWith('Este termo já foi registrado nesta consulta.'));
    await assentar();
    expect(termoAssinaturaApi.criar).toHaveBeenCalledTimes(1);
    expect(termoAssinaturaApi.listarPorPaciente.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it('(d) sem a prop: usa criar direto como hoje', async () => {
    render(comAssinaturas({}));
    await abrirTermo();
    await waitFor(() => expect(termoAssinaturaApi.criar).toHaveBeenCalledTimes(1));
    expect(termoAssinaturaApi.criar.mock.calls[0][0]).toMatchObject({ atendimentoId: 'at-1', termoId: 't1' });
  });
});
