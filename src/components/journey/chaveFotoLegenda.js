/**
 * F5: chave estável de uma foto para legenda e para key do React.
 * - fotoId único na lista: o próprio fotoId (a url muda no aviso GALERIA e a legenda se preserva);
 * - fotoId repetido na lista: `${fotoId}|${url}|${indice}`;
 * - sem fotoId: a url (como sempre) e, se a url também repete, `${url}|${indice}`.
 */
export function chaveFotoLegenda(photo, listaDeFotos, indice) {
  const lista = Array.isArray(listaDeFotos) ? listaDeFotos : [];
  const fotoId = photo?.meta?.fotoId;
  const url = photo?.url;
  if (fotoId != null && fotoId !== '') {
    const repetidos = lista.filter((p) => p?.meta?.fotoId === fotoId).length;
    return repetidos > 1 ? `${fotoId}|${url ?? ''}|${indice}` : fotoId;
  }
  if (url == null || url === '') return url;
  const repetidas = lista.filter((p) => !(p?.meta?.fotoId != null && p.meta.fotoId !== '') && p?.url === url).length;
  return repetidas > 1 ? `${url}|${indice}` : url;
}
