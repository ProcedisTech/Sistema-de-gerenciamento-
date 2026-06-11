import React, { useCallback, useMemo, useState } from 'react';
import { DisponibilidadeRevisionContext } from './disponibilidadeRevisionContext.js';

export function DisponibilidadeRevisionProvider({ children }) {
  const [revision, setRevision] = useState(0);

  const bumpRevision = useCallback(() => {
    setRevision((n) => n + 1);
  }, []);

  const value = useMemo(() => ({ revision, bumpRevision }), [revision, bumpRevision]);

  return (
    <DisponibilidadeRevisionContext.Provider value={value}>
      {children}
    </DisponibilidadeRevisionContext.Provider>
  );
}
