import React, { useMemo } from 'react';
import ReactQuill from 'react-quill-new';
import DOMPurify from 'dompurify';
import { Shield } from 'lucide-react';
import { replaceTermVariables } from '../../utils/replaceTermVariables';
import 'react-quill-new/dist/quill.snow.css';

const TOOLBAR_ID = 'termo-folha-toolbar';

// Memoização module-level: referências estáveis entre renders (Quill re-inicializa se modules mudar).
const EDIT_MODULES = { toolbar: { container: `#${TOOLBAR_ID}` } };
const VIEW_MODULES = { toolbar: false };

/**
 * Folha A4 unificada dos termos (view/edit). A folha é o wrapper React
 * (.termo-folha); o Quill é apenas a área de texto dentro dela. Banner teal
 * e faixa de título ficam DENTRO do papel (papel timbrado). A única
 * diferença entre modos é a toolbar + editabilidade.
 *
 * No edit a toolbar fica FORA do canvas cinza (barra própria acima), mas
 * continua dentro deste componente para remontar junto com o Quill (key) —
 * evita pickers duplicados. `quillRef` expõe o ReactQuill ao pai (insert no cursor).
 */
export function TermoFolha({
  editavel = false,
  titulo,
  conteudo,
  onChangeConteudo,
  onChangeTitulo,
  tituloError = false,
  pacienteCtx,
  clinicaCtx,
  profissionalCtx,
  procedimentoCtx,
  nomeProcedimento,
  procedimentos,
  quillRef,
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

  const nomePaciente = pac.nome || '[Nome do Paciente]';
  const cpfPaciente = pac.cpf || '[CPF do Paciente]';
  const contatoPaciente = pac.telefone || '[Telefone do Paciente]';

  // View: placeholders substituídos + sanitização. Edit: conteúdo cru (placeholders visíveis).
  const conteudoView = useMemo(() => {
    if (editavel) return '';
    const substituido = replaceTermVariables(String(conteudo || '').trim(), {
      pac: pacienteCtx || {},
      clinica: clinicaCtx || {},
      prof: profissionalCtx || {},
      procedimento: procedimentoCtx || nomeProcedimento,
      nomeProcedimento,
      procedimentos,
    });
    return DOMPurify.sanitize(substituido, { ADD_ATTR: ['class'] });
  }, [editavel, conteudo, pacienteCtx, clinicaCtx, profissionalCtx, procedimentoCtx, nomeProcedimento, procedimentos]);

  const valorExibido = editavel ? conteudo : conteudoView;

  const folha = (
    <div className={editavel ? 'termo-folha termo-folha--edit' : 'termo-folha'}>
        {/* Cabeçalho de Qualificação (Teal Banner) — dentro do papel, full-bleed */}
        <div className="flex flex-col gap-3 bg-[#00a88e] px-5 py-3 sm:flex-row sm:items-center">
          <div className="flex shrink-0 items-center justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white shadow-sm">
              <Shield className="h-5 w-5" strokeWidth={2.5} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 text-white">
            <div className="text-[11px] leading-snug">
              <span className="mr-1 font-bold text-emerald-100">CLÍNICA:</span>
              {nomeClinica} — {enderecoClinica} — Contato: {contatoClinica}
            </div>
            <div className="text-[11px] leading-snug">
              <span className="mr-1 font-bold text-emerald-100">PROFISSIONAL:</span>
              {nomeProfissional} — Registro/CPF: {cpfCrmProfissional}
            </div>
            <div className="text-[11px] leading-snug">
              <span className="mr-1 font-bold text-emerald-100">PACIENTE:</span>
              {nomePaciente} — CPF: {cpfPaciente} — Contato: {contatoPaciente}
            </div>
          </div>
        </div>

        {/* Faixa de título — dentro do papel (input editável no edit, texto puro no view) */}
        <div
          className={`bg-[#f0fdfa] px-6 py-4 text-center ${
            editavel && tituloError
              ? 'border-b-2 border-[#dc2626]'
              : 'border-b border-[#e2e8f0]'
          }`}
        >
          {editavel ? (
            <input
              type="text"
              value={titulo ?? ''}
              onChange={(e) => onChangeTitulo?.(e.target.value)}
              placeholder="Ex: Termo de Consentimento — Toxina Botulínica"
              aria-label="Nome do termo"
              className="w-full border-none bg-transparent text-center text-[16px] font-bold uppercase tracking-wide text-[#0f172a] outline-none placeholder:font-normal placeholder:normal-case placeholder:text-[#94a3b8]"
            />
          ) : (
            <h3 className="text-[16px] font-bold uppercase tracking-wide text-[#0f172a]">
              {tituloExibicao}
            </h3>
          )}
        </div>
        {editavel && tituloError ? (
          <p className="bg-[#f0fdfa] px-6 pb-2 text-center text-[12px] text-[#dc2626]">
            Título obrigatório
          </p>
        ) : null}

        <ReactQuill
          key={editavel ? 'edit' : 'view'}
          ref={editavel ? quillRef : undefined}
          theme="snow"
          readOnly={!editavel}
          modules={editavel ? EDIT_MODULES : VIEW_MODULES}
          value={valorExibido}
          onChange={editavel ? onChangeConteudo : undefined}
          bounds=".termo-folha"
        />
      </div>
  );

  if (!editavel) {
    return <div className="a4-canvas a4-canvas--static">{folha}</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div id={TOOLBAR_ID}>
        <span className="ql-formats">
          <select className="ql-header" defaultValue="">
            <option value="1" />
            <option value="2" />
            <option value="3" />
            <option value="4" />
            <option value="5" />
            <option value="6" />
            <option value="" />
          </select>
        </span>
        <span className="ql-formats">
          <button type="button" className="ql-bold" aria-label="Negrito" />
          <button type="button" className="ql-italic" aria-label="Itálico" />
          <button type="button" className="ql-underline" aria-label="Sublinhado" />
          <button type="button" className="ql-strike" aria-label="Tachado" />
        </span>
        <span className="ql-formats">
          <select className="ql-align" defaultValue="">
            <option value="" />
            <option value="center" />
            <option value="right" />
            <option value="justify" />
          </select>
        </span>
        <span className="ql-formats">
          <button type="button" className="ql-list" value="ordered" aria-label="Lista numerada" />
          <button type="button" className="ql-list" value="bullet" aria-label="Lista com marcadores" />
        </span>
        <span className="ql-formats">
          <button type="button" className="ql-blockquote" aria-label="Citação" />
          <button type="button" className="ql-link" aria-label="Link" />
        </span>
        <span className="ql-formats">
          <button type="button" className="ql-clean" aria-label="Limpar formatação" />
        </span>
      </div>
      <div className="a4-canvas a4-canvas--scroll min-h-0 flex-1">{folha}</div>
    </div>
  );
}
