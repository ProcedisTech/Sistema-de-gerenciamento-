/**
 * Dados fixos das telas da consulta para os snapshots de HTML (Etapa 0 da fatia 2).
 * Mudar qualquer valor aqui muda os snapshots: só mexa junto com a atualização consciente deles.
 */

/** 06/10/2026 10:00 em America/Sao_Paulo. */
export const INSTANTE_FIXO = '2026-10-06T13:00:00.000Z';

export const pacienteFixo = {
  id: 'pac-1',
  nome: 'Ana Souza',
  nomeCompleto: 'Ana Souza',
  cpf: '12345678909',
  telefone: '11999990000',
  sexo: 'F',
  idade: 34,
  dataNascimento: '1992-03-15',
};

export const loteFixo = [
  {
    agendaId: 'ag-1',
    procedimentoNome: 'Toxina botulínica',
    nomeProcedimento: 'Toxina botulínica',
    catalogoProcedimentoSaudeId: 'cat-1',
    planejamentoItemId: null,
    isAgendaRetorno: false,
  },
];

function fotoFixa(n, tipo) {
  return {
    url: `https://fotos.teste/${tipo}-${n}.jpg`,
    blob: null,
    meta: { origem: 'camera', categoria: tipo === 'avaliacao' ? 'Avaliação' : 'Pós imediato' },
  };
}

export const fotosAvaliacaoFixas = [fotoFixa(1, 'avaliacao'), fotoFixa(2, 'avaliacao')];
export const fotosProcedimentoFixas = [fotoFixa(1, 'procedimento')];

export const orientacoesFixas = [
  { descricao: 'Não deitar por 4 horas', checado: true, ordem: 1 },
  { descricao: 'Evitar exercício por 24 horas', checado: false, ordem: 2 },
];

export const termosAssinadosFixos = [];

export const termoFixo = {
  id: 'termo-1',
  titulo: 'Termo de consentimento — Toxina botulínica',
  conteudo: 'Declaro que fui informada sobre riscos e cuidados do procedimento.',
  ativo: true,
};

export const planoFixo = {
  id: 'plano-1',
  titulo: 'Rejuvenescimento facial',
  observacao: 'Duas sessões',
  statusCodigo: 'ATIVO',
  statusNome: 'Ativo',
  criadoEm: '2026-09-01T13:00:00.000Z',
  valorTotal: 1500,
  progresso: 0,
  itens: [
    {
      id: 'pi-1',
      planejamentoId: 'plano-1',
      catalogoProcedimentoSaudeId: 'cat-1',
      catalogoNome: 'Toxina botulínica',
      dataPlanejada: '2026-10-06',
      statusItem: 'PLANEJADO',
      statusItemNome: 'Planejado',
      valorOrcado: 1500,
      sessaoAtiva: null,
      sessaoRealizada: null,
      sessaoRetornoAtiva: null,
    },
  ],
};
