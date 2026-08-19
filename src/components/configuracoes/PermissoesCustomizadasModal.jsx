import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Loader2 } from 'lucide-react';

/**
 * Pop-up de escolha ao clicar "Editar" num perfil já customizado da clínica na
 * aba Perfis de Acesso: criar um novo perfil (copiando as permissões atuais como
 * ponto de partida) ou editar este perfil diretamente.
 */
export function PermissoesCustomizadasModal({ perfilNome, saving, onClose, onCriarNovo, onEditarExistente }) {
  const [modo, setModo] = useState(null); // null | 'nomear'
  const [nomePerfil, setNomePerfil] = useState('');

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl">
        <div className="flex items-start gap-3 mb-5">
          <div className="p-2.5 bg-amber-50 rounded-xl shrink-0">
            <Sparkles className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Editar perfil</h3>
            <p className="text-sm text-slate-500 mt-1">O que você quer fazer com as permissões de <span className="font-semibold text-slate-700">"{perfilNome}"</span>?</p>
          </div>
        </div>

        {modo === 'nomear' ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-teal-700 mb-1.5 ml-1">Nome do novo perfil</label>
              <input
                autoFocus
                maxLength={50}
                disabled={saving}
                value={nomePerfil}
                onChange={e => setNomePerfil(e.target.value)}
                placeholder="Ex: Profissional Sênior sem Financeiro"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setModo(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={saving || !nomePerfil.trim()}
                onClick={() => onCriarNovo(nomePerfil.trim())}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00a88e] to-teal-500 text-white text-sm font-bold shadow-lg shadow-teal-500/30 disabled:opacity-50 disabled:pointer-events-none transition-all"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Criar perfil
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              disabled={saving}
              onClick={() => setModo('nomear')}
              className="w-full text-left px-4 py-3 rounded-xl border border-teal-200 bg-teal-50/50 hover:bg-teal-50 transition-colors disabled:opacity-50"
            >
              <span className="block text-sm font-bold text-teal-900">Criar novo perfil</span>
              <span className="block text-xs text-teal-700 mt-0.5">Copia as permissões atuais como ponto de partida, com um novo nome.</span>
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={onEditarExistente}
              className="w-full flex items-center justify-between gap-3 text-left px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <span>
                <span className="block text-sm font-bold text-slate-800">Editar "{perfilNome}"</span>
                <span className="block text-xs text-slate-500 mt-0.5">Altera este perfil diretamente — afeta todos os membros que já usam ele.</span>
              </span>
              {saving && <Loader2 className="h-4 w-4 animate-spin text-slate-400 shrink-0" />}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="w-full px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors mt-1 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
