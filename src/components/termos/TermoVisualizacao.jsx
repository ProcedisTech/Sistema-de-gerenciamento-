import React from 'react';
import { Shield } from 'lucide-react';

export function TermoVisualizacao({ titulo, conteudo, pacienteCtx, profissionalCtx, clinicaCtx, children }) {
  const tituloExibicao = titulo || 'Termo de Consentimento LGPD';

  // Se não houver texto, mostramos o texto padrão da LGPD
  const conteudoTexto = String(conteudo || '').trim();
  const temConteudoTexto = conteudoTexto.length > 0;

  // Fallbacks para quando os contextos não são passados (ex: preview do manager)
  const clinica = clinicaCtx || {};
  const prof = profissionalCtx || {};
  const pac = pacienteCtx || {};

  const nomeClinica = clinica.nome || '[Nome da Clínica]';
  const enderecoClinica = clinica.endereco || '[Endereço da Clínica]';
  const contatoClinica = clinica.telefone || '[Telefone da Clínica]';

  const nomeProfissional = prof.nome || '[Nome do Profissional]';
  const cpfCrmProfissional = prof.cpf || prof.crm || '[CPF/CRM do Profissional]';

  const nomePaciente = pac.nome || '[Nome do Paciente]';
  const cpfPaciente = pac.cpf || '[CPF do Paciente]';
  const contatoPaciente = pac.telefone || '[Telefone do Paciente]';

  return (
    <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm ring-1 ring-[#e2e8f0]">
      {/* Cabeçalho de Qualificação (Teal Banner) */}
      <div className="flex flex-col gap-3 bg-[#00a88e] px-5 py-3 sm:flex-row sm:items-center">
        <div className="flex shrink-0 items-center justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white shadow-sm">
            <Shield className="h-5 w-5" strokeWidth={2.5} />
          </div>
        </div>
        
        <div className="flex flex-col gap-1.5 text-white">
          <div className="text-[11px] leading-snug">
            <span className="font-bold text-emerald-100 mr-1">CLÍNICA:</span>
            {nomeClinica} — {enderecoClinica} — Contato: {contatoClinica}
          </div>
          <div className="text-[11px] leading-snug">
            <span className="font-bold text-emerald-100 mr-1">PROFISSIONAL:</span>
            {nomeProfissional} — Registro/CPF: {cpfCrmProfissional}
          </div>
          <div className="text-[11px] leading-snug">
            <span className="font-bold text-emerald-100 mr-1">PACIENTE:</span>
            {nomePaciente} — CPF: {cpfPaciente} — Contato: {contatoPaciente}
          </div>
        </div>
      </div>
      
      {/* Titulo */}
      <div className="border-b border-[#e2e8f0] bg-[#f0fdfa] px-6 py-4 text-center">
        <h3 className="text-[16px] font-bold tracking-wide text-[#0f172a] uppercase">
          {tituloExibicao}
        </h3>
      </div>
      {/* Corpo do Documento */}
      <div className="bg-[#f8fafc] p-6">
        <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-slate-200">
          {temConteudoTexto ? (
            <div className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[#334155]">
              {conteudoTexto}
            </div>
          ) : (
            <>
              <p className="mb-3 text-[14px] leading-relaxed text-[#334155]">
                Autorizo o tratamento de meus dados pessoais conforme a LGPD (Lei 13.709/2018), incluindo a coleta,
                armazenamento e uso de informações de saúde estritamente para a finalidade de realização dos procedimentos
                estéticos.
              </p>
              <p className="text-[14px] leading-relaxed text-[#334155]">
                Declaro que forneci informações verdadeiras sobre meu histórico médico e assumo a responsabilidade por
                omitir qualquer condição de saúde que possa interferir no procedimento.
              </p>
            </>
          )}
        </div>
      </div>
      
      {/* Área inferior para assinaturas e botões (se passada como children) */}
      {children && (
        <div className="border-t border-[#e2e8f0] bg-slate-50 p-6 sm:p-8">
          {children}
        </div>
      )}
    </div>
  );
}
