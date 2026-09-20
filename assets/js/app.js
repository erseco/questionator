/**
 * Questionator - Main Application Controller
 */

import { state, setState, clearResults } from './state.js';
import { parseQuestionnaire, validateQuestion } from './question-parser.js';
import { extractFileContent, isSupportedFile, getFileTypeLabel, generateDocId } from './files.js';
import { evaluateQuestionsWithJev, JevError } from './jev-client.js';
import { renderResults } from './results.js';
import {
  loadSavedApiKey,
  isRememberApiKeyEnabled,
  saveApiKey,
  clearSavedApiKey,
  loadSavedTheme,
  saveTheme,
  loadSavedEndpoint,
  saveEndpoint,
  resetSavedEndpoint,
  DEFAULT_ENDPOINT
} from './storage.js';
import { escapeHtml, formatNumber, formatBytes } from './utils.js';

// DOM Elements
let elApiKeyInput;
let elToggleApiKeyBtn;
let elRememberKeyCheck;
let elClearSavedKeyBtn;

let elEndpointInput;
let elBtnResetEndpoint;

let elDocDropZone;
let elDocFileInput;
let elDocListContainer;
let elBtnRemoveAllDocs;
let elDocEmptyState;

let elQuestionnaireInput;
let elBtnParseQuestions;
let elBtnLoadSample;
let elQuestionsWorkbench;
let elQuestionsSummary;
let elQuestionsList;
let elBtnAddQuestion;
let elBtnAskJev;
let elBtnCancelJev;
let elJevStatusContainer;

let elResultsContainer;
let elAlertContainer;
let elThemeSelect;

/**
 * Initializes the application once the DOM is loaded.
 */
export function initApp() {
  cacheDOMElements();
  setupTheme();
  setupApiKeyEvents();
  setupEndpointEvents();
  setupDocumentEvents();
  setupQuestionnaireEvents();
  setupEvaluationEvents();
  setupAlertDismiss();

  // Initial render
  renderDocumentList();
  renderQuestionsWorkbench();
  renderResults(elResultsContainer, null, []);
}

function cacheDOMElements() {
  elApiKeyInput = document.getElementById('api-key-input');
  elToggleApiKeyBtn = document.getElementById('btn-toggle-api-key');
  elRememberKeyCheck = document.getElementById('remember-key-check');
  elClearSavedKeyBtn = document.getElementById('btn-clear-saved-key');

  elEndpointInput = document.getElementById('endpoint-input');
  elBtnResetEndpoint = document.getElementById('btn-reset-endpoint');

  elDocDropZone = document.getElementById('doc-drop-zone');
  elDocFileInput = document.getElementById('doc-file-input');
  elDocListContainer = document.getElementById('doc-list-container');
  elBtnRemoveAllDocs = document.getElementById('btn-remove-all-docs');
  elDocEmptyState = document.getElementById('doc-empty-state');

  elQuestionnaireInput = document.getElementById('questionnaire-input');
  elBtnParseQuestions = document.getElementById('btn-parse-questions');
  elBtnLoadSample = document.getElementById('btn-load-sample');
  elQuestionsWorkbench = document.getElementById('questions-workbench');
  elQuestionsSummary = document.getElementById('questions-summary');
  elQuestionsList = document.getElementById('questions-list');
  elBtnAddQuestion = document.getElementById('btn-add-question');
  elBtnAskJev = document.getElementById('btn-ask-jev');
  elBtnCancelJev = document.getElementById('btn-cancel-jev');
  elJevStatusContainer = document.getElementById('jev-status-container');

  elResultsContainer = document.getElementById('results-container');
  elAlertContainer = document.getElementById('alert-container');
  elThemeSelect = document.getElementById('theme-select');
}

/**
 * Theme setup (Auto / Light / Dark)
 */
function setupTheme() {
  const savedTheme = loadSavedTheme();
  applyTheme(savedTheme);

  if (elThemeSelect) {
    elThemeSelect.value = savedTheme;
    elThemeSelect.addEventListener('change', () => {
      const selected = elThemeSelect.value;
      saveTheme(selected);
      applyTheme(selected);
    });
  }

  // Listen to system preference changes if in auto mode
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (loadSavedTheme() === 'auto') {
      applyTheme('auto');
    }
  });
}

function applyTheme(theme) {
  let effectiveTheme = theme;
  if (theme === 'auto') {
    effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-bs-theme', effectiveTheme);
}

/**
 * API Key Management
 */
function setupApiKeyEvents() {
  // Load saved key if opt-in enabled
  const savedKey = loadSavedApiKey();
  if (savedKey && elApiKeyInput) {
    elApiKeyInput.value = savedKey;
    state.apiKey = savedKey;
  }

  if (elRememberKeyCheck) {
    elRememberKeyCheck.checked = isRememberApiKeyEnabled();
    elRememberKeyCheck.addEventListener('change', () => {
      const remember = elRememberKeyCheck.checked;
      state.rememberApiKey = remember;
      saveApiKey(state.apiKey, remember);
      updateClearKeyButtonVisibility();
    });
  }

  if (elApiKeyInput) {
    elApiKeyInput.addEventListener('input', () => {
      state.apiKey = elApiKeyInput.value.trim();
      if (state.rememberApiKey) {
        saveApiKey(state.apiKey, true);
      }
      updateClearKeyButtonVisibility();
    });
  }

  if (elToggleApiKeyBtn && elApiKeyInput) {
    elToggleApiKeyBtn.addEventListener('click', () => {
      const isPassword = elApiKeyInput.type === 'password';
      elApiKeyInput.type = isPassword ? 'text' : 'password';
      const icon = elToggleApiKeyBtn.querySelector('i');
      if (icon) {
        icon.className = isPassword ? 'bi bi-eye-slash' : 'bi bi-eye';
      }
      elToggleApiKeyBtn.setAttribute('title', isPassword ? 'Hide API key' : 'Show API key');
      elToggleApiKeyBtn.setAttribute('aria-label', isPassword ? 'Hide API key' : 'Show API key');
    });
  }

  if (elClearSavedKeyBtn) {
    elClearSavedKeyBtn.addEventListener('click', () => {
      clearSavedApiKey();
      if (elApiKeyInput) elApiKeyInput.value = '';
      if (elRememberKeyCheck) elRememberKeyCheck.checked = false;
      state.apiKey = '';
      state.rememberApiKey = false;
      updateClearKeyButtonVisibility();
      showAlert('Stored API key removed from this browser.', 'info');
    });
  }

  updateClearKeyButtonVisibility();
}

function updateClearKeyButtonVisibility() {
  if (elClearSavedKeyBtn) {
    const hasStored = Boolean(loadSavedApiKey());
    elClearSavedKeyBtn.style.display = hasStored ? 'inline-block' : 'none';
  }
}

/**
 * Custom API Endpoint Management
 */
function setupEndpointEvents() {
  if (elEndpointInput) {
    elEndpointInput.value = state.endpointUrl;
    elEndpointInput.addEventListener('input', () => {
      const val = elEndpointInput.value.trim();
      state.endpointUrl = val || DEFAULT_ENDPOINT;
      saveEndpoint(val);
    });
  }

  if (elBtnResetEndpoint) {
    elBtnResetEndpoint.addEventListener('click', () => {
      resetSavedEndpoint();
      state.endpointUrl = DEFAULT_ENDPOINT;
      if (elEndpointInput) elEndpointInput.value = DEFAULT_ENDPOINT;
      showAlert('API endpoint reset to official TypeSafe System One.', 'info');
    });
  }
}

/**
 * Reference Documents Management
 */
function setupDocumentEvents() {
  if (elDocDropZone && elDocFileInput) {
    elDocDropZone.addEventListener('click', () => {
      elDocFileInput.click();
    });

    elDocDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      elDocDropZone.classList.add('dragover');
    });

    elDocDropZone.addEventListener('dragleave', () => {
      elDocDropZone.classList.remove('dragover');
    });

    elDocDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      elDocDropZone.classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFilesSelected(Array.from(e.dataTransfer.files));
      }
    });

    elDocFileInput.addEventListener('change', () => {
      if (elDocFileInput.files && elDocFileInput.files.length > 0) {
        handleFilesSelected(Array.from(elDocFileInput.files));
        elDocFileInput.value = ''; // Reset so the same file can be picked again
      }
    });
  }

  if (elBtnRemoveAllDocs) {
    elBtnRemoveAllDocs.addEventListener('click', () => {
      state.documents = [];
      renderDocumentList();
      showAlert('All reference documents removed.', 'secondary');
    });
  }
}

async function handleFilesSelected(files) {
  for (const file of files) {
    if (!isSupportedFile(file)) {
      showAlert(`Unsupported file type: "${file.name}". Supported: PDF, DOCX, TXT, MD, JSON, CSV.`, 'warning');
      continue;
    }

    const docId = generateDocId();
    const docEntry = {
      id: docId,
      name: file.name,
      type: getFileTypeLabel(file.name),
      size: file.size,
      characters: 0,
      content: '',
      status: 'extracting',
      statusMessage: 'Reading file…'
    };

    state.documents.push(docEntry);
    renderDocumentList();

    try {
      const result = await extractFileContent(file, (msg) => {
        docEntry.statusMessage = msg;
        renderDocumentList();
      });

      docEntry.content = result.content;
      docEntry.characters = result.characters;
      docEntry.status = result.warning ? 'warning' : 'ready';
      docEntry.statusMessage = result.warning || 'Ready';

      if (result.warning) {
        showAlert(`Warning for "${file.name}": ${result.warning}`, 'warning');
      }
    } catch (err) {
      docEntry.status = 'error';
      docEntry.statusMessage = err.message || 'Extraction failed';
      showAlert(`Error extracting "${file.name}": ${err.message}`, 'danger');
    }

    renderDocumentList();
  }
}

function renderDocumentList() {
  if (!elDocListContainer) return;

  const docs = state.documents;
  if (docs.length === 0) {
    if (elDocEmptyState) elDocEmptyState.style.display = 'block';
    if (elBtnRemoveAllDocs) elBtnRemoveAllDocs.style.display = 'none';
    elDocListContainer.innerHTML = '';
    return;
  }

  if (elDocEmptyState) elDocEmptyState.style.display = 'none';
  if (elBtnRemoveAllDocs) elBtnRemoveAllDocs.style.display = 'inline-block';

  let html = '<div class="d-flex flex-column gap-2">';
  for (const doc of docs) {
    const isReady = doc.status === 'ready';
    const isExtracting = doc.status === 'extracting';
    const isWarning = doc.status === 'warning';
    const isError = doc.status === 'error';

    let badgeClass = 'bg-secondary';
    if (isReady) badgeClass = 'bg-success';
    if (isExtracting) badgeClass = 'bg-primary';
    if (isWarning) badgeClass = 'bg-warning text-dark';
    if (isError) badgeClass = 'bg-danger';

    html += `
      <div class="card doc-item border shadow-sm" id="${escapeHtml(doc.id)}">
        <div class="card-body p-2 d-flex align-items-center justify-content-between gap-2">
          <div class="flex-grow-1 text-truncate">
            <div class="fw-semibold text-truncate small" title="${escapeHtml(doc.name)}">
              <i class="bi ${getFileIconClass(doc.type)} me-1"></i>
              ${escapeHtml(doc.name)}
            </div>
            <div class="text-muted extra-small" style="font-size: 0.75rem;">
              <span>${escapeHtml(doc.type)}</span>
              ${doc.characters > 0 ? ` · ${formatNumber(doc.characters)} chars` : ''}
              ${doc.size ? ` · ${formatBytes(doc.size)}` : ''}
              · <span class="badge ${badgeClass} extra-small">${escapeHtml(doc.statusMessage)}</span>
            </div>
          </div>
          <button type="button" class="btn btn-outline-danger btn-sm p-1 px-2 btn-remove-doc" data-id="${escapeHtml(doc.id)}" title="Remove document" aria-label="Remove document ${escapeHtml(doc.name)}">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    `;
  }
  html += '</div>';

  elDocListContainer.innerHTML = html;

  // Bind remove buttons
  const removeButtons = elDocListContainer.querySelectorAll('.btn-remove-doc');
  removeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      state.documents = state.documents.filter(d => d.id !== id);
      renderDocumentList();
    });
  });
}

function getFileIconClass(type) {
  switch (type) {
    case 'PDF': return 'bi-file-earmark-pdf text-danger';
    case 'DOCX': return 'bi-file-earmark-word text-primary';
    case 'Markdown': return 'bi-markdown text-info';
    case 'JSON': return 'bi-filetype-json text-warning';
    case 'CSV': return 'bi-file-earmark-spreadsheet text-success';
    default: return 'bi-file-earmark-text text-secondary';
  }
}

/**
 * Questionnaire Workbench & Parser
 */
function setupQuestionnaireEvents() {
  if (elBtnParseQuestions && elQuestionnaireInput) {
    elBtnParseQuestions.addEventListener('click', () => {
      const rawText = elQuestionnaireInput.value;
      if (!rawText.trim()) {
        showAlert('Please paste questionnaire questions first.', 'warning');
        return;
      }

      state.rawQuestionnaire = rawText;
      const parsed = parseQuestionnaire(rawText);
      if (parsed.length === 0) {
        showAlert('No questions could be parsed from the provided text. Please check the format.', 'warning');
        return;
      }

      state.questions = parsed;
      renderQuestionsWorkbench();
      showAlert(`Successfully parsed ${parsed.length} questions.`, 'success');
    });
  }

  if (elBtnLoadSample && elQuestionnaireInput) {
    elBtnLoadSample.addEventListener('click', () => {
      elQuestionnaireInput.value = getSampleQuestionnaire();
      showAlert('Sample questionnaire loaded. Click "Parse questions" to proceed.', 'info');
    });
  }

  if (elBtnAddQuestion) {
    elBtnAddQuestion.addEventListener('click', () => {
      const nextNum = state.questions.length + 1;
      const newQ = {
        id: `q${nextNum}_${Date.now().toString(36)}`,
        number: nextNum,
        text: '',
        options: [
          { id: 'A', text: '' },
          { id: 'B', text: '' }
        ],
        isValid: false,
        validationError: 'Question text is empty.'
      };
      state.questions.push(newQ);
      renderQuestionsWorkbench();
    });
  }
}

function renderQuestionsWorkbench() {
  if (!elQuestionsWorkbench) return;

  const questions = state.questions;
  if (questions.length === 0) {
    elQuestionsWorkbench.style.display = 'none';
    return;
  }

  elQuestionsWorkbench.style.display = 'block';

  // Summary counts
  const total = questions.length;
  const readyCount = questions.filter(q => q.isValid).length;
  const reviewCount = total - readyCount;

  if (elQuestionsSummary) {
    elQuestionsSummary.innerHTML = `
      <div class="d-flex align-items-center gap-2">
        <span class="badge ${readyCount === total ? 'bg-success' : 'bg-primary'} fs-6">
          ${total} ${total === 1 ? 'question' : 'questions'} detected
        </span>
        <span class="badge bg-success-subtle text-success border border-success-subtle">
          ${readyCount} ready
        </span>
        ${reviewCount > 0 ? `
          <span class="badge bg-danger-subtle text-danger border border-danger-subtle">
            ${reviewCount} needs review
          </span>
        ` : ''}
      </div>
    `;
  }

  if (elQuestionsList) {
    let html = '';
    for (let qIdx = 0; qIdx < questions.length; qIdx++) {
      const q = questions[qIdx];
      const isValid = q.isValid;

      html += `
        <div class="card question-edit-card shadow-sm ${isValid ? 'ready' : 'needs-review'} mb-3" data-qid="${escapeHtml(q.id)}">
          <div class="card-header bg-body-tertiary d-flex justify-content-between align-items-center py-2">
            <div class="d-flex align-items-center gap-2">
              <span class="fw-bold">Question ${q.number}</span>
              ${isValid ? `
                <span class="badge bg-success-subtle text-success border border-success-subtle extra-small">Ready</span>
              ` : `
                <span class="badge bg-danger-subtle text-danger border border-danger-subtle extra-small" title="${escapeHtml(q.validationError || 'Invalid')}">
                  ${escapeHtml(q.validationError || 'Needs review')}
                </span>
              `}
            </div>
            <button type="button" class="btn btn-outline-danger btn-sm p-1 px-2 btn-delete-question" data-qid="${escapeHtml(q.id)}" title="Delete question">
              <i class="bi bi-trash"></i>
            </button>
          </div>
          <div class="card-body">
            <!-- Question Text -->
            <div class="mb-3">
              <label class="form-label small fw-semibold text-muted mb-1" for="q-text-${escapeHtml(q.id)}">Question text</label>
              <textarea class="form-control form-control-sm q-text-input" id="q-text-${escapeHtml(q.id)}" data-qid="${escapeHtml(q.id)}" rows="2">${escapeHtml(q.text)}</textarea>
            </div>

            <!-- Options -->
            <div class="options-container d-flex flex-column gap-2 mb-2">
              <label class="form-label small fw-semibold text-muted mb-0">Answer options</label>
      `;

      for (let oIdx = 0; oIdx < q.options.length; oIdx++) {
        const opt = q.options[oIdx];
        html += `
          <div class="option-edit-row">
            <span class="badge bg-secondary option-badge font-monospace">${escapeHtml(opt.id)}</span>
            <input type="text" class="form-control form-control-sm opt-text-input" data-qid="${escapeHtml(q.id)}" data-oid="${escapeHtml(opt.id)}" value="${escapeHtml(opt.text)}" placeholder="Option ${escapeHtml(opt.id)} text">
            <button type="button" class="btn btn-outline-secondary btn-sm p-1 px-2 btn-delete-opt" data-qid="${escapeHtml(q.id)}" data-oid="${escapeHtml(opt.id)}" title="Delete option" ${q.options.length <= 2 ? 'disabled' : ''}>
              <i class="bi bi-x"></i>
            </button>
          </div>
        `;
      }

      html += `
            </div>
            <button type="button" class="btn btn-outline-primary btn-sm mt-1 btn-add-opt" data-qid="${escapeHtml(q.id)}">
              <i class="bi bi-plus me-1"></i> Add option
            </button>
          </div>
        </div>
      `;
    }

    elQuestionsList.innerHTML = html;
    bindQuestionEditorEvents();
  }
}

function bindQuestionEditorEvents() {
  if (!elQuestionsList) return;

  // Question text changes
  const qInputs = elQuestionsList.querySelectorAll('.q-text-input');
  qInputs.forEach(input => {
    input.addEventListener('input', () => {
      const qid = input.getAttribute('data-qid');
      const q = state.questions.find(item => item.id === qid);
      if (q) {
        q.text = input.value;
        validateQuestion(q);
        updateQuestionCardUI(q);
      }
    });
  });

  // Option text changes
  const optInputs = elQuestionsList.querySelectorAll('.opt-text-input');
  optInputs.forEach(input => {
    input.addEventListener('input', () => {
      const qid = input.getAttribute('data-qid');
      const oid = input.getAttribute('data-oid');
      const q = state.questions.find(item => item.id === qid);
      if (q) {
        const opt = q.options.find(o => o.id === oid);
        if (opt) {
          opt.text = input.value;
          validateQuestion(q);
          updateQuestionCardUI(q);
        }
      }
    });
  });

  // Delete question
  const delQBtns = elQuestionsList.querySelectorAll('.btn-delete-question');
  delQBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const qid = btn.getAttribute('data-qid');
      state.questions = state.questions.filter(item => item.id !== qid);
      // Re-number
      state.questions.forEach((item, idx) => {
        item.number = idx + 1;
      });
      renderQuestionsWorkbench();
    });
  });

  // Add option
  const addOptBtns = elQuestionsList.querySelectorAll('.btn-add-opt');
  addOptBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const qid = btn.getAttribute('data-qid');
      const q = state.questions.find(item => item.id === qid);
      if (q) {
        const nextLetter = String.fromCharCode(65 + q.options.length);
        q.options.push({ id: nextLetter, text: '' });
        validateQuestion(q);
        renderQuestionsWorkbench();
      }
    });
  });

  // Delete option
  const delOptBtns = elQuestionsList.querySelectorAll('.btn-delete-opt');
  delOptBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const qid = btn.getAttribute('data-qid');
      const oid = btn.getAttribute('data-oid');
      const q = state.questions.find(item => item.id === qid);
      if (q && q.options.length > 2) {
        q.options = q.options.filter(o => o.id !== oid);
        // Re-assign letters A, B, C...
        q.options.forEach((o, i) => {
          o.id = String.fromCharCode(65 + i);
        });
        validateQuestion(q);
        renderQuestionsWorkbench();
      }
    });
  });
}

function updateQuestionCardUI(q) {
  const card = elQuestionsList.querySelector(`[data-qid="${q.id}"]`);
  if (!card) return;

  if (q.isValid) {
    card.classList.remove('needs-review');
    card.classList.add('ready');
  } else {
    card.classList.remove('ready');
    card.classList.add('needs-review');
  }

  // Update summary counts
  const total = state.questions.length;
  const readyCount = state.questions.filter(item => item.isValid).length;
  const reviewCount = total - readyCount;

  if (elQuestionsSummary) {
    elQuestionsSummary.innerHTML = `
      <div class="d-flex align-items-center gap-2">
        <span class="badge ${readyCount === total ? 'bg-success' : 'bg-primary'} fs-6">
          ${total} ${total === 1 ? 'question' : 'questions'} detected
        </span>
        <span class="badge bg-success-subtle text-success border border-success-subtle">
          ${readyCount} ready
        </span>
        ${reviewCount > 0 ? `
          <span class="badge bg-danger-subtle text-danger border border-danger-subtle">
            ${reviewCount} needs review
          </span>
        ` : ''}
      </div>
    `;
  }
}

/**
 * JEV Evaluation Trigger
 */
function setupEvaluationEvents() {
  if (elBtnAskJev) {
    elBtnAskJev.addEventListener('click', handleAskJev);
  }

  if (elBtnCancelJev) {
    elBtnCancelJev.addEventListener('click', () => {
      if (state.currentAbortController) {
        state.currentAbortController.abort();
        state.currentAbortController = null;
        setEvaluatingUI(false);
        showAlert('Evaluation cancelled by user.', 'info');
      }
    });
  }
}

async function handleAskJev() {
  // Check API key
  const apiKey = (state.apiKey || (elApiKeyInput ? elApiKeyInput.value : '')).trim();
  if (!apiKey) {
    showAlert('TypeSafe API key is required. Please enter your API key in the left panel.', 'warning');
    if (elApiKeyInput) elApiKeyInput.focus();
    return;
  }

  // Check valid questions
  const validQuestions = state.questions.filter(q => q.isValid);
  if (validQuestions.length === 0) {
    showAlert('No valid questions to evaluate. Please parse or correct questions in the workbench.', 'warning');
    return;
  }

  // Setup UI for loading
  setEvaluatingUI(true, `Evaluating ${validQuestions.length} ${validQuestions.length === 1 ? 'question' : 'questions'} with JEV…`);
  clearResults();

  const abortController = new AbortController();
  state.currentAbortController = abortController;

  try {
    const result = await evaluateQuestionsWithJev({
      apiKey: apiKey,
      endpointUrl: state.endpointUrl,
      documents: state.documents,
      questions: validQuestions,
      signal: abortController.signal
    });

    state.results = result;
    state.debugInfo = {
      model: result.model,
      latencyMs: result.latencyMs,
      usage: result.usage,
      requestPayload: result.requestPayload,
      rawResponse: result.rawResponse
    };

    setEvaluatingUI(false);
    renderResults(elResultsContainer, state.results, state.questions, state.debugInfo);
    showAlert(`Successfully evaluated ${validQuestions.length} questions in ${result.latencyMs} ms.`, 'success');

    // Smooth scroll to results on small screens
    if (window.innerWidth < 992 && elResultsContainer) {
      elResultsContainer.scrollIntoView({ behavior: 'smooth' });
    }
  } catch (err) {
    setEvaluatingUI(false);

    if (err.name === 'JevAbortError') {
      showAlert('Evaluation cancelled.', 'info');
      return;
    }

    if (err.isCors) {
      // Clean, honest CORS explanation as required by Section 5 & 18
      showCorsAlert(err.message);
      return;
    }

    showAlert(`Evaluation error: ${err.message}`, 'danger');
  } finally {
    state.currentAbortController = null;
  }
}

function setEvaluatingUI(isEvaluating, message = '') {
  if (elBtnAskJev) {
    elBtnAskJev.disabled = isEvaluating;
    if (isEvaluating) {
      elBtnAskJev.innerHTML = `
        <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
        Evaluating…
      `;
    } else {
      elBtnAskJev.innerHTML = `
        <i class="bi bi-stars me-1"></i> Ask JEV
      `;
    }
  }

  if (elBtnCancelJev) {
    elBtnCancelJev.style.display = isEvaluating ? 'inline-block' : 'none';
  }

  if (elJevStatusContainer) {
    if (isEvaluating) {
      elJevStatusContainer.innerHTML = `
        <div class="d-flex align-items-center gap-2 text-primary small mt-2">
          <span class="spinner-grow spinner-grow-sm" role="status" aria-hidden="true"></span>
          <span>${escapeHtml(message)}</span>
        </div>
      `;
      elJevStatusContainer.style.display = 'block';
    } else {
      elJevStatusContainer.style.display = 'none';
      elJevStatusContainer.innerHTML = '';
    }
  }
}

/**
 * Alerts & Notifications
 */
export function showAlert(message, type = 'info', autoDismissMs = 6000) {
  if (!elAlertContainer) return;

  const alertId = 'alert_' + Date.now();
  const alertEl = document.createElement('div');
  alertEl.className = `alert alert-${type} alert-dismissible fade show shadow-sm`;
  alertEl.role = 'alert';
  alertEl.id = alertId;
  alertEl.innerHTML = `
    <div class="d-flex align-items-center">
      <i class="bi ${getAlertIcon(type)} me-2 fs-5"></i>
      <div class="flex-grow-1">${escapeHtml(message)}</div>
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;

  elAlertContainer.appendChild(alertEl);

  if (autoDismissMs > 0) {
    setTimeout(() => {
      alertEl.classList.remove('show');
      setTimeout(() => alertEl.remove(), 200);
    }, autoDismissMs);
  }
}

function showCorsAlert(errorMessage) {
  if (!elAlertContainer) return;

  const alertEl = document.createElement('div');
  alertEl.className = 'alert alert-danger alert-dismissible fade show shadow-sm';
  alertEl.role = 'alert';
  alertEl.innerHTML = `
    <div class="d-flex align-items-start">
      <i class="bi bi-shield-x me-3 fs-3 text-danger"></i>
      <div class="flex-grow-1">
        <h5 class="alert-heading h6 fw-bold mb-1">Direct Browser Request Blocked (CORS)</h5>
        <p class="mb-2 small">
          ${escapeHtml(errorMessage)}
        </p>
        <hr class="my-2">
        <div class="small text-muted">
          <strong>Privacy Architecture Notice:</strong> Questionator is private by design and does not use unauthorized third-party CORS proxies, backends, or relays. Direct communication depends on TypeSafe's API permitting cross-origin browser requests. See <a href="README.md" class="alert-link" target="_blank">README.md</a> for details.
        </div>
      </div>
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;

  elAlertContainer.prepend(alertEl);
}

function getAlertIcon(type) {
  switch (type) {
    case 'success': return 'bi-check-circle-fill text-success';
    case 'warning': return 'bi-exclamation-triangle-fill text-warning';
    case 'danger': return 'bi-x-circle-fill text-danger';
    case 'secondary': return 'bi-info-circle text-secondary';
    default: return 'bi-info-circle-fill text-info';
  }
}

function setupAlertDismiss() {
  // Bootstrap alert dismissal works with data-bs-dismiss="alert"
}

function getSampleQuestionnaire() {
  return `1. What is the capital of France?
A. Rome
B. Madrid
C. Paris
D. Berlin

2. Which protocol is used for secure web traffic?
A) FTP
B) HTTPS
C) SMTP
D) DNS

3. The Earth revolves around the Sun. (True/False)`;
}

// Auto-initialize when document is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}
