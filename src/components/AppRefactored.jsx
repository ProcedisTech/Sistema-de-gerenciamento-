import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Hooks de estado
import { useAuthState, usePatientState, useJourneyState, useAppointmentState } from './hooks';

// Componentes de Autenticação
import { LoginForm, CookieConsent } from './auth';

// Componentes de Layout
import { Sidebar, Stepper } from './layout';

// Componentes da Jornada (5 Etapas)
import { Step1CheckIn, Step2Anamnese, Step3Evaluation, Step4LGPD, Step5Finalization } from './journey';

// Utilitários
import { api, calculateAgeFromISODate } from './utils';

export default function App() {
  // ============ ESTADO GLOBAL ============
  const authState = useAuthState();
  const patientState = usePatientState();
  const journeyState = useJourneyState();
  const appointmentState = useAppointmentState();
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // ============ Estados destructurados para facilitar leitura ============
  const { authReady, isLoggedIn, handleLogin, handleLogout, cookieConsentAccepted, acceptCookies } = authState;
  const { currentStep, setCurrentStep, isFinishing, setIsFinishing, journeyId, setJourneyId } = journeyState;
  const { patients, setPatients } = patientState;
  
  // ============ FUNÇÕES DE NAVEGAÇÃO ============
  const [activeView, setActiveView] = React.useState('jornada');

  const handleNextStep = () => {
    if (currentStep === 1) {
      const { nome, dataNascimento, sexo, estadoCivil, profissao, cpf, telefone, email, alergias, lgpdInicial } = journeyState;
      const errors = {};
      if (!nome.trim()) errors.nome = true;
      if (!dataNascimento) errors.dataNascimento = true;
      if (!sexo) errors.sexo = true;
      if (!estadoCivil) errors.estadoCivil = true;
      if (!profissao.trim()) errors.profissao = true;
      if (!cpf.trim()) errors.cpf = true;
      if (!telefone.trim()) errors.telefone = true;
      if (!email.trim()) errors.email = true;
      if (!alergias.trim()) errors.alergias = true;
      if (!lgpdInicial) errors.lgpdInicial = true;

      if (Object.keys(errors).length > 0) {
        journeyState.setStep1Errors(errors);
        return;
      }
      journeyState.setStep1Errors({});
    }

    if (currentStep === 2) {
      const { queixa, expectativas } = journeyState;
      if (!queixa.trim() || !expectativas.trim()) {
        alert('Preencha queixa e expectativas');
        return;
      }
    }

    if (currentStep === 4) {
      const { termoLido, termoAssinado } = journeyState;
      if (!termoLido || !termoAssinado) {
        alert('Confirme a leitura e assinatura do termo LGPD');
        return;
      }
    }

    if (currentStep === 5) {
      const { orientacoes, satisfacao } = journeyState;
      if (!orientacoes || !satisfacao) {
        alert('Confirme as orientações e satisfação');
        return;
      }
    }

    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    } else {
      finishJourney();
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const finishJourney = async () => {
    setIsFinishing(true);
    try {
      console.log('Jornada finalizada!', { currentStep, journeyId });
      alert('Procedimento finalizado com sucesso!');
      resetJourney();
    } catch (error) {
      console.error('Erro ao finalizar jornada:', error);
    } finally {
      setIsFinishing(false);
    }
  };

  const resetJourney = () => {
    setCurrentStep(1);
    journeyState.setNome('');
    journeyState.setDataNascimento('');
    journeyState.setIdade('');
    journeyState.setSexo('');
    journeyState.setEstadoCivil('');
    journeyState.setProfissao('');
    journeyState.setAlergias('');
    journeyState.setCpf('');
    journeyState.setRg('');
    journeyState.setTelefone('');
    journeyState.setEmail('');
    journeyState.setQueixa('');
    journeyState.setExpectativas('');
    journeyState.setImageSrc(null);
    journeyState.setPaths([]);
    journeyState.setTermoLido(false);
    journeyState.setTermoAssinado(false);
    journeyState.setOrientacoes(false);
    journeyState.setSatisfacao(false);
    patientState.setSelectedPatientCpf(null);
  };

  const selectPatient = (patient) => {
    if (!patient) return;
    journeyState.setNome(patient.nome || '');
    journeyState.setDataNascimento(patient.dataNascimento || '');
    journeyState.setIdade(patient.idade !== undefined && patient.idade !== null ? String(patient.idade) : '');
    journeyState.setSexo(patient.sexo || '');
    journeyState.setEstadoCivil(patient.estadoCivil || '');
    journeyState.setProfissao(patient.profissao || '');
    journeyState.setAlergias(patient.alergias || '');
    journeyState.setCpf(patient.cpf || '');
    journeyState.setRg(patient.rg || '');
    journeyState.setTelefone(patient.telefone || '');
    journeyState.setEmail(patient.email || '');
    journeyState.setStep1Errors({});
    patientState.setSelectedPatientCpf(patient.cpf || null);
    journeyState.setActiveTab('existente');
  };

  // ============ RENDERIZAÇÃO ============
  if (!authReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-[#f0fdfa] to-[#f8fbfb]">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-[#00a88e] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-[#00a88e] font-bold">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <>
        <LoginForm {...authState} />
        <CookieConsent cookieConsentAccepted={cookieConsentAccepted} acceptCookies={acceptCookies} />
      </>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen font-sans overflow-hidden" style={{ backgroundColor: '#f8fbfb', color: '#0f172a' }}>
      <CookieConsent cookieConsentAccepted={cookieConsentAccepted} acceptCookies={acceptCookies} />

      {/* Sidebar */}
      <Sidebar activeView={activeView} setActiveView={setActiveView} handleLogout={handleLogout} />

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto pb-[96px] md:pb-0">
        {/* Header */}
        <header className="bg-white px-4 sm:px-6 md:px-10 py-6 sm:py-8 border-b-[3px] border-[#00a88e]/15 shadow-[0_4px_24px_rgb(0,168,142,0.02)] z-0">
          {activeView === 'jornada' ? (
            <>
              <h2 className="text-[24px] font-bold text-[#0f172a] mb-1">Jornada de Harmonização Otimizada</h2>
              <p className="text-[#64748b] text-[14px] mb-8 font-medium">Processo completo em 5 etapas</p>
              <Stepper currentStep={currentStep} />
            </>
          ) : null}
        </header>

        {/* Content Area */}
        <div className="p-4 sm:p-6 md:p-8 max-w-[1100px] mx-auto w-full">
          <div className="bg-white rounded-[20px] border-[3px] border-[#00a88e]/25 shadow-lg shadow-[#00a88e]/5 p-8 pb-6">
            
            {activeView === 'jornada' && (
              <>
                {/* ============ ETAPA 1: CHECK-IN ============ */}
                {currentStep === 1 && (
                  <Step1CheckIn
                    activeTab={journeyState.activeTab}
                    setActiveTab={journeyState.setActiveTab}
                    searchQuery={journeyState.searchQuery}
                    setSearchQuery={journeyState.setSearchQuery}
                    patients={patients}
                    nome={journeyState.nome}
                    setNome={journeyState.setNome}
                    dataNascimento={journeyState.dataNascimento}
                    setDataNascimento={journeyState.setDataNascimento}
                    idade={journeyState.idade}
                    setIdade={journeyState.setIdade}
                    sexo={journeyState.sexo}
                    setSexo={journeyState.setSexo}
                    estadoCivil={journeyState.estadoCivil}
                    setEstadoCivil={journeyState.setEstadoCivil}
                    profissao={journeyState.profissao}
                    setProfissao={journeyState.setProfissao}
                    alergias={journeyState.alergias}
                    setAlergias={journeyState.setAlergias}
                    cpf={journeyState.cpf}
                    setCpf={journeyState.setCpf}
                    rg={journeyState.rg}
                    setRg={journeyState.setRg}
                    telefone={journeyState.telefone}
                    setTelefone={journeyState.setTelefone}
                    email={journeyState.email}
                    setEmail={journeyState.setEmail}
                    lgpdInicial={journeyState.lgpdInicial}
                    setLgpdInicial={journeyState.setLgpdInicial}
                    step1Errors={journeyState.step1Errors}
                    setStep1Errors={journeyState.setStep1Errors}
                    selectPatient={selectPatient}
                  />
                )}

                {/* ============ ETAPA 2: ANAMNESE ============ */}
                {currentStep === 2 && (
                  <Step2Anamnese
                    queixa={journeyState.queixa}
                    setQueixa={journeyState.setQueixa}
                    expectativas={journeyState.expectativas}
                    setExpectativas={journeyState.setExpectativas}
                    gestante={journeyState.gestante}
                    setGestante={journeyState.setGestante}
                    amamentando={journeyState.amamentando}
                    setAmamentando={journeyState.setAmamentando}
                    anticoagulantes={journeyState.anticoagulantes}
                    setAnticoagulantes={journeyState.setAnticoagulantes}
                    queloides={journeyState.queloides}
                    setQueloides={journeyState.setQueloides}
                  />
                )}

                {/* ============ ETAPA 3: AVALIAÇÃO ============ */}
                {currentStep === 3 && (
                  <Step3Evaluation
                    imageSrc={journeyState.imageSrc}
                    setImageSrc={journeyState.setImageSrc}
                    activeTool={journeyState.activeTool}
                    setActiveTool={journeyState.setActiveTool}
                    activeColor={journeyState.activeColor}
                    setActiveColor={journeyState.setActiveColor}
                    pointSize={journeyState.pointSize}
                    setPointSize={journeyState.setPointSize}
                    showPointNumbers={journeyState.showPointNumbers}
                    setShowPointNumbers={journeyState.setShowPointNumbers}
                    eraserSize={journeyState.eraserSize}
                    setEraserSize={journeyState.setEraserSize}
                    cursorPos={journeyState.cursorPos}
                    setCursorPos={journeyState.setCursorPos}
                    isHoveringCanvas={journeyState.isHoveringCanvas}
                    setIsHoveringCanvas={journeyState.setIsHoveringCanvas}
                    paths={journeyState.paths}
                    setPaths={journeyState.setPaths}
                    isDrawing={journeyState.isDrawing}
                    setIsDrawing={journeyState.setIsDrawing}
                    canvasRef={canvasRef}
                    containerRef={containerRef}
                    evaluationAnnotatedPhotoUrl={journeyState.evaluationAnnotatedPhotoUrl}
                    setEvaluationAnnotatedPhotoUrl={journeyState.setEvaluationAnnotatedPhotoUrl}
                    selectedPatientCpf={patientState.selectedPatientCpf}
                    cpf={journeyState.cpf}
                    patients={patients}
                    setPatients={setPatients}
                  />
                )}

                {/* ============ ETAPA 4: LGPD ============ */}
                {currentStep === 4 && (
                  <Step4LGPD
                    termoLido={journeyState.termoLido}
                    setTermoLido={journeyState.setTermoLido}
                    termoAssinado={journeyState.termoAssinado}
                    setTermoAssinado={journeyState.setTermoAssinado}
                  />
                )}

                {/* ============ ETAPA 5: FINALIZAÇÃO ============ */}
                {currentStep === 5 && (
                  <Step5Finalization
                    orientacoes={journeyState.orientacoes}
                    setOrientacoes={journeyState.setOrientacoes}
                    satisfacao={journeyState.satisfacao}
                    setSatisfacao={journeyState.setSatisfacao}
                  />
                )}

                {/* ============ BOTÕES DE NAVEGAÇÃO ============ */}
                <div className="flex justify-between items-center mt-10 pt-6 border-t-[3px] border-[#00a88e]/15">
                  <button
                    onClick={prevStep}
                    disabled={currentStep === 1 || isFinishing}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[14px] transition-all outline-none shadow-sm border-[3px] ${
                      currentStep === 1 || isFinishing
                        ? 'text-[#94a3b8] bg-[#f8fbfb] border-[#e2e8f0] cursor-not-allowed'
                        : 'text-[#00a88e] bg-white border-[#00a88e]/25 hover:bg-[#e6f7f5] hover:border-[#00a88e]'
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" strokeWidth={3} /> Anterior
                  </button>

                  {currentStep < 5 ? (
                    <button
                      onClick={handleNextStep}
                      disabled={isFinishing}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[14px] transition-all outline-none shadow-md border-[3px] border-transparent text-white bg-[#00a88e] hover:bg-[#00967f] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Próxima Etapa <ChevronRight className="w-4 h-4" strokeWidth={3} />
                    </button>
                  ) : (
                    <button
                      onClick={handleNextStep}
                      disabled={isFinishing}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[14px] transition-all outline-none shadow-md border-[3px] border-transparent text-white bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Finalizar Procedimento ✓
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* CSS Global */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #00a88e; border-radius: 10px; opacity: 0.5; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #00967f; }
      `}} />
    </div>
  );
}

