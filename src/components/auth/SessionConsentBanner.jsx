import React from 'react';
import { Shield } from 'lucide-react';

export function CookieConsent({ cookieConsentAccepted, acceptCookies }) {
  if (cookieConsentAccepted) return null;

  return (
    <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[120] w-[92vw] max-w-[520px]">
      <div className="bg-white rounded-2xl border-[3px] border-[#00a88e]/25 shadow-xl overflow-hidden">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <Shield className="w-6 h-6 text-[#00a88e]" strokeWidth={2.5} />
            <h3 className="text-[16px] font-bold text-[#0f172a]">Cookies</h3>
          </div>
          <p className="text-[13px] text-[#475569] font-medium mb-4">
            Usamos cookies para manter sua sessão e melhorar a experiência. Aceitando, você concorda com o uso de cookies.
          </p>
          <button
            type="button"
            onClick={acceptCookies}
            className="w-full bg-[#00a88e] hover:bg-[#00967f] text-white py-3 px-4 rounded-xl font-bold transition-all shadow-md border-[3px] border-transparent"
          >
            Aceitar cookies
          </button>
        </div>
      </div>
    </div>
  );
}

