import { useOrg } from '../contexts/OrgContext';

export function usePapel() {
  const { papel: rawPapel } = useOrg();

  // No ambiente de desenvolvimento (localhost), se o papel for null,
  // tratamos como ADMIN para não bloquear o acesso às configurações.
  // const isDev = import.meta.env.DEV;
  // REMOVIDO: fallback para ADMIN em dev para não mascarar erros de permissão
  const papel = rawPapel;

  const isAdmin = papel === 'ADMIN';
  const isProfissional = papel === 'PROFISSIONAL';
  const isRecepcionista = papel === 'RECEPCIONISTA';

  return { papel, isAdmin, isProfissional, isRecepcionista };
}
