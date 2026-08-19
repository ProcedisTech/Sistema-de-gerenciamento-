import React from 'react';
import { Tablet, QrCode, MessageCircle, X, Settings } from 'lucide-react';

export function ModalEscolhaAssinatura({
  open,
  onClose,
  onSelectTablet,
  onSelectQrCode,
  onSelectLink,
  opcoes = { tablet: true, qrCode: true, link: true },
  onAbrirConfiguracoes,
}) {
  if (!open) return null;

  const nenhumAtivo = !opcoes.tablet && !opcoes.qrCode && !opcoes.link;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Como o paciente vai assinar?</h3>
            <p className="text-sm text-slate-500">Escolha o método mais adequado</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="p-5 flex flex-col gap-3">
          {nenhumAtivo ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-[14px] font-semibold text-amber-950">
                Nenhum método de assinatura ativo para esta clínica
              </p>
              <p className="mt-1 text-[13px] text-amber-800">
                Ative tablet, QR Code ou link em Configurações para solicitar a assinatura do paciente.
              </p>
              {typeof onAbrirConfiguracoes === 'function' ? (
                <button
                  type="button"
                  onClick={onAbrirConfiguracoes}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#0f172a] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[#1e293b]"
                >
                  <Settings className="h-4 w-4" />
                  Configurações &gt; métodos de assinatura
                </button>
              ) : null}
            </div>
          ) : null}
          {opcoes.tablet && (
            <button
              onClick={onSelectTablet}
              className="flex items-start gap-4 rounded-xl border-2 border-slate-200 p-4 text-left transition-all hover:border-[#0f766e] hover:bg-teal-50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-[#0f766e]">
                <Tablet className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900">Neste Dispositivo</h4>
                <p className="text-sm text-slate-500">Vire a tela e peça para o paciente assinar com o dedo ou caneta.</p>
              </div>
            </button>
          )}

          {opcoes.qrCode && (
            <button
              onClick={onSelectQrCode}
              className="flex items-start gap-4 rounded-xl border-2 border-slate-200 p-4 text-left transition-all hover:border-indigo-600 hover:bg-indigo-50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                <QrCode className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900">QR Code (Celular do Paciente)</h4>
                <p className="text-sm text-slate-500">O paciente aponta a câmera e assina no próprio celular.</p>
              </div>
            </button>
          )}

          {opcoes.link && (
            <button
              onClick={onSelectLink}
              className="flex items-start gap-4 rounded-xl border-2 border-slate-200 p-4 text-left transition-all hover:border-[#25D366] hover:bg-[#25D366]/10"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#25D366]/20 text-[#1ebd5b]">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900">Link via WhatsApp / SMS</h4>
                <p className="text-sm text-slate-500">Envie um link para o celular do paciente para segurança máxima.</p>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
