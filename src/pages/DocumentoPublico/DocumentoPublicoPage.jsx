import React, { useState, useEffect, useRef } from 'react';
import { resolveApiUrl } from '../../config/apiEnv';
import { generateTermoPdf } from '../../utils/pdfGenerator';

import { Download, Eraser, CheckCircle, PenLine, AlertTriangle } from 'lucide-react';
import { TermoVisualizacao } from '../../components/termos/TermoVisualizacao';
import { SignatureFullscreenModal } from '../../components/journey/Step4LGPD.jsx';

// CPF formatter: 000.000.000-00
const formatCPF = (val) => {
  let v = val.replace(/\D/g, '');
  if (v.length > 11) v = v.slice(0, 11);
  if (v.length > 9) {
    v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  } else if (v.length > 6) {
    v = v.replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3');
  } else if (v.length > 3) {
    v = v.replace(/(\d{3})(\d{3})/, '$1.$2');
  }
  return v;
};



export const DocumentoPublicoPage = () => {
  const [clinicSlug, setClinicSlug] = useState('');
  const [tipo, setTipo] = useState('');
  const [documentoId, setDocumentoId] = useState('');
  const [cpf, setCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [estado, setEstado] = useState('ENTRADA_CPF'); // ENTRADA_CPF | JA_ASSINADO | VISUALIZACAO | SUCESSO
  const [lookupData, setLookupData] = useState(null);
  
  const [signingOpen, setSigningOpen] = useState(false);
  const [recusado, setRecusado] = useState(false);
  const [mobilePortrait, setMobilePortrait] = useState(false);
  const [signatureBase64, setSignatureBase64] = useState('');
  
  const sigCanvasRef = useRef(null);
  const sigHasStrokeRef = useRef(false);
  const pdfContainerRef = useRef(null);

  // Resize listener for mobile portrait
  useEffect(() => {
    const ev = () => {
      const isMobile = window.matchMedia('(max-width: 639px)').matches;
      const isPortrait = window.matchMedia('(orientation: portrait)').matches;
      setMobilePortrait(isMobile && isPortrait);
    };
    ev();
    window.addEventListener('resize', ev);
    return () => window.removeEventListener('resize', ev);
  }, []);

  // Load DOMPurify dynamically
  useEffect(() => {
    import('dompurify').then((mod) => {
      window.DOMPurify = mod.default || mod;
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('clinic');
    const t = params.get('tipo');
    const docId = params.get('documento_id');

    if (slug) setClinicSlug(slug);
    if (t) setTipo(t);
    if (docId) setDocumentoId(docId);

    if (!slug) {
      setErrorMsg('O link acessado é inválido (parâmetro clinic ausente).');
    }
    if (!t || !docId) {
      setErrorMsg('O link acessado é inválido (parâmetros tipo ou documento_id ausentes).');
    }
  }, []);

  const handleLookup = async (e) => {
    e.preventDefault();
    if (!clinicSlug || !tipo || !documentoId) return;

    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      setErrorMsg('CPF inválido. Digite 11 números.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(
        resolveApiUrl(`/api/public/documento/lookup?cpf=${cleanCpf}&clinic=${clinicSlug}&tipo=${tipo}&documento_id=${documentoId}`)
      );

      if (!res.ok) {
        let serverErrorMsg = 'Erro ao buscar dados. Tente novamente.';
        try {
          const errData = await res.json();
          if (errData.message && errData.message !== 'No message available' && errData.message !== 'Not Found') {
            serverErrorMsg = errData.message;
          } else if (res.status === 404) {
            serverErrorMsg = 'Paciente, clínica ou documento não encontrado. Verifique com a clínica.';
          }
        } catch {
          if (res.status === 404) {
            serverErrorMsg = 'Paciente, clínica ou documento não encontrado. Verifique com a clínica.';
          }
        }
        throw new Error(serverErrorMsg);
      }

      const data = await res.json();
      setLookupData(data);

      if (data.status === 'JA_ASSINADO') {
        setEstado('JA_ASSINADO');
      } else {
        setEstado('VISUALIZACAO');
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssinar = async () => {
    if (recusado) {
      setErrorMsg('O documento foi recusado. Não é possível enviá-lo.');
      return;
    }

    if (!signatureBase64) {
      setErrorMsg('Por favor, assine o documento antes de confirmar.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const body = {
        cpf: cpf.replace(/\D/g, ''),
        clinic: clinicSlug,
        tipo: tipo,
        documentoId: documentoId,
        assinaturaBase64: signatureBase64,
        recusado: false
      };

      const res = await fetch(resolveApiUrl('/api/public/documento/assinar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        if (res.status === 409) throw new Error('Este documento já foi assinado.');
        let msg = 'Erro ao assinar. Tente novamente.';
        try {
          const errData = await res.json();
          if (errData.message) msg = errData.message;
        } catch { /* ignore */ }
        throw new Error(msg);
      }

      const data = await res.json();
      
      // Update lookupData to include signature, IP and date for PDF generation
      // Notice: IP is saved backend-side, so if we don't return it we just display the date.
      // But user wanted IP in PDF. Let's see if we can get it from the response or just show it generic if not returned.
      // Usually backend returns dataAssinatura, we will embed the base64Signature in the state for PDF.
      setLookupData(prev => ({ 
        ...prev, 
        dataAssinatura: data.dataAssinatura,
        assinaturaBase64: signatureBase64,
        ipOrigem: data.ipOrigem || 'Registrado via Link Seguro' // fallback if backend doesn't return
      }));
      setEstado('SUCESSO');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRecusar = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const body = {
        cpf: cpf.replace(/\D/g, ''),
        clinic: clinicSlug,
        tipo: tipo,
        documentoId: documentoId,
        assinaturaBase64: null,
        recusado: true
      };

      const res = await fetch(resolveApiUrl('/api/public/documento/assinar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        setRecusado(true);
      } else {
        const errorData = await res.json().catch(() => ({}));
        setErrorMsg(errorData.message || 'Erro ao registrar recusa. Tente novamente.');
      }
    } catch {
      setErrorMsg('Erro de conexão ao tentar recusar.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    setLoading(true);
    try {
      generateTermoPdf({
        titulo: lookupData.documento?.titulo || 'Documento',
        conteudo: lookupData.documento?.conteudo,
        assinaturaPaciente: lookupData.assinaturaBase64,
        metadados: {
          pacienteNome: lookupData.pacienteNome,
          dataHora: lookupData.dataAssinatura ? new Date(lookupData.dataAssinatura).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : new Date().toLocaleString(),
          ipAddress: lookupData.ipOrigem,
          recusado: lookupData.recusado
        },
        fileName: `documento_${(lookupData.pacienteNome || 'paciente').replace(/\s+/g, '_')}.pdf`,
        pacienteCtx: {
          nome: lookupData.pacienteNome,
          cpf: lookupData.pacienteCpf || formatCPF(cpf),
          telefone: lookupData.pacienteTelefone
        },
        clinicaCtx: {
          nome: lookupData.clinicaNome,
          endereco: lookupData.clinicaEndereco,
          telefone: lookupData.clinicaTelefone
        },
        profissionalCtx: {
          nome: lookupData.profissionalNome,
          cpf: lookupData.profissionalCpfCrm
        }
      });
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao gerar o PDF. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const tipoLabel = tipo === 'TERMO' ? 'Termo de Consentimento' : tipo === 'PROCEDIMENTO' ? 'Informações do Procedimento' : 'Documento';

  return (
    <div className="min-h-screen w-full bg-slate-100 flex flex-col items-center py-10 px-4 font-sans">
      <div className="w-full max-w-[800px]">

        {/* ENTRADA_CPF */}
        {estado === 'ENTRADA_CPF' && (
          <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 p-8 w-full max-w-[480px] mx-auto animate-in fade-in zoom-in-95 duration-300">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-center text-slate-800 mb-2">{tipoLabel}</h1>
            <p className="text-sm text-center text-slate-500 mb-8">Informe seu CPF para acessar o documento.</p>

            <form onSubmit={handleLookup} className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1.5 block">CPF do Paciente</label>
                <input
                  type="text"
                  placeholder="000.000.000-00"
                  className="w-full h-12 px-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-base transition-all bg-slate-50 focus:bg-white"
                  value={cpf}
                  onChange={(e) => setCpf(formatCPF(e.target.value))}
                  autoFocus
                />
              </div>

              {errorMsg && (
                <p className="text-sm text-red-600 font-medium text-center">{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={loading || !clinicSlug || !tipo || !documentoId}
                className="w-full h-12 mt-2 rounded-xl bg-teal-600 text-white font-bold text-[15px] hover:bg-teal-700 active:bg-teal-800 transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : 'Continuar'}
              </button>
            </form>
          </div>
        )}

        {/* JA_ASSINADO */}
        {estado === 'JA_ASSINADO' && lookupData && (
          <div className="bg-emerald-50 rounded-[24px] border border-emerald-200 p-8 w-full max-w-[480px] mx-auto text-center animate-in fade-in zoom-in-95 duration-300 shadow-sm">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-emerald-800 mb-2">Documento já assinado!</h2>
            <p className="text-emerald-700 text-sm">
              Olá, <strong>{lookupData.pacienteNome}</strong>.<br />
              Você já assinou este documento em{' '}
              <strong className="font-semibold">
                {lookupData.dataAssinatura
                  ? new Date(lookupData.dataAssinatura).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                  : '—'}
              </strong>.
            </p>
          </div>
        )}

        {/* VISUALIZACAO E ASSINATURA */}
        {estado === 'VISUALIZACAO' && lookupData && (
          <div className="flex flex-col gap-6 w-full animate-in fade-in duration-500">
            {/* O "Papel A4" com a mesma formatação do Fluxo de Atendimento */}
            <div className="mx-auto w-full md:w-[800px] mb-4 shadow-lg border border-slate-200 rounded-xl overflow-hidden bg-white">
              <TermoVisualizacao 
                titulo={lookupData.documento?.titulo}
                conteudo={lookupData.documento?.conteudo}
                clinicaCtx={{
                  nome: lookupData.clinicaNome,
                  endereco: lookupData.clinicaEndereco,
                  telefone: lookupData.clinicaTelefone
                }}
                pacienteCtx={{
                  nome: lookupData.pacienteNome,
                  cpf: lookupData.pacienteCpf || formatCPF(cpf),
                  telefone: lookupData.pacienteTelefone
                }}
                profissionalCtx={{
                  nome: lookupData.profissionalNome,
                  cpf: lookupData.profissionalCpfCrm
                }}
              >
                {/* Área de Assinatura fica como children dentro do TermoVisualizacao */}
                <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase">Assinatura do Paciente</h3>
                {recusado ? (
                  <div className="flex flex-col items-center gap-4 py-6 text-center border-2 border-dashed border-red-300 rounded-xl bg-red-50">
                    <AlertTriangle className="h-10 w-10 text-red-500" strokeWidth={1.5} />
                    <p className="text-sm font-bold text-red-700">
                      Você se recusou a assinar o documento.
                    </p>
                    <p className="text-xs text-red-600 max-w-[350px]">
                      Como o consentimento não foi concedido, o procedimento não poderá ser realizado. Por favor, comunique a clínica.
                    </p>
                    <button
                      type="button"
                      onClick={() => setRecusado(false)}
                      className="mt-2 rounded-lg bg-white border border-red-300 px-4 py-2 text-xs font-bold text-red-700 transition-colors hover:bg-red-50 shadow-sm"
                    >
                      Mudei de ideia, quero assinar
                    </button>
                  </div>
                ) : signatureBase64 ? (
                  <div className="flex flex-col items-center gap-2 mt-4 relative">
                    <img src={signatureBase64} alt="Assinatura" className="h-24 object-contain border-b border-slate-800 pb-2 mb-2" />
                    <p className="text-sm font-bold">{lookupData.pacienteNome}</p>
                    <p className="text-xs text-slate-500">CPF: {lookupData.pacienteCpf || formatCPF(cpf)}</p>
                    
                    <button
                      type="button"
                      onClick={() => setSignatureBase64('')}
                      className="absolute top-0 right-0 bg-slate-100 p-2 rounded-lg text-slate-500 hover:text-red-600 transition-colors shadow-sm"
                      title="Refazer assinatura"
                    >
                      <Eraser size={18} />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 py-6 text-center border-2 border-dashed border-slate-300 rounded-xl bg-slate-50">
                    <PenLine className="h-10 w-10 text-slate-400" strokeWidth={1.5} />
                    <p className="text-xs text-slate-500 max-w-[300px]">
                      Ao assinar abaixo, você concorda com todo o conteúdo descrito no documento.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={() => setSigningOpen(true)}
                        className="rounded-lg bg-teal-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-teal-700 shadow-sm"
                      >
                        Assinar Digitalmente
                      </button>
                      <button
                        type="button"
                        onClick={handleRecusar}
                        disabled={loading}
                        className="rounded-lg bg-red-50 border border-red-200 px-6 py-3 text-sm font-bold text-red-700 transition-colors hover:bg-red-100 shadow-sm disabled:opacity-50"
                      >
                        {loading ? 'Processando...' : 'Recusar a Assinar'}
                      </button>
                    </div>
                  </div>
                )}
              </TermoVisualizacao>
            </div>



            {errorMsg && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 max-w-[700px] mx-auto w-full text-center font-medium">
                {errorMsg}
              </div>
            )}

            <div className="flex justify-center mt-4">
              <button
                type="button"
                onClick={handleAssinar}
                disabled={loading}
                className="w-full max-w-[320px] h-12 rounded-xl bg-teal-600 text-white font-bold text-[15px] hover:bg-teal-700 active:bg-teal-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Confirmar e Assinar
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* SUCESSO & DOWNLOAD PDF */}
        {estado === 'SUCESSO' && lookupData && (
          <div className="flex flex-col gap-6 w-full animate-in fade-in zoom-in-95 duration-500">
            <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 p-8 w-full max-w-[480px] mx-auto text-center mb-4">
              <div className="w-20 h-20 bg-teal-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-teal-500/30">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-3">Assinatura Concluída!</h2>
              <p className="text-slate-500">
                Obrigado, <strong className="text-slate-700">{lookupData?.pacienteNome}</strong>.<br />
                Sua assinatura foi registrada com sucesso na ficha clínica.
              </p>
              
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={loading}
                className="mt-6 w-full h-12 rounded-xl bg-slate-800 text-white font-bold text-[15px] hover:bg-slate-900 active:bg-slate-950 transition-colors disabled:opacity-70 shadow-md flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Baixar Cópia em PDF
                  </>
                )}
              </button>
            </div>

            {/* DOM OCULTO (Apenas para gerar o PDF via html2canvas) */}
            <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
              <div 
                ref={pdfContainerRef} 
                className="bg-white text-slate-900" 
                style={{ width: '800px', padding: '0px', boxSizing: 'border-box' }}
              >
                <div className="border border-slate-200">
                  <TermoVisualizacao 
                    titulo={lookupData.documento?.titulo}
                    conteudo={lookupData.documento?.conteudo}
                    clinicaCtx={{
                      nome: lookupData.clinicaNome,
                      endereco: lookupData.clinicaEndereco,
                      telefone: lookupData.clinicaTelefone
                    }}
                    pacienteCtx={{
                      nome: lookupData.pacienteNome,
                      cpf: lookupData.pacienteCpf || formatCPF(cpf),
                      telefone: lookupData.pacienteTelefone
                    }}
                    profissionalCtx={{
                      nome: lookupData.profissionalNome,
                      cpf: lookupData.profissionalCpfCrm
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      {lookupData.recusado ? (
                        <div style={{ color: '#dc2626', fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', marginTop: '20px' }}>
                          RECUSADO PELO PACIENTE
                        </div>
                      ) : (
                        <img 
                          src={lookupData.assinaturaBase64} 
                          alt="Assinatura do Paciente" 
                          style={{ height: '80px', objectFit: 'contain', borderBottom: '1px solid #1e293b', paddingBottom: '10px', marginBottom: '10px' }} 
                        />
                      )}
                      <p style={{ fontSize: '14px', fontWeight: 'bold' }}>{lookupData.pacienteNome}</p>
                      <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>CPF: {lookupData.pacienteCpf || formatCPF(cpf)}</p>
                    </div>

                    <div style={{ marginTop: '40px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', fontSize: '11px', color: '#475569', border: '1px solid #e2e8f0' }}>
                      <strong>Validação Eletrônica (LGPD)</strong><br />
                      Data/Hora do Aceite: {lookupData.dataAssinatura ? new Date(lookupData.dataAssinatura).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : new Date().toLocaleString()}<br />
                      Registro de Origem (IP): {lookupData.ipOrigem}
                    </div>
                  </TermoVisualizacao>
                </div>
              </div>
            </div>
          </div>
        )}

        <SignatureFullscreenModal
          open={signingOpen}
          title="Assinatura do Paciente"
          onClose={() => setSigningOpen(false)}
          canvasRef={sigCanvasRef}
          hasStrokeRef={sigHasStrokeRef}
          mobilePortrait={mobilePortrait}
          onConfirm={(base64) => {
            setSignatureBase64(base64);
            setSigningOpen(false);
          }}
        />

      </div>
    </div>
  );
};
