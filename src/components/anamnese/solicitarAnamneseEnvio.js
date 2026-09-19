export function montarUrlWhatsAppAnamnese({ telefonePaciente, pacienteCpf, pacienteNome, urlPublica }) {
  const phone = (telefonePaciente || '').replace(/\D/g, '');
  const finalPhone = phone.startsWith('55') ? phone : `55${phone}`;
  const cpf = (pacienteCpf || '').replace(/\D/g, '');
  let link = urlPublica || '';
  if (cpf && link && !link.includes('cpf=')) {
    link += (link.includes('?') ? '&' : '?') + `cpf=${cpf}`;
  }
  const nome = pacienteNome || 'Paciente';
  const text = `Olá ${nome}, segue o link da sua ficha de anamnese: ${link}\n\nPor favor, preencha a ficha antes da sua consulta.`;
  return `https://wa.me/${finalPhone}?text=${encodeURIComponent(text)}`;
}
