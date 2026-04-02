import React from 'react';
import { ErrorBoundary } from './ErrorBoundary.jsx';
import App from './App.jsx';
import { OrgProvider } from '../contexts/OrgContext.jsx';

export default function AppRoot() {
  return (
    <ErrorBoundary>
      <OrgProvider>
        <App />
      </OrgProvider>
    </ErrorBoundary>
  );
}

