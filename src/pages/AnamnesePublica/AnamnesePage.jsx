import React, { useState, useEffect, useRef } from 'react';
import { resolveApiUrl } from '../../config/apiEnv';
import { SignatureFullscreenModal } from '../../components/journey/Step4LGPD';
import { TermoVisualizacao } from '../../components/termos/TermoVisualizacao';
import { PenLine, Calendar } from 'lucide-react';

// Simple CPF formatter: 000.000.000-00
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

export const AnamnesePage = () => {
  const [clinicSlug, setClinicSlug] = useState('');
  const [cpf, setCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [estado, setEstado] = useState('ENTRADA_CPF'); // ENTRADA_CPF | VALIDA | FORMULARIO | ASSINATURA | SUCESSO
  const [lookupData, setLookupData] = useState(null);
  
  const [respostas, setRespostas] = useState({});
  const [assinatura, setAssinatura] = useState(null);
  const [termoAceito, setTermoAceito] = useState(false);

  // Assinatura Modal states
  const [patSigningOpen, setPatSigningOpen] = useState(false);
  const patCanvasRef = useRef(null);
  const patHasStrokeRef = useRef(false);
  const [mobilePortrait, setMobilePortrait] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('clinic');
    if (slug) {
      setClinicSlug(slug);
    } else {
      setErrorMsg('O link acessado é inválido (parâmetro clinic ausente).');
    }
  }, []);

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

  const handleLookup = async (e) => {
    e.preventDefault();
    if (!clinicSlug) return;
    
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      setErrorMsg('CPF inválido. Digite 11 números.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    
    try {
      const res = await fetch(resolveApiUrl(`/api/public/anamnese/lookup?cpf=${cleanCpf}&clinic=${clinicSlug}`));
      
      if (!res.ok) {
        let serverErrorMsg = 'Erro ao buscar dados. Tente novamente.';
        try {
          const errData = await res.json();
          if (errData.message && errData.message !== 'No message available' && errData.message !== 'Not Found') {
            serverErrorMsg = errData.message;
          } else if (res.status === 404) {
            serverErrorMsg = 'Paciente ou clínica não encontrados, ou ficha padrão não configurada. Verifique com a clínica.';
          }
        } catch {
          if (res.status === 404) {
            serverErrorMsg = 'Paciente ou clínica não encontrados, ou ficha padrão não configurada. Verifique com a clínica.';
          }
        }
        throw new Error(serverErrorMsg);
      }
      
      const data = await res.json();
      setLookupData(data);
      
      if (data.status === 'VALIDA') {
        setEstado('VALIDA');
      } else {
        setEstado('FORMULARIO');
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeResposta = (perguntaId, valor, tipo) => {
    if (tipo === 'checkbox') {
      setRespostas(prev => {
        const selected = prev[perguntaId] || [];
        if (selected.includes(valor)) {
          return { ...prev, [perguntaId]: selected.filter(v => v !== valor) };
        } else {
          return { ...prev, [perguntaId]: [...selected, valor] };
        }
      });
    } else {
      setRespostas(prev => ({ ...prev, [perguntaId]: valor }));
    }
  };

  const handleGoToSignature = (e) => {
    e.preventDefault();
    
    const modelo = lookupData?.modelo;
    if (!modelo) return;
    
    let allAnswered = true;
    for (const cat of modelo.categorias) {
      for (const p of cat.perguntas) {
        if (p.obrigatorio) {
          const val = respostas[p.perguntaId];
          if (val === undefined || val === '' || (Array.isArray(val) && val.length === 0)) {
            allAnswered = false;
            break;
          }
        }
      }
    }
    
    if (!allAnswered) {
      setErrorMsg('Por favor, responda a todas as perguntas obrigatórias antes de continuar.');
      return;
    }
    
    setErrorMsg('');
    setEstado('ASSINATURA');
  };

  const handleConfirmPat = (dataUrl) => {
    setAssinatura(dataUrl);
    setPatSigningOpen(false);
  };

  const handleSubmitForm = async () => {
    if (!termoAceito) {
      setErrorMsg('Você precisa aceitar o termo para continuar.');
      return;
    }
    if (!assinatura) {
      setErrorMsg('Por favor, assine antes de enviar.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    
    try {
      const modelo = lookupData?.modelo;
      const formattedRespostas = {};
      Object.entries(respostas).forEach(([key, val]) => {
        formattedRespostas[key] = val;
      });

      const body = {
        cpf: cpf.replace(/\D/g, ''),
        clinic: clinicSlug,
        anamneseId: modelo.anamneseId,
        respostas: formattedRespostas,
        assinatura: assinatura
      };

      const res = await fetch(resolveApiUrl('/api/public/anamnese/responder'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      
      if (!res.ok) {
        if (res.status === 409) throw new Error('Sua anamnese já está em dia.');
        throw new Error('Erro ao enviar respostas. Tente novamente.');
      }
      
      setEstado('SUCESSO');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderFormulario = () => {
    const modelo = lookupData?.modelo;
    if (!modelo) return null;

    return (
      <form onSubmit={handleGoToSignature} className="flex flex-col gap-6 w-full animate-in fade-in duration-500">
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold text-slate-800">{modelo.nome}</h2>
          <p className="text-sm text-slate-500 mt-2">Olá, {lookupData.pacienteNome}. Por favor, preencha sua anamnese.</p>
        </div>

        {errorMsg && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100">
            {errorMsg}
          </div>
        )}

        {modelo.categorias.map(cat => (
          <div key={cat.categoriaId} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-100">{cat.nome}</h3>
            <div className="flex flex-col gap-5">
              {cat.perguntas.map(p => {
                const isTexto = p.tipo === 'texto' || !p.tipo;
                const isTextarea = p.tipo === 'textarea';
                const isSelect = p.tipo === 'select' || p.tipo === 'escolha_unica';
                const isCheckbox = p.tipo === 'checkbox' || p.tipo === 'multipla_escolha';
                const isEscala = p.tipo === 'escala';
                const isNumero = p.tipo === 'numero';
                const isBooleano = p.tipo === 'booleano';
                
                const val = respostas[p.perguntaId];

                return (
                  <div key={p.perguntaId} className={`flex flex-col gap-3 p-5 rounded-2xl border transition-all ${p.alerta ? 'border-red-200 bg-red-50/10' : 'border-slate-100 bg-slate-50/20'}`}>
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 flex-wrap">
                      {p.alerta && <span className="text-red-500 font-bold" title="Alerta clínico">⚠️</span>}
                      {p.texto}
                      {p.obrigatorio && <span className="text-red-500 text-xs font-semibold bg-red-50 px-2 py-0.5 rounded-md border border-red-100" title="Obrigatório">obrigatório *</span>}
                    </label>
                    
                    {isTexto && (
                      <input 
                        type="text" 
                        className="w-full h-11 px-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all bg-white"
                        value={val || ''}
                        onChange={e => handleChangeResposta(p.perguntaId, e.target.value, 'texto')}
                        placeholder="Sua resposta"
                      />
                    )}

                    {isTextarea && (
                      <textarea 
                        className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all resize-none bg-white"
                        rows={3}
                        value={val || ''}
                        onChange={e => handleChangeResposta(p.perguntaId, e.target.value, 'textarea')}
                        placeholder="Sua resposta"
                      />
                    )}

                    {isSelect && (
                      <select 
                        className="w-full h-11 px-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all bg-white text-slate-800 font-medium"
                        value={val || ''}
                        onChange={e => handleChangeResposta(p.perguntaId, e.target.value, 'select')}
                      >
                        <option value="" disabled>Selecione uma opção</option>
                        {p.opcoes?.map(opt => (
                          <option key={opt.opcaoId} value={opt.opcaoId}>{opt.texto}</option>
                        ))}
                      </select>
                    )}

                    {isCheckbox && (
                      <div className="flex flex-col gap-2">
                        {p.opcoes?.map(opt => (
                          <label key={opt.opcaoId} className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors bg-white">
                            <input 
                              type="checkbox"
                              className="w-5 h-5 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer"
                              checked={(val || []).includes(opt.opcaoId)}
                              onChange={() => handleChangeResposta(p.perguntaId, opt.opcaoId, 'checkbox')}
                            />
                            <span className="text-sm font-medium text-slate-700">{opt.texto}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {isEscala && (
                      <div className="flex flex-col gap-3 mt-1">
                        <input 
                          type="range"
                          min="0"
                          max="10"
                          step="1"
                          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                          value={val || 0}
                          onChange={e => handleChangeResposta(p.perguntaId, e.target.value, 'escala')}
                        />
                        <div className="flex justify-between text-xs font-semibold text-slate-500">
                          <span>0</span>
                          <span className="text-teal-600 text-lg px-2 py-0.5 bg-teal-50 rounded-md">{val || 0}</span>
                          <span>10</span>
                        </div>
                      </div>
                    )}

                    {isNumero && (
                      <input 
                        type="number" 
                        className="w-full h-11 px-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all bg-white"
                        value={val ?? ''}
                        onChange={e => handleChangeResposta(p.perguntaId, e.target.value === '' ? '' : Number(e.target.value), 'numero')}
                        placeholder="0"
                      />
                    )}

                    {isBooleano && (
                      <div className="flex gap-3">
                        {[{ label: 'Sim', value: 'true' }, { label: 'Não', value: 'false' }].map(({ label, value }) => {
                          const ativo = String(val) === value;
                          return (
                            <button
                              key={label}
                              type="button"
                              onClick={() => handleChangeResposta(p.perguntaId, value, 'booleano')}
                              className={`flex-1 py-2.5 px-4 rounded-xl border text-[14px] font-semibold transition-all shadow-sm ${
                                ativo 
                                  ? 'border-teal-600 bg-teal-50 text-teal-700 font-bold ring-2 ring-teal-500/20' 
                                  : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <button 
          type="submit"
          disabled={loading}
          className="w-full h-12 mt-4 rounded-xl bg-teal-600 text-white font-bold text-[15px] hover:bg-teal-700 active:bg-teal-800 transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              Continuar para assinatura
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </>
          )}
        </button>
      </form>
    );
  };

  const renderAssinatura = () => {
    const pacienteCtx = {
      nome: lookupData?.pacienteNome || 'paciente',
      cpf: cpf
    };
    
    const termoConteudo = `Eu, [NOME DO PACIENTE], portador(a) do CPF [CPF DO PACIENTE], declaro que:

1. Preenchi pessoalmente esta ficha de anamnese com informações verdadeiras e completas sobre meu histórico de saúde.
2. Estou ciente de que as informações prestadas são de minha inteira responsabilidade e serão utilizadas exclusivamente para fins de acompanhamento e tratamento de saúde.
3. Comprometo-me a informar quaisquer alterações no meu estado de saúde que possam impactar os tratamentos realizados.
4. Autorizo o uso das informações desta ficha pela equipe de profissionais de saúde responsáveis pelo meu atendimento.
5. Compreendo que a omissão ou falsidade de qualquer informação pode comprometer a segurança dos procedimentos e tratamentos a mim prestados.

Data do preenchimento: ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}`;

    let conteudoExibicao = termoConteudo;
    if (pacienteCtx?.nome) conteudoExibicao = conteudoExibicao.replace(/\[NOME DO PACIENTE\]/gi, pacienteCtx.nome);
    if (pacienteCtx?.cpf) conteudoExibicao = conteudoExibicao.replace(/\[CPF DO PACIENTE\]/gi, pacienteCtx.cpf);

    return (
      <div className="flex flex-col gap-6 w-full animate-in fade-in duration-500">
        <TermoVisualizacao
          titulo="Declaração do Paciente"
          conteudo={conteudoExibicao}
          pacienteCtx={pacienteCtx}
        >
          <div className="space-y-6">
            <label className="flex items-start gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors bg-white">
              <input 
                type="checkbox"
                className="w-5 h-5 mt-0.5 text-[#00a88e] rounded border-slate-300 focus:ring-[#00a88e] cursor-pointer flex-shrink-0"
                checked={termoAceito}
                onChange={(e) => setTermoAceito(e.target.checked)}
              />
              <span className="text-sm text-slate-700 font-medium leading-snug">
                Li e concordo com o termo acima. Confirmo que todas as informações fornecidas são verdadeiras e que fui eu quem preencheu esta ficha.
              </span>
            </label>

            <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-[15px] font-bold text-[#0f172a]">Assinatura do Paciente</h4>
                {assinatura ? (
                  <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">✓ Assinado</span>
                ) : (
                  <span className="rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Obrigatório
                  </span>
                )}
              </div>

              {assinatura ? (
                <div className="flex flex-col items-stretch gap-2">
                  <img
                    src={assinatura}
                    alt="Assinatura do paciente"
                    className="mx-auto h-20 max-w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] object-contain"
                  />
                  <div className="flex items-center gap-1.5 text-[12px] text-[#64748b]">
                    <Calendar className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                    <span>Assinado hoje</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAssinatura(null);
                      setPatSigningOpen(true);
                    }}
                    className="self-start text-[12px] font-medium text-[#64748b] hover:text-[#475569]"
                  >
                    Refazer assinatura
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 py-6 text-center">
                  <PenLine className="h-12 w-12 text-[#94a3b8]" strokeWidth={1.75} aria-hidden />
                  <p className="text-[13px] font-medium text-[#64748b]">Clique para assinar digitalmente</p>
                  <button
                    type="button"
                    onClick={() => setPatSigningOpen(true)}
                    className="rounded-lg bg-[#00a88e] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#00967f]"
                  >
                    Assinar como Paciente
                  </button>
                </div>
              )}
            </div>
          </div>
        </TermoVisualizacao>

        {errorMsg && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100">
            {errorMsg}
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-col gap-3">
          <button 
            type="button"
            onClick={handleSubmitForm}
            disabled={loading || !termoAceito || !assinatura}
            className="w-full h-12 rounded-xl bg-teal-600 text-white font-bold text-[15px] hover:bg-teal-700 active:bg-teal-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Confirmar e Enviar Anamnese
              </>
            )}
          </button>
          <button 
            type="button"
            onClick={() => { setEstado('FORMULARIO'); setErrorMsg(''); }}
            disabled={loading}
            className="w-full h-10 rounded-xl border border-slate-300 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
            </svg>
            Voltar e revisar respostas
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 flex flex-col items-center py-10 px-4 font-sans">
      <div className="w-full max-w-4xl">
        
        {estado === 'ENTRADA_CPF' && (
          <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 p-8 w-full max-w-[480px] mx-auto animate-in fade-in zoom-in-95 duration-300">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-center text-slate-800 mb-2">Ficha de Anamnese</h1>
            <p className="text-sm text-center text-slate-500 mb-8">Informe seu CPF para acessar ou preencher sua ficha.</p>
            
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
                disabled={loading || !clinicSlug}
                className="w-full h-12 mt-2 rounded-xl bg-teal-600 text-white font-bold text-[15px] hover:bg-teal-700 active:bg-teal-800 transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : 'Continuar'}
              </button>
            </form>
          </div>
        )}

        {estado === 'VALIDA' && lookupData && (
          <div className="bg-emerald-50 rounded-[24px] border border-emerald-200 p-8 w-full max-w-[480px] mx-auto text-center animate-in fade-in zoom-in-95 duration-300 shadow-sm">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h2 className="text-xl font-bold text-emerald-800 mb-2">Anamnese em dia!</h2>
            <p className="text-emerald-700 text-sm">
              Olá, {lookupData.pacienteNome}.<br/>
              Sua ficha está válida até <strong className="font-semibold">{new Date(lookupData.validadeAte).toLocaleDateString('pt-BR')}</strong>.<br/>
              Não é necessário preencher novamente.
            </p>
          </div>
        )}

        {estado === 'FORMULARIO' && renderFormulario()}

        {estado === 'ASSINATURA' && renderAssinatura()}

        {estado === 'SUCESSO' && (
          <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 p-8 w-full max-w-[480px] mx-auto text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-teal-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-teal-500/30">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-3">Enviado com sucesso!</h2>
            <p className="text-slate-500">
              Obrigado, <strong className="text-slate-700">{lookupData?.pacienteNome}</strong>.<br/>
              Suas respostas foram registradas com segurança.
            </p>
            <div className="mt-4 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <div className="flex items-center justify-center gap-2 text-emerald-700 text-sm font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Assinatura digital registrada
              </div>
            </div>
          </div>
        )}

      </div>
      
      <SignatureFullscreenModal
        open={patSigningOpen}
        title="Assinatura do Paciente"
        onClose={() => setPatSigningOpen(false)}
        canvasRef={patCanvasRef}
        hasStrokeRef={patHasStrokeRef}
        mobilePortrait={mobilePortrait}
        onConfirm={handleConfirmPat}
      />
    </div>
  );
};
