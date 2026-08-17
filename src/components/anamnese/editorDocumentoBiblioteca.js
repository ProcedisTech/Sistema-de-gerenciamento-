import { cloneSecoesFromDocumento } from './editorDocumentoState.js';
import { computeSecaoSummary, perguntaAlimentaProntuario } from './editorTipoMeta.js';

const EMOJI_POR_ESPECIALIDADE = {
  ODONTOLOGIA: '🦷',
  ESTETICA: '✨',
  DERMATOLOGIA: '✨',
};

export function emojiForEspecialidade(codigo, nome) {
  const c = String(codigo || '').toUpperCase();
  if (EMOJI_POR_ESPECIALIDADE[c]) return EMOJI_POR_ESPECIALIDADE[c];
  const n = String(nome || '').toLowerCase();
  if (n.includes('odonto')) return '🦷';
  if (n.includes('estét') || n.includes('estet') || n.includes('derma')) return '✨';
  return '📋';
}

function secaoIsFeminino(sexo) {
  const s = String(sexo || '').toUpperCase();
  return s === 'F' || s === 'FEMININO';
}

function fichaNums(doc) {
  const secoes = doc.secoes || [];
  let perguntas = 0;
  let criticas = 0;
  let prontuario = 0;
  for (const s of secoes) {
    for (const q of s.perguntas || []) {
      perguntas += 1;
      if (String(q.prioridade || 'NORMAL').toUpperCase() === 'CRITICA') criticas += 1;
      if (perguntaAlimentaProntuario(q) || q.cond) prontuario += 1;
    }
  }
  return { secoes: secoes.length, perguntas, criticas, prontuario };
}

/**
 * Deriva FICHAS / MODULOS / BANCO só das fichas prontas (tipo FICHA), como L892–897.
 */
export function buildBiblioteca(docs, metas = []) {
  const metaByCodigo = new Map((metas || []).map((m) => [m.codigo, m]));
  const FICHAS = (docs || []).map((doc) => {
    const meta = metaByCodigo.get(doc.codigo) || {};
    return {
      codigo: doc.codigo,
      nome: doc.nome,
      especialidadeId: doc.especialidadeId ?? null,
      especialidadeCodigo: doc.especialidadeCodigo ?? null,
      especialidadeNome: doc.especialidadeNome ?? null,
      textoDeclaracao: doc.textoDeclaracao || '',
      secoes: doc.secoes || [],
      descricao: meta.descricao || '',
      origem: meta.descricao || '',
      ic: emojiForEspecialidade(doc.especialidadeCodigo, doc.especialidadeNome),
      nums: fichaNums(doc),
    };
  });

  const MODULOS = [];
  FICHAS.forEach((f) => {
    (f.secoes || []).forEach((s) => {
      if (!MODULOS.some((m) => m.nome === s.nome)) {
        const sum = computeSecaoSummary(s);
        MODULOS.push({
          ...s,
          ic: s.icone || s.ic || f.ic,
          d: s.descricao || s.d || s.nome,
          sexo: s.sexoAplicavel,
          feminino: secaoIsFeminino(s.sexoAplicavel),
          criticas: sum.crit,
          prontuario: sum.hist,
          nPerguntas: sum.total,
        });
      }
    });
  });

  const BANCO = [];
  MODULOS.forEach((m) => {
    (m.perguntas || []).forEach((x) => {
      if (x.perguntaPaiClientKey) return;
      if (BANCO.some((b) => b.descricao === x.descricao)) return;
      BANCO.push({ ...x, cat: m.nome });
    });
  });

  return { FICHAS, MODULOS, BANCO };
}

export async function loadBiblioteca({ listStarters, getStarterDocumento }) {
  const starters = await listStarters();
  const metas = Array.isArray(starters) ? starters : [];
  const fichasMeta = metas.filter((s) => s.tipo === 'FICHA');
  const docs = await Promise.all(
    fichasMeta.map((s) => getStarterDocumento(s.codigo).catch(() => null))
  );
  return buildBiblioteca(
    docs.filter(Boolean),
    metas
  );
}

export function moduloToAppendSecoes(modulo) {
  return cloneSecoesFromDocumento([modulo]);
}
