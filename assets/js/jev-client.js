/**
 * Questionator - TypeSafe JEV Transport Client
 * Isolated client module communicating with the TypeSafe JEV System One endpoint.
 *
 * NOTE: Application data is only sent to TypeSafe/JEV upon explicit user request.
 * The API key is NEVER logged, committed, or exposed in error messages.
 */

import { formatQuestionsForJev } from './question-parser.js';

export const DEFAULT_JEV_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const DEFAULT_MODEL = 'jev-latest';
const MAX_RETRIES = 2;
const BASE_RETRY_DELAY_MS = 1000;

/**
 * Custom error class for JEV API and network errors.
 */
export class JevError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = options.name || 'JevError';
    this.status = options.status || null;
    this.isCors = Boolean(options.isCors);
    this.isRetryable = Boolean(options.isRetryable);
    this.details = options.details || null;
  }
}

/**
 * Evaluates questions against reference documents using TypeSafe JEV.
 *
 * @param {object} params
 * @param {string} params.apiKey - TypeSafe API key (Bearer token).
 * @param {Array<{ name: string, content: string }>} params.documents - Reference documents.
 * @param {Array<object>} params.questions - Parsed question objects.
 * @param {string} [params.endpointUrl] - API endpoint URL (defaults to official TypeSafe System One).
 * @param {string} [params.guidance] - Optional prompt guidance.
 * @param {AbortSignal} [params.signal] - AbortSignal for request cancellation.
 * @returns {Promise<{
 *   model: string,
 *   answers: object,
 *   usage: { input_tokens?: number, output_tokens?: number },
 *   latencyMs: number,
 *   rawResponse: object,
 *   requestPayload: object
 * }>}
 */
export async function evaluateQuestionsWithJev({
  apiKey,
  documents,
  questions,
  endpointUrl,
  guidance,
  signal
}) {
  const targetEndpoint = (endpointUrl || '').trim() || DEFAULT_JEV_ENDPOINT;
  // Input validation
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    throw new JevError('TypeSafe API key is required.', { name: 'JevAuthError' });
  }

  const validQuestions = (questions || []).filter(q => q.isValid);
  if (validQuestions.length === 0) {
    throw new JevError('No valid questions available to evaluate. Please check the questionnaire.', {
      name: 'JevValidationError'
    });
  }

  // Build JEV System One request payload
  const formattedQuestions = formatQuestionsForJev(validQuestions, guidance);

  // Format reference documents into state
  const referenceDocs = (documents || [])
    .filter(doc => doc.content && doc.content.trim())
    .map(doc => ({
      name: doc.name,
      content: doc.content
    }));

  const payload = {
    model: DEFAULT_MODEL,
    state: {
      reference_documents: referenceDocs
    },
    questions: formattedQuestions
  };

  const startTime = performance.now();
  let response = null;
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    try {
      response = await fetch(targetEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cleanKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: signal
      });

      // If response is OK, break retry loop
      if (response.ok) {
        break;
      }

      // Handle specific HTTP status codes
      if (response.status === 401) {
        throw new JevError(
          'Authentication failed (HTTP 401): The provided TypeSafe API key is invalid or unauthorized.',
          { name: 'JevAuthError', status: 401 }
        );
      }

      if (response.status === 422) {
        let errorDetails = '';
        try {
          const errJson = await response.json();
          errorDetails = errJson.message || errJson.error || JSON.stringify(errJson);
        } catch {
          // ignore
        }
        throw new JevError(
          `Request validation failed (HTTP 422): ${errorDetails || 'The questionnaire payload was rejected by JEV.'}`,
          { name: 'JevValidationError', status: 422, details: errorDetails }
        );
      }

      // 429 Rate Limit or 529/5xx Overloaded: Retry with exponential backoff
      if (response.status === 429 || response.status === 529 || response.status >= 500) {
        attempt++;
        if (attempt <= MAX_RETRIES) {
          const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          await new Promise((resolve, reject) => {
            const timeoutId = setTimeout(resolve, delay);
            if (signal) {
              signal.addEventListener('abort', () => {
                clearTimeout(timeoutId);
                reject(new DOMException('Request cancelled by user', 'AbortError'));
              });
            }
          });
          continue;
        }

        const msg = response.status === 429
          ? 'TypeSafe API rate limit exceeded (HTTP 429). Please wait a moment before trying again.'
          : `TypeSafe API service unavailable or overloaded (HTTP ${response.status}). Please try again shortly.`;

        throw new JevError(msg, {
          name: response.status === 429 ? 'JevRateLimitError' : 'JevServerError',
          status: response.status
        });
      }

      // Other unexpected HTTP errors
      throw new JevError(
        `TypeSafe API returned HTTP error ${response.status} (${response.statusText || 'Unknown'}).`,
        { status: response.status }
      );
    } catch (err) {
      // If user aborted, rethrow directly
      if (err.name === 'AbortError' || (signal && signal.aborted)) {
        throw new JevError('Evaluation was cancelled by user.', { name: 'JevAbortError' });
      }

      // If already a categorized JevError, rethrow
      if (err instanceof JevError) {
        throw err;
      }

      // Detect CORS or preflight failure:
      // In modern browsers, a blocked CORS preflight causes fetch() to throw TypeError with 'Failed to fetch' or 'NetworkError'.
      const isNetworkOrCors = err instanceof TypeError || (err.message && /fetch|network/i.test(err.message));
      if (isNetworkOrCors) {
        throw new JevError(
          'Direct browser request to TypeSafe/JEV was blocked by browser CORS policy or network error. ' +
          'The TypeSafe API endpoint (https://api.typesafe.ai/v1/systemone) does not currently allow direct cross-origin requests from web browsers ' +
          '(preflight OPTIONS returns "Disallowed CORS origin").',
          {
            name: 'JevCorsError',
            isCors: true,
            details: err.message
          }
        );
      }

      throw new JevError(`Unexpected error during JEV evaluation: ${err.message}`, {
        details: err.message
      });
    }
  }

  const latencyMs = Math.round(performance.now() - startTime);

  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new JevError('Failed to parse response from TypeSafe/JEV as JSON.', {
      details: err.message
    });
  }

  if (!data || typeof data !== 'object') {
    throw new JevError('TypeSafe/JEV returned an invalid or empty response.');
  }

  return {
    model: data.model || DEFAULT_MODEL,
    answers: data.answers || {},
    usage: data.usage || {},
    latencyMs: latencyMs,
    rawResponse: data,
    requestPayload: payload
  };
}
