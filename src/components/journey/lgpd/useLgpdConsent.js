/**
 * useLgpdConsent.js
 *
 * Custom Hook que encapsula a lógica de negócio do Termo de Consentimento LGPD:
 * 1. Geração do PDF com o texto interpolado (via lgpdPdfGenerator)
 * 2. Cálculo do SHA-256 do PDF gerado (validade jurídica)
 * 3. Disparo do download para o usuário
 * 4. Mutação no backend (termoAssinaturaApi.criar) com todos os campos jurídicos
 *
 * @module useLgpdConsent
 */

import { useCallback, useState } from 'react';
import { termoAssinaturaApi } from '../../../services/api';
import { gerarPdfLgpd } from './lgpdPdfGenerator';

// ── Re-exporta para compatibilidade com testes existentes ────────────────────
export { gerarPdfLgpd as generateAndDownloadPdf };

// ── Hash SHA-256 ─────────────────────────────────────────────────────────────

/**
 * Calcula o hash SHA-256 de um Blob/ArrayBuffer usando a Web Crypto API nativa.
 * Retorna a representação hexadecimal de 64 chars.
 *
 * @param {Blob} blob
 * @returns {Promise<string>} SHA-256 hex string (64 chars)
 */
export async function computeSha256(blob) {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Hook principal ───────────────────────────────────────────────────────────

/**
 * Hook de negócio para exportar PDF e persistir o aceite LGPD.
 *
 * Retorna:
 * - `isExporting`: PDF sendo gerado
 * - `isPersisting`: mutação em andamento
 * - `exportAndSign(options)`: ação principal
 *
 * @returns {{ isExporting: boolean, isPersisting: boolean, exportAndSign: Function }}
 */
export function useLgpdConsent() {
  const [isExporting,  setIsExporting]  = useState(false);
  const [isPersisting, setIsPersisting] = useState(false);

  const exportAndSign = useCallback(async (options) => {
    const {
      termoId,
      pacienteId,
      roleUserId          = null,
      procedimentoFeitoId = null,
      consentText,
      assinaturaProfissional,
      assinaturaPaciente,
      profissionalAssinouEm,
      pacienteAssinouEm,
      onSuccess,
    } = options;

    // 1. Gerar PDF e fazer download
    setIsExporting(true);
    let pdfBlob;
    let pdfHash = null;
    try {
      pdfBlob = await gerarPdfLgpd(consentText);
      pdfHash = await computeSha256(pdfBlob);
    } finally {
      setIsExporting(false);
    }

    // 2. Persistir aceite no backend com todos os campos jurídicos
    setIsPersisting(true);
    try {
      const result = await termoAssinaturaApi.criar({
        termoId,
        pacienteId,
        procedimentoFeitoId: procedimentoFeitoId ?? null,
        roleUserId:          roleUserId ?? null,
        assinaturaProfissional,
        assinaturaPaciente,
        pacienteRecusou: false,
        statusCodigo: 'ASSINADO',
        profissionalAssinouEm:
          profissionalAssinouEm != null
            ? new Date(profissionalAssinouEm).toISOString()
            : new Date().toISOString(),
        pacienteAssinouEm:
          pacienteAssinouEm != null
            ? new Date(pacienteAssinouEm).toISOString()
            : new Date().toISOString(),
        conteudoSnapshot: consentText,
        pdfHash,
        ipAddress: null,
        userAgent: navigator.userAgent ?? null,
      });

      onSuccess?.(result);
      return result;
    } finally {
      setIsPersisting(false);
    }
  }, []);

  return { isExporting, isPersisting, exportAndSign };
}
