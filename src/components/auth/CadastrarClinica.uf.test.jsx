import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CadastrarClinica } from './CadastrarClinica';
import * as apiModule from '../../services/api.js';
import * as toastModule from '../../contexts/useToast.js';
import * as cepUtils from '../../utils/cepUtils.js';
import { limparCacheUfs } from '../hooks/useUfs.js';
import { UFS_FIXTURE, deferred } from '../../test/ufsFixture.js';

vi.mock('../../services/api.js', () => ({
  organizacaoApi: { criar: vi.fn() },
  ufApi: { listar: vi.fn() },
  getApiErrorToastMessage: vi.fn((err, fallback) => fallback),
  authHeadersForFetch: vi.fn(async () => ({})),
}));

vi.mock('../../contexts/useToast.js', () => ({
  useToast: vi.fn(),
}));

vi.mock('../../utils/cepUtils.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchAddressByCepBackend: vi.fn(),
}));

const ENDERECO_AC = { rua: 'Rua do Acre', bairro: 'Centro', cidade: 'Rio Branco', estado: 'AC' };
const MSG_CEP_INLINE = 'Não foi possível consultar o CEP. Preencha o endereço manualmente.';

const mockToast = { error: vi.fn(), success: vi.fn() };

function ufSelect() {
  return screen.getByLabelText('Estado (UF)');
}

function textoSelecionado() {
  return ufSelect().selectedOptions[0]?.textContent;
}

async function buscarCep(cep) {
  fireEvent.change(screen.getByLabelText('CEP'), { target: { value: cep } });
  fireEvent.click(screen.getByRole('button', { name: /Buscar/i }));
}

function preencherObrigatorios() {
  fireEvent.change(screen.getByLabelText(/Razão social/i), { target: { value: 'Clinica UF LTDA' } });
  fireEvent.change(screen.getByLabelText(/Nome fantasia/i), { target: { value: 'Clinica UF' } });
  fireEvent.change(screen.getByLabelText(/CNPJ/i), { target: { value: '11.222.333/0001-81' } });
}

async function enviarEObterPayload() {
  fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));
  await waitFor(() => expect(apiModule.organizacaoApi.criar).toHaveBeenCalledTimes(1));
  return vi.mocked(apiModule.organizacaoApi.criar).mock.calls[0][0];
}

async function renderComListaCarregada() {
  render(<CadastrarClinica onComplete={vi.fn()} />);
  await screen.findByRole('option', { name: 'AC — Acre' });
}

describe('CadastrarClinica — UF em lista', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limparCacheUfs();
    vi.mocked(toastModule.useToast).mockReturnValue(mockToast);
    vi.mocked(apiModule.organizacaoApi.criar).mockResolvedValue({ id: 'org-uuid-123' });
    vi.mocked(apiModule.ufApi.listar).mockResolvedValue(UFS_FIXTURE);
  });

  it('renderiza "Sem UF" + 27 UFs vindas da API', async () => {
    await renderComListaCarregada();
    const options = Array.from(ufSelect().querySelectorAll('option'));
    expect(options).toHaveLength(28);
    expect(options[0]).toHaveValue('');
    expect(options[0]).toHaveTextContent('Sem UF');
    expect(options[1]).toHaveTextContent('AC — Acre');
    expect(ufSelect()).toHaveValue('');
    expect(apiModule.ufApi.listar).toHaveBeenCalledTimes(1);
  });

  it('ViaCEP com AC seleciona AC (lista carregada antes da resposta)', async () => {
    vi.mocked(cepUtils.fetchAddressByCepBackend).mockResolvedValue(ENDERECO_AC);
    await renderComListaCarregada();

    await buscarCep('69900-001');

    await waitFor(() => expect(ufSelect()).toHaveValue('AC'));
    expect(textoSelecionado()).toBe('AC — Acre');
  });

  it('ViaCEP com AC seleciona AC (lista carregada depois da resposta)', async () => {
    const lista = deferred();
    vi.mocked(apiModule.ufApi.listar).mockReturnValue(lista.promise);
    vi.mocked(cepUtils.fetchAddressByCepBackend).mockResolvedValue(ENDERECO_AC);
    render(<CadastrarClinica onComplete={vi.fn()} />);

    await buscarCep('69900-002');
    await waitFor(() => expect(ufSelect()).toHaveValue('AC'));

    await act(async () => {
      lista.resolve(UFS_FIXTURE);
    });
    await waitFor(() => expect(textoSelecionado()).toBe('AC — Acre'));
    expect(ufSelect()).toHaveValue('AC');
  });

  it('CEP inexistente: nada selecionado e mensagens atuais mantidas', async () => {
    vi.mocked(cepUtils.fetchAddressByCepBackend).mockResolvedValue(null);
    await renderComListaCarregada();

    await buscarCep('00000-001');

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('CEP não encontrado.'));
    expect(await screen.findByText(MSG_CEP_INLINE)).toBeInTheDocument();
    expect(ufSelect()).toHaveValue('');
  });

  it('ViaCEP fora do ar: mesmo toast e mensagem de hoje, UF inalterada', async () => {
    const err = new Error('CEP lookup HTTP 503');
    err.kind = 'network';
    vi.mocked(cepUtils.fetchAddressByCepBackend).mockRejectedValue(err);
    await renderComListaCarregada();

    await buscarCep('00000-002');

    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith('Não foi possível consultar o CEP. Tente novamente.')
    );
    expect(await screen.findByText(MSG_CEP_INLINE)).toBeInTheDocument();
    expect(ufSelect()).toHaveValue('');
  });

  it('CEP em branco: Buscar desabilitado', async () => {
    await renderComListaCarregada();
    expect(screen.getByRole('button', { name: /Buscar/i })).toBeDisabled();
    expect(cepUtils.fetchAddressByCepBackend).not.toHaveBeenCalled();
  });

  it('payload envia a sigla escolhida', async () => {
    await renderComListaCarregada();
    preencherObrigatorios();
    fireEvent.change(ufSelect(), { target: { value: 'AC' } });

    const payload = await enviarEObterPayload();
    expect(payload.enderecoEstado).toBe('AC');
  });

  it('payload envia null com "Sem UF"', async () => {
    await renderComListaCarregada();
    preencherObrigatorios();

    const payload = await enviarEObterPayload();
    expect(payload.enderecoEstado).toBeNull();
  });

  it('mostra o fuso da UF escolhida e o padrão sem UF', async () => {
    await renderComListaCarregada();
    expect(screen.getByText('Sem UF: usa o horário de Brasília (UTC−3)')).toBeInTheDocument();

    fireEvent.change(ufSelect(), { target: { value: 'AC' } });
    expect(screen.getByText('Fuso horário: UTC−5 (Acre)')).toBeInTheDocument();

    fireEvent.change(ufSelect(), { target: { value: 'DF' } });
    expect(screen.getByText('Fuso horário: UTC−3 (Distrito Federal)')).toBeInTheDocument();
  });

  it('falha ao carregar: aviso, sigla atual preservada e "Tentar novamente" recarrega', async () => {
    vi.mocked(apiModule.ufApi.listar).mockRejectedValueOnce(new Error('500'));
    vi.mocked(cepUtils.fetchAddressByCepBackend).mockResolvedValue(ENDERECO_AC);
    render(<CadastrarClinica onComplete={vi.fn()} />);

    expect(await screen.findByText('Não foi possível carregar a lista de UFs.')).toBeInTheDocument();
    expect(ufSelect().querySelectorAll('option')).toHaveLength(1);

    await buscarCep('69900-003');
    await waitFor(() => expect(ufSelect()).toHaveValue('AC'));
    expect(textoSelecionado()).toBe('AC');

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await screen.findByRole('option', { name: 'AC — Acre' });
    expect(ufSelect().querySelectorAll('option')).toHaveLength(28);
    expect(ufSelect()).toHaveValue('AC');
    expect(screen.queryByText('Não foi possível carregar a lista de UFs.')).not.toBeInTheDocument();
  });
});
