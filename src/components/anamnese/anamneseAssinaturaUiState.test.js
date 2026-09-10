import { describe, expect, it } from 'vitest';

import { resolverEstadoAssinatura } from './anamneseAssinaturaUiState.js';



describe('resolverEstadoAssinatura', () => {

  it('permite solicitar sem assinatura e sem envio', () => {

    const ui = resolverEstadoAssinatura({

      assinada: false,

      envioStatus: null,

      preenchimentoId: 'p1',

      pacienteId: 'pac1',

      imutavel: false,

    });

    expect(ui.podeSolicitar).toBe(true);

    expect(ui.envioAtivo).toBe(false);

  });



  it('bloqueia solicitar com envio pendente', () => {

    const ui = resolverEstadoAssinatura({

      assinada: false,

      envioStatus: 'PENDENTE',

      preenchimentoId: 'p1',

      pacienteId: 'pac1',

      imutavel: false,

    });

    expect(ui.podeSolicitar).toBe(false);

    expect(ui.aguardandoPaciente).toBe(true);

    expect(ui.envioAtivo).toBe(true);

  });



  it('reenviar após expirado', () => {

    const ui = resolverEstadoAssinatura({

      assinada: false,

      envioStatus: 'EXPIRADO',

      preenchimentoId: 'p1',

      pacienteId: 'pac1',

      imutavel: false,

    });

    expect(ui.podeSolicitar).toBe(true);

    expect(ui.envioAtivo).toBe(false);

  });



  it('recusa (CONCLUIDO sem assinatura) permite solicitar novamente', () => {

    const ui = resolverEstadoAssinatura({

      assinada: false,

      envioStatus: 'CONCLUIDO',

      preenchimentoId: 'p1',

      pacienteId: 'pac1',

      imutavel: false,

    });

    expect(ui.concluido).toBe(false);

    expect(ui.aguardandoPaciente).toBe(false);

    expect(ui.podeSolicitar).toBe(true);

  });



  it('recusa com envioStatus null após refresh permite solicitar', () => {

    const ui = resolverEstadoAssinatura({

      assinada: false,

      envioStatus: null,

      preenchimentoId: 'p1',

      pacienteId: 'pac1',

      imutavel: false,

    });

    expect(ui.podeSolicitar).toBe(true);

    expect(ui.concluido).toBe(false);

  });



  it('assinatura (assinada=true) bloqueia solicitar', () => {

    const ui = resolverEstadoAssinatura({

      assinada: true,

      envioStatus: 'CONCLUIDO',

      preenchimentoId: 'p1',

      pacienteId: 'pac1',

      imutavel: false,

    });

    expect(ui.concluido).toBe(true);

    expect(ui.podeSolicitar).toBe(false);

  });



  it('processandoResposta após refresh não trava podeSolicitar', () => {

    const ui = resolverEstadoAssinatura({

      assinada: false,

      envioStatus: null,

      preenchimentoId: 'p1',

      pacienteId: 'pac1',

      imutavel: false,

      processandoResposta: true,

    });

    expect(ui.podeSolicitar).toBe(true);

    expect(ui.mostrarBadgeAtualizando).toBe(true);

  });



  it('badge B4 durante polling com envio ainda pendente nos props', () => {

    const ui = resolverEstadoAssinatura({

      assinada: false,

      envioStatus: 'PENDENTE',

      preenchimentoId: 'p1',

      pacienteId: 'pac1',

      imutavel: false,

      processandoResposta: true,

    });

    expect(ui.mostrarBadgeAtualizando).toBe(true);

    expect(ui.aguardandoPaciente).toBe(false);

    expect(ui.podeSolicitar).toBe(false);

  });



  it('imutavel bloqueia solicitar', () => {

    const ui = resolverEstadoAssinatura({

      assinada: false,

      envioStatus: null,

      preenchimentoId: 'p1',

      pacienteId: 'pac1',

      imutavel: true,

    });

    expect(ui.podeSolicitar).toBe(false);

  });



  it('sem preenchimentoId bloqueia solicitar', () => {

    const ui = resolverEstadoAssinatura({

      assinada: false,

      envioStatus: null,

      preenchimentoId: null,

      pacienteId: 'pac1',

      imutavel: false,

    });

    expect(ui.podeSolicitar).toBe(false);

  });



  it('CANCELADO permite solicitar novamente', () => {

    const ui = resolverEstadoAssinatura({

      assinada: false,

      envioStatus: 'CANCELADO',

      preenchimentoId: 'p1',

      pacienteId: 'pac1',

      imutavel: false,

    });

    expect(ui.podeSolicitar).toBe(true);

    expect(ui.envioAtivo).toBe(false);

  });

});

