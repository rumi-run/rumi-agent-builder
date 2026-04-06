/**
 * Map thrown errors (especially from api.js with err.status) to safe user-visible English strings.
 */
export function userFacingError(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;

  const status = typeof err.status === 'number' ? err.status : undefined;
  const msg = typeof err.message === 'string' ? err.message : '';

  if (status === 401) {
    return 'Your session expired. Sign in again.';
  }
  if (status === 403) {
    return 'You do not have permission to do that.';
  }
  if (status === 404) {
    return 'The requested item was not found.';
  }
  if (status === 409) {
    return msg || 'This action conflicts with the current state. Refresh and try again.';
  }
  if (status === 429) {
    return 'Too many requests. Please wait and try again.';
  }
  if (status === 503) {
    return msg || 'The service is temporarily unavailable. Please try again later.';
  }
  if (status >= 500) {
    return 'The service is temporarily unavailable. Please try again later.';
  }
  if (status >= 400) {
    return msg || 'The request could not be completed.';
  }

  if (err.name === 'TypeError' || /failed to fetch|network/i.test(msg)) {
    return 'Network error. Check your connection and try again.';
  }

  if (msg && !/^\s*error\s*:/i.test(msg)) {
    return msg;
  }

  return fallback;
}
