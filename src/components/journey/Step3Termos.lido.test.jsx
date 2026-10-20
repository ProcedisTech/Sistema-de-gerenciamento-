import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
const termo2 = { id: 't2', titulo: 'Termo Dois', conteudo: 'Outro texto.', ativo: true };
const termo = { id: 't1', titulo: TITULO, conteudo: 'Declaro que fui informada.', ativo: true };

function Harness({ extra = {}, pendentesIniciais = ['t1'] }) {
  const [assinados, setAssinados] = useState([]);
  const [pendentes, setPendentes] = useState(pendentesIniciais);
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

describe('Step3Termos — lido automático ao abrir o termo', () => {
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
    limparAmbienteSnapshot();
  });

  it('(a) abrir o termo marca lido 1x e grava 1x', async () => {
    const setTermoLido = vi.fn();
    const gravarEstadoTermos = vi.fn();
    render(<Harness extra={{ termosDaConsulta: [], gravarEstadoTermos, setTermoLido }} />);
    await abrirTermo();
    expect(setTermoLido).toHaveBeenCalledTimes(1);
    expect(setTermoLido).toHaveBeenCalledWith(true);
    expect(gravarEstadoTermos).toHaveBeenCalledTimes(1);
  });

  it('(b) reabrir o mesmo termo não chama de novo', async () => {
    termosApi.list.mockResolvedValue([termo, termo2]);
    const setTermoLido = vi.fn();
    const gravarEstadoTermos = vi.fn();
    render(
      <Harness
        pendentesIniciais={['t1', 't2']}
        extra={{ termosDaConsulta: [], gravarEstadoTermos, setTermoLido }}
      />,
    );
    await screen.findAllByRole('button', { name: 'Ler e Assinar' });
    const abrirPrimeiro = async () => {
      fireEvent.click((await screen.findAllByRole('button', { name: 'Ler e Assinar' }))[0]);
      await assentar();
    };
    await abrirPrimeiro(); // abre t1
    await abrirPrimeiro(); // abre t2 (t1 volta a ficar disponível)
    expect(setTermoLido).toHaveBeenCalledTimes(2);
    expect(gravarEstadoTermos).toHaveBeenCalledTimes(2);
    await abrirPrimeiro(); // reabre t1: já marcado nesta sessão
    expect(setTermoLido).toHaveBeenCalledTimes(2);
    expect(gravarEstadoTermos).toHaveBeenCalledTimes(2);
  });

  it('(c) termo já lido no servidor não dispara nada', async () => {
    const setTermoLido = vi.fn();
    const gravarEstadoTermos = vi.fn();
    const lidos = [{ termoId: 't1', termoTitulo: TITULO, statusAssinatura: 'PENDENTE', lido: true, lidoEm: '2026-01-01T10:00:00Z', ordem: 1 }];
    render(<Harness extra={{ termosDaConsulta: lidos, gravarEstadoTermos, setTermoLido }} />);
    await abrirTermo();
    expect(setTermoLido).not.toHaveBeenCalled();
    expect(gravarEstadoTermos).not.toHaveBeenCalled();
  });

  it('(d) fluxo antigo (sem gravarEstadoTermos) só marca lido', async () => {
    const setTermoLido = vi.fn();
    render(<Harness extra={{ setTermoLido }} />);
    await abrirTermo();
    expect(setTermoLido).toHaveBeenCalledTimes(1);
    expect(setTermoLido).toHaveBeenCalledWith(true);
  });
});
