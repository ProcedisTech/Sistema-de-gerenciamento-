import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { DadosClinicaPanel } from './DadosClinicaPanel';
import * as apiModule from '../../services/api.js';
import * as toastModule from '../../contexts/useToast.js';
import * as cepUtils from '../../utils/cepUtils.js';
import { limparCacheUfs } from '../hooks/useUfs.js';
import { UFS_FIXTURE, deferred } from '../../test/ufsFixture.js';

const ORG_ID = 'd0000000-0000-0000-0000-0000000000aa';

vi.mock('../../services/api.js', () => ({
  organizacaoApi: { getMinhas: vi.fn(), atualizar: vi.fn() },
  ufApi: { listar: vi.fn() },
  getApiErrorToastMessage: vi.fn((err, fallback) => fallback),
  authHeadersForFetch: vi.fn(async () => ({})),
}));

vi.mock('../../contexts/useToast.js', () => ({
  useToast: vi.fn(),
}));

vi.mock('../../contexts/OrgContext.jsx', () => ({
  useOrg: () => ({ orgId: 'd0000000-0000-0000-0000-0000000000aa' }),
}));

vi.mock('../../hooks/usePapel.js', () => ({
  usePapel: () => ({ isAdmin: true }),
}));

vi.mock('../../utils/cepUtils.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchAddressByCepBackend: vi.fn(),
}));

const ENDERECO_AC = { rua: 'Rua do Acre', bairro: 'Centro', cidade: 'Rio Branco', estado: 'AC' };
const MSG_CEP_INLINE = 'Não foi possível consultar o CEP. Preencha o endereço manualmente.';

const mockToast = { error: vi.fn(), success: vi.fn() };

function orgRow(enderecoEstado = null) {
  return {
    id: ORG_ID,
    razaoSocial: 'Clinica UF LTDA',
    nomeFantasia: 'Clinica UF',
    cnpj: '11222333000181',
    enderecoEstado,
  };
}

function ufSelect() {
  return screen.getByLabelText('Estado (UF)');
}

function textoSelecionado() {
  return ufSelect().selectedOptions[0]?.textContent;
}

function buscarCep(cep) {
  fireEvent.change(screen.getByLabelText('CEP'), { target: { value: cep } });
  fireEvent.click(screen.getByRole('button', { name: /Buscar/i }));
}

async function salvarEObterPatch() {
  fireEvent.click(screen.getByRole('button', { name: /Salvar alterações/i }));
  await waitFor(() => expect(apiModule.organizacaoApi.atualizar).toHaveBeenCalledTimes(1));
  const [id, patch] = vi.mocked(apiModule.organizacaoApi.atualizar).mock.calls[0];
  expect(id).toBe(ORG_ID);
  return patch;
}

async function renderComListaCarregada() {
  render(<DadosClinicaPanel getAuthHeaders={() => ({})} />);
  await screen.findByRole('option', { name: 'AC — Acre' });
}

describe('DadosClinicaPanel — UF em lista', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limparCacheUfs();
    vi.mocked(toastModule.useToast).mockReturnValue(mockToast);
    vi.mocked(apiModule.organizacaoApi.getMinhas).mockResolvedValue([orgRow()]);
    vi.mocked(apiModule.organizacaoApi.atualizar).mockResolvedValue({});
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
  });

  it('ViaCEP com AC seleciona AC (lista carregada antes da resposta)', async () => {
    vi.mocked(cepUtils.fetchAddressByCepBackend).mockResolvedValue(ENDERECO_AC);
    await renderComListaCarregada();

    buscarCep('69900-011');

    await waitFor(() => expect(ufSelect()).toHaveValue('AC'));
    expect(textoSelecionado()).toBe('AC — Acre');
  });

  it('ViaCEP com AC seleciona AC (lista carregada depois da resposta)', async () => {
    const lista = deferred();
    vi.mocked(apiModule.ufApi.listar).mockReturnValue(lista.promise);
    vi.mocked(cepUtils.fetchAddressByCepBackend).mockResolvedValue(ENDERECO_AC);
    render(<DadosClinicaPanel getAuthHeaders={() => ({})} />);
    await screen.findByLabelText('Estado (UF)');

    buscarCep('69900-012');
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

    buscarCep('00000-011');

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('CEP não encontrado.'));
    expect(await screen.findByText(MSG_CEP_INLINE)).toBeInTheDocument();
    expect(ufSelect()).toHaveValue('');
  });

  it('ViaCEP fora do ar: mesmo toast e mensagem de hoje, UF inalterada', async () => {
    const err = new Error('CEP lookup HTTP 503');
    err.kind = 'network';
    vi.mocked(cepUtils.fetchAddressByCepBackend).mockRejectedValue(err);
    await renderComListaCarregada();

    buscarCep('00000-012');

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

  it('clínica com UF salva abre com a UF certa (lista carregada antes)', async () => {
    const org = deferred();
    vi.mocked(apiModule.organizacaoApi.getMinhas).mockReturnValue(org.promise);
    render(<DadosClinicaPanel getAuthHeaders={() => ({})} />);
    await waitFor(() => expect(apiModule.ufApi.listar).toHaveBeenCalled());
    await act(async () => {});

    await act(async () => {
      org.resolve([orgRow('AC')]);
    });

    await waitFor(() => expect(ufSelect()).toHaveValue('AC'));
    expect(textoSelecionado()).toBe('AC — Acre');
  });

  it('clínica com UF salva abre com a UF certa (lista carregada depois)', async () => {
    const lista = deferred();
    vi.mocked(apiModule.ufApi.listar).mockReturnValue(lista.promise);
    vi.mocked(apiModule.organizacaoApi.getMinhas).mockResolvedValue([orgRow('AC')]);
    render(<DadosClinicaPanel getAuthHeaders={() => ({})} />);

    await waitFor(() => expect(ufSelect()).toHaveValue('AC'));
    expect(textoSelecionado()).toBe('AC');

    await act(async () => {
      lista.resolve(UFS_FIXTURE);
    });
    await waitFor(() => expect(textoSelecionado()).toBe('AC — Acre'));
    expect(ufSelect()).toHaveValue('AC');
  });

  it('payload envia a sigla escolhida', async () => {
    await renderComListaCarregada();
    fireEvent.change(ufSelect(), { target: { value: 'AC' } });

    const patch = await salvarEObterPatch();
    expect(patch.enderecoEstado).toBe('AC');
  });

  it('payload envia "" com "Sem UF"', async () => {
    vi.mocked(apiModule.organizacaoApi.getMinhas).mockResolvedValue([orgRow('SP')]);
    await renderComListaCarregada();
    await waitFor(() => expect(ufSelect()).toHaveValue('SP'));
    fireEvent.change(ufSelect(), { target: { value: '' } });

    const patch = await salvarEObterPatch();
    expect(patch.enderecoEstado).toBe('');
  });

  it('mostra o fuso da UF escolhida e o padrão sem UF', async () => {
    await renderComListaCarregada();
    expect(screen.getByText('Sem UF: usa o horário de Brasília (UTC−3)')).toBeInTheDocument();

    fireEvent.change(ufSelect(), { target: { value: 'AC' } });
    expect(screen.getByText('Fuso horário: UTC−5 (Acre)')).toBeInTheDocument();

    fireEvent.change(ufSelect(), { target: { value: 'DF' } });
    expect(screen.getByText('Fuso horário: UTC−3 (Distrito Federal)')).toBeInTheDocument();
  });

  it('falha ao carregar: aviso, UF salva preservada e "Tentar novamente" recarrega', async () => {
    vi.mocked(apiModule.ufApi.listar).mockRejectedValueOnce(new Error('500'));
    vi.mocked(apiModule.organizacaoApi.getMinhas).mockResolvedValue([orgRow('AC')]);
    render(<DadosClinicaPanel getAuthHeaders={() => ({})} />);

    expect(await screen.findByText('Não foi possível carregar a lista de UFs.')).toBeInTheDocument();
    await waitFor(() => expect(ufSelect()).toHaveValue('AC'));
    expect(ufSelect().querySelectorAll('option')).toHaveLength(2);
    expect(textoSelecionado()).toBe('AC');

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await screen.findByRole('option', { name: 'AC — Acre' });
    expect(ufSelect().querySelectorAll('option')).toHaveLength(28);
    expect(ufSelect()).toHaveValue('AC');
    expect(screen.queryByText('Não foi possível carregar a lista de UFs.')).not.toBeInTheDocument();
  });
});
