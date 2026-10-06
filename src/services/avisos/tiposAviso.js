/**
 * Catálogo dos avisos do canal (espelho de `TipoAviso.java` no backend).
 * O `tipo` do protocolo v1 é `"MODULO.ACAO"`; os avisos ACESSO são internos e nunca chegam ao navegador.
 * @see docs/arquitetura/canal-de-avisos.md (backend)
 */

export const VERSAO_PROTOCOLO = 1;

export const PREFIXO_AVISO = Object.freeze({
  AGENDA: 'AGENDA',
  ANAMNESE: 'ANAMNESE',
  TERMOS: 'TERMOS',
  NOTIFICACAO: 'NOTIFICACAO',
});

export const AVISO = Object.freeze({
  AGENDA: Object.freeze({
    CRIADO: 'AGENDA.CRIADO',
    ALTERADO: 'AGENDA.ALTERADO',
    REAGENDADO: 'AGENDA.REAGENDADO',
    STATUS_ALTERADO: 'AGENDA.STATUS_ALTERADO',
    CANCELADO: 'AGENDA.CANCELADO',
  }),
  ANAMNESE: Object.freeze({
    ENVIO_ALTERADO: 'ANAMNESE.ENVIO_ALTERADO',
  }),
  TERMOS: Object.freeze({
    ASSINATURA_REMOTA_ALTERADA: 'TERMOS.ASSINATURA_REMOTA_ALTERADA',
  }),
  NOTIFICACAO: Object.freeze({
    CRIADA: 'NOTIFICACAO.CRIADA',
    ALTERADA: 'NOTIFICACAO.ALTERADA',
  }),
});

/** `true` quando o tipo pertence ao prefixo (`AGENDA` cobre `AGENDA.*`). */
export function tipoDoPrefixo(tipo, prefixo) {
  return typeof tipo === 'string' && typeof prefixo === 'string' && tipo.startsWith(`${prefixo}.`);
}
