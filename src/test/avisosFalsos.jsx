/**
 * Canal de avisos simulado para testes de telas: um `AvisosContext` cujo teste empurra avisos/recarregar.
 */
import React from 'react';
import { act } from '@testing-library/react';
import { AvisosContext } from '../contexts/avisosContext.js';

export function criarAvisosFalsos() {
  const inscritos = new Set();
  const value = {
    assinar(receber) {
      inscritos.add(receber);
      return () => inscritos.delete(receber);
    },
  };

  const despachar = (msg) => {
    act(() => {
      for (const r of Array.from(inscritos)) r(msg);
    });
  };

  function Wrapper({ children }) {
    return <AvisosContext.Provider value={value}>{children}</AvisosContext.Provider>;
  }

  return {
    Wrapper,
    inscritos,
    emitirAviso(tipo, registroId = null, extras = {}) {
      despachar({
        tipo: 'aviso',
        aviso: { id: null, tipo, registroId, atendimentoId: null, porMim: false, ...extras },
      });
    },
    emitirRecarregar() {
      despachar({ tipo: 'recarregar' });
    },
  };
}
