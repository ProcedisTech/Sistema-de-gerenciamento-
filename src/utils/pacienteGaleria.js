import { resolveApiUrl } from '../config/apiEnv.js';

/**
 * Normaliza JSON da galeria quando o GET retorna 200.
 * Contrato Spring: { fotos: [ { id, url, dataReferencia, registradoEm, legenda, … } ] }
 * (também aceita array direto, itens, content — legado / stubs).
 *
 * `url` costuma ser path `/api/v1/.../galeria/{fotoId}/arquivo?v=…` ou URL HTTPS presigned (R2).
 */
export function normalizePacienteGaleriaResponse(data) {
  if (data == null) return [];
  let rows = [];
  if (Array.isArray(data)) rows = data;
  else if (Array.isArray(data.fotos)) rows = data.fotos;
  else if (Array.isArray(data.itens)) rows = data.itens;
  else if (Array.isArray(data.content)) rows = data.content;

  const out = [];
  for (const raw of rows) {
    const item = normalizePacienteGaleriaItem(raw);
    if (item) out.push(item);
  }
  return out;
}

function absolutizeUrl(u) {
  if (!u || typeof u !== 'string') return '';
  const t = u.trim();
  if (!t) return '';
  if (t.startsWith('data:')) return t;
  if (/^https?:\/\//i.test(t)) return t;
  const path = t.startsWith('/') ? t : `/${t}`;
  return resolveApiUrl(path);
}

/**
 * Monta `url` exibível para a UI / hooks de galeria:
 * 1) Primeiro campo não vazio entre `arquivoUrl`, `url`, `urlFoto`, `urlPublica`, `presignedUrl`, `signedUrl`, `link`, `caminho`.
 * 2) `absolutizeUrl`: se já for `https?://` (ex.: presigned R2), mantém; se for path `/api/v1/...`, prefixa `VITE_API_BASE_URL`.
 * Se o backend mandar só `arquivoUrl` com R2, esse valor ganha prioridade sobre `url`.
 */
export function normalizePacienteGaleriaItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.foto && typeof raw.foto === 'object') return normalizePacienteGaleriaItem(raw.foto);
  if (raw.item && typeof raw.item === 'object') return normalizePacienteGaleriaItem(raw.item);
  console.log('galeria item:', raw);
  const url =
    raw.arquivoUrl ||
    raw.url ||
    raw.urlFoto ||
    raw.urlPublica ||
    raw.presignedUrl ||
    raw.signedUrl ||
    raw.link ||
    raw.caminho;
  if (!url) return null;
  const id = raw.id ?? raw.fotoId;
  if (id == null || id === '') return null;
  const legenda = typeof raw.legenda === 'string' ? raw.legenda.trim() : '';
  return {
    serverId: String(id),
    url: absolutizeUrl(String(url)),
    fileName:
      legenda ||
      raw.nomeArquivo ||
      raw.fileName ||
      raw.descricao ||
      raw.titulo ||
      'Foto',
    legenda: legenda || null,
    dataReferencia: raw.dataReferencia || null,
    createdAt: raw.registradoEm || raw.criadoEm || raw.dataUpload || raw.createdAt || null,
  };
}

/** Mensagens amigáveis para upload/lista/delete da galeria (401 em JSON dispara auth:expired na api.js). */
export function formatPacienteGaleriaError(err) {
  const status = err?.status;
  const base = typeof err?.message === 'string' ? err.message.trim() : '';
  if (status === 413) return 'Arquivo acima do limite permitido pelo servidor.';
  if (status === 400) return base || 'Arquivo ou dados inválidos (tipo, tamanho, legenda ou vínculos).';
  if (status === 404) return base || 'Foto ou paciente não encontrado.';
  if (status === 401) {
    return (
      base ||
      'Não autorizado (401). Faça login de novo; confira se a organização no app bate com a do banco e se o usuário (ex.: seed-admin) tem permissão nas rotas da galeria e do arquivo no Spring. Isso não é causado por paciente novo.'
    );
  }
  if (status === 403) {
    return base || 'Sem permissão nesta organização para esta operação na galeria.';
  }
  return base || 'Erro ao usar a galeria.';
}
