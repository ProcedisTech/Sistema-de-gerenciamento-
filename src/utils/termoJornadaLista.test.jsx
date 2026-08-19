import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import {
  ROTULO_DROPDOWN_TERMOS,
  clearTermosJornadaState,
  idsAssinadosNestaJornada,
  idsPendentesSemAssinadosNestaJornada,
  linhasDropdownTermos,
  mesclarFilaExigida,
  mostrarContagemPendentesCatalogo,
  previewTermoLista,
  proximoTermoPendente,
  seloLinhaTermo,
  termosDropdownSelecionaveis,
} from './termoJornadaLista.js';

function TermosDropdownStub({ termos, idsFilaExigida }) {
  const linhas = linhasDropdownTermos(termos, idsFilaExigida);
  return (
    <div>
      <p>{ROTULO_DROPDOWN_TERMOS}</p>
      {mostrarContagemPendentesCatalogo() ? (
        <p>{termos.length} termo(s) pendente(s) nesta jornada</p>
      ) : null}
      <ul>
        {linhas.map((linha) => (
          <li key={linha.id}>
            <span>{linha.titulo}</span>
            {linha.selo === 'OBRIGATORIO' ? <span>Obrigatório</span> : null}
            <span>{linha.preview}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

describe('D1 — jornada nova sem card da visita anterior', () => {
  it('clearTermosJornadaState zera assinados, fila e seleção', () => {
    const journeyState = {
      setTermosAssinados: vi.fn(),
      setTermosPendentesIds: vi.fn(),
      setTermoSelecionadoId: vi.fn(),
    };
    clearTermosJornadaState(journeyState);
    expect(journeyState.setTermosAssinados).toHaveBeenCalledWith([]);
    expect(journeyState.setTermosPendentesIds).toHaveBeenCalledWith([]);
    expect(journeyState.setTermoSelecionadoId).toHaveBeenCalledWith(null);
  });
});

describe('D2 — dropdown pela jornada atual', () => {
  const historicoAssinado = { id: 'botox', titulo: 'Teste de vinculação ao botox' };
  const lgpd = { id: 'lgpd', titulo: 'LGPD' };
  const extra = { id: 'extra', titulo: 'Avulso' };

  it('ASSINADO só de jornada anterior não sela nem tira da lista nesta visita', () => {
    const destaVisita = [];
    const ids = idsAssinadosNestaJornada(destaVisita);
    const listados = termosDropdownSelecionaveis([historicoAssinado, lgpd, extra], ids);
    expect(ids.has('botox')).toBe(false);
    expect(listados.map((t) => t.id)).toEqual(['botox', 'lgpd', 'extra']);
  });

  it('termo ASSINADO nesta jornada não é selecionável', () => {
    const destaVisita = [
      { termoId: 'botox', resultadoCompleto: { statusCodigo: 'ASSINADO' } },
    ];
    const ids = idsAssinadosNestaJornada(destaVisita);
    const listados = termosDropdownSelecionaveis([historicoAssinado, lgpd], ids);
    expect(ids.has('botox')).toBe(true);
    expect(listados.map((t) => t.id)).toEqual(['lgpd']);
  });

  it('RECUSADO nesta jornada continua selecionável', () => {
    const destaVisita = [
      { termoId: 'lgpd', resultadoCompleto: { statusCodigo: 'RECUSADO', recusadoEm: '2026-08-19' } },
    ];
    const ids = idsAssinadosNestaJornada(destaVisita);
    expect(ids.has('lgpd')).toBe(false);
    expect(termosDropdownSelecionaveis([lgpd], ids)).toHaveLength(1);
  });

  it('preview não mostra entidades HTML escapadas', () => {
    const preview = previewTermoLista('&lt;p&gt;Consentimento informado&lt;/p&gt;');
    expect(preview).toBe('Consentimento informado');
    expect(preview).not.toContain('&lt;');
    expect(preview).not.toContain('<p>');
  });
});

describe('E1 — copy neutro e selos', () => {
  const termos = [
    { id: 'vinculado', titulo: 'Termo do botox', conteudo: '<p>Consentimento botox</p>' },
    { id: 'lgpd', titulo: 'LGPD', conteudo: '<p>Privacidade</p>' },
    { id: 'avulso', titulo: 'Avulso', conteudo: '<p>Extra</p>' },
  ];

  it('3 cadastrados e 1 na fila exigida: sem contagem de pendentes, rótulo neutro, um Obrigatório e dois sem selo', () => {
    render(<TermosDropdownStub termos={termos} idsFilaExigida={['vinculado']} />);

    expect(screen.getByText(ROTULO_DROPDOWN_TERMOS)).toBeInTheDocument();
    expect(screen.queryByText(/termo\(s\) pendente\(s\)/i)).not.toBeInTheDocument();
    expect(mostrarContagemPendentesCatalogo()).toBe(false);

    expect(screen.getByText('Termo do botox')).toBeInTheDocument();
    expect(screen.getByText('Obrigatório')).toBeInTheDocument();
    expect(screen.getByText('LGPD')).toBeInTheDocument();
    expect(screen.getByText('Avulso')).toBeInTheDocument();
    expect(screen.getAllByText('Obrigatório')).toHaveLength(1);
    expect(screen.getByText(/Consentimento botox/)).toBeInTheDocument();
    expect(screen.getByText('Privacidade')).toBeInTheDocument();
    expect(screen.getByText('Extra')).toBeInTheDocument();
  });

  it('seloLinhaTermo só marca a fila exigida', () => {
    expect(seloLinhaTermo('vinculado', ['vinculado'])).toBe('OBRIGATORIO');
    expect(seloLinhaTermo('lgpd', ['vinculado'])).toBeNull();
  });
});

describe('E2 — assinado nesta jornada não volta à fila', () => {
  it('faltante do resolver + ASSINADO nesta jornada sai da fila; opt-in permanece', () => {
    const assinados = [{ termoId: 'vinculado', resultadoCompleto: { statusCodigo: 'ASSINADO' } }];
    const fila = mesclarFilaExigida(['lgpd'], ['vinculado'], assinados);
    expect(fila).not.toContain('vinculado');
    expect(fila).toContain('lgpd');
  });

  it('histórico de outra visita ainda pode entrar nesta', () => {
    const fila = mesclarFilaExigida([], ['vinculado'], []);
    expect(fila).toEqual(['vinculado']);
  });

  it('idsPendentesSemAssinadosNestaJornada tira o assinado da seleção', () => {
    const next = idsPendentesSemAssinadosNestaJornada(
      ['vinculado', 'lgpd'],
      [{ termoId: 'vinculado', resultadoCompleto: { statusCodigo: 'ASSINADO' } }],
    );
    expect(next).toEqual(['lgpd']);
  });

  it('proximoTermoPendente ignora o recém-assinado', () => {
    const assinados = [{ termoId: 'a', resultadoCompleto: { statusCodigo: 'ASSINADO' } }];
    expect(proximoTermoPendente(['a', 'b'], assinados, ['a'])).toBe('b');
    expect(proximoTermoPendente(['a'], assinados, ['a'])).toBeNull();
  });
});
