/** As 27 UFs da tb_uf (seed V166), na ordem devolvida por GET /api/v1/ufs. */
export const UFS_FIXTURE = [
  { sigla: 'AC', nome: 'Acre', fusoIana: 'America/Rio_Branco' },
  { sigla: 'AL', nome: 'Alagoas', fusoIana: 'America/Maceio' },
  { sigla: 'AP', nome: 'Amapá', fusoIana: 'America/Belem' },
  { sigla: 'AM', nome: 'Amazonas', fusoIana: 'America/Manaus' },
  { sigla: 'BA', nome: 'Bahia', fusoIana: 'America/Bahia' },
  { sigla: 'CE', nome: 'Ceará', fusoIana: 'America/Fortaleza' },
  { sigla: 'DF', nome: 'Distrito Federal', fusoIana: 'America/Sao_Paulo' },
  { sigla: 'ES', nome: 'Espírito Santo', fusoIana: 'America/Sao_Paulo' },
  { sigla: 'GO', nome: 'Goiás', fusoIana: 'America/Sao_Paulo' },
  { sigla: 'MA', nome: 'Maranhão', fusoIana: 'America/Fortaleza' },
  { sigla: 'MT', nome: 'Mato Grosso', fusoIana: 'America/Cuiaba' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul', fusoIana: 'America/Campo_Grande' },
  { sigla: 'MG', nome: 'Minas Gerais', fusoIana: 'America/Sao_Paulo' },
  { sigla: 'PA', nome: 'Pará', fusoIana: 'America/Belem' },
  { sigla: 'PB', nome: 'Paraíba', fusoIana: 'America/Fortaleza' },
  { sigla: 'PR', nome: 'Paraná', fusoIana: 'America/Sao_Paulo' },
  { sigla: 'PE', nome: 'Pernambuco', fusoIana: 'America/Recife' },
  { sigla: 'PI', nome: 'Piauí', fusoIana: 'America/Fortaleza' },
  { sigla: 'RJ', nome: 'Rio de Janeiro', fusoIana: 'America/Sao_Paulo' },
  { sigla: 'RN', nome: 'Rio Grande do Norte', fusoIana: 'America/Fortaleza' },
  { sigla: 'RS', nome: 'Rio Grande do Sul', fusoIana: 'America/Sao_Paulo' },
  { sigla: 'RO', nome: 'Rondônia', fusoIana: 'America/Porto_Velho' },
  { sigla: 'RR', nome: 'Roraima', fusoIana: 'America/Boa_Vista' },
  { sigla: 'SC', nome: 'Santa Catarina', fusoIana: 'America/Sao_Paulo' },
  { sigla: 'SP', nome: 'São Paulo', fusoIana: 'America/Sao_Paulo' },
  { sigla: 'SE', nome: 'Sergipe', fusoIana: 'America/Maceio' },
  { sigla: 'TO', nome: 'Tocantins', fusoIana: 'America/Araguaina' },
];

export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
