import { corParaProcedimento, getCorLivreParaProcedimento } from '../constants/mapeamentoPaletaCores.js';

function gerarIdSeguro() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'proc_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
}

/**
 * Cria ou normaliza um item individual de procedimento da sessão.
 * Garante que extraProps nunca sobrescreva os campos canônicos id, corHex e catalogoId.
 * REGRA CRÍTICA: O campo 'id' representa o ID de ProcedimentoFeito persistido no banco de dados.
 * Itens em rascunho na sessão que ainda não foram salvos no banco DEVEM ter id = null.
 * Se um UUID aleatório for colocado em 'id', o sistema entenderá que o procedimento já foi
 * persistido no banco, pulando a validação de termos e quebrando a finalização (404/400).
 */
export function criarItemProcedimentoSessao(
  propsOuItem = {},
  _indexOuCores = null,
  listaOpcional = null,
) {
  const props = propsOuItem || {};
  const extraProps = props.extraProps || props;

  const catIdResolvido =
    props.catalogoId ||
    props.catalogoProcedimentoSaudeId ||
    extraProps.catalogoId ||
    extraProps.catalogoProcedimentoSaudeId ||
    null;

  // Preserva ID e procedimentoFeitoId separadamente se já existirem (não gera UUID falso)
  const idReal = props.id != null ? props.id : (extraProps.id != null ? extraProps.id : null);
  const pfIdReal =
    props.procedimentoFeitoId != null
      ? props.procedimentoFeitoId
      : (extraProps.procedimentoFeitoId != null ? extraProps.procedimentoFeitoId : null);

  // Se receber lista de procedimentos como 3º argumento ou coresOcupadas no objeto
  let coresOcupadas = props.coresOcupadas || null;
  if (!coresOcupadas && Array.isArray(listaOpcional)) {
    coresOcupadas = new Set(
      listaOpcional
        .map((p) => {
          if (p?.corHex && typeof p.corHex === 'string') return p.corHex;
          if (p?.cor && typeof p.cor === 'string') return p.cor;
          const cid = p?.catalogoProcedimentoSaudeId || p?.catalogoId || p?.nomeProcedimentoCatalogoId;
          return cid ? corParaProcedimento(cid) : null;
        })
        .filter((c) => c && typeof c === 'string' && c.startsWith('#'))
        .map((c) => c.toLowerCase()),
    );
  }

  let corResolvida = props.corHex || extraProps.corHex;
  if (!corResolvida || typeof corResolvida !== 'string' || !corResolvida.startsWith('#')) {
    if (coresOcupadas) {
      corResolvida = getCorLivreParaProcedimento(catIdResolvido, coresOcupadas);
    } else {
      corResolvida = corParaProcedimento(catIdResolvido);
    }
  }

  const nomeFinal =
    props.nome ||
    props.nomeProcedimento ||
    props.procedimentoNome ||
    extraProps.nomeProcedimento ||
    extraProps.procedimentoNome ||
    extraProps.nome ||
    '';

  // Identificador exclusivo de UI apenas para keys do React (não usado como id de banco)
  const uid = extraProps._uid || props._uid || gerarIdSeguro();

  return {
    ...extraProps,
    _uid: uid,
    id: idReal,
    procedimentoFeitoId: pfIdReal,
    catalogoId: catIdResolvido,
    catalogoProcedimentoSaudeId: catIdResolvido,
    nome: nomeFinal,
    nomeProcedimento: nomeFinal,
    corHex: corResolvida,
  };
}

/**
 * Cria/normaliza um lote de procedimentos em duas passadas:
 * Passada 1: coleta as cores já explícitas e válidas para reservar no Set.
 * Passada 2: para os itens sem cor, aloca cor anti-colisão cumulativa contra o Set.
 * Preserva integralmente todas as chaves adicionais do item bruto (ex: agendaId, procedimentoFeitoId, etc).
 */
export function criarLoteProcedimentosSessao(rawItems = [], coresJaOcupadas = null) {
  if (!Array.isArray(rawItems)) return [];

  const coresOcupadas = new Set(
    Array.from(coresJaOcupadas || [])
      .map((c) => String(c || '').trim().toLowerCase())
      .filter(Boolean)
  );

  // Passada 1: reservar cores explícitas válidas
  for (const item of rawItems) {
    if (item && item.corHex && typeof item.corHex === 'string' && item.corHex.startsWith('#')) {
      coresOcupadas.add(item.corHex.trim().toLowerCase());
    }
  }

  // Passada 2: instanciar cada item garantindo preservação de campos e alocação de cor
  const resultado = [];
  for (const raw of rawItems) {
    if (!raw) continue;
    const {
      id,
      catalogoId,
      catalogoProcedimentoSaudeId,
      nome,
      corHex,
      procedimentoFeitoId,
      ...resto
    } = raw;

    const catId = catalogoId || catalogoProcedimentoSaudeId || null;
    let cor = corHex;
    if (!cor || typeof cor !== 'string' || !cor.startsWith('#')) {
      cor = getCorLivreParaProcedimento(catId, coresOcupadas);
    }
    coresOcupadas.add(cor.trim().toLowerCase());

    resultado.push(
      criarItemProcedimentoSessao({
        id,
        catalogoId: catId,
        catalogoProcedimentoSaudeId: catId,
        nome: nome || '',
        corHex: cor,
        procedimentoFeitoId,
        extraProps: resto,
        coresOcupadas
      })
    );
  }

  return resultado;
}
