import React from 'react';

/** Layout da view consulta — sem lógica de negócio nem estado. */
export function ConsultaViewShell({ children }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1600px] p-3 pb-28 [-webkit-overflow-scrolling:touch] sm:p-6 md:px-8 md:pt-8 md:pb-28">
          <div className="rounded-[20px] border border-app-border bg-white p-4 shadow-app-card sm:p-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
