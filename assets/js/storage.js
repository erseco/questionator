/**
 * Questionator - Local Storage Management
 * Only non-sensitive settings and explicitly opt-in remembered API keys are persisted.
 */

const STORAGE_KEY_API_KEY = 'questionator_api_key';
const STORAGE_KEY_REMEMBER_KEY = 'questionator_remember_key';
const STORAGE_KEY_THEME = 'questionator_theme';
const STORAGE_KEY_ENDPOINT = 'questionator_custom_endpoint';

export const DEFAULT_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';

/**
 * Loads the saved custom endpoint URL, or returns the default.
 * @returns {string}
 */
export function loadSavedEndpoint() {
  try {
    return localStorage.getItem(STORAGE_KEY_ENDPOINT) || DEFAULT_ENDPOINT;
  } catch {
    return DEFAULT_ENDPOINT;
  }
}

/**
 * Saves a custom endpoint URL.
 * @param {string} endpoint
 */
export function saveEndpoint(endpoint) {
  try {
    const clean = (endpoint || '').trim();
    if (clean && clean !== DEFAULT_ENDPOINT) {
      localStorage.setItem(STORAGE_KEY_ENDPOINT, clean);
    } else {
      localStorage.removeItem(STORAGE_KEY_ENDPOINT);
    }
  } catch {
    // Storage access might be restricted
  }
}

/**
 * Resets the endpoint URL to default.
 */
export function resetSavedEndpoint() {
  try {
    localStorage.removeItem(STORAGE_KEY_ENDPOINT);
  } catch {
    // Storage access might be restricted
  }
}

/**
 * Checks if the user opted to remember the API key on this device.
 * @returns {boolean}
 */
export function isRememberApiKeyEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY_REMEMBER_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Loads the stored API key if the user previously opted in.
 * @returns {string} The stored API key or empty string.
 */
export function loadSavedApiKey() {
  try {
    if (isRememberApiKeyEnabled()) {
      return localStorage.getItem(STORAGE_KEY_API_KEY) || '';
    }
  } catch {
    // Storage access might be restricted
  }
  return '';
}

/**
 * Saves or removes the API key from localStorage based on user preference.
 * @param {string} apiKey - The API key.
 * @param {boolean} remember - Whether to persist the key in localStorage.
 */
export function saveApiKey(apiKey, remember) {
  try {
    if (remember && apiKey) {
      localStorage.setItem(STORAGE_KEY_REMEMBER_KEY, 'true');
      localStorage.setItem(STORAGE_KEY_API_KEY, apiKey);
    } else {
      localStorage.removeItem(STORAGE_KEY_REMEMBER_KEY);
      localStorage.removeItem(STORAGE_KEY_API_KEY);
    }
  } catch {
    // Storage access might be restricted
  }
}

/**
 * Clears the stored API key completely.
 */
export function clearSavedApiKey() {
  try {
    localStorage.removeItem(STORAGE_KEY_REMEMBER_KEY);
    localStorage.removeItem(STORAGE_KEY_API_KEY);
  } catch {
    // Storage access might be restricted
  }
}

/**
 * Loads the user's theme preference.
 * @returns {'auto' | 'light' | 'dark'}
 */
export function loadSavedTheme() {
  try {
    const theme = localStorage.getItem(STORAGE_KEY_THEME);
    if (theme === 'light' || theme === 'dark' || theme === 'auto') {
      return theme;
    }
  } catch {
    // Storage access might be restricted
  }
  return 'auto';
}

/**
 * Saves the user's theme preference.
 * @param {'auto' | 'light' | 'dark'} theme
 */
export function saveTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY_THEME, theme);
  } catch {
    // Storage access might be restricted
  }
}
