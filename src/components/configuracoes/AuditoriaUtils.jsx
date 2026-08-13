import React from 'react';
import { User, Calendar, FileText, Activity } from 'lucide-react';

export const ACOES_MAP = {
  // Paciente
  CRIAR_PACIENTE:         { label: 'Criou paciente',        cor: 'green' },
  EDITAR_PACIENTE:        { label: 'Editou paciente',        cor: 'blue' },
  DESATIVAR_PACIENTE:     { label: 'Inativou paciente',      cor: 'red' },
  REATIVAR_PACIENTE:      { label: 'Reativou paciente',      cor: 'green' },
  
  // Agenda & Agendamento
  CRIAR_AGENDAMENTO:      { label: 'Criou agendamento',      cor: 'green' },
  REMOVER_AGENDAMENTO:    { label: 'Removeu agendamento',    cor: 'red' },
  CRIAR_AGENDA:           { label: 'Criou agenda',           cor: 'green' },
  EDITAR_AGENDA:          { label: 'Editou agenda',          cor: 'blue' },
  CANCELAR_AGENDA:        { label: 'Cancelou agenda',        cor: 'red' },
  REAGENDAR_AGENDA:       { label: 'Reagendou agenda',       cor: 'purple' },
  
  // Procedimento & Notas
  INICIAR_PROCEDIMENTO:   { label: 'Iniciou procedimento',   cor: 'blue' },
  FINALIZAR_PROCEDIMENTO: { label: 'Finalizou procedimento', cor: 'purple' },
  CRIAR_NOTA:             { label: 'Criou nota',             cor: 'green' },
  EDITAR_NOTA:            { label: 'Editou nota',            cor: 'blue' },
  REMOVER_NOTA:           { label: 'Removeu nota',           cor: 'red' },
  
  // Anamnese
  PREENCHER_ANAMNESE:     { label: 'Preencheu anamnese',     cor: 'blue' },
  FINALIZAR_ANAMNESE:     { label: 'Finalizou anamnese',     cor: 'purple' },
  CRIAR_CATEGORIA_ANAMNESE:   { label: 'Criou categoria',    cor: 'green' },
  EDITAR_CATEGORIA_ANAMNESE:  { label: 'Editou categoria',   cor: 'blue' },
  DESATIVAR_CATEGORIA_ANAMNESE: { label: 'Desativou categoria', cor: 'red' },
  CRIAR_PERGUNTA_ANAMNESE:    { label: 'Criou pergunta',     cor: 'green' },
  EDITAR_PERGUNTA_ANAMNESE:   { label: 'Editou pergunta',    cor: 'blue' },
  DESATIVAR_PERGUNTA_ANAMNESE: { label: 'Desativou pergunta', cor: 'red' },
  CRIAR_FICHA_ANAMNESE:       { label: 'Criou ficha',        cor: 'green' },
  EDITAR_FICHA_ANAMNESE:      { label: 'Editou ficha',       cor: 'blue' },
  DESATIVAR_FICHA_ANAMNESE:   { label: 'Desativou ficha',    cor: 'red' },
  
  // Equipe & Usuário
  CRIAR_PROFISSIONAL:     { label: 'Criou profissional',    cor: 'green' },
  EDITAR_PROFISSIONAL:    { label: 'Editou profissional',   cor: 'blue' },
  DESATIVAR_PROFISSIONAL: { label: 'Desativou profissional', cor: 'red' },
  CRIAR_USUARIO:          { label: 'Criou login',           cor: 'green' },
  EDITAR_USUARIO:         { label: 'Editou login',          cor: 'blue' },
  DESATIVAR_USUARIO:      { label: 'Desativou login',       cor: 'red' },
  UPLOAD_FOTO_PERFIL:     { label: 'Alterou foto perfil',   cor: 'blue' },
  EDITAR_PERFIL_PROPRIO:  { label: 'Editou próprio perfil', cor: 'blue' },
  EDITAR_ASSINATURA_PERFIL: { label: 'Alterou assinatura',  cor: 'blue' },
  
  // Clínica & Termos
  EDITAR_DADOS_CLINICA:   { label: 'Editou dados clínica',  cor: 'blue' },
  UPLOAD_LOGO_CLINICA:    { label: 'Alterou logo clínica',  cor: 'blue' },
  EDITAR_HORARIO_CLINICA: { label: 'Editou horários clínica', cor: 'blue' },
  CRIAR_TERMO_CONSENTIMENTO: { label: 'Criou termo',         cor: 'green' },
  EDITAR_TERMO_CONSENTIMENTO: { label: 'Editou termo',        cor: 'blue' },
  REMOVER_TERMO_CONSENTIMENTO: { label: 'Removeu termo',      cor: 'red' },
  ASSINAR_TERMO:          { label: 'Assinou termo',          cor: 'purple' },
  BAIXAR_FICHA_PACIENTE:  { label: 'Baixou ficha PDF',       cor: 'purple' },

  // Agenda Config
  EDITAR_HORARIO_AGENDA:  { label: 'Editou horários profissional', cor: 'blue' },
  SINCRONIZAR_HORARIO_AGENDA: { label: 'Sincronizou horários', cor: 'blue' },
  CRIAR_FERIADO:          { label: 'Criou feriado',          cor: 'green' },
  DESATIVAR_FERIADO:      { label: 'Removeu feriado',        cor: 'red' },
  EDITAR_TEMPLATE_LEMBRETE: { label: 'Editou lembrete',      cor: 'blue' },
  EDITAR_TEMPLATE_CONFIRMACAO: { label: 'Editou confirmação', cor: 'blue' },

  // Auditoria
  EXPORTAR_RELATORIO_AUDITORIA: { label: 'Exportou relatório de auditoria', cor: 'purple' },

  // Perfil Clínico
  EDITAR_PERFIL_CLINICO:  { label: 'Editou perfil clínico',  cor: 'blue' },

  // Estoque
  CRIAR_ITEM_ESTOQUE:     { label: 'Criou item de estoque',  cor: 'green' },
  EDITAR_ITEM_ESTOQUE:    { label: 'Editou item de estoque', cor: 'blue' },
  DESATIVAR_ITEM_ESTOQUE: { label: 'Desativou item de estoque', cor: 'red' },
  CRIAR_LOTE_ESTOQUE:     { label: 'Criou lote de estoque',  cor: 'green' },
  CRIAR_MOVIMENTACAO_ESTOQUE: { label: 'Movimentou estoque', cor: 'blue' },

  // Assinatura Externa (link/OTP)
  GERAR_ENVIO_ASSINATURA_EXTERNA: { label: 'Gerou link de assinatura', cor: 'green' },
  VALIDAR_OTP_ASSINATURA_EXTERNA: { label: 'Validou código OTP',   cor: 'blue' },
  ASSINAR_TERMO_EXTERNO:  { label: 'Assinou termo (externo)',  cor: 'purple' },

  // Agenda
  CONFIRMAR_AGENDA:       { label: 'Confirmou agendamento',   cor: 'blue' },
  REALIZAR_AGENDA:        { label: 'Marcou agendamento como realizado', cor: 'purple' },

  // Termo de Assinatura
  VINCULAR_PROCEDIMENTO_TERMO_ASSINATURA: { label: 'Vinculou termo a procedimento', cor: 'blue' },

  // Anamnese
  REORDENAR_ALTERNATIVAS_ANAMNESE: { label: 'Reordenou alternativas', cor: 'blue' },
  ADICIONAR_ALTERNATIVAS_ANAMNESE: { label: 'Adicionou alternativas', cor: 'green' },
  ATUALIZAR_OBSERVACOES_ANAMNESE:  { label: 'Editou observações da anamnese', cor: 'blue' },
};

export const BADGE_CORES = {
  green:  'bg-emerald-50 border-emerald-100 text-emerald-700',
  blue:   'bg-blue-50 border-blue-100 text-blue-700',
  red:    'bg-rose-50 border-rose-100 text-rose-700',
  purple: 'bg-indigo-50 border-indigo-100 text-indigo-700',
};

export function formatarEntidade(ent) {
  if (!ent) return '-';
  const normalized = ent.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalized === 'clinica') return 'Clínica';
  return ent
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatData(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getIconForEntidade(ent) {
  switch (ent?.toLowerCase()) {
    case 'paciente':     return <User className="h-3.5 w-3.5" />;
    case 'agenda':       return <Calendar className="h-3.5 w-3.5" />;
    case 'agendamento':  return <Calendar className="h-3.5 w-3.5" />;
    case 'procedimento': return <Activity className="h-3.5 w-3.5" />;
    default:             return <FileText className="h-3.5 w-3.5" />;
  }
}
