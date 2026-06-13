import React, { useEffect, useState } from 'react';
import { Download, FileText, Loader2, Link } from 'lucide-react';
import { resolveApiUrl } from '../../../config/apiEnv';
import { getAccessToken } from '../../../services/api';
import { useToast } from '../../../contexts/useToast';
import { useOrg } from '../../../contexts/OrgContext';

export function DocumentosAssinadosTab({ pacienteId, onOpenDocumentoModal, paciente, clinicaInfo, perfilInfo }) {
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { orgId } = useOrg();
  const toast = useToast();

  useEffect(() => {
    if (!pacienteId || !orgId) return;

    let mounted = true;
    const fetchDocs = async () => {
      try {
        setLoading(true);
        const token = getAccessToken();
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

  const handleDownloadPdf = (doc) => {
    if (!doc.conteudoSnapshot) {
      toast.error('O conteúdo deste documento não está disponível para download.');
      return;
    }
    
    import('../../../utils/pdfGenerator.js').then(({ generateTermoPdf }) => {
      generateTermoPdf({
        titulo: doc.titulo || 'Documento',
        conteudo: doc.conteudoSnapshot,
        assinaturaPaciente: doc.assinaturaBase64,
        assinaturaProfissional: doc.assinaturaProfissionalBase64,
        metadados: {
          pacienteNome: paciente?.nomeCompleto || paciente?.nome || 'Paciente',
          dataHora: doc.dataAssinatura ? new Date(doc.dataAssinatura).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR'),
          recusado: doc.recusado,
        },
        fileName: `documento_${doc.titulo ? doc.titulo.replace(/\s+/g, '_').toLowerCase() : 'assinado'}_${new Date().getTime()}.pdf`,
        pacienteCtx: {
          nome: paciente?.nomeCompleto || paciente?.nome,
          cpf: paciente?.cpf,
          telefone: paciente?.telefone || paciente?.phone || paciente?.telefoneNumero || paciente?.telefonePrincipal
        },
        clinicaCtx: {
          nome: clinicaInfo?.nome,
          cnpj: clinicaInfo?.cnpj,
          endereco: clinicaInfo?.endereco,
          telefone: clinicaInfo?.telefone,
        },
        profissionalCtx: {
          nome: perfilInfo?.nomeCompleto,
          cpf: perfilInfo?.cpf || perfilInfo?.crm,
          telefone: perfilInfo?.telefone,
        }
      });
    }).catch(() => {
      toast.error('Erro ao gerar o arquivo PDF.');
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 mt-4 text-center">
        {error}
      </div>
    );
  }

  if (documentos.length === 0) {
    return (
      <div className="bg-slate-50 text-slate-500 p-8 rounded-xl border border-slate-200 mt-4 text-center">
        <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
        <p className="font-medium">Nenhum documento assinado encontrado</p>
        <p className="text-sm mt-1">Quando o paciente assinar documentos públicos, eles aparecerão aqui.</p>
        <button
          type="button"
          onClick={onOpenDocumentoModal}
          className="mt-4 mx-auto inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white font-semibold text-sm rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Link className="w-4 h-4" />
          Solicitar Nova Assinatura
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Botão de Solicitar Nova Assinatura no topo */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onOpenDocumentoModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white font-semibold text-sm rounded-lg hover:bg-teal-700 transition-colors shadow-sm"
        >
          <Link className="w-4 h-4" />
          Solicitar Nova Assinatura
        </button>
      </div>

      {documentos.map((doc) => (
        <div key={doc.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="w-12 h-12 bg-teal-50 rounded-lg flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6 text-teal-600" />
          </div>
          
          <div className="flex-1">
            <h4 className="font-semibold text-slate-800 text-sm md:text-base">{doc.titulo}</h4>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-slate-500">
              <span className="font-medium bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                {doc.tipoDocumento === 'TERMO' ? 'Termo' : 'Procedimento'}
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
            
            {doc.recusado && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 border border-red-200">
                RECUSADO PELO PACIENTE
              </div>
            )}
          </div>

          <div className="shrink-0 flex items-center gap-3">
            {doc.assinaturaBase64 && !doc.recusado && (
              <div className="border-r border-slate-200 pr-4 py-1">
                <img 
                  src={doc.assinaturaBase64} 
                  alt="Assinatura" 
                  className="h-10 object-contain max-w-[100px] filter contrast-125 grayscale" 
                  title="Assinatura do Paciente"
                />
              </div>
            )}
            
            <button
              onClick={() => handleDownloadPdf(doc)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="hidden md:inline">Baixar PDF</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
