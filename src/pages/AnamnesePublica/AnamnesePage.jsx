import React, { useState, useEffect, useRef } from 'react';
import { resolveApiUrl } from '../../config/apiEnv';
import { SignatureFullscreenModal } from '../../components/journey/Step4LGPD';
import { Check, Edit2 } from 'lucide-react';

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
  const [estado, setEstado] = useState('ENTRADA_CPF'); // ENTRADA_CPF | VALIDA | FORMULARIO | SUCESSO
  const [lookupData, setLookupData] = useState(null);
  
  const [respostas, setRespostas] = useState({});
  const [assinatura, setAssinatura] = useState('');
  const [signingOpen, setSigningOpen] = useState(false);
  const canvasRef = useRef(null);
  const hasStrokeRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('clinic');
    if (slug) {
      setClinicSlug(slug);
    } else {
      setErrorMsg('O link acessado é inválido (parâmetro clinic ausente).');
    }
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

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    
    // Validate all questions answered
    const modelo = lookupData?.modelo;
    if (!modelo) return;
    
    let allAnswered = true;
    for (const cat of modelo.categorias) {
      for (const p of cat.perguntas) {
        const val = respostas[p.perguntaId];
        if (val === undefined || val === '' || (Array.isArray(val) && val.length === 0)) {
          allAnswered = false;
          break;
        }
      }
    }
    
    if (!allAnswered) {
      setErrorMsg('Por favor, responda a todas as perguntas antes de enviar.');
      return;
    }
    
    if (!assinatura) {
      setErrorMsg('Por favor, assine a anamnese antes de enviar.');
      return;
    }
    
    setLoading(true);
    setErrorMsg('');
    
    try {
      // For checkboxes (arrays), we might join them or pick the first if backend expects single string.
      // The backend will save it as string text. If UUID, it saves it. Let's join checkboxes with commas if array.
      const formattedRespostas = {};
      Object.entries(respostas).forEach(([key, val]) => {
        formattedRespostas[key] = Array.isArray(val) ? val.join(', ') : val;
      });

      const body = {
        cpf: cpf.replace(/\D/g, ''),
        clinic: clinicSlug,
        anamneseId: modelo.anamneseId,
        respostas: formattedRespostas,
        assinaturaPaciente: assinatura
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
      <form onSubmit={handleSubmitForm} className="flex flex-col gap-6 w-full animate-in fade-in duration-500">
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
                const isSelect = p.tipo === 'select';
                const isCheckbox = p.tipo === 'checkbox';
                const isEscala = p.tipo === 'escala';
                
                const val = respostas[p.perguntaId];

                return (
                  <div key={p.perguntaId} className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-700">{p.texto}</label>
                    
                    {isTexto && (
                      <input 
                        type="text" 
                        className="w-full h-11 px-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                        value={val || ''}
                        onChange={e => handleChangeResposta(p.perguntaId, e.target.value, 'texto')}
                        placeholder="Sua resposta"
                      />
                    )}

                    {isTextarea && (
                      <textarea 
                        className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all resize-none"
                        rows={3}
                        value={val || ''}
                        onChange={e => handleChangeResposta(p.perguntaId, e.target.value, 'textarea')}
                        placeholder="Sua resposta"
                      />
                    )}

                    {isSelect && (
                      <select 
                        className="w-full h-11 px-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all bg-white"
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
                          <label key={opt.opcaoId} className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                            <input 
                              type="checkbox"
                              className="w-5 h-5 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                              checked={(val || []).includes(opt.opcaoId)}
                              onChange={() => handleChangeResposta(p.perguntaId, opt.opcaoId, 'checkbox')}
                            />
                            <span className="text-sm text-slate-700">{opt.texto}</span>
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
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mt-2">
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Termo de Responsabilidade</h3>
          <p className="text-sm text-slate-600 mb-4">
            Declaro que as informações prestadas são verdadeiras e assumo inteira responsabilidade pelas mesmas.
          </p>
          
          {!assinatura ? (
            <button
              type="button"
              onClick={() => setSigningOpen(true)}
              className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-teal-500 text-teal-600 font-semibold hover:bg-teal-50 transition-colors flex items-center justify-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              Clique aqui para assinar
            </button>
          ) : (
            <div className="flex flex-col items-center gap-3 p-4 rounded-xl border border-emerald-200 bg-emerald-50">
              <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                <Check className="w-5 h-5" />
                Assinado com sucesso
              </div>
              <img src={assinatura} alt="Assinatura" className="h-16 object-contain mix-blend-multiply" />
              <button
                type="button"
                onClick={() => setSigningOpen(true)}
                className="text-sm text-emerald-600 underline hover:text-emerald-800"
              >
                Assinar novamente
              </button>
            </div>
          )}
        </div>

        <button 
          type="submit"
          disabled={loading || !assinatura}
          className="w-full h-12 mt-4 rounded-xl bg-teal-600 text-white font-bold text-[15px] hover:bg-teal-700 active:bg-teal-800 transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : 'Enviar Anamnese'}
        </button>

        <SignatureFullscreenModal
          open={signingOpen}
          title="Assinatura do Paciente"
          onClose={() => setSigningOpen(false)}
          canvasRef={canvasRef}
          hasStrokeRef={hasStrokeRef}
          mobilePortrait={window.matchMedia('(max-width: 639px)').matches && window.matchMedia('(orientation: portrait)').matches}
          onConfirm={(dataUrl) => {
            setAssinatura(dataUrl);
            setSigningOpen(false);
          }}
        />
      </form>
    );
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 flex flex-col items-center py-10 px-4 font-sans">
      <div className="w-full max-w-[480px]">
        
        {estado === 'ENTRADA_CPF' && (
          <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 p-8 w-full animate-in fade-in zoom-in-95 duration-300">
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
          <div className="bg-emerald-50 rounded-[24px] border border-emerald-200 p-8 w-full text-center animate-in fade-in zoom-in-95 duration-300 shadow-sm">
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

        {estado === 'SUCESSO' && (
          <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 p-8 w-full text-center animate-in fade-in zoom-in-95 duration-300">
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
          </div>
        )}

      </div>
    </div>
  );
};
