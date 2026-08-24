import React from 'react';
import DOMPurify from 'dompurify';
import { Shield } from 'lucide-react';
import { replaceTermVariables } from '../../utils/replaceTermVariables';
import 'react-quill-new/dist/quill.snow.css';

export function TermoVisualizacao({
  titulo,
  conteudo,
  pacienteCtx,
  profissionalCtx,
  clinicaCtx,
  procedimentoCtx,
  nomeProcedimento,
  procedimentos,
  children,
}) {
  const tituloExibicao = titulo || 'Termo de Consentimento LGPD';

  // Fallbacks para quando os contextos não são passados (ex: preview do manager)
  const clinica = clinicaCtx || {};
  const prof = profissionalCtx || {};
  const pac = pacienteCtx || {};

  const nomeClinica = clinica.nome || '[Nome da Clínica]';
  const enderecoClinica = clinica.endereco || '[Endereço da Clínica]';
  const contatoClinica = clinica.telefone || '[Telefone da Clínica]';

  const nomeProfissional = prof.nome || '[Nome do Profissional]';
  const cpfCrmProfissional = prof.cpf || prof.crm || '[CPF/CRM do Profissional]';

  const nomePaciente = pac.nome || pac.nomeCompleto || '[Nome do Paciente]';
  const cpfPaciente = pac.cpf || '[CPF do Paciente]';
  const contatoPaciente = pac.telefone || '[Telefone do Paciente]';

  let conteudoTexto = String(conteudo || '').trim();

  // Substitui os placeholders pelos dados reais do contexto usando o utility centralizado
  conteudoTexto = replaceTermVariables(conteudoTexto, {
    pac,
    clinica,
    prof,
    procedimento: procedimentoCtx || nomeProcedimento,
    nomeProcedimento,
    procedimentos,
  });

  const conteudoSanitizado = DOMPurify.sanitize(conteudoTexto, {
    ADD_ATTR: ['class'],
  });

  const temConteudoTexto = conteudoSanitizado.length > 0;

  return (
    <div className="termo-folha termo-folha--view mx-auto overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-xl ring-1 ring-slate-900/5">
      {/* Cabeçalho de Qualificação (Teal Banner) */}
      <div className="flex flex-col gap-3 bg-[#00a88e] px-6 py-4 sm:flex-row sm:items-center">
        <div className="flex shrink-0 items-center justify-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/25 bg-white/15 text-white shadow-sm">
            <Shield className="h-6 w-6" strokeWidth={2.2} />
          </div>
        </div>

        <div className="flex flex-col gap-1 text-white">
          <div className="text-[12px] leading-snug">
            <span className="font-bold text-emerald-100 mr-1.5">CLÍNICA:</span>
            {nomeClinica} — {enderecoClinica} — Contato: {contatoClinica}
          </div>
          <div className="text-[12px] leading-snug">
            <span className="font-bold text-emerald-100 mr-1.5">PROFISSIONAL:</span>
            {nomeProfissional} — Registro/CPF: {cpfCrmProfissional}
          </div>
          <div className="text-[12px] leading-snug">
            <span className="font-bold text-emerald-100 mr-1.5">PACIENTE:</span>
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
      <div className="px-8 py-8 sm:px-14 sm:py-10 text-[14px] text-[#1e293b]">
        {temConteudoTexto ? (
          <div className="ql-snow">
            <div
              className="ql-editor !p-0 !min-h-0 text-[14px] leading-relaxed text-[#1e293b]"
              style={{
                wordBreak: 'normal',
                overflowWrap: 'break-word',
                hyphens: 'manual',
                whiteSpace: 'normal',
              }}
              dangerouslySetInnerHTML={{ __html: conteudoSanitizado }}
            />
          </div>
        ) : (
          <div className="space-y-3 text-[14px] leading-relaxed text-[#334155]">
            <p>
              Autorizo o tratamento de meus dados pessoais conforme a LGPD (Lei 13.709/2018), incluindo a coleta,
              armazenamento e uso de informações de saúde estritamente para a finalidade de realização dos procedimentos
              estéticos.
            </p>
            <p>
              Declaro que forneci informações verdadeiras sobre meu histórico médico e assumo a responsabilidade por
              omitir qualquer condição de saúde que possa interferir no procedimento.
            </p>
          </div>
        )}
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
