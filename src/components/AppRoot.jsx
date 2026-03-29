import React from 'react';
import { ErrorBoundary } from './ErrorBoundary.jsx';
import App from './App.jsx';

export default function AppRoot() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

