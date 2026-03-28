import React from 'react';
import { Shield } from 'lucide-react';
import { Square, CheckSquare } from 'lucide-react';

export function Step4LGPD({
  termoLido, setTermoLido,
  termoAssinado, setTermoAssinado,
}) {
  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex items-center gap-4 mb-6">
        <div className="bg-[#dcfce7] p-3 rounded-2xl text-[#22c55e] border-[3px] border-[#22c55e]/25">
          <Shield className="w-7 h-7" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="text-[20px] font-bold text-[#0f172a]">Termo de Consentimento LGPD</h3>
          <p className="text-[#64748b] text-[14px] font-medium">Autorização antes do procedimento</p>
        </div>
      </div>

      <div className="bg-[#f0fdfa] border-[3px] border-[#00a88e]/25 rounded-2xl p-8 h-[240px] overflow-y-auto mb-6 shadow-inner">
        <h4 className="font-bold text-[#0f766e] mb-3 text-[16px]">TERMO DE CONSENTIMENTO</h4>
        <p className="text-[14px] text-[#334155] mb-3 font-medium leading-relaxed">
          Autorizo o tratamento de meus dados pessoais conforme a LGPD (Lei 13.709/2018), incluindo a coleta, armazenamento e uso de informações de saúde estritamente para a finalidade de realização dos procedimentos estéticos.
        </p>
        <p className="text-[14px] text-[#334155] font-medium leading-relaxed">
          Declaro que forneci informações verdadeiras sobre meu histórico médico e assumo a responsabilidade por omitir qualquer condição de saúde que possa interferir no procedimento.
        </p>
      </div>

      <div className="space-y-3">
        <div
          onClick={() => setTermoLido(!termoLido)}
          className={`flex items-center gap-4 p-4 border-[3px] rounded-xl cursor-pointer transition-all shadow-sm ${
            termoLido ? 'border-[#00a88e] bg-[#e6f7f5]' : 'border-[#00a88e]/25 bg-white hover:bg-[#f8fbfb]'
          }`}
        >
          {termoLido ? (
            <CheckSquare className="w-6 h-6 text-[#00a88e]" strokeWidth={2.5} />
          ) : (
            <Square className="w-6 h-6 text-[#00a88e]/40" strokeWidth={2.5} />
          )}
          <span className={`text-[14px] font-bold ${termoLido ? 'text-[#0f766e]' : 'text-[#475569]'}`}>
            Li e concordo com os termos. Autorizo a realização do procedimento.
          </span>
        </div>

        <div
          onClick={() => setTermoAssinado(!termoAssinado)}
          className={`flex items-center gap-4 p-4 border-[3px] rounded-xl cursor-pointer transition-all shadow-sm ${
            termoAssinado ? 'border-[#00a88e] bg-[#e6f7f5]' : 'border-[#00a88e]/25 bg-white hover:bg-[#f8fbfb]'
          }`}
        >
          {termoAssinado ? (
            <CheckSquare className="w-6 h-6 text-[#00a88e]" strokeWidth={2.5} />
          ) : (
            <Square className="w-6 h-6 text-[#00a88e]/40" strokeWidth={2.5} />
          )}
          <span className={`text-[14px] font-bold ${termoAssinado ? 'text-[#0f766e]' : 'text-[#475569]'}`}>
            Assino digitalmente este termo de consentimento
          </span>
        </div>
      </div>
    </div>
  );
}

