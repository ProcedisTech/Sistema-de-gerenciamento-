/**
 * Abre WhatsApp em nova aba/app com URL gerada pelo backend.
 * Usar com a URL retornada por confirmacaoApi.gerar() (campo urlWhatsApp).
 *
 * @param {string} urlWhatsApp URL completa wa.me?... incluindo telefone + mensagem encoded
 */
export function abrirWhatsApp(urlWhatsApp) {
  if (!urlWhatsApp || typeof urlWhatsApp !== 'string') {
    throw new Error('URL do WhatsApp inválida');
  }
  window.open(urlWhatsApp, '_blank', 'noopener,noreferrer');
}
