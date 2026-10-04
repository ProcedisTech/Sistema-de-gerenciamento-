import React from 'react';

/** Tela exibida no lugar do shell enquanto o contexto da clínica não está pronto. */
export function ContextoClinicaTela({ estado, onTentarDeNovo }) {
  if (estado === 'carregando') {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-[#f0fdfa] to-[#f8fbfb]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#00a88e] border-t-transparent" />
          <p className="font-bold text-[#00a88e]">Preparando sessão…</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-[#f0fdfa] to-[#f8fbfb] px-4">
      <div className="max-w-md text-center">
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-[14px] font-medium text-red-800">
          {estado === 'semClinica'
            ? 'Nenhuma clínica selecionada.'
            : 'Não foi possível carregar os dados da clínica.'}
        </p>
        <button
          type="button"
          onClick={onTentarDeNovo}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00a88e] py-3 text-[15px] font-bold text-white transition-colors hover:bg-[#00967f] disabled:opacity-60"
        >
          Tentar de novo
        </button>
      </div>
    </div>
  );
}
