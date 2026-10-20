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

describe('Step3Termos — termos da consulta (hub)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prepararAmbienteSnapshot();
    stubCanvas();
    termosApi.list.mockResolvedValue([termo]);
    termosApi.resolver.mockResolvedValue(null);
    organizacaoApi.getMinhas.mockResolvedValue([]);
    termoAssinaturaApi.criar.mockResolvedValue({ id: 'ass-criada', termoId: 't1', statusCodigo: 'ASSINADO' });
    termoAssinaturaApi.concluirPresencial.mockResolvedValue({ id: 'p1', termoId: 't1', statusCodigo: 'ASSINADO' });
    termoAssinaturaApi.listarPorPaciente.mockResolvedValue([]);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    limparAmbienteSnapshot();
  });

  it('(a) o tablet envia atendimentoId pela fila quando a prop existe', async () => {
    const enviarAssinaturaPelaFila = vi.fn(async () => ({ id: 'ass-fila', termoId: 't1', statusCodigo: 'ASSINADO' }));
    render(<Harness extra={{ termosDaConsulta: [], enviarAssinaturaPelaFila }} />);
    await abrirTermo();
    await assinarNoTablet();
    expect(enviarAssinaturaPelaFila).toHaveBeenCalledTimes(1);
    expect(enviarAssinaturaPelaFila.mock.calls[0][0]).toMatchObject({
      atendimentoId: 'at-1',
      termoId: 't1',
      pacienteId: 'pac-1',
      statusCodigo: 'ASSINADO',
    });
    expect(termoAssinaturaApi.criar).not.toHaveBeenCalled();
  });

  it('(a2) sem enviarAssinaturaPelaFila usa o criar de hoje, agora com atendimentoId', async () => {
    render(<Harness />);
    await abrirTermo();
    await assinarNoTablet();
    expect(termoAssinaturaApi.criar).toHaveBeenCalledTimes(1);
    expect(termoAssinaturaApi.criar.mock.calls[0][0]).toMatchObject({ atendimentoId: 'at-1', termoId: 't1' });
  });

  it('(b) termo ASSINADO no servidor aparece como assinado e o tablet não cria', async () => {
    const enviarAssinaturaPelaFila = vi.fn();
    const { rerender } = render(<Harness extra={{ termosDaConsulta: [], enviarAssinaturaPelaFila }} />);
    await abrirTermo();
    rerender(
      <Harness
        extra={{
          enviarAssinaturaPelaFila,
          termosDaConsulta: [
            { termoId: 't1', titulo: TITULO, statusAssinatura: 'ASSINADO', termoAssinaturaId: 'ass-9', ordem: 1 },
          ],
        }}
      />,
    );
    await assentar();
    expect(screen.getAllByText(new RegExp(TITULO)).length).toBeGreaterThan(0);
    // Mesmo com o termo aberto antes do aviso, a assinatura no tablet não cria outra.
    const solicitar = screen.queryByRole('button', { name: 'Solicitar Assinatura' });
    if (solicitar) await assinarNoTablet();
    expect(enviarAssinaturaPelaFila).not.toHaveBeenCalled();
    expect(termoAssinaturaApi.criar).not.toHaveBeenCalled();
  });

  it('(c) a lista nova substitui: termo que sumiu da prop sai da tela', async () => {
    const assinadoNaTela = () => screen.queryByText(/Termos assinados|Assinado nesta|Termo assinado/i);
    const item = { termoId: 't2', titulo: 'Termo Dois Assinado', statusAssinatura: 'ASSINADO', termoAssinaturaId: 'ass-2', ordem: 1 };
    const { rerender } = render(<Harness extra={{ termosDaConsulta: [item] }} />);
    await assentar();
    expect(screen.getAllByText('Termo Dois Assinado').length).toBeGreaterThan(0);
    rerender(<Harness extra={{ termosDaConsulta: [] }} />);
    await assentar();
    expect(screen.queryByText('Termo Dois Assinado')).not.toBeInTheDocument();
    void assinadoNaTela;
  });

  it('(c2) F3: o título do termo assinado vem do `titulo` da consulta, nunca do genérico', async () => {
    const item = { termoId: 't9', titulo: 'Termo de preenchimento labial', statusAssinatura: 'ASSINADO', termoAssinaturaId: 'ass-9', ordem: 1 };
    render(<Harness extra={{ termosDaConsulta: [item] }} />);
    await assentar();
    expect(screen.getAllByText('Termo de preenchimento labial').length).toBeGreaterThan(0);
    expect(screen.queryByText('TERMO DE CONSENTIMENTO')).not.toBeInTheDocument();
  });

  it('(d) PENDENTE da consulta usa concluir-presencial e não cria outra', async () => {
    const enviarAssinaturaPelaFila = vi.fn();
    render(
      <Harness
        extra={{
          enviarAssinaturaPelaFila,
          termosDaConsulta: [
            { termoId: 't1', titulo: TITULO, statusAssinatura: 'PENDENTE', termoAssinaturaId: 'p1', ordem: 1 },
          ],
        }}
      />,
    );
    await abrirTermo();
    await assinarNoTablet();
    expect(termoAssinaturaApi.concluirPresencial).toHaveBeenCalledTimes(1);
    expect(termoAssinaturaApi.concluirPresencial.mock.calls[0][0]).toBe('p1');
    expect(termoAssinaturaApi.criar).not.toHaveBeenCalled();
    expect(enviarAssinaturaPelaFila).not.toHaveBeenCalled();
  });

  it('(e) escolher o termo chama gravarEstadoTermos uma vez', async () => {
    const gravarEstadoTermos = vi.fn();
    render(<Harness extra={{ termosDaConsulta: [], gravarEstadoTermos }} />);
    await screen.findByRole('button', { name: 'Ler e Assinar' });
    await assentar();
    expect(gravarEstadoTermos).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Ler e Assinar' }));
    await assentar();
    expect(gravarEstadoTermos).toHaveBeenCalledTimes(1);
  });

  it('sem hub (termosDaConsulta ausente) lê os assinados por listarPorPaciente como reserva', async () => {
    termoAssinaturaApi.listarPorPaciente.mockResolvedValue([
      { id: 'ass-7', termoId: 't7', termoTitulo: 'Termo Sete', atendimentoId: 'at-1', statusCodigo: 'ASSINADO' },
    ]);
    render(<Harness />);
    await assentar();
    expect(termoAssinaturaApi.listarPorPaciente).toHaveBeenCalledWith('pac-1');
    expect(screen.getAllByText('Termo Sete').length).toBeGreaterThan(0);
  });

  it('com hub não lê por listarPorPaciente', async () => {
    render(<Harness extra={{ termosDaConsulta: [] }} />);
    await assentar();
    expect(termoAssinaturaApi.listarPorPaciente).not.toHaveBeenCalled();
  });
});
