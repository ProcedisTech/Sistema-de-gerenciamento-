/**
 * Onda E+: abrir o termo ("Ler e Assinar") grava "lido" sozinho e a outra aba ve "lido".
 * Step3Termos REAL + useTermosConsulta REAL (aba A e aba B) sobre um servidor falso em memoria.
 */
import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { limparAmbienteSnapshot, prepararAmbienteSnapshot, assentar } from '../snapshotConsulta.jsx';
import { termosApi, termoAssinaturaApi, organizacaoApi } from '../../services/api.js';
import { Step3Termos } from '../../components/journey/Step4LGPD.jsx';
import { useTermosConsulta } from '../../components/hooks/useTermosConsulta.js';

vi.mock('../../services/api.js', async (importOriginal) => {
  const { apiVazia } = await import('../snapshotConsulta.jsx');
  return apiVazia(await importOriginal());
});
vi.mock('../../contexts/OrgContext', async (importOriginal) => {
  const { orgComTodasPermissoes } = await import('../snapshotConsulta.jsx');
  const { PERMISSOES } = await import('../../constants/permissoes.js');
  return orgComTodasPermissoes(await importOriginal(), Object.values(PERMISSOES));
});

const noop = () => {};
const termo1 = { id: 't1', titulo: 'Termo Um', conteudo: 'Texto um.', ativo: true };
const termo2 = { id: 't2', titulo: 'Termo Dois', conteudo: 'Texto dois.', ativo: true };
const linha = (termoId, ordem) => ({
  termoId, ordem, lido: false, lidoEm: null, escolhido: false, termoAssinaturaId: null, statusAssinatura: 'PENDENTE',
});

let puts;
let salvarB;

/** Servidor falso: PUT /termos grava escolhido/lido/lidoEm; "lido" nunca desmarca. */
function Mundo({ ids }) {
  const [servidor, setServidor] = useState(() => ids.map((id, i) => linha(id, i + 1)));
  const [assinados, setAssinados] = useState([]);

  const [selA, setSelA] = useState(null);
  const [lidoA, setLidoA] = useState(false);
  const [pendA, setPendA] = useState(ids);
  const jsA = {
    termoSelecionadoId: selA, setTermoSelecionadoId: setSelA,
    termoLido: lidoA, setTermoLido: setLidoA,
    termosPendentesIds: pendA, setTermosPendentesIds: setPendA,
  };
  const salvarA = (corpo) => {
    puts.push(corpo);
    setServidor((prev) => corpo.termosPendentesIds.map((id, i) => {
      const antes = prev.find((t) => t.termoId === id);
      const escolhido = String(id) === String(corpo.termoSelecionadoId);
      const lido = Boolean(antes?.lido) || (escolhido && corpo.termoLido);
      return {
        ...linha(id, i + 1), ...antes, escolhido, lido,
        lidoEm: antes?.lidoEm || (lido ? '2026-10-14T10:00:00Z' : null),
      };
    }));
    return true;
  };
  const { gravarEstadoTermos } = useTermosConsulta({
    termosDaConsulta: servidor, salvarTermosConsulta: salvarA, journeyState: jsA,
  });

  const [selB, setSelB] = useState(null);
  const [lidoB, setLidoB] = useState(false);
  const [pendB, setPendB] = useState(ids);
  useTermosConsulta({
    termosDaConsulta: servidor,
    salvarTermosConsulta: salvarB,
    journeyState: {
      termoSelecionadoId: selB, setTermoSelecionadoId: setSelB,
      termoLido: lidoB, setTermoLido: setLidoB,
      termosPendentesIds: pendB, setTermosPendentesIds: setPendB,
    },
  });
  const linhaB = servidor.find((t) => t.termoId === 't1');

  return (
    <>
      <div data-testid="aba-b">
        {`sel=${selB};lido=${lidoB};t1lido=${linhaB?.lido};t1lidoEm=${linhaB?.lidoEm ? 'sim' : 'nao'}`}
      </div>
      <Step3Termos
        setTermoLido={setLidoA}
        termoAssinaturaDataUrl=""
        setTermoAssinaturaDataUrl={noop}
        setTermoAssinado={noop}
        profissionalAssinaturaDataUrl="data:image/png;base64,PROF"
        setProfissionalAssinaturaDataUrl={noop}
        setStep4Errors={noop}
        termosAssinados={assinados}
        setTermosAssinados={setAssinados}
        termosPendentesIds={pendA}
        setTermosPendentesIds={setPendA}
        termosDaConsulta={servidor}
        gravarEstadoTermos={gravarEstadoTermos}
        termoTitulo=""
        termoConteudo=""
        onTermoChange={setSelA}
        onAssinaturaSalva={noop}
        pacienteId="pac-1"
        procedimentoFeitoId={null}
        roleUserId="ru-1"
        pacienteCtx={{ nome: 'Ana', cpf: '1', telefone: '1' }}
        clinicaCtx={{ nome: 'Clinica', cnpj: '1', endereco: 'R', telefone: '1' }}
        profissionalCtx={{ nome: 'Dra', cpf: '1', telefone: '1' }}
        onConcluir={noop}
        catalogoIds={[]}
        exigirFilaVinculo={false}
        atendimentoId="at-1"
      />
    </>
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

async function clicarLer(indice = 0) {
  const botoes = await screen.findAllByRole('button', { name: 'Ler e Assinar' });
  fireEvent.click(botoes[indice]);
  await assentar();
}

describe('Termos: lido automatico ao abrir (tela + duas abas)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    puts = [];
    salvarB = vi.fn();
    prepararAmbienteSnapshot();
    stubCanvas();
    termosApi.list.mockResolvedValue([termo1, termo2]);
    termosApi.resolver.mockResolvedValue(null);
    organizacaoApi.getMinhas.mockResolvedValue([]);
    termoAssinaturaApi.listarPorPaciente.mockResolvedValue([]);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    limparAmbienteSnapshot();
  });

  it('(g) "Ler e Assinar" grava 1 PUT com termoLido; reabrir nao grava de novo; a aba B ve lido', async () => {
    render(<Mundo ids={['t1', 't2']} />);
    await screen.findAllByRole('button', { name: 'Ler e Assinar' });
    expect(screen.getByTestId('aba-b')).toHaveTextContent('lido=false');

    await clicarLer(0); // abre t1
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toMatchObject({ termoLido: true, termoSelecionadoId: 't1' });
    await waitFor(() => expect(screen.getByTestId('aba-b')).toHaveTextContent('sel=t1;lido=true;t1lido=true;t1lidoEm=sim'));

    await clicarLer(0); // abre t2 (t1 volta a ficar disponivel): escolha mudou, segundo PUT
    await waitFor(() => expect(puts).toHaveLength(2));
    expect(puts[1]).toMatchObject({ termoSelecionadoId: 't2' });

    await clicarLer(0); // reabre t1: ja lido nesta sessao e no servidor
    await assentar();
    expect(puts.filter((p) => p.termoLido === true && p.termoSelecionadoId === 't1')).toHaveLength(1);
    expect(puts.slice(2).every((p) => p.termoSelecionadoId === 't1')).toBe(true);
    expect(salvarB).not.toHaveBeenCalled();
    expect(screen.getByTestId('aba-b')).toHaveTextContent('t1lido=true;t1lidoEm=sim');
  });
});
