import React from 'react';
import { X, User, Clock, MapPin, Activity, FileText, AlertTriangle } from 'lucide-react';
import { formatData, formatarEntidade, ACOES_MAP, BADGE_CORES } from './AuditoriaUtils';

function tryParseJSON(jsonString) {
  try {
    const o = JSON.parse(jsonString);
    if (o && typeof o === "object") {
        return o;
    }
  } catch (e) { // eslint-disable-line no-unused-vars
    // ignorar
  }
  return false;
}

const renderValue = (val) => {
  if (val === null || val === undefined) return <span className="text-slate-400 italic">vazio</span>;
  if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};

export function AuditoriaDetailsModal({ registro, onClose }) {
  if (!registro) return null;

  const acao = ACOES_MAP[registro.acao] ?? { label: registro.acao?.replace(/_/g, ' ') || 'Ação', cor: 'blue' };
  
  let antigoObj = null;
  let novoObj = null;
  
  if (registro.dadosAntigos) {
    antigoObj = tryParseJSON(registro.dadosAntigos) || registro.dadosAntigos;
  }
  if (registro.dadosNovos) {
    novoObj = tryParseJSON(registro.dadosNovos) || registro.dadosNovos;
  }

  const hasDiffs = antigoObj && novoObj && typeof antigoObj === 'object' && typeof novoObj === 'object';
  
  let changedKeys = [];
  if (hasDiffs) {
    const allKeys = new Set([...Object.keys(antigoObj), ...Object.keys(novoObj)]);
    for (const key of allKeys) {
      if (JSON.stringify(antigoObj[key]) !== JSON.stringify(novoObj[key])) {
        changedKeys.push(key);
      }
    }
  }

  return (
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 sm:p-6 backdrop-blur-md"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-5 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-teal-50 p-2 text-teal-600">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-slate-900 leading-tight">Detalhes da Ação</h2>
                {registro.suspeito && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-bold uppercase tracking-wider">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Suspeito
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-slate-500">
                Auditoria de segurança e rastreabilidade
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-400 border border-slate-200 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-600 active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Main Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-slate-400" />
                <h3 className="text-sm font-bold text-slate-700">Responsável</h3>
              </div>
              <div className="font-semibold text-slate-900">{registro.nomeUsuario}</div>
              <div className="text-xs text-slate-500 mt-0.5">{registro.papel}</div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-slate-400" />
                <h3 className="text-sm font-bold text-slate-700">Data e Hora</h3>
              </div>
              <div className="font-semibold text-slate-900">{formatData(registro.criadoEm)}</div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 sm:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-slate-400" />
                    <h3 className="text-sm font-bold text-slate-700">Ação / Entidade</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wider ${BADGE_CORES[acao.cor]}`}>
                      {acao.label}
                    </span>
                    <span className="text-sm font-medium text-slate-600 ml-2">
                      {formatarEntidade(registro.entidade)}
                    </span>
                  </div>
               </div>
            </div>

            {registro.descricao && (
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 sm:col-span-2">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <h3 className="text-sm font-bold text-slate-700">Descrição da Ação</h3>
                </div>
                <p className="text-sm text-slate-800 bg-white p-3 rounded-xl border border-slate-200 shadow-sm leading-relaxed">
                  {registro.descricao}
                </p>
              </div>
            )}

            <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100 sm:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-4 w-4 text-blue-500" />
                <h3 className="text-sm font-bold text-blue-800">Origem da Ação</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-blue-600/70 font-semibold text-xs block mb-1 uppercase tracking-wider">Endereço IP</span>
                  <span className="font-medium text-blue-900 font-mono bg-blue-100/50 px-2 py-1 rounded-md">{registro.ipOrigem || 'Não registrado'}</span>
                </div>
                <div>
                  <span className="text-blue-600/70 font-semibold text-xs block mb-1 uppercase tracking-wider">Dispositivo / Navegador</span>
                  <span className="font-medium text-blue-900 break-all">{registro.userAgent || 'Não registrado'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Diffs */}
          {hasDiffs && changedKeys.length > 0 && (
            <div className="border-t border-slate-100 pt-6 mt-6">
              <h3 className="text-base font-bold text-slate-900 mb-4">Alterações Detalhadas</h3>
              <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-bold text-slate-600">Campo</th>
                      <th className="px-4 py-3 font-bold text-rose-600 bg-rose-50/30">Valor Anterior</th>
                      <th className="px-4 py-3 font-bold text-emerald-600 bg-emerald-50/30">Novo Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {changedKeys.map(k => (
                      <tr key={k} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-700 font-mono text-xs">{k}</td>
                        <td className="px-4 py-3 bg-rose-50/10 text-slate-600 break-words">{renderValue(antigoObj[k])}</td>
                        <td className="px-4 py-3 bg-emerald-50/10 text-slate-900 font-medium break-words">{renderValue(novoObj[k])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {(!hasDiffs && (registro.dadosAntigos || registro.dadosNovos)) && (
            <div className="border-t border-slate-100 pt-6 mt-6">
               <h3 className="text-base font-bold text-slate-900 mb-4">Dados Técnicos</h3>
               <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto text-xs font-mono text-emerald-400">
                 <pre>{JSON.stringify({ antigo: antigoObj, novo: novoObj }, null, 2)}</pre>
               </div>
            </div>
          )}

        </div>
        
        {/* Footer */}
        <div className="flex shrink-0 justify-end border-t border-slate-100 bg-slate-50/50 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow-md active:scale-95"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
