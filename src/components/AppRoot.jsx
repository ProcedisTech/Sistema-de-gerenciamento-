import React from 'react';
import { ErrorBoundary } from './ErrorBoundary.jsx';

const App = React.lazy(() => import('./App.jsx'));

export default function AppRoot() {
  return (
    <ErrorBoundary>
      <React.Suspense
        fallback={(
          <div
            className="min-h-screen flex flex-col items-center justify-center p-4 font-sans gap-4"
            style={{ backgroundColor: '#f8fbfb', color: '#0f172a' }}
          >
            <div className="bg-[#00a88e] w-14 h-14 rounded-[1.25rem] flex items-center justify-center shadow-md border-[3px] border-[#00a88e]/30 animate-pulse" />
            <p className="text-[15px] text-[#475569] font-medium">Carregando interface...</p>
          </div>
        )}
      >
        <App />
      </React.Suspense>
    </ErrorBoundary>
  );
}

