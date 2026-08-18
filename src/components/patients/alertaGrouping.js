import { ANAMNESE_STYLE, SECAO_STYLE } from './alertaSeveridadeStyle.js';

// Ordem dos campos nos cards agrupados — mesma ordem em que aparecem no editor de
// Perfil Clínico (PerfilClinicoBloco.jsx): alimentar, princípio ativo, medicamento, antecedente.
const GROUP_DEFS = [
  { secao: 'alergias', label: 'Alimentar' },
  { secao: 'alergiasPrincipioAtivo', label: 'Princípio ativo' },
  { secao: 'medicamentos', label: 'Medicamento' },
  { secao: 'antecedentes', label: 'Antecedente' },
];

/**
 * Agrupa alertas de perfil clínico + anamnese por campo (alimentar, princípio ativo,
 * medicamento, antecedente, anamnese). Usado na sidebar do perfil e no modal
 * "Todos os alertas clínicos".
 */
export function buildGroupedChips(alertasPerfil, alertasAnamnese) {
  const groups = GROUP_DEFS.map((def) => ({
    ...def,
    ...SECAO_STYLE[def.secao],
    items: [],
  }));
  const bySecao = Object.fromEntries(groups.map((g) => [g.secao, g]));
  alertasPerfil.forEach((item) => {
    const group = bySecao[item.secao] ?? bySecao.antecedentes;
    group.items.push({ key: item.key, label: item.valor || item.titulo });
  });
  if (alertasAnamnese.length > 0) {
    groups.push({
      secao: 'anamnese',
      label: 'Anamnese',
      color: ANAMNESE_STYLE.color,
      Icon: ANAMNESE_STYLE.Icon,
      items: alertasAnamnese.map((item) => ({ key: item.key, label: item.titulo || item.valor })),
    });
  }
  return groups.filter((group) => group.items.length > 0);
}
