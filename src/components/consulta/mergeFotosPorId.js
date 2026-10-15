/**
 * Y11: a rebusca das fotos da consulta junta por `fotoId`.
 * - Foto local ainda sem `fotoId` (envio pendente) fica sempre.
 * - Foto local com `fotoId` sai só se o servidor já a conhecia (estava em `idsAnteriores`) e agora não tem mais:
 *   uma lista velha nunca apaga a foto que acabou de subir.
 * - Foto do servidor que o aparelho não tem entra com a URL da galeria (Y14) e sem blob; com `categoriaDe`, entra
 *   também com a categoria (a faixa em que estava no aparelho que a tirou).
 * - F1 (anotação em outro aparelho): foto que o aparelho já tem, com versão (`arquivoAtualizadoEm`) diferente da do
 *   servidor, é trocada no lugar pela URL de reserva do arquivo (`?v=<epochMs>`), sem blob e com a versão nova; a
 *   meta é mantida. Precisa de `pacienteId`; sem ele, nada é trocado. Foto local sem versão só adota a do servidor
 *   (meta), sem trocar url nem blob: a partir daí uma anotação feita noutro aparelho passa a ser percebida.
 *
 * @param {Array<{ url?: string, blob?: Blob | null, meta?: object }>} locais
 * @param {Array<{ id: string, atendimentoItemId?: string | null, tipoFotoCodigo?: string | null, arquivoAtualizadoEm?: string | null }>} doServidor
 * @param {{
 *   idsAnteriores?: Set<string>,
 *   urlDe: (fotoId: string) => string | null,
 *   entra?: (foto: object) => boolean,
 *   categoriaDe?: (foto: object) => string | null,
 *   versaoDe?: (fotoLocal: object) => string | null,
 *   pacienteId?: string | null,
 * }} opcoes `entra` escolhe quais fotos do servidor esta lista recebe; a saída sempre olha a lista inteira.
 * @returns {Array} a mesma lista se nada mudou
 */
export function mergeFotosPorId(locais, doServidor, {
  idsAnteriores = new Set(),
  urlDe,
  entra = () => true,
  categoriaDe,
  versaoDe = versaoDaFotoLocal,
  pacienteId = null,
}) {
  const lista = Array.isArray(locais) ? locais : [];
  const servidor = Array.isArray(doServidor) ? doServidor : [];
  const idsServidor = new Set(servidor.map((f) => String(f.id)));
  const porId = new Map(servidor.map((f) => [String(f.id), f]));

  let trocou = false;
  const ficam = lista
    .filter((f) => {
      const id = f?.meta?.fotoId;
      if (!id) return true;
      return idsServidor.has(String(id)) || !idsAnteriores.has(String(id));
    })
    .map((f) => {
      const id = f?.meta?.fotoId;
      if (!id) return f;
      const srv = porId.get(String(id));
      const versaoServidor = srv?.arquivoAtualizadoEm ?? null;
      if (!versaoServidor) return f;
      const versaoLocal = versaoDe(f) ?? null;
      if (versaoLocal === versaoServidor) return f;
      if (!versaoLocal) {
        trocou = true;
        return { ...f, meta: { ...(f.meta || {}), arquivoAtualizadoEm: versaoServidor } };
      }
      // Foto que este aparelho acabou de anotar: a troca só vale quando a do servidor é mais nova.
      if (Date.parse(versaoServidor) < Date.parse(versaoLocal)) return f;
      const url = urlDeReservaDaFoto(pacienteId, id, versaoServidor);
      if (!url) return f;
      trocou = true;
      return { url, blob: null, meta: { ...(f.meta || {}), arquivoAtualizadoEm: versaoServidor } };
    });
  const idsLocais = new Set(ficam.map((f) => f?.meta?.fotoId).filter(Boolean).map(String));
  const novas = [];
  for (const f of servidor) {
    if (idsLocais.has(String(f.id)) || !entra(f)) continue;
    const url = urlDe(String(f.id));
    if (!url) continue;
    const categoria = categoriaDe ? categoriaDe(f) : null;
    novas.push({
      url,
      blob: null,
      meta: {
        fotoId: String(f.id),
        atendimentoItemId: f.atendimentoItemId ?? null,
        tipoFotoCodigo: f.tipoFotoCodigo ?? null,
        ...(categoria ? { categoria } : {}),
        ...(f.arquivoAtualizadoEm ? { arquivoAtualizadoEm: f.arquivoAtualizadoEm } : {}),
        source: 'servidor',
      },
    });
  }
  if (!trocou && novas.length === 0 && ficam.length === lista.length) return locais;
  return [...ficam, ...novas];
}

/** Versão do arquivo que a foto local conhece (`AtendimentoFotoDTO.arquivoAtualizadoEm`, ISO UTC com ms). */
export function versaoDaFotoLocal(foto) {
  return foto?.meta?.arquivoAtualizadoEm ?? null;
}

/**
 * URL de reserva do arquivo da foto da galeria: `/api/v1/pacientes/{p}/galeria/{fotoId}/arquivo?v=<epochMs>`.
 * Sem paciente ou sem fotoId devolve null; sem versão (ou versão que não é data) vai sem `?v=`.
 * O servidor exige X-Org-Id: carregue por `usePacienteGaleriaArquivoBlobUrl` com forceBlob, nunca em `<img src>`.
 *
 * @param {string | null | undefined} pacienteId
 * @param {string | null | undefined} fotoId
 * @param {string | null | undefined} arquivoAtualizadoEm ISO UTC
 * @returns {string | null}
 */
export function urlDeReservaDaFoto(pacienteId, fotoId, arquivoAtualizadoEm) {
  if (!pacienteId || !fotoId) return null;
  const base = `/api/v1/pacientes/${encodeURIComponent(String(pacienteId))}/galeria/${encodeURIComponent(String(fotoId))}/arquivo`;
  const epochMs = arquivoAtualizadoEm ? Date.parse(arquivoAtualizadoEm) : NaN;
  return Number.isFinite(epochMs) ? `${base}?v=${epochMs}` : base;
}
