import {
  Stethoscope,
  ClipboardList,
  User,
  Building2,
  CalendarDays,
  Users,
  FileText,
  PenLine,
  Globe,
  Clock,
  MessageCircle,
  UserX,
} from 'lucide-react';

/**
 * Definição canônica de todas as categorias do Settings Hub.
 * Cada categoria contém seus itens com a flag canSee que precisa ser verdadeira.
 *
 * `requireFlag` — chave da prop canSee* que o item precisa para aparecer.
 * Categoria some do hub se nenhum item for visível ao usuário.
 */
export const CATEGORY_DEFS = [
  {
    key: 'clinica-group',
    label: 'Clínica',
    description: 'Procedimentos, termos e assinaturas',
    icon: Stethoscope,
    color: '#00A88E',
    items: [
      { id: 'procedimentos', label: 'Procedimentos', subtitle: 'Catálogo de serviços', icon: Stethoscope, requireFlag: 'canSeeProcedimentos' },
      { id: 'termos', label: 'Termos de Consentimento', subtitle: 'Documentos legais', icon: FileText, requireFlag: 'canSeeTermos' },
      { id: 'metodos-assinatura', label: 'Métodos de Assinatura', subtitle: 'QR Code, Tablet, Link', icon: PenLine, requireFlag: 'canSeeTermos' },
    ],
  },
  {
    key: 'anamnese',
    label: 'Anamnese',
    description: 'Fichas e acesso público',
    icon: ClipboardList,
    color: '#7C3AED',
    items: [
      { id: 'fichas', label: 'Fichas', subtitle: 'Editor de anamnese', icon: ClipboardList, requireFlag: 'canSeeAnamnese' },
      { id: 'anamnese-publica', label: 'Acesso Público', subtitle: 'Configurações de acesso', icon: Globe, requireFlag: 'canSeeAnamnese' },
    ],
  },
  {
    key: 'meu-perfil',
    label: 'Meu Perfil',
    description: 'Seus dados e assinatura profissional',
    icon: User,
    color: '#F59E0B',
    items: [
      { id: 'perfil', label: 'Meus Dados', subtitle: 'Informações e assinatura', icon: User, requireFlag: 'canSeePerfil' },
    ],
  },
  {
    key: 'organizacao',
    label: 'Organização',
    description: 'Logo, endereço e CNPJ da clínica',
    icon: Building2,
    color: '#14B8A6',
    items: [
      { id: 'clinica', label: 'Dados da Clínica', subtitle: 'Logo, endereço, CNPJ', icon: Building2, requireFlag: 'canSeeClinica' },
    ],
  },
  {
    key: 'agenda',
    label: 'Agenda',
    description: 'Horários, feriados e mensagens',
    icon: CalendarDays,
    color: '#3B82F6',
    items: [
      { id: 'horarios-funcionamento', label: 'Horário de atendimento', icon: Clock, requireFlag: 'canSeeAgendaConfig' },
      { id: 'agenda-feriados', label: 'Feriados', icon: CalendarDays, requireFlag: 'canSeeAgendaConfig' },
      { id: 'agenda-templates', label: 'Templates de mensagem', icon: MessageCircle, requireFlag: 'canSeeAgendaConfig' },
    ],
  },
  {
    key: 'equipe',
    label: 'Equipe',
    description: 'Pacientes inativados',
    icon: Users,
    color: '#EC4899',
    items: [
      { id: 'pacientes-inativados', label: 'Pacientes Inativados', icon: UserX, requireFlag: 'canSeeEquipe' },
    ],
  },
];

/**
 * Filtra os itens de uma categoria pelo conjunto de flags de permissão.
 * @param {object} category — entrada de CATEGORY_DEFS
 * @param {object} flags    — { canSeeAnamnese, canSeeProcedimentos, canSeeTermos, canSeePerfil, canSeeClinica, canSeeAgendaConfig, canSeeEquipe }
 * @returns {Array} itens visíveis ao usuário
 */
export function filterCategoryItems(category, flags) {
  return category.items.filter((item) => !!flags[item.requireFlag]);
}

/**
 * Retorna as categorias visíveis ao usuário (ao menos 1 item com permissão).
 * Cada categoria retornada tem `visibleItems` com os itens filtrados.
 */
export function getVisibleCategories(flags) {
  return CATEGORY_DEFS.reduce((acc, cat) => {
    const visibleItems = filterCategoryItems(cat, flags);
    if (visibleItems.length > 0) {
      acc.push({ ...cat, visibleItems });
    }
    return acc;
  }, []);
}
