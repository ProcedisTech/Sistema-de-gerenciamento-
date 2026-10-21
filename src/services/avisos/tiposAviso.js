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
  ATENDIMENTO: 'ATENDIMENTO',
  GALERIA: 'GALERIA',
  PROCEDIMENTO: 'PROCEDIMENTO',
  PACIENTE: 'PACIENTE',
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
  ATENDIMENTO: Object.freeze({
    ABERTO: 'ATENDIMENTO.ABERTO',
    MODULO_ALTERADO: 'ATENDIMENTO.MODULO_ALTERADO',
    RETOMADO: 'ATENDIMENTO.RETOMADO',
    ENCERRADO: 'ATENDIMENTO.ENCERRADO',
    ABANDONADO: 'ATENDIMENTO.ABANDONADO',
    CANCELADO: 'ATENDIMENTO.CANCELADO',
    SESSAO_ALTERADA: 'ATENDIMENTO.SESSAO_ALTERADA',
  }),
  GALERIA: Object.freeze({
    FOTO_ADICIONADA: 'GALERIA.FOTO_ADICIONADA',
    FOTO_REMOVIDA: 'GALERIA.FOTO_REMOVIDA',
    FOTO_ANOTADA: 'GALERIA.FOTO_ANOTADA',
  }),
  PROCEDIMENTO: Object.freeze({
    MAPA_SALVO: 'PROCEDIMENTO.MAPA_SALVO',
  }),
  PACIENTE: Object.freeze({
    CRIADO: 'PACIENTE.CRIADO',
    EDITADO: 'PACIENTE.EDITADO',
  }),
});

/** `true` quando o tipo pertence ao prefixo (`AGENDA` cobre `AGENDA.*`). */
export function tipoDoPrefixo(tipo, prefixo) {
  return typeof tipo === 'string' && typeof prefixo === 'string' && tipo.startsWith(`${prefixo}.`);
}
