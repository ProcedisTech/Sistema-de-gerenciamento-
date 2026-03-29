import React from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  Lightbulb,
  Search,
  Shield,
  Square,
  Upload,
  UserCheck,
} from 'lucide-react';

export function JourneyView({
  currentStep,
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  filteredPatients,
  selectedPatientCpf,
  selectPatient,
  getPatientInitials,
  step1Errors,
  setStep1Errors,
  nome,
  setNome,
  dataNascimento,
  handleDataNascimentoChange,
  idade,
  sexo,
  setSexo,
  estadoCivil,
  setEstadoCivil,
  profissao,
  setProfissao,
  cpf,
  setCpf,
  maskCPF,
  rg,
  setRg,
  maskRG,
  telefone,
  setTelefone,
  maskTelefone,
  email,
  setEmail,
  alergias,
  setAlergias,
  lgpdInicial,
  setLgpdInicial,
  queixa,
  setQueixa,
  expectativas,
  setExpectativas,
  gestante,
  setGestante,
  amamentando,
  setAmamentando,
  anticoagulantes,
  setAnticoagulantes,
  queloides,
  setQueloides,
  evaluationCapturedPhotos,
  evaluationSelectedPhotoIndex,
  setEvaluationSelectedPhotoIndex,
  setImageSrc,
  setPaths,
  setEvaluationAnnotatedPhotoUrl,
  imageSrc,
  activeTool,
  setActiveTool,
  colors,
  activeColor,
  setActiveColor,
  pointSize,
  setPointSize,
  showPointNumbers,
  setShowPointNumbers,
  eraserSize,
  setEraserSize,
  handleImageUpload,
  canvasRef,
  startDrawing,
  handleMouseMove,
  endDrawing,
  handleMouseLeave,
  handleMouseEnter,
  isHoveringCanvas,
  cursorPos,
  saveAnnotatedEvaluationPhoto,
  paths,
  evaluationAnnotatedPhotoUrl,
  EVALUATION_PHOTO_MAX,
  termoLido,
  setTermoLido,
  termoAssinado,
  setTermoAssinado,
  orientacoes,
  setOrientacoes,
  satisfacao,
  setSatisfacao,
  prevStep,
  handleNextStep,
  handleFinishJourney,
  isFinishing,
  containerRef,
}) {
  return (
    <>
      {currentStep === 1 && (
        <div className="animate-in fade-in duration-300">
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-[#e6f7f5] p-3 rounded-2xl text-[#00a88e] border-[3px] border-[#00a88e]/25"><UserCheck className="w-7 h-7" strokeWidth={2.5} /></div>
            <div>
              <h3 className="text-[20px] font-bold text-[#0f172a]">Check-in do Paciente</h3>
              <p className="text-[#64748b] text-[14px] font-medium">Selecione ou cadastre novo paciente</p>
            </div>
          </div>
          <div className="flex bg-[#f8fbfb] p-1.5 rounded-2xl mb-8 border-[3px] border-[#00a88e]/15">
            <button onClick={() => setActiveTab('existente')} className={`flex-1 py-3 text-[14px] font-bold rounded-xl transition-all ${activeTab === 'existente' ? 'bg-[#00a88e] text-white shadow-md' : 'text-[#64748b] hover:text-[#00a88e] hover:bg-white'}`}>Paciente Existente</button>
            <button onClick={() => setActiveTab('novo')} className={`flex-1 py-3 text-[14px] font-bold rounded-xl transition-all ${activeTab === 'novo' ? 'bg-[#00a88e] text-white shadow-md' : 'text-[#64748b] hover:text-[#00a88e] hover:bg-white'}`}>Novo Paciente</button>
          </div>

          {activeTab === 'existente' ? (
            <>
              <div className="relative mb-8">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-[#00a88e]/60" strokeWidth={2.5} />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar por nome, CPF ou telefone..." className="w-full pl-12 pr-4 py-3.5 bg-[#f8fbfb] border-[3px] border-[#00a88e]/25 rounded-2xl text-[14px] focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e] transition-all font-medium" />
              </div>
              {filteredPatients.length === 0 ? (
                <div className="p-6 rounded-2xl border-[3px] border-[#00a88e]/15 bg-[#f8fbfb] text-[#64748b] font-bold text-[14px]">
                  Nenhum paciente encontrado.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredPatients.map((p) => {
                    const isSelected = selectedPatientCpf && p.cpf === selectedPatientCpf;
                    return (
                      <div
                        key={p.id}
                        onClick={() => selectPatient(p)}
                        className={`p-5 rounded-2xl border-[3px] cursor-pointer flex gap-4 shadow-sm transition-all hover:shadow-md ${
                          isSelected
                            ? 'border-[#00a88e] bg-[#e6f7f5]'
                            : 'border-[#00a88e]/40 bg-[#f0fdfa] hover:border-[#00a88e]'
                        }`}
                      >
                        <div className="w-12 h-12 rounded-full bg-[#00a88e] text-white flex items-center justify-center font-bold text-[16px] flex-shrink-0 shadow-sm">
                          {getPatientInitials(p.nome)}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-[16px] font-bold text-[#0f766e] mb-1.5">{p.nome}</h4>
                          <div className="text-[13px] text-[#475569] space-y-0.5 mb-2 font-medium">
                            <p>{p.cpf}</p>
                            <p>{p.telefone}</p>
                          </div>
                          <div className="flex items-center gap-1.5 text-[#ef4444] text-[12px] font-bold bg-red-50 w-fit px-2.5 py-1.5 rounded-lg border-[3px] border-red-100">
                            <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2.5} /> Alergias: {p.alergias || '-'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <form className="space-y-6">
              {Object.keys(step1Errors).length > 0 && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-[14px] font-bold border-[3px] border-red-200 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" strokeWidth={2.5} />
                  Por favor, preencha todos os campos obrigatorios (*) e o termo LGPD para avancar.
                </div>
              )}

              <div className={`border-[3px] rounded-2xl p-6 transition-colors ${step1Errors.nome || step1Errors.dataNascimento || step1Errors.sexo || step1Errors.estadoCivil || step1Errors.profissao ? 'border-red-300 bg-red-50/10' : 'border-[#00a88e]/25 bg-white'}`}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-[#00a88e] text-white flex items-center justify-center font-bold text-[14px] shadow-sm">1</div>
                  <h4 className="text-[18px] font-bold text-[#0f766e]">Dados Pessoais</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-[13px] font-bold text-[#00a88e]">Nome Completo <span className="text-red-500">*</span></label>
                    <input type="text" value={nome} onChange={(e) => {setNome(e.target.value); setStep1Errors({...step1Errors, nome: false});}} placeholder="Nome completo do paciente" className={`w-full px-4 py-3 bg-[#f8fbfb] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 transition-all ${step1Errors.nome ? 'border-red-400 bg-red-50' : 'border-[#00a88e]/25 focus:border-[#00a88e]'}`} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-bold text-[#00a88e]">Data de Nascimento <span className="text-red-500">*</span></label>
                    <input type="date" value={dataNascimento} onChange={(e) => {handleDataNascimentoChange(e); setStep1Errors({...step1Errors, dataNascimento: false});}} className={`w-full px-4 py-3 bg-[#f8fbfb] border-[3px] rounded-xl text-[14px] text-[#0f172a] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 transition-all ${step1Errors.dataNascimento ? 'border-red-400 bg-red-50' : 'border-[#00a88e]/25 focus:border-[#00a88e]'}`} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-bold text-[#00a88e]">Idade</label>
                    <input type="text" value={idade !== '' ? `${idade} anos` : ''} placeholder="Calculada automaticamente" disabled className="w-full px-4 py-3 bg-[#e2e8f0]/40 border-[3px] border-[#00a88e]/15 rounded-xl text-[14px] text-[#0f172a] font-bold cursor-not-allowed" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-bold text-[#00a88e]">Sexo <span className="text-red-500">*</span></label>
                    <select value={sexo} onChange={(e) => {setSexo(e.target.value); setStep1Errors({...step1Errors, sexo: false});}} className={`w-full px-4 py-3 bg-[#f8fbfb] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 appearance-none transition-all ${step1Errors.sexo ? 'border-red-400 bg-red-50' : 'border-[#00a88e]/25 focus:border-[#00a88e]'}`}>
                      <option value="">Selecione...</option>
                      <option value="f">Feminino</option>
                      <option value="m">Masculino</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-bold text-[#00a88e]">Estado Civil <span className="text-red-500">*</span></label>
                    <select value={estadoCivil} onChange={(e) => {setEstadoCivil(e.target.value); setStep1Errors({...step1Errors, estadoCivil: false});}} className={`w-full px-4 py-3 bg-[#f8fbfb] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 appearance-none transition-all ${step1Errors.estadoCivil ? 'border-red-400 bg-red-50' : 'border-[#00a88e]/25 focus:border-[#00a88e]'}`}>
                      <option value="">Selecione...</option>
                      <option value="solteiro">Solteiro(a)</option>
                      <option value="casado">Casado(a)</option>
                    </select>
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-[13px] font-bold text-[#00a88e]">Profissao <span className="text-red-500">*</span></label>
                    <input type="text" value={profissao} onChange={(e) => {setProfissao(e.target.value); setStep1Errors({...step1Errors, profissao: false});}} placeholder="Ex: Advogada, Empresario, Estudante..." className={`w-full px-4 py-3 bg-[#f8fbfb] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 transition-all ${step1Errors.profissao ? 'border-red-400 bg-red-50' : 'border-[#00a88e]/25 focus:border-[#00a88e]'}`} />
                  </div>
                </div>
              </div>

              <div className={`border-[3px] rounded-2xl p-6 transition-colors ${step1Errors.cpf ? 'border-red-300 bg-red-50/10' : 'border-[#3b82f6]/25 bg-white'}`}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-[#3b82f6] text-white flex items-center justify-center font-bold text-[14px] shadow-sm">2</div>
                  <h4 className="text-[18px] font-bold text-[#1d4ed8]">Documentos</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-bold text-[#3b82f6]">CPF <span className="text-red-500">*</span></label>
                    <input type="text" value={cpf} onChange={(e) => {setCpf(maskCPF(e.target.value)); setStep1Errors({...step1Errors, cpf: false});}} placeholder="000.000.000-00" className={`w-full px-4 py-3 bg-[#eff6ff] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#3b82f6]/20 transition-all ${step1Errors.cpf ? 'border-red-400 bg-red-50' : 'border-[#3b82f6]/30 focus:border-[#3b82f6]'}`} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-bold text-[#3b82f6]">RG</label>
                    <input type="text" value={rg} onChange={(e) => setRg(maskRG(e.target.value))} placeholder="00.000.000-0" className="w-full px-4 py-3 bg-[#eff6ff] border-[3px] border-[#3b82f6]/30 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#3b82f6]/20 focus:border-[#3b82f6] transition-all" />
                  </div>
                </div>
              </div>

              <div className={`border-[3px] rounded-2xl p-6 transition-colors ${step1Errors.telefone || step1Errors.email ? 'border-red-300 bg-red-50/10' : 'border-[#a855f7]/25 bg-white'}`}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-[#a855f7] text-white flex items-center justify-center font-bold text-[14px] shadow-sm">3</div>
                  <h4 className="text-[18px] font-bold text-[#7e22ce]">Contato</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-bold text-[#a855f7]">Telefone <span className="text-red-500">*</span></label>
                    <input type="text" value={telefone} onChange={(e) => {setTelefone(maskTelefone(e.target.value)); setStep1Errors({...step1Errors, telefone: false});}} placeholder="(00) 00000-0000" className={`w-full px-4 py-3 bg-[#faf5ff] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#a855f7]/20 transition-all ${step1Errors.telefone ? 'border-red-400 bg-red-50' : 'border-[#a855f7]/30 focus:border-[#a855f7]'}`} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-bold text-[#a855f7]">E-mail <span className="text-red-500">*</span></label>
                    <input type="email" value={email} onChange={(e) => {setEmail(e.target.value); setStep1Errors({...step1Errors, email: false});}} placeholder="email@exemplo.com" className={`w-full px-4 py-3 bg-[#faf5ff] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#a855f7]/20 transition-all ${step1Errors.email ? 'border-red-400 bg-red-50' : 'border-[#a855f7]/30 focus:border-[#a855f7]'}`} />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-[13px] font-bold text-[#a855f7]">Endereco Completo</label>
                    <input type="text" placeholder="Rua, numero, bairro, cidade - UF, CEP" className="w-full px-4 py-3 bg-[#faf5ff] border-[3px] border-[#a855f7]/30 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#a855f7]/20 focus:border-[#a855f7] transition-all" />
                  </div>
                </div>
              </div>

              <div className="border-[3px] border-[#f59e0b]/25 rounded-2xl p-6 bg-white">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-[#f59e0b] text-white flex items-center justify-center font-bold text-[14px] shadow-sm">4</div>
                  <h4 className="text-[18px] font-bold text-[#b45309]">Opcionais</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-bold text-[#f59e0b]">Indicacao</label>
                    <input type="text" placeholder="Quem indicou?" className="w-full px-4 py-3 bg-[#fffbeb] border-[3px] border-[#f59e0b]/30 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#f59e0b]/20 focus:border-[#f59e0b] transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-bold text-[#f59e0b]">Instagram</label>
                    <input type="text" placeholder="@usuario" className="w-full px-4 py-3 bg-[#fffbeb] border-[3px] border-[#f59e0b]/30 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#f59e0b]/20 focus:border-[#f59e0b] transition-all" />
                  </div>
                </div>
              </div>

              <div className={`bg-[#fef2f2] border-[3px] rounded-2xl p-6 transition-colors ${step1Errors.alergias ? 'border-red-400 ring-[5px] ring-red-100' : 'border-red-300'}`}>
                <div className="flex items-center gap-3 mb-6 text-[#dc2626]">
                  <AlertTriangle className="w-6 h-6" strokeWidth={2.5} />
                  <h4 className="text-[18px] font-bold">Historico Medico Importante</h4>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#dc2626]">Alergias <span className="text-red-500">*</span></label>
                  <input type="text" value={alergias} onChange={(e) => {setAlergias(e.target.value); setStep1Errors({...step1Errors, alergias: false});}} placeholder="Ex: Penicilina, Latex, ou digite 'Nenhuma'" className={`w-full px-4 py-3 bg-white border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-red-200 transition-all ${step1Errors.alergias ? 'border-red-500 bg-red-50' : 'border-red-300 focus:border-red-500'}`} />
                  {step1Errors.alergias && <p className="text-[12px] text-red-600 font-bold mt-1">Este campo e obrigatorio.</p>}
                </div>
              </div>

              <div className={`bg-[#f0fdfa] border-[3px] rounded-2xl p-6 transition-colors ${step1Errors.lgpdInicial ? 'border-red-400 ring-[5px] ring-red-100' : 'border-[#00a88e]/30'}`}>
                <div className="flex items-center gap-3 mb-5 text-[#00a88e]">
                  <Shield className="w-6 h-6" strokeWidth={2.5} />
                  <h4 className="text-[18px] font-bold text-[#0f766e]">Termo LGPD Inicial</h4>
                </div>
                <div onClick={() => {setLgpdInicial(!lgpdInicial); setStep1Errors({...step1Errors, lgpdInicial: false});}} className={`flex items-start gap-4 p-4 bg-white border-[3px] rounded-xl cursor-pointer hover:bg-[#e6f7f5] transition-all shadow-sm ${step1Errors.lgpdInicial ? 'border-red-300 bg-red-50/50' : 'border-[#00a88e]/25'}`}>
                  {lgpdInicial ? <CheckSquare className="w-6 h-6 text-[#00a88e] mt-0.5" strokeWidth={2.5} /> : <Square className={`w-6 h-6 mt-0.5 ${step1Errors.lgpdInicial ? 'text-red-400' : 'text-[#00a88e]/40'}`} strokeWidth={2.5} />}
                  <div>
                    <p className={`text-[15px] font-bold mb-1 ${lgpdInicial ? 'text-[#00a88e]' : step1Errors.lgpdInicial ? 'text-red-600' : 'text-[#0f766e]'}`}>O paciente assinou o termo da LGPD</p>
                    <p className="text-[13px] text-[#475569] font-medium leading-relaxed">Declaro que li e concordo com os termos de uso e autorizo o tratamento dos meus dados pessoais.</p>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      {currentStep === 2 && (
        <div className="animate-in fade-in duration-300">
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-[#f3e8ff] p-3 rounded-2xl text-[#a855f7] border-[3px] border-[#a855f7]/25"><ClipboardList className="w-7 h-7" strokeWidth={2.5} /></div>
            <div>
              <h3 className="text-[20px] font-bold text-[#0f172a]">Anamnese Completa</h3>
              <p className="text-[#64748b] text-[14px] font-medium">Historico medico e contraindicacoes</p>
            </div>
          </div>
          <form className="space-y-6 bg-white border-[3px] border-[#00a88e]/25 rounded-2xl p-6">
            <div className="space-y-2">
              <label className="text-[13px] font-bold text-[#00a88e] ml-1">Queixa Principal <span className="text-red-500">*</span></label>
              <textarea value={queixa} onChange={(e) => setQueixa(e.target.value)} rows={3} className="w-full p-4 bg-[#f8fbfb] border-[3px] border-[#00a88e]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e]" placeholder="Descreva o motivo da consulta..." />
            </div>
            <div className="space-y-2">
              <label className="text-[13px] font-bold text-[#00a88e] ml-1">Expectativas do Paciente <span className="text-red-500">*</span></label>
              <textarea value={expectativas} onChange={(e) => setExpectativas(e.target.value)} rows={3} className="w-full p-4 bg-[#f8fbfb] border-[3px] border-[#00a88e]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e]" placeholder="O que o paciente espera do procedimento..." />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              {[
                { state: gestante, setter: setGestante, label: 'Gestante' },
                { state: amamentando, setter: setAmamentando, label: 'Amamentando' },
                { state: anticoagulantes, setter: setAnticoagulantes, label: 'Uso de Anticoagulantes' },
                { state: queloides, setter: setQueloides, label: 'Tendencia a Queloides' },
              ].map((item, idx) => (
                <div key={idx} onClick={() => item.setter(!item.state)} className={`flex items-center gap-3 p-4 border-[3px] rounded-xl cursor-pointer hover:bg-[#e6f7f5] transition-all shadow-sm ${item.state ? 'border-[#00a88e] bg-[#f0fdfa]' : 'border-[#00a88e]/20 bg-[#f8fbfb]'}`}>
                  {item.state ? <CheckSquare className="w-5 h-5 text-[#00a88e]" strokeWidth={2.5} /> : <Square className="w-5 h-5 text-[#00a88e]/40" strokeWidth={2.5} />}
                  <span className={`text-[14px] font-bold ${item.state ? 'text-[#0f766e]' : 'text-[#475569]'}`}>{item.label}</span>
                </div>
              ))}
            </div>
          </form>
        </div>
      )}

      {currentStep === 3 && (
        <div className="animate-in fade-in duration-300">
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-[#eff6ff] p-3 rounded-2xl text-[#3b82f6] border-[3px] border-[#3b82f6]/25"><Eye className="w-7 h-7" strokeWidth={2.5} /></div>
            <div>
              <h3 className="text-[20px] font-bold text-[#0f172a]">Mapeamento Facial Avancado</h3>
              <p className="text-[#64748b] text-[14px] font-medium">Faca o upload da foto e desenhe marcacoes especificas</p>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[13px] font-bold text-[#00a88e]">Fotos tiradas na camera</h4>
              <span className="text-[12px] font-bold text-[#00a88e] bg-[#e6f7f5] px-2 py-0.5 rounded-md">
                {evaluationCapturedPhotos.length}/{EVALUATION_PHOTO_MAX}
              </span>
            </div>

            {evaluationCapturedPhotos.length === 0 ? (
              <div className="bg-[#f8fbfb] border-[3px] border-[#00a88e]/15 rounded-2xl p-4 text-[#64748b] text-[13px] font-medium">
                Toque no botao redondo a direita para tirar uma foto ao vivo.
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {evaluationCapturedPhotos.map((ph, idx) => {
                  const isSelected = evaluationSelectedPhotoIndex === idx;
                  return (
                    <button
                      key={ph.url}
                      type="button"
                      onClick={() => {
                        setEvaluationSelectedPhotoIndex(idx);
                        setImageSrc(ph.url);
                        setPaths([]);
                        setEvaluationAnnotatedPhotoUrl(null);
                      }}
                      className={`w-20 h-20 rounded-2xl overflow-hidden border-[3px] transition-all ${
                        isSelected
                          ? 'border-[#00a88e] ring-[4px] ring-[#00a88e]/20'
                          : 'border-[#00a88e]/15 hover:border-[#00a88e]/40'
                      }`}
                      aria-label="Usar foto capturada"
                    >
                      <img src={ph.url} alt="Foto capturada" className="w-full h-full object-cover" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className={`border-[3px] border-[#00a88e]/25 bg-white shadow-sm rounded-2xl p-6 mb-8 transition-opacity ${!imageSrc ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
            <div className="flex flex-col md:flex-row gap-6 mb-4">
              <div className="flex-1">
                <span className="text-[13px] font-bold text-[#00a88e] mb-3 block">Ferramentas</span>
                <div className="flex gap-2">
                  {['draw', 'point', 'erase'].map((t) => (
                    <button key={t} onClick={() => setActiveTool(t)} className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold border-[3px] transition-all outline-none ${activeTool === t ? 'bg-[#00a88e] text-white border-[#00a88e] shadow-md' : 'bg-[#f8fbfb] text-[#475569] border-[#00a88e]/20 hover:bg-[#e6f7f5] hover:text-[#00a88e]'}`}>
                      {t === 'draw' ? 'Desenhar' : t === 'point' ? 'Ponto' : 'Apagar'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1">
                <span className="text-[13px] font-bold text-[#00a88e] mb-3 block">Cores</span>
                <div className="flex flex-wrap gap-2">
                  {colors.slice(0, 10).map((color) => (
                    <button key={color} onClick={() => { setActiveColor(color); setActiveTool(activeTool === 'erase' ? 'draw' : activeTool); }} className={`w-8 h-8 rounded-full shadow-sm transition-all outline-none ${activeColor === color && activeTool !== 'erase' ? 'ring-[4px] ring-offset-2 ring-[#00a88e]/30 scale-110' : 'hover:scale-110'}`} style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>
            </div>

            {activeTool === 'point' && (
              <div className="flex flex-col md:flex-row items-center gap-6 mb-6 p-4 bg-[#f8fbfb] border-[3px] border-[#00a88e]/15 rounded-xl animate-in fade-in slide-in-from-top-2">
                <div className="flex-1 w-full">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[13px] font-bold text-[#0f766e]">Tamanho do Ponto</label>
                    <span className="text-[12px] font-bold text-[#00a88e] bg-[#e6f7f5] px-2 py-0.5 rounded-md">{pointSize}px</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input type="range" min="3" max="40" value={pointSize} onChange={(e) => setPointSize(parseInt(e.target.value, 10))} className="w-full h-2 bg-[#00a88e]/20 rounded-lg appearance-none cursor-pointer accent-[#00a88e]" />
                    <div className="w-10 h-10 flex items-center justify-center shrink-0 bg-white border-[2px] border-[#00a88e]/20 rounded-xl shadow-sm">
                      <div className="rounded-full transition-all" style={{ width: Math.min(pointSize * 2, 28), height: Math.min(pointSize * 2, 28), backgroundColor: activeColor }} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto md:min-w-[200px]">
                  <div onClick={() => setShowPointNumbers(!showPointNumbers)} className={`flex items-center gap-3 p-3 w-full border-[3px] rounded-xl cursor-pointer transition-all shadow-sm ${showPointNumbers ? 'border-[#00a88e] bg-[#e6f7f5]' : 'border-[#00a88e]/20 bg-white hover:bg-[#f8fbfb]'}`}>
                    {showPointNumbers ? <CheckSquare className="w-5 h-5 text-[#00a88e]" strokeWidth={2.5} /> : <Square className="w-5 h-5 text-[#00a88e]/40" strokeWidth={2.5} />}
                    <span className={`text-[13px] font-bold ${showPointNumbers ? 'text-[#0f766e]' : 'text-[#475569]'}`}>Numerar Pontos</span>
                  </div>
                </div>
              </div>
            )}

            {activeTool === 'erase' && (
              <div className="flex flex-col md:flex-row items-center gap-6 mb-6 p-4 bg-[#f8fbfb] border-[3px] border-[#00a88e]/15 rounded-xl animate-in fade-in slide-in-from-top-2">
                <div className="flex-1 w-full">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[13px] font-bold text-[#0f766e]">Tamanho da Borracha</label>
                    <span className="text-[12px] font-bold text-[#00a88e] bg-[#e6f7f5] px-2 py-0.5 rounded-md">{eraserSize}px</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input type="range" min="5" max="100" value={eraserSize} onChange={(e) => setEraserSize(parseInt(e.target.value, 10))} className="w-full h-2 bg-[#00a88e]/20 rounded-lg appearance-none cursor-pointer accent-[#00a88e]" />
                    <div className="w-10 h-10 flex items-center justify-center shrink-0 bg-white border-[2px] border-[#00a88e]/20 rounded-xl shadow-sm relative overflow-hidden">
                      <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#00a88e 2px, transparent 2px)', backgroundSize: '6px 6px' }} />
                      <div className="rounded-full border-[2px] border-gray-700 bg-white/80 z-10 transition-all" style={{ width: Math.min(eraserSize, 28), height: Math.min(eraserSize, 28) }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {imageSrc && (
              <div className="mb-4 flex justify-end">
                <label className="cursor-pointer text-[13px] font-bold text-[#00a88e] hover:text-[#00967f] bg-[#e6f7f5] border-[3px] border-[#00a88e]/15 hover:bg-[#f0fdfa] px-4 py-2 rounded-xl transition-all">
                  Trocar por upload
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                </label>
              </div>
            )}

            <div className="flex gap-4 mt-2">
              <button onClick={() => setPaths((prev) => prev.slice(0, -1))} className="flex-1 py-2.5 bg-[#fffbeb] border-[3px] border-[#f59e0b]/40 hover:bg-[#fef3c7] text-[#b45309] rounded-xl font-bold text-[13px] transition-all outline-none shadow-sm">Desfazer</button>
              <button onClick={() => setPaths([])} className="flex-1 py-2.5 bg-[#fef2f2] border-[3px] border-red-300 hover:bg-red-50 text-red-600 rounded-xl font-bold text-[13px] transition-all outline-none shadow-sm">Limpar Tudo</button>
            </div>
          </div>

          <div className="mb-6">
            {!imageSrc ? (
              <label className="flex flex-col items-center justify-center w-full h-[300px] border-[3px] border-dashed border-[#00a88e]/40 rounded-2xl cursor-pointer bg-[#f0fdfa] hover:bg-[#e6f7f5] transition-all">
                <Upload className="w-10 h-10 text-[#00a88e] mb-4" strokeWidth={2} />
                <p className="font-bold text-[#0f766e] text-[16px]">Carregar foto do paciente</p>
                <p className="text-[13px] text-[#00a88e]/70 mt-1 font-medium">Clique para escolher uma imagem do seu computador</p>
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
              </label>
            ) : (
              <div className="relative rounded-[20px] overflow-hidden border-[4px] border-[#00a88e]/30 shadow-lg" ref={containerRef}>
                <img src={imageSrc} alt="Paciente" className="w-full max-h-[500px] object-contain block bg-[#f8fbfb]" />
                <canvas
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={handleMouseMove}
                  onMouseUp={endDrawing}
                  onMouseLeave={handleMouseLeave}
                  onMouseEnter={handleMouseEnter}
                  onTouchStart={startDrawing}
                  onTouchMove={handleMouseMove}
                  onTouchEnd={handleMouseLeave}
                  className={`absolute top-0 left-0 w-full h-full touch-none ${activeTool === 'erase' || activeTool === 'point' ? 'cursor-none' : 'cursor-crosshair'}`}
                  style={{ zIndex: 10 }}
                />

                {isHoveringCanvas && (activeTool === 'erase' || activeTool === 'point') && (
                  <div
                    className="absolute rounded-full pointer-events-none z-20 shadow-sm"
                    style={{
                      width: activeTool === 'erase' ? eraserSize : pointSize * 2,
                      height: activeTool === 'erase' ? eraserSize : pointSize * 2,
                      left: cursorPos.x - (activeTool === 'erase' ? eraserSize / 2 : pointSize),
                      top: cursorPos.y - (activeTool === 'erase' ? eraserSize / 2 : pointSize),
                      border: `2px solid ${activeTool === 'erase' ? 'rgba(0,0,0,0.6)' : activeColor}`,
                      backgroundColor: activeTool === 'erase' ? 'rgba(255,255,255,0.7)' : `${activeColor}40`,
                    }}
                  />
                )}
              </div>
            )}
          </div>

          {imageSrc && (
            <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
              <button
                type="button"
                onClick={saveAnnotatedEvaluationPhoto}
                disabled={!imageSrc || !paths || paths.length === 0}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-[14px] transition-all outline-none shadow-sm border-[3px] ${
                  paths && paths.length > 0
                    ? 'bg-[#00a88e] hover:bg-[#00967f] text-white border-transparent'
                    : 'bg-[#f8fbfb] text-[#94a3b8] border-[#e2e8f0] cursor-not-allowed shadow-none'
                }`}
              >
                <CheckCircle className="w-4 h-4" strokeWidth={3} />
                Salvar foto desenhada
              </button>

              {evaluationAnnotatedPhotoUrl && (
                <div className="w-20 h-20 rounded-2xl overflow-hidden border-[3px] border-[#00a88e]/20 bg-white shadow-sm">
                  <img src={evaluationAnnotatedPhotoUrl} alt="Foto desenhada salva" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {currentStep === 4 && (
        <div className="animate-in fade-in duration-300">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-[#dcfce7] p-3 rounded-2xl text-[#22c55e] border-[3px] border-[#22c55e]/25"><Shield className="w-7 h-7" strokeWidth={2.5} /></div>
            <div>
              <h3 className="text-[20px] font-bold text-[#0f172a]">Termo de Consentimento LGPD</h3>
              <p className="text-[#64748b] text-[14px] font-medium">Autorizacao antes do procedimento</p>
            </div>
          </div>
          <div className="bg-[#f0fdfa] border-[3px] border-[#00a88e]/25 rounded-2xl p-8 h-[240px] overflow-y-auto mb-6 shadow-inner">
            <h4 className="font-bold text-[#0f766e] mb-3 text-[16px]">TERMO DE CONSENTIMENTO</h4>
            <p className="text-[14px] text-[#334155] mb-3 font-medium leading-relaxed">Autorizo o tratamento de meus dados pessoais conforme a LGPD (Lei 13.709/2018), incluindo a coleta, armazenamento e uso de informacoes de saude estritamente para a finalidade de realizacao dos procedimentos esteticos.</p>
            <p className="text-[14px] text-[#334155] font-medium leading-relaxed">Declaro que forneci informacoes verdadeiras sobre meu historico medico e assumo a responsabilidade por omitir qualquer condicao de saude que possa interferir no procedimento.</p>
          </div>
          <div className="space-y-3">
            <div onClick={() => setTermoLido(!termoLido)} className={`flex items-center gap-4 p-4 border-[3px] rounded-xl cursor-pointer transition-all shadow-sm ${termoLido ? 'border-[#00a88e] bg-[#e6f7f5]' : 'border-[#00a88e]/25 bg-white hover:bg-[#f8fbfb]'}`}>
              {termoLido ? <CheckSquare className="w-6 h-6 text-[#00a88e]" strokeWidth={2.5} /> : <Square className="w-6 h-6 text-[#00a88e]/40" strokeWidth={2.5} />}
              <span className={`text-[14px] font-bold ${termoLido ? 'text-[#0f766e]' : 'text-[#475569]'}`}>Li e concordo com os termos. Autorizo a realizacao do procedimento.</span>
            </div>
            <div onClick={() => setTermoAssinado(!termoAssinado)} className={`flex items-center gap-4 p-4 border-[3px] rounded-xl cursor-pointer transition-all shadow-sm ${termoAssinado ? 'border-[#00a88e] bg-[#e6f7f5]' : 'border-[#00a88e]/25 bg-white hover:bg-[#f8fbfb]'}`}>
              {termoAssinado ? <CheckSquare className="w-6 h-6 text-[#00a88e]" strokeWidth={2.5} /> : <Square className="w-6 h-6 text-[#00a88e]/40" strokeWidth={2.5} />}
              <span className={`text-[14px] font-bold ${termoAssinado ? 'text-[#0f766e]' : 'text-[#475569]'}`}>Assino digitalmente este termo de consentimento</span>
            </div>
          </div>
        </div>
      )}

      {currentStep === 5 && (
        <div className="animate-in fade-in duration-300">
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-[#dcfce7] p-3 rounded-2xl text-[#22c55e] border-[3px] border-[#22c55e]/25"><Award className="w-7 h-7" strokeWidth={2.5} /></div>
            <div>
              <h3 className="text-[20px] font-bold text-[#0f172a]">Finalizacao do Procedimento</h3>
              <p className="text-[#64748b] text-[14px] font-medium">Orientacoes e confirmacoes finais</p>
            </div>
          </div>
          <div className="bg-[#f0fdfa] border-[3px] border-[#00a88e]/25 rounded-2xl p-6 mb-6 shadow-sm">
            <h4 className="text-[16px] font-bold text-[#0f766e] mb-5 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-[#f59e0b]" /> Orientacoes Pos-Procedimento
            </h4>
            <ul className="space-y-4">
              {['Evitar exposicao solar por 48 horas', 'Nao realizar exercicios fisicos intensos por 24 horas', 'Aplicar compressa fria se houver edema', 'Retorno em 15 dias para avaliacao'].map((txt, i) => (
                <li key={i} className="flex items-center gap-3 text-[#00a88e]">
                  <CheckCircle2 className="w-5 h-5 text-[#00a88e]" strokeWidth={2.5} /><span className="text-[14px] font-bold text-[#334155]">{txt}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <div onClick={() => setOrientacoes(!orientacoes)} className={`flex items-center gap-4 p-4 border-[3px] rounded-xl cursor-pointer transition-all shadow-sm ${orientacoes ? 'border-[#00a88e] bg-[#e6f7f5]' : 'border-[#00a88e]/25 bg-white hover:bg-[#f8fbfb]'}`}>
              {orientacoes ? <CheckSquare className="w-6 h-6 text-[#00a88e]" strokeWidth={2.5} /> : <Square className="w-6 h-6 text-[#00a88e]/40" strokeWidth={2.5} />}
              <span className={`text-[14px] font-bold ${orientacoes ? 'text-[#0f766e]' : 'text-[#475569]'}`}>Orientacoes pos-procedimento fornecidas e compreendidas</span>
            </div>
            <div onClick={() => setSatisfacao(!satisfacao)} className={`flex items-center gap-4 p-4 border-[3px] rounded-xl cursor-pointer transition-all shadow-sm ${satisfacao ? 'border-[#00a88e] bg-[#e6f7f5]' : 'border-[#00a88e]/25 bg-white hover:bg-[#f8fbfb]'}`}>
              {satisfacao ? <CheckSquare className="w-6 h-6 text-[#00a88e]" strokeWidth={2.5} /> : <Square className="w-6 h-6 text-[#00a88e]/40" strokeWidth={2.5} />}
              <span className={`text-[14px] font-bold ${satisfacao ? 'text-[#0f766e]' : 'text-[#475569]'}`}>Paciente confirma satisfacao com o resultado</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mt-10 pt-6 border-t-[3px] border-[#00a88e]/15">
        <button
          onClick={prevStep}
          disabled={currentStep === 1 || isFinishing}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[14px] transition-all outline-none shadow-sm border-[3px] ${currentStep === 1 ? 'text-[#94a3b8] bg-[#f8fbfb] border-[#e2e8f0] cursor-not-allowed' : 'text-[#00a88e] bg-white border-[#00a88e]/25 hover:bg-[#e6f7f5] hover:border-[#00a88e]'}`}
        >
          <ChevronLeft className="w-4 h-4" strokeWidth={3} /> Anterior
        </button>

        {currentStep < 5 ? (
          <button
            onClick={handleNextStep}
            className="flex items-center gap-2 bg-[#00a88e] hover:bg-[#00967f] text-white px-6 py-3 rounded-xl font-bold text-[14px] transition-all outline-none shadow-md hover:shadow-lg border-[3px] border-transparent"
          >
            Proximo <ChevronRight className="w-4 h-4" strokeWidth={3} />
          </button>
        ) : (
          <button
            onClick={handleFinishJourney}
            disabled={!orientacoes || !satisfacao || isFinishing}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[14px] transition-all outline-none shadow-md border-[3px] ${orientacoes && satisfacao ? 'bg-[#00a88e] hover:bg-[#00967f] text-white border-transparent' : 'bg-[#f8fbfb] text-[#94a3b8] border-[#e2e8f0] cursor-not-allowed shadow-none'}`}
          >
            {isFinishing ? 'Salvando...' : 'Finalizar Jornada'} <CheckCircle className="w-4 h-4" strokeWidth={3} />
          </button>
        )}
      </div>
    </>
  );
}

