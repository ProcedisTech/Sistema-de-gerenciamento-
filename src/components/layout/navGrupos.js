import { CalendarDays, History, Settings, Users, UserCog } from 'lucide-react';
import { papelDe } from '../../hooks/usePapel';
import { usePapelExibicao } from '../../contexts/PreviaAcessoContext';

export const NAV_GRUPOS = [
  {
    id: 'dia',
    titulo: 'Dia a dia',
    itens: [
      { view: 'pacientes', label: 'Pacientes', icon: Users },
      { view: 'agenda', label: 'Agenda', icon: CalendarDays },
    ],
  },
  {
    id: 'gestao',
    titulo: 'Gestão',
    itens: [
      { view: 'gestao-equipe', label: 'Gestão de Equipe', icon: UserCog },
      { view: 'auditoria', label: 'Auditoria', icon: History },
    ],
  },
  { id: 'sistema', titulo: 'Sistema', itens: [{ view: 'configuracoes', label: 'Configurações', icon: Settings }] },
];

const VISIVEL = {
  configuracoes: (f) => f.canSeeConfig,
  'gestao-equipe': (f) => f.canSeeConfigEquipe,
  auditoria: (f) => f.canSeeConfigAuditoria,
};

/** Mesma regra do menu de sempre; grupos sem item somem. */
export function gruposVisiveis(flags) {
  return NAV_GRUPOS.map((g) => ({
    ...g,
    itens: g.itens.filter((i) => (VISIVEL[i.view] ? VISIVEL[i.view](flags) : true)),
  })).filter((g) => g.itens.length > 0);
}

export function useNavGrupos() {
  return gruposVisiveis(usePapelExibicao());
}

/** Lista só de leitura: o menu de quem tem estes códigos de permissão. */
export function menuParaFuncoes(codigos) {
  return gruposVisiveis(papelDe({ permissoes: [...codigos] }));
}
