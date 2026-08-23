import React, { useEffect, useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import { Download, FileText, FlaskConical, Loader2, ChevronDown, ChevronUp, Stethoscope, ShieldCheck, ShieldX } from 'lucide-react';
import { resolveApiUrl } from '../../../config/apiEnv';
import { getFreshToken } from '../../../services/api';
import { useToast } from '../../../contexts/useToast';
import { useOrg } from '../../../contexts/OrgContext';
import { generateTermoPdf } from '../../../utils/pdfGenerator';
import { replaceTermVariables } from '../../../utils/replaceTermVariables';
import { buildPacienteCtx } from '../../../utils/pacienteCtx';
import { TermoIntegridadeSelo } from '../../termos/TermoIntegridadeSelo.jsx';
import { SolicitacaoExamesModal } from './SolicitacaoExamesModal.jsx';
import 'react-quill-new/dist/quill.snow.css';

/** Retorna { expirado, data } a partir de vigencia/expiradaEm, ou null se vigente indefinidamente. */
function resolverStatusExpiracao(doc) {
  if (typeof doc.vigente === 'boolean' && doc.vigente && !doc.expiradaEm) return null;
  if (!doc.expiradaEm && doc.vigente !== false) return null;
  if (!doc.expiradaEm) return { expirado: true, data: null };
  const data = new Date(doc.expiradaEm);
  if (Number.isNaN(data.getTime())) return null;
  return { expirado: data.getTime() <= Date.now(), data };
}

function isRecusado(doc) {
  return doc?.statusCodigo === 'RECUSADO' || Boolean(doc?.recusadoEm);
}

export function DocumentosAssinadosTab({ pacienteId, paciente, clinicaInfo, perfilInfo }) {
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { orgId } = useOrg();
  const toast = useToast();
  const [expandedDocId, setExpandedDocId] = useState(null);
  const [examesModalOpen, setExamesModalOpen] = useState(false);

  useEffect(() => {
    if (!pacienteId || !orgId) return;

    let mounted = true;
    const fetchDocs = async () => {
      try {
        setLoading(true);
        const token = await getFreshToken();
        const res = await fetch(resolveApiUrl(`/api/v1/pacientes/${pacienteId}/documentos-assinados`), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Org-Id': orgId
          }
        });
        
        if (!res.ok) {
          throw new Error('Falha ao carregar documentos assinados.');
        }

        const data = await res.json();
        if (mounted) setDocumentos(data);
      } catch (err) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchDocs();
    return () => { mounted = false; };
  }, [pacienteId, orgId]);

  const pacienteCtx = useMemo(() => buildPacienteCtx(paciente), [paciente]);
  const clinicaCtx = useMemo(() => ({
    nome: clinicaInfo?.nome,
    cnpj: clinicaInfo?.cnpj,
    endereco: clinicaInfo?.endereco,
    telefone: clinicaInfo?.telefone,
  }), [clinicaInfo]);
  const profissionalCtx = useMemo(() => ({
    nome: perfilInfo?.nomeCompleto,
    cpf: perfilInfo?.cpf || perfilInfo?.crm,
    telefone: perfilInfo?.telefone,
  }), [perfilInfo]);

  const handleDownloadPdf = (doc) => {
    if (!doc.conteudoSnapshot) {
      toast.error('O conteúdo deste documento não está disponível para download.');
      return;
    }

    try {
      generateTermoPdf({
        titulo: doc.titulo || 'Documento',
        conteudo: doc.conteudoSnapshot,
        assinaturaPaciente: doc.assinaturaBase64,
        assinaturaProfissional: doc.assinaturaProfissionalBase64,
        metadados: {
          pacienteNome: paciente?.nomeCompleto || paciente?.nome || 'Paciente',
          dataHora: doc.dataAssinatura ? new Date(doc.dataAssinatura).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR'),
          recusado: isRecusado(doc),
          statusCodigo: doc.statusCodigo,
          recusadoEm: doc.recusadoEm
            ? new Date(doc.recusadoEm).toLocaleString('pt-BR')
            : undefined,
        },
        fileName: `documento_${doc.titulo ? doc.titulo.replace(/\s+/g, '_').toLowerCase() : 'assinado'}_${new Date().getTime()}.pdf`,
        pacienteCtx,
        clinicaCtx,
        profissionalCtx,
      });
    } catch {
      toast.error('Erro ao gerar o arquivo PDF.');
    }
  };

  const header = (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={() => setExamesModalOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-[#e2e8f0] px-3 py-2 text-xs font-semibold text-[#334155] hover:bg-slate-50"
      >
        <FlaskConical className="h-4 w-4 text-[#00a88e]" />
        Solicitar Exames
      </button>
      <SolicitacaoExamesModal
        open={examesModalOpen}
        onClose={() => setExamesModalOpen(false)}
        clinicaCtx={clinicaCtx}
        pacienteCtx={pacienteCtx}
        profissionalCtx={profissionalCtx}
      />
    </div>
  );

  if (loading) {
    return (
      <>
        {header}
        <div className="flex justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        {header}
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 mt-4 text-center">
          {error}
        </div>
      </>
    );
  }

  if (documentos.length === 0) {
    return (
      <>
        {header}
        <div className="bg-slate-50 text-slate-500 p-8 rounded-xl border border-slate-200 mt-4 text-center">
          <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="font-medium">Nenhum documento assinado encontrado</p>
          <p className="text-sm mt-1">Quando o paciente assinar termos, eles aparecerão aqui.</p>
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="mt-4 space-y-4">
      {documentos.map((doc) => {
        const isExpanded = expandedDocId === doc.id;
        return (
          <div key={doc.id} className="bg-white border border-slate-200 rounded-xl shadow-sm transition-all overflow-hidden">
            <div 
              className="p-4 flex flex-col md:flex-row gap-4 items-start md:items-center cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setExpandedDocId(isExpanded ? null : doc.id)}
            >
              <div className="w-12 h-12 bg-teal-50 rounded-lg flex items-center justify-center shrink-0">
                <FileText className="w-6 h-6 text-teal-600" />
              </div>
              
              <div className="flex-1">
                <h4 className="font-semibold text-slate-800 text-sm md:text-base">{doc.titulo}</h4>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-slate-500">
                  <span className="font-medium bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                    Termo
                  </span>
                  <span>
                    Assinado em:{' '}
                    {new Date(doc.dataAssinatura).toLocaleDateString('pt-BR', {
                      timeZone: 'America/Sao_Paulo',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                  {doc.ipOrigem && (
                    <span className="text-slate-400">
                      IP: {doc.ipOrigem}
                    </span>
                  )}
                </div>

                {doc.procedimentosVinculados && doc.procedimentosVinculados.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {doc.procedimentosVinculados.map((p) => (
                      <span
                        key={p.catalogoProcedimentoSaudeId}
                        className="inline-flex items-center gap-1.5 rounded-md bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700 border border-teal-100"
                      >
                        <Stethoscope className="w-3.5 h-3.5" />
                        {p.nomeProcedimento}
                      </span>
                    ))}
                  </div>
                )}

                {!isRecusado(doc) && (() => {
                  const statusExp = resolverStatusExpiracao(doc);
                  const dataStr = statusExp?.data?.toLocaleDateString('pt-BR');
                  return (
                    <div
                      className={`mt-1.5 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold border ${
                        statusExp?.expirado
                          ? 'bg-slate-100 text-slate-500 border-slate-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {statusExp?.expirado ? (
                        <>
                          <ShieldX className="w-3.5 h-3.5" />
                          Expirado em {dataStr}
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {statusExp ? `Ativo até ${dataStr}` : 'Ativo'}
                        </>
                      )}
                    </div>
                  );
                })()}

                {isRecusado(doc) && (
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 border border-red-200">
                    RECUSADO PELO PACIENTE
                  </div>
                )}
              </div>

              <div className="shrink-0 flex items-center gap-3">
                {doc.assinaturaBase64 && !isRecusado(doc) && (
                  <div className="border-r border-slate-200 pr-4 py-1">
                    <img 
                      src={doc.assinaturaBase64} 
                      alt="Assinatura" 
                      className="h-10 object-contain max-w-[100px] filter contrast-125 grayscale" 
                      title="Assinatura do Paciente"
                    />
                  </div>
                )}
                
                {doc.selfieUrl && !isRecusado(doc) && (
                  <div className="border-r border-slate-200 pr-4 py-1 flex items-center justify-center">
                    <img 
                      src={doc.selfieUrl} 
                      alt="Selfie de validação" 
                      className="h-10 w-10 object-cover rounded-full border-2 border-slate-200" 
                      title="Foto tirada pelo paciente no momento da assinatura"
                    />
                  </div>
                )}
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadPdf(doc);
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden md:inline">Baixar PDF</span>
                </button>

                <div className="text-slate-400 ml-2">
                  {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </div>
            </div>

            {isExpanded && (
              <div className="border-t border-slate-100 bg-slate-50/50 p-4 animate-in fade-in slide-in-from-top-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2">
                    <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Conteúdo do Documento</h5>
                    <div className="bg-white border border-slate-200 rounded-lg max-h-[400px] overflow-y-auto text-sm text-slate-700 custom-scrollbar shadow-inner ql-snow">
                      <div className="ql-editor p-4" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(replaceTermVariables(doc.conteudoSnapshot, { pac: pacienteCtx, clinica: clinicaCtx, prof: profissionalCtx }) || '<p>Conteúdo indisponível</p>') }} />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Dados da Assinatura</h5>
                      <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-2">
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-400">Data/Hora:</span>
                          <span className="font-medium">{new Date(doc.dataAssinatura).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-400">Endereço IP:</span>
                          <span className="font-medium">{doc.ipOrigem || 'Não registrado'}</span>
                        </div>
                        {doc.procedimentosVinculados && doc.procedimentosVinculados.length > 0 && (
                          <div className="flex justify-between border-b border-slate-100 pb-2">
                            <span className="text-slate-400">Procedimentos:</span>
                            <span className="font-medium text-right">
                              {doc.procedimentosVinculados.map((p) => p.nomeProcedimento).join(', ')}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-slate-400">Status:</span>
                          <span className={`font-medium ${isRecusado(doc) ? 'text-red-600' : 'text-teal-600'}`}>
                            {isRecusado(doc) ? 'Recusado' : 'Assinado'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {!isRecusado(doc) && doc.id ? (
                      <TermoIntegridadeSelo
                        assinaturaId={doc.id}
                        conteudoHash={doc.conteudoHash}
                      />
                    ) : null}

                    {!isRecusado(doc) && doc.selfieUrl && (
                      <div>
                        <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Foto de Validação</h5>
                        <div className="bg-white border border-slate-200 rounded-lg p-3 flex justify-center">
                          <img 
                            src={doc.selfieUrl} 
                            alt="Selfie ampliada" 
                            className="max-h-[150px] object-cover rounded-lg border border-slate-200 shadow-sm" 
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
      </div>
    </>
  );
}
