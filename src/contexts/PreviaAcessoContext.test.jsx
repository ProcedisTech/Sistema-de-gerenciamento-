import { useEffect } from 'react';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { PERMISSOES } from '../constants/permissoes';
import { PreviaAcessoProvider, usePapelExibicao, usePreviaAcesso } from './PreviaAcessoContext';

vi.mock('./OrgContext', () => ({
  useOrg: () => ({
    papel: 'DONO',
    permissoes: [PERMISSOES.USUARIO_VER],
    roleUserId: 'real-1',
  }),
}));

const capt = {};
function Sonda() {
  const api = usePreviaAcesso();
  const nav = useNavigate();
  useEffect(() => {
    capt.api = api;
    capt.nav = nav;
  });
  const papel = usePapelExibicao();
  return <span data-testid="equipe">{String(papel.canSeeConfigEquipe)}|{String(papel.canSeeAgenda)}</span>;
}

const montar = () =>
  render(
    <MemoryRouter initialEntries={['/a']}>
      <PreviaAcessoProvider>
        <Sonda />
      </PreviaAcessoProvider>
    </MemoryRouter>,
  );

const pessoa = {
  pessoaId: 'p1',
  nome: 'Ana Souza',
  perfil: 'Recepção',
  codigos: [PERMISSOES.AGENDA_VER],
};

describe('PreviaAcessoContext', () => {
  it('entrar mostra a faixa no body com o nome e o papel de exibição segue os códigos', () => {
    montar();
    expect(screen.getByTestId('equipe').textContent).toBe('true|false');
    act(() => capt.api.entrar(pessoa));
    const faixa = screen.getByRole('status');
    expect(document.body.contains(faixa)).toBe(true);
    expect(faixa.textContent).toContain('Prévia. É assim que Ana Souza (Recepção) vê o Procedi. Nada aqui muda o acesso dela.');
    expect(faixa.className).toContain('bottom-[var(--bottom-nav-h)]');
    expect(capt.api.ativa).toBe(true);
    expect(capt.api.nome).toBe('Ana Souza');
    expect(screen.getByTestId('equipe').textContent).toBe('false|true');
  });

  it('"Sair da prévia" some com a faixa e volta ao papel real', async () => {
    montar();
    act(() => capt.api.entrar(pessoa));
    expect(screen.getByRole('status')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Sair da prévia' }));
    expect(screen.queryByRole('status')).toBeNull();
    expect(capt.api.ativa).toBe(false);
    expect(screen.getByTestId('equipe').textContent).toBe('true|false');
  });

  it('mudar a rota sai sozinho', () => {
    montar();
    act(() => capt.api.entrar(pessoa));
    expect(screen.getByRole('status')).toBeTruthy();
    act(() => capt.nav('/b'));
    expect(screen.queryByRole('status')).toBeNull();
    expect(capt.api.ativa).toBe(false);
  });

  it('voltar à rota onde entrou não ressuscita a prévia', () => {
    render(
      <MemoryRouter initialEntries={['/a']}>
        <PreviaAcessoProvider>
          <Routes>
            <Route path="/a" element={<><Sonda /><span>rota-a</span></>} />
            <Route path="/b" element={<><Sonda /><span>rota-b</span></>} />
          </Routes>
        </PreviaAcessoProvider>
      </MemoryRouter>,
    );
    act(() => capt.api.entrar(pessoa));
    expect(screen.getByRole('status')).toBeTruthy();
    act(() => capt.nav('/b'));
    expect(screen.getByText('rota-b')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    act(() => capt.nav(-1));
    expect(screen.getByText('rota-a')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    expect(capt.api.ativa).toBe(false);
  });

  it('sem provider o hook devolve inativo', () => {
    const { result } = renderHook(() => usePreviaAcesso());
    expect(result.current).toMatchObject({
      ativa: false, pessoaId: null, nome: null, perfil: null, codigos: [],
    });
    expect(typeof result.current.entrar).toBe('function');
    expect(typeof result.current.sair).toBe('function');
  });
});
