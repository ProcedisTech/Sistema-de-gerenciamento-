import React from 'react';

/** Layout da view consulta — sem lógica de negócio nem estado. */
export function ConsultaViewShell({ children, compact = false }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div
          className={
            compact
              ? 'mx-auto w-full max-w-[1600px] p-3 pb-28 [-webkit-overflow-scrolling:touch] sm:p-4 md:px-6 md:pt-4 md:pb-28'
              : 'mx-auto w-full max-w-[1600px] p-3 pb-28 [-webkit-overflow-scrolling:touch] sm:p-6 md:px-8 md:pt-8 md:pb-28'
          }
        >
          <div
            className={
              compact
                ? 'rounded-[20px] border border-app-border bg-white p-3 shadow-app-card sm:p-5'
                : 'rounded-[20px] border border-app-border bg-white p-4 shadow-app-card sm:p-8'
            }
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
