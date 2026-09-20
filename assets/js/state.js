/**
 * Questionator - Central Application State
 * Single source of truth for the application.
 */

import { loadSavedApiKey, isRememberApiKeyEnabled, loadSavedEndpoint } from './storage.js';

export const state = {
  apiKey: loadSavedApiKey(),
  rememberApiKey: isRememberApiKeyEnabled(),
  endpointUrl: loadSavedEndpoint(),
  documents: [],
  rawQuestionnaire: '',
  questions: [],
  results: null,
  requestStatus: 'idle', // 'idle' | 'loading' | 'success' | 'error'
  requestError: null,
  debugInfo: null,
  currentAbortController: null
};

const listeners = new Set();

/**
 * Subscribes a listener to state changes.
 * @param {function(string, any): void} listener
 * @returns {function(): void} Unsubscribe function.
 */
export function subscribeState(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Updates application state and notifies listeners.
 * @param {Partial<typeof state>} updates
 * @param {string} [action] - Name of the action triggering the change.
 */
export function setState(updates, action = 'update') {
  Object.assign(state, updates);
  for (const listener of listeners) {
    try {
      listener(action, state);
    } catch {
      // ignore listener errors
    }
  }
}

/**
 * Resets results and request status.
 */
export function clearResults() {
  setState({
    results: null,
    requestStatus: 'idle',
    requestError: null,
    debugInfo: null
  }, 'clearResults');
}
