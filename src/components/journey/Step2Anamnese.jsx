import React from 'react';
import { ClipboardList, Square, CheckSquare } from 'lucide-react';

export function Step2Anamnese({
  queixa, setQueixa,
  expectativas, setExpectativas,
  gestante, setGestante,
  amamentando, setAmamentando,
  anticoagulantes, setAnticoagulantes,
  queloides, setQueloides,
}) {
  const items = [
    { state: gestante, setter: setGestante, label: 'Gestante' },
    { state: amamentando, setter: setAmamentando, label: 'Amamentando' },
    { state: anticoagulantes, setter: setAnticoagulantes, label: 'Uso de Anticoagulantes' },
    { state: queloides, setter: setQueloides, label: 'Histórico de Queloides' },
  ];

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex items-center gap-4 mb-8">
        <div className="bg-[#f3e8ff] p-3 rounded-2xl text-[#a855f7] border-[3px] border-[#a855f7]/25">
          <ClipboardList className="w-7 h-7" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="text-[20px] font-bold text-[#0f172a]">Anamnese Completa</h3>
          <p className="text-[#64748b] text-[14px] font-medium">Histórico médico e contraindicações</p>
        </div>
      </div>

      <form className="space-y-6 bg-white border-[3px] border-[#00a88e]/25 rounded-2xl p-6">
        <div className="space-y-2">
          <label className="text-[13px] font-bold text-[#00a88e] ml-1">Queixa Principal <span className="text-red-500">*</span></label>
          <textarea
            value={queixa}
            onChange={(e) => setQueixa(e.target.value)}
            rows={3}
            className="w-full p-4 bg-[#f8fbfb] border-[3px] border-[#00a88e]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e]"
            placeholder="Descreva o motivo da consulta..."
          />
        </div>

        <div className="space-y-2">
          <label className="text-[13px] font-bold text-[#00a88e] ml-1">Expectativas do Paciente <span className="text-red-500">*</span></label>
          <textarea
            value={expectativas}
            onChange={(e) => setExpectativas(e.target.value)}
            rows={3}
            className="w-full p-4 bg-[#f8fbfb] border-[3px] border-[#00a88e]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e]"
            placeholder="O que o paciente espera do procedimento..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t-[3px] border-[#00a88e]/15">
          {items.map((item, idx) => (
            <div
              key={idx}
              onClick={() => item.setter(!item.state)}
              className={`flex items-center gap-4 p-4 border-[3px] rounded-xl cursor-pointer transition-all shadow-sm ${
                item.state ? 'border-[#00a88e] bg-[#e6f7f5]' : 'border-[#00a88e]/25 bg-white hover:bg-[#f8fbfb]'
              }`}
            >
              {item.state ? (
                <CheckSquare className="w-6 h-6 text-[#00a88e]" strokeWidth={2.5} />
              ) : (
                <Square className="w-6 h-6 text-[#00a88e]/40" strokeWidth={2.5} />
              )}
              <span className={`text-[14px] font-bold ${item.state ? 'text-[#0f766e]' : 'text-[#475569]'}`}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </form>
    </div>
  );
}

