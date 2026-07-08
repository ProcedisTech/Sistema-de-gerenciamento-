import React from 'react';

/**
 * Símbolo Procedi (3 nós) — cores travadas do protótipo aprovado.
 * Usado apenas no GlobalHeader; favicon estático em public/favicon.svg.
 */
export function ProcediSymbol({ className = 'h-8 w-8', ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      className={className}
      aria-hidden
      {...props}
    >
      <line x1="16" y1="8" x2="16" y2="16" stroke="#0f5132" strokeWidth="2.6" />
      <line x1="16" y1="16" x2="16" y2="24" stroke="#0f5132" strokeWidth="2.6" />
      <circle cx="16" cy="8" r="5" fill="none" stroke="#0f5132" strokeWidth="2.6" />
      <circle cx="16" cy="16" r="6" fill="#0d7a5f" />
      <circle cx="16" cy="24" r="5" fill="#0a2e23" />
    </svg>
  );
}
