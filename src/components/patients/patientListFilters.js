/**
 * Conta filtros ativos na lista de pacientes (badge do botão Filtros no mobile).
 */
export function countActivePatientFilters({
  statusPlanoFilter = '',
  anamneseDesatualizadaFilter = false,
  semRetornoFilter = false,
  ehNovoFilter = false,
  ehAniversarianteFilter = false,
  quickFilter = 'todos',
} = {}) {
  let n = 0;
  if (statusPlanoFilter !== '') n += 1;
  if (anamneseDesatualizadaFilter) n += 1;
  if (semRetornoFilter) n += 1;
  if (ehNovoFilter) n += 1;
  if (ehAniversarianteFilter) n += 1;
  if (quickFilter === 'menor') n += 1;
  return n;
}
