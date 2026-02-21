'use client';

import { useEffect, useState } from 'react';
import { getSessionId, resetSessionId } from '@/lib/session';

export function useSessionId() {
  const [sessionId, setSessionId] = useState<string>('');

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  function reset() {
    setSessionId(resetSessionId());
  }

  return { sessionId, reset };
}
