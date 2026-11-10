import React, { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { limparAmbienteSnapshot, prepararAmbienteSnapshot } from '../../test/snapshotConsulta.jsx';
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

const linhaDe = (texto) => {
  const linha = texto.closest('div.rounded-xl');
  expect(linha).not.toBeNull();
  return linha;
};

describe('Step3Termos - lista "Termos desta jornada" sem Cancelar', () => {
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

  const doServidor = (statusAssinatura) => ({
    termosDaConsulta: [{ termoId: 't1', titulo: TITULO, statusAssinatura, termoAssinaturaId: 'ass-1', ordem: 1 }],
  });

  it('1. termo ASSINADO do servidor: tem "Ver PDF" e nao tem "Cancelar" na linha', async () => {
    render(<Harness extra={doServidor('ASSINADO')} />);
    const linha = linhaDe(await screen.findByText('Assinado e salvo com sucesso.'));
    expect(within(linha).getByRole('button', { name: 'Ver PDF' })).toBeInTheDocument();
    expect(within(linha).queryByRole('button', { name: 'Cancelar' })).toBeNull();
    expect(within(linha).queryByText('Cancelar')).toBeNull();
  });

  it('2. termo RECUSADO do servidor: linha sem "Cancelar"', async () => {
    render(<Harness extra={doServidor('RECUSADO')} />);
    const linha = linhaDe(await screen.findByText(/Termo recusado pelo paciente/));
    expect(within(linha).getByRole('button', { name: 'Ver PDF' })).toBeInTheDocument();
    expect(within(linha).queryByRole('button', { name: 'Cancelar' })).toBeNull();
  });

  it('3. o pop-up "Cancelar Assinatura" nao existe', async () => {
    render(<Harness extra={doServidor('ASSINADO')} />);
    await screen.findByText('Assinado e salvo com sucesso.');
    expect(screen.queryByText('Cancelar Assinatura')).toBeNull();
  });
});
