/**
 * F4 (testador independente): casos adversariais da anamnese da consulta.
 *  (a) Step2Anamnese repassa queixa/expectativas ao AnamneseDocumentoView;
 *  (b) PATCH em voo ao clicar Voltar ao hub: o modal abre;
 *  (c) texto salvo apagado (campo vazio) sem blur: o modal abre;
 *  (d) só espaços a mais: o modal NÃO abre;
 *  (e) 0 perguntas e preenchimentoAnamneseId nulo: o Concluir Anamnese não quebra e leva queixa/expectativas às
 *      observações (cópia feita pelo FRONT em AppRefactored.salvarAnamneseAntesDeAvancar, não pelo back);
 *  (f) bloco "Queixa e Expectativas" não aparece sem texto e aparece só com expectativas.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS } from '../encerrar/cenariosEncerrar.js';
import {
  TIMEOUT,
  assentarMuito,
  clicarBotao,
  esperarEmConsulta,
  iniciarPeloPaciente,
  montarApp,
} from './appConsulta.jsx';
import { anamneseApi } from '../../services/api';
import { Step2Anamnese } from '../../components/journey/Step2Anamnese.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());
vi.mock('../../hooks/usePerfilClinico', () => ({ usePerfilClinico: () => ({}) }));
vi.mock('../../components/perfil-clinico/PerfilClinicoBloco', () => ({ PerfilClinicoBloco: () => null }));
// Substituto do documento: só expõe as props que o Step2 repassa (queixa/expectativas).
vi.mock('../../components/anamnese/AnamneseDocumentoAssinadoView.jsx', () => ({
  AnamneseDocumentoView: ({ queixa, expectativas }) => (
    <div data-testid="documento-stub">
      <span data-testid="stub-queixa">{String(queixa ?? '')}</span>
      <span data-testid="stub-expectativas">{String(expectativas ?? '')}</span>
    </div>
  ),
}));

const FICHA_BASICA = IDS.FICHA_BASICA;
const AVALIACAO_TEXTO = /^\/api\/v1\/atendimentos\/[^/]+\/avaliacao-texto$/;
const PLACEHOLDER_QUEIXA = /O que trouxe o paciente|Descreva o motivo da consulta/;

function rotasDaAvaliacao({ segurar = null } = {}) {
  const textos = { queixa: null, expectativas: null, observacoesAvaliacao: null, preenchimentoAnamneseId: null };
  return [
    ['PATCH', AVALIACAO_TEXTO, async ({ body }) => {
      if (segurar?.promessa) await segurar.promessa;
      for (const campo of ['queixa', 'expectativas', 'observacoesAvaliacao']) {
        if (body && Object.hasOwn(body, campo)) textos[campo] = body[campo] === '' ? null : body[campo];
      }
      return { ...textos };
    }],
    ['GET', /^\/api\/v1\/anamnese\/fichas\/basica$/, () => ({ id: FICHA_BASICA, nome: 'Ficha básica' })],
  ];
}

const escritasDaAnamnese = (srv) => srv.escritas.filter((e) => e.path.startsWith('/api/v1/anamnese/paciente/'));

async function abrirAnamnese(opcoes) {
  const srv = await montarApp({ rotas: rotasDaAvaliacao(opcoes) });
  await iniciarPeloPaciente();
  esperarEmConsulta();
  clicarBotao(/(^|sessões|assinatura)Anamnese/);
  await assentarMuito();
  return srv;
}

function campoQueixa() {
  return screen.getAllByPlaceholderText(PLACEHOLDER_QUEIXA)[0];
}

async function salvarQueixaPeloBlur(texto) {
  const campo = campoQueixa();
  fireEvent.change(campo, { target: { value: texto } });
  fireEvent.blur(campo);
  await assentarMuito();
  return campo;
}

// ---------------------------------------------------------------- (a) e (f): repasse e bloco do documento

describe('F4 adversarial: Step2Anamnese repassa queixa/expectativas ao documento', () => {
  beforeEach(() => {
    vi.spyOn(anamneseApi, 'listFichas').mockResolvedValue([{ id: 'f1', nome: 'Estética' }]);
    vi.spyOn(anamneseApi, 'listPaciente').mockResolvedValue([
      { id: 'pre-1', anamneseId: 'f1', status: 'finalizada', preenchidoPorPaciente: false, quantidadeRespostas: 3, dataHora: '2026-08-01T10:00:00Z' },
    ]);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderStep2(props) {
    return render(
      <Step2Anamnese
        queixa=""
        setQueixa={() => {}}
        expectativas=""
        setExpectativas={() => {}}
        pacienteId="pac1"
        consultaMode
        {...props}
      />,
    );
  }

  it('(a) queixa e expectativas chegam ao AnamneseDocumentoView', async () => {
    renderStep2({ queixa: 'Rugas na testa', expectativas: 'Suavizar' });
    await screen.findByTestId('documento-stub');
    expect(screen.getByTestId('stub-queixa').textContent).toBe('Rugas na testa');
    expect(screen.getByTestId('stub-expectativas').textContent).toBe('Suavizar');
  });

  it('(a) só expectativas: queixa chega vazia e expectativas preenchida', async () => {
    renderStep2({ queixa: '', expectativas: 'Suavizar' });
    await screen.findByTestId('documento-stub');
    expect(screen.getByTestId('stub-queixa').textContent).toBe('');
    expect(screen.getByTestId('stub-expectativas').textContent).toBe('Suavizar');
  });
});

describe('F4 adversarial: bloco Queixa e Expectativas no AnamneseDocumentoView real', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function renderDocumento(props) {
    const real = await vi.importActual('../../components/anamnese/AnamneseDocumentoAssinadoView.jsx');
    vi.spyOn(anamneseApi, 'getDocumento').mockResolvedValue({
      preenchimentoId: 'p1',
      anamneseNome: 'Ficha',
      pacienteNome: 'Marina Alves',
      pacienteCpf: '41288790633',
      pacienteIdade: 42,
      preenchidoPorNome: 'Dra. Ana',
      fatosCriticos: [],
      fatosAlerta: [],
      prontuarioPerguntaIds: [],
      envioAtivo: null,
      assinaturaPaciente: null,
      conteudoHash: null,
      gravadoEm: null,
      conteudoJsonb: { anamnese_nome: 'Ficha', texto_declaracao: 'Declaro.', itens: [] },
    });
    const View = real.AnamneseDocumentoView;
    return render(<View pacienteId="pac1" preenchimentoId="p1" {...props} />);
  }

  it('(f) sem texto algum o bloco não aparece (null, undefined e só espaços)', async () => {
    const r = await renderDocumento({ queixa: '   ', expectativas: undefined });
    await screen.findAllByText('Marina Alves');
    expect(screen.queryByTestId('doc-queixa-expectativas')).toBeNull();
    expect(screen.queryByText('Queixa e Expectativas')).toBeNull();
    r.unmount();
  });

  it('(f) só com expectativas o bloco aparece, com a expectativa e sem a queixa', async () => {
    await renderDocumento({ queixa: '', expectativas: 'Pele uniforme' });
    await screen.findAllByText('Marina Alves');
    const bloco = await screen.findByTestId('doc-queixa-expectativas');
    expect(bloco.textContent).toContain('Pele uniforme');
    expect(bloco.textContent).not.toMatch(/Queixa:/i);
    expect(screen.getByText('Queixa e Expectativas')).toBeTruthy();
  });
});

// ---------------------------------------------------------------- (b) (c) (d) (e): app inteiro

describe('F4 adversarial: Sair sem salvar? e Concluir com 0 perguntas', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('(b) PATCH ainda em voo ao clicar Voltar ao hub: o modal abre', async () => {
    const segurar = { promessa: null };
    let liberar;
    segurar.promessa = new Promise((resolve) => { liberar = resolve; });
    await abrirAnamnese({ segurar });

    const campo = campoQueixa();
    fireEvent.change(campo, { target: { value: 'Rugas na testa' } });
    fireEvent.blur(campo);
    await assentarMuito(2); // o PATCH está parado no servidor falso: segue na fila

    clicarBotao(/Voltar ao hub/);
    await assentarMuito(2);
    expect(screen.getByText('Sair sem salvar?')).toBeTruthy();

    liberar();
    await assentarMuito();
  }, TIMEOUT);

  it('(c) texto salvo e depois apagado (campo vazio, sem blur): o modal abre', async () => {
    await abrirAnamnese();
    const campo = await salvarQueixaPeloBlur('Rugas na testa');

    fireEvent.change(campo, { target: { value: '' } });
    clicarBotao(/Voltar ao hub/);
    await assentarMuito();
    expect(screen.getByText('Sair sem salvar?')).toBeTruthy();
  }, TIMEOUT);

  it('(d) só espaços a mais depois do texto salvo: o modal NÃO abre e volta ao hub', async () => {
    await abrirAnamnese();
    const campo = await salvarQueixaPeloBlur('Rugas na testa');

    fireEvent.change(campo, { target: { value: '  Rugas na testa   ' } });
    clicarBotao(/Voltar ao hub/);
    await assentarMuito();
    expect(screen.queryByText('Sair sem salvar?')).toBeNull();
    expect(screen.queryByText('Voltar ao hub')).toBeNull();
  }, TIMEOUT);

  it('(e) 0 perguntas e id nulo: Concluir (queixa e expectativas SEM blur) não quebra e as observações levam os dois textos', async () => {
    const srv = await abrirAnamnese();

    fireEvent.change(campoQueixa(), { target: { value: 'Rugas na testa' } });
    fireEvent.change(screen.getAllByPlaceholderText(/O que o paciente espera/)[0], { target: { value: 'Suavizar' } });

    clicarBotao(/Concluir Anamnese/);
    await assentarMuito(6);

    const anamnese = escritasDaAnamnese(srv);
    const posts = anamnese.filter((e) => e.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0].body).toMatchObject({ observacoes: 'Queixa: Rugas na testa. Expectativas: Suavizar' });
    expect(posts[0].body.respostas ?? []).toEqual([]);
    expect(anamnese.filter((e) => e.method === 'PUT')).toEqual([]);
    expect(screen.queryByText(/Erro ao salvar a anamnese/)).toBeNull();
  }, TIMEOUT);
});
