import { describe, expect, it } from 'vitest';
import {
  bloqueioExecucaoTermos,
  consentimentosAguardandoExecucao,
  pfIdNestaSessaoParaCatalogo,
} from './termoResolucao.js';

const CAT = 'cat-botox';

/** Resolução do servidor com o termo do catálogo já assinado e ainda não consumido por nenhum PF. */
const RESOLUCAO_ASSINADO_SEM_PF = {
  faltantes: [],
  termosExigidos: [
    { termoId: 't-1', titulo: 'Consentimento toxina', vigente: true, assinaturaId: 'a-1', assinadoEm: '2026-10-06T13:00:00Z' },
  ],
};

describe('ND19: termo assinado sem PF da sessão não volta a bloquear', () => {
  it('na consulta o mapa não cria PF: a linha da sessão fica sem id e o termo assinado basta', () => {
    const sessao = [{ nomeProcedimentoCatalogoId: CAT, catalogoProcedimentoSaudeId: CAT }];
    const pf = pfIdNestaSessaoParaCatalogo(CAT, sessao);
    expect(pf).toBeNull();
    expect(bloqueioExecucaoTermos({ resolucao: RESOLUCAO_ASSINADO_SEM_PF, pfIdNestaSessao: pf })).toBe(false);
  });

  it('o crédito continua aparecendo como aguardando execução', () => {
    expect(consentimentosAguardandoExecucao(RESOLUCAO_ASSINADO_SEM_PF)).toEqual([
      { termoId: 't-1', titulo: 'Consentimento toxina', assinadoEm: '2026-10-06T13:00:00Z' },
    ]);
  });

  it('sem assinatura, sem PF, continua bloqueando', () => {
    const faltando = { faltantes: [{ termoId: 't-1', titulo: 'Consentimento toxina' }], termosExigidos: [] };
    expect(bloqueioExecucaoTermos({ resolucao: faltando, pfIdNestaSessao: null })).toBe(true);
  });
});
