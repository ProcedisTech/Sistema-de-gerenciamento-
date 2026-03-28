import React from 'react';
import { Award, Square, CheckSquare } from 'lucide-react';

export function Step5Finalization({
  orientacoes, setOrientacoes,
  satisfacao, setSatisfacao,
}) {
  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex items-center gap-4 mb-8">
        <div className="bg-[#dcfce7] p-3 rounded-2xl text-[#22c55e] border-[3px] border-[#22c55e]/25">
          <Award className="w-7 h-7" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="text-[20px] font-bold text-[#0f172a]">Finalização do Procedimento</h3>
          <p className="text-[#64748b] text-[14px] font-medium">Orientações e confirmações finais</p>
        </div>
      </div>

      <div className="space-y-6 bg-white border-[3px] border-[#00a88e]/25 rounded-2xl p-6">
        <div>
          <h4 className="text-[18px] font-bold text-[#0f766e] mb-4">Orientações Pós-Procedimento</h4>
          <div className="space-y-3 text-[14px] text-[#475569] font-medium">
            <p>✓ Evite exposição solar direta por 48 horas</p>
            <p>✓ Não toque na área tratada nas primeiras 6 horas</p>
            <p>✓ Mantenha a pele hidratada</p>
            <p>✓ Use protetor solar SPF 50+ nos próximos 7 dias</p>
            <p>✓ Evite atividades físicas intensas por 24 horas</p>
            <p>✓ Entre em contato conosco em caso de dúvidas ou reações</p>
          </div>
        </div>

        <div className="border-t-[3px] border-[#00a88e]/15 pt-6">
          <div
            onClick={() => setOrientacoes(!orientacoes)}
            className={`flex items-center gap-4 p-4 border-[3px] rounded-xl cursor-pointer transition-all shadow-sm ${
              orientacoes ? 'border-[#00a88e] bg-[#e6f7f5]' : 'border-[#00a88e]/25 bg-white hover:bg-[#f8fbfb]'
            }`}
          >
            {orientacoes ? (
              <CheckSquare className="w-6 h-6 text-[#00a88e]" strokeWidth={2.5} />
            ) : (
              <Square className="w-6 h-6 text-[#00a88e]/40" strokeWidth={2.5} />
            )}
            <span className={`text-[14px] font-bold ${orientacoes ? 'text-[#0f766e]' : 'text-[#475569]'}`}>
              Recebi e compreendi as orientações pós-procedimento
            </span>
          </div>

          <div
            onClick={() => setSatisfacao(!satisfacao)}
            className={`flex items-center gap-4 p-4 border-[3px] rounded-xl cursor-pointer transition-all shadow-sm mt-3 ${
              satisfacao ? 'border-[#00a88e] bg-[#e6f7f5]' : 'border-[#00a88e]/25 bg-white hover:bg-[#f8fbfb]'
            }`}
          >
            {satisfacao ? (
              <CheckSquare className="w-6 h-6 text-[#00a88e]" strokeWidth={2.5} />
            ) : (
              <Square className="w-6 h-6 text-[#00a88e]/40" strokeWidth={2.5} />
            )}
            <span className={`text-[14px] font-bold ${satisfacao ? 'text-[#0f766e]' : 'text-[#475569]'}`}>
              Paciente confirma satisfação com o resultado
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

