/** Timeout de inatividade — constantes centralizadas. */

export const SESSION_TIMEOUT_MS =
  Number(import.meta.env.VITE_SESSION_TIMEOUT_MIN || 15) * 60_000;

export const SESSION_WARNING_BEFORE_MS = 2 * 60_000;

export const ACTIVITY_THROTTLE_MS = 5_000;

export const SESSION_STORAGE_KEY = 'procedi_last_activity';
