import React, { useEffect } from 'react';
import { ErrorBoundary } from './ErrorBoundary.jsx';
import App from './App.jsx';
import { OrgProvider } from '../contexts/OrgContext.jsx';
import { BackendGate } from './system/BackendGate.jsx';
import { warnDevApiBaseIfMisconfigured } from '../config/apiEnv.js';

function DevApiBaseWarning() {
  useEffect(() => {
    warnDevApiBaseIfMisconfigured();
  }, []);
  return null;
}

export default function AppRoot() {
  return (
    <ErrorBoundary>
      <BackendGate>
        <OrgProvider>
          <DevApiBaseWarning />
          <App />
        </OrgProvider>
      </BackendGate>
    </ErrorBoundary>
  );
}

