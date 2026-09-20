/**
 * Questionator - Results Rendering Module
 * Renders answer cards, probability bars, compact summary, and debug details.
 */

import { escapeHtml, formatPercent, copyToClipboard } from './utils.js';

/**
 * Renders the results panel into the given container.
 * @param {HTMLElement} container - Results container element.
 * @param {object} resultsData - Result data from JEV.
 * @param {Array<object>} questions - Parsed question objects.
 * @param {object} [debugInfo] - Optional debug info (without API key!).
 */
export function renderResults(container, resultsData, questions, debugInfo) {
  if (!container) return;

  if (!resultsData || !resultsData.answers) {
    container.innerHTML = `
      <div class="card border-0 bg-body-tertiary text-center p-5">
        <div class="card-body">
          <i class="bi bi-patch-question text-muted" style="font-size: 3rem;"></i>
          <h3 class="h5 mt-3 text-secondary">No answers yet</h3>
          <p class="text-muted mb-0">Your answers and probability distributions will appear here after asking JEV.</p>
        </div>
      </div>
    `;
    return;
  }

  const { answers, model, usage, latencyMs } = resultsData;
  const questionMap = new Map((questions || []).map(q => [q.id, q]));

  // Build answer list items
  const answerEntries = [];
  for (const [qid, ans] of Object.entries(answers)) {
    const qObj = questionMap.get(qid);
    if (qObj) {
      const selectedOptionId = ans.choice || ans.selected;
      const selectedOptionObj = qObj.options.find(o => o.id === selectedOptionId);
      const selectedText = selectedOptionObj ? selectedOptionObj.text : '';
      answerEntries.push({
        questionId: qid,
        number: qObj.number,
        questionText: qObj.text,
        options: qObj.options,
        selectedId: selectedOptionId,
        selectedText: selectedText,
        confidence: ans.confidence,
        probabilities: ans.probabilities || {}
      });
    }
  }

  // Sort by question number
  answerEntries.sort((a, b) => a.number - b.number);

  if (answerEntries.length === 0) {
    container.innerHTML = `
      <div class="alert alert-warning" role="alert">
        <i class="bi bi-exclamation-triangle-fill me-2"></i>
        No answers found in the response from JEV.
      </div>
    `;
    return;
  }

  // Build compact text for copying
  const compactAnswersText = answerEntries
    .map(e => `${e.number}. ${e.selectedId || '?'}`)
    .join('\n');

  const detailedAnswersText = answerEntries
    .map(e => `${e.number}. ${e.selectedId || '?'} — ${e.selectedText || ''}`)
    .join('\n');

  // Build HTML
  let html = `
    <!-- Results Header -->
    <div class="card mb-4 border-success-subtle shadow-sm">
      <div class="card-body">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div>
            <h2 class="h5 mb-1 text-success d-flex align-items-center gap-2">
              <i class="bi bi-check-circle-fill"></i>
              <span>${answerEntries.length} ${answerEntries.length === 1 ? 'Answer' : 'Answers'} Evaluated</span>
            </h2>
            <div class="text-muted small">
              ${model ? `<span class="badge bg-secondary-subtle text-secondary me-2">${escapeHtml(model)}</span>` : ''}
              ${latencyMs ? `<span class="me-2"><i class="bi bi-stopwatch me-1"></i>${latencyMs} ms</span>` : ''}
              ${usage && usage.input_tokens ? `<span><i class="bi bi-cpu me-1"></i>${usage.input_tokens} in / ${usage.output_tokens || 0} out</span>` : ''}
            </div>
          </div>
          <div class="d-flex gap-2">
            <button type="button" class="btn btn-outline-success btn-sm" id="btn-copy-compact" title="Copy compact list of answers (e.g. 1. B, 2. A)">
              <i class="bi bi-clipboard me-1"></i> Copy answers
            </button>
            <button type="button" class="btn btn-outline-secondary btn-sm" id="btn-copy-detailed" title="Copy answers with full option text">
              <i class="bi bi-clipboard-data me-1"></i> Copy with text
            </button>
          </div>
        </div>

        <!-- Quick Summary Bar -->
        <div class="mt-3 p-2 bg-body-tertiary rounded border font-monospace small d-flex flex-wrap gap-3">
          ${answerEntries.map(e => `
            <span><strong>${e.number}.</strong> <span class="badge bg-primary text-white">${escapeHtml(e.selectedId || '?')}</span></span>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Answer Cards -->
    <div class="answer-cards-list d-flex flex-column gap-3">
  `;

  for (const entry of answerEntries) {
    const confPercent = entry.confidence !== undefined && entry.confidence !== null
      ? formatPercent(entry.confidence)
      : null;

    html += `
      <article class="card shadow-sm border" id="card-${escapeHtml(entry.questionId)}">
        <div class="card-header bg-body-tertiary d-flex justify-content-between align-items-center">
          <span class="fw-bold text-secondary">Question ${entry.number}</span>
          ${confPercent ? `
            <span class="badge ${getConfidenceBadgeClass(entry.confidence)} px-2 py-1" title="Model confidence score">
              Confidence: ${confPercent}
            </span>
          ` : ''}
        </div>
        <div class="card-body">
          <p class="card-text fw-semibold mb-3">${escapeHtml(entry.questionText)}</p>

          <!-- Selected Answer Banner -->
          <div class="selected-answer-banner p-3 rounded mb-3 border border-2 border-primary bg-primary-subtle d-flex align-items-center gap-3">
            <div class="winning-letter-box bg-primary text-white rounded d-flex align-items-center justify-content-center fw-bold fs-3 shadow-sm" style="min-width: 54px; height: 54px;" aria-hidden="true">
              ${escapeHtml(entry.selectedId || '?')}
            </div>
            <div class="flex-grow-1">
              <div class="text-uppercase small fw-bold text-primary mb-1">Selected Answer (Option ${escapeHtml(entry.selectedId || '?')})</div>
              <div class="fs-5 fw-bold text-body-emphasis">${escapeHtml(entry.selectedText || '(No option text)')}</div>
            </div>
          </div>

          <!-- Probability Distribution -->
          <div class="probabilities-section mt-3">
            <h6 class="text-muted small text-uppercase mb-2 fw-semibold">Probability Distribution</h6>
            <div class="d-flex flex-column gap-2">
    `;

    for (const opt of entry.options) {
      const probValue = entry.probabilities[opt.id];
      const probPercent = probValue !== undefined ? formatPercent(probValue) : '0%';
      const probNum = probValue !== undefined ? (probValue <= 1 ? probValue * 100 : probValue) : 0;
      const isSelected = opt.id === entry.selectedId;

      html += `
        <div class="probability-row p-2 rounded ${isSelected ? 'bg-body-secondary fw-semibold' : ''}">
          <div class="d-flex justify-content-between align-items-center mb-1 small">
            <span class="d-flex align-items-center gap-2">
              <span class="badge ${isSelected ? 'bg-primary' : 'bg-secondary'} font-monospace">${escapeHtml(opt.id)}</span>
              <span class="text-body">${escapeHtml(opt.text)}</span>
            </span>
            <span class="font-monospace fw-bold ms-2 ${isSelected ? 'text-primary' : 'text-muted'}">${probPercent}</span>
          </div>
          <div class="progress" style="height: 8px;" role="progressbar" aria-valuenow="${Math.round(probNum)}" aria-valuemin="0" aria-valuemax="100" aria-label="Option ${escapeHtml(opt.id)} probability">
            <div class="progress-bar ${isSelected ? 'bg-primary' : 'bg-secondary'}" style="width: ${probNum}%"></div>
          </div>
        </div>
      `;
    }

    html += `
            </div>
          </div>
        </div>
      </article>
    `;
  }

  html += `</div>`;

  // Collapsible Debug Details (SAFE: API Key is never included!)
  if (debugInfo) {
    html += `
      <div class="mt-4">
        <details class="card border-0 bg-body-tertiary">
          <summary class="card-header bg-transparent text-muted small fw-semibold cursor-pointer user-select-none py-2">
            <i class="bi bi-terminal me-1"></i> Developer & Debug Information (API key is never shown)
          </summary>
          <div class="card-body font-monospace small pt-2">
            ${debugInfo.latencyMs ? `<div class="mb-2"><strong>Measured Latency:</strong> ${debugInfo.latencyMs} ms</div>` : ''}
            ${debugInfo.requestPayload ? `
              <div class="mb-2">
                <strong>Request Payload:</strong>
                <pre class="bg-body p-2 rounded border mt-1 mb-0 overflow-auto" style="max-height: 200px;"><code>${escapeHtml(JSON.stringify(debugInfo.requestPayload, null, 2))}</code></pre>
              </div>
            ` : ''}
            ${debugInfo.rawResponse ? `
              <div class="mb-0">
                <strong>Raw API Response:</strong>
                <pre class="bg-body p-2 rounded border mt-1 mb-0 overflow-auto" style="max-height: 200px;"><code>${escapeHtml(JSON.stringify(debugInfo.rawResponse, null, 2))}</code></pre>
              </div>
            ` : ''}
          </div>
        </details>
      </div>
    `;
  }

  container.innerHTML = html;

  // Setup copy buttons
  const btnCopyCompact = container.querySelector('#btn-copy-compact');
  if (btnCopyCompact) {
    btnCopyCompact.addEventListener('click', async () => {
      const ok = await copyToClipboard(compactAnswersText);
      if (ok) {
        const originalHtml = btnCopyCompact.innerHTML;
        btnCopyCompact.innerHTML = '<i class="bi bi-check2 me-1"></i> Copied!';
        btnCopyCompact.classList.replace('btn-outline-success', 'btn-success');
        setTimeout(() => {
          btnCopyCompact.innerHTML = originalHtml;
          btnCopyCompact.classList.replace('btn-success', 'btn-outline-success');
        }, 2000);
      }
    });
  }

  const btnCopyDetailed = container.querySelector('#btn-copy-detailed');
  if (btnCopyDetailed) {
    btnCopyDetailed.addEventListener('click', async () => {
      const ok = await copyToClipboard(detailedAnswersText);
      if (ok) {
        const originalHtml = btnCopyDetailed.innerHTML;
        btnCopyDetailed.innerHTML = '<i class="bi bi-check2 me-1"></i> Copied!';
        btnCopyDetailed.classList.replace('btn-outline-secondary', 'btn-secondary');
        setTimeout(() => {
          btnCopyDetailed.innerHTML = originalHtml;
          btnCopyDetailed.classList.replace('btn-secondary', 'btn-outline-secondary');
        }, 2000);
      }
    });
  }
}

/**
 * Returns Bootstrap badge class for confidence score.
 * @param {number} conf
 * @returns {string}
 */
function getConfidenceBadgeClass(conf) {
  if (conf === null || conf === undefined) return 'bg-secondary text-white';
  const val = conf <= 1 ? conf : conf / 100;
  if (val >= 0.8) return 'bg-success text-white';
  if (val >= 0.5) return 'bg-warning text-dark';
  return 'bg-danger text-white';
}
