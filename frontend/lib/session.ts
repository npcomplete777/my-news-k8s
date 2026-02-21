const SESSION_KEY = 'anon-news-session-id';

function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Returns the persistent browser session ID, creating one if absent. Returns '' on server. */
export function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = newId();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/** Generates a fresh session ID and persists it. Returns '' on server. */
export function resetSessionId(): string {
  if (typeof window === 'undefined') return '';
  const id = newId();
  localStorage.setItem(SESSION_KEY, id);
  return id;
}
