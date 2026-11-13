import { act, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { PERMISSOES } from '../../constants/permissoes';
import { PreviaAcessoProvider, usePreviaAcesso } from '../../contexts/PreviaAcessoContext';
import { menuParaFuncoes, useNavGrupos } from './navGrupos';

const rotulos = (grupos) => grupos.flatMap((g) => g.itens.map((i) => i.label));

describe('useNavGrupos na prévia', () => {
  it('códigos sem a função de equipe: Pacientes aparece, Gestão de Equipe não', () => {
    const wrapper = ({ children }) =>
      createElement(MemoryRouter, null, createElement(PreviaAcessoProvider, null, children));
    const { result } = renderHook(() => ({ nav: useNavGrupos(), previa: usePreviaAcesso() }), { wrapper });
    act(() => result.current.previa.entrar({
      pessoaId: 'p1', nome: 'Ana', perfil: 'X', codigos: [PERMISSOES.AUDITORIA_VER],
    }));
    expect(rotulos(result.current.nav)).toContain('Pacientes');
    expect(rotulos(result.current.nav)).not.toContain('Gestão de Equipe');
  });
});

describe('menuParaFuncoes', () => {
  it('sem USUARIO_VER não há Gestão de Equipe', () => {
    const grupos = menuParaFuncoes([PERMISSOES.AUDITORIA_VER]);
    expect(rotulos(grupos)).toContain('Pacientes');
    expect(rotulos(grupos)).not.toContain('Gestão de Equipe');
    expect(rotulos(grupos)).toContain('Auditoria');
  });

  it('sem equipe e sem auditoria o grupo Gestão some; com as duas aparece', () => {
    const sem = menuParaFuncoes([]);
    expect(sem.map((g) => g.titulo)).toContain('Dia a dia');
    expect(sem.map((g) => g.titulo)).not.toContain('Gestão');

    const com = menuParaFuncoes([PERMISSOES.USUARIO_VER, PERMISSOES.AUDITORIA_VER]);
    const gestao = com.find((g) => g.id === 'gestao');
    expect(gestao.itens.map((i) => i.label)).toEqual(['Gestão de Equipe', 'Auditoria']);
  });
});
