import { useOrg } from '../../contexts/OrgContext';

/**
 * Fuso da clínica ativa (IANA), lido do /me com X-Org-Id guardado no OrgContext.
 * `pronto === false` enquanto o /me não respondeu — nada deve decidir "hoje" ou "já passou" antes disso.
 */
export function useFusoClinica() {
  const { fusoHorario, recarregarContextoOrg } = useOrg();
  return {
    fuso: fusoHorario,
    pronto: fusoHorario != null,
    recarregarFuso: recarregarContextoOrg,
  };
}
