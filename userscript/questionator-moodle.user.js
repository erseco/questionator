// ==UserScript==
// @name         Questionator for Moodle
// @namespace    https://github.com/erseco/questionator
// @version      1.1.1
// @description  Answer Moodle quiz attempts directly using TypeSafe JEV and reference context.
// @author       erseco
// @match        *://*/*mod/quiz/attempt.php*
// @match        *://*/mod/quiz/attempt.php*
// @include      *://*/*mod/quiz/attempt.php*
// @include      *://*/mod/quiz/attempt.php*
// @include      *://*/*/mod/quiz/attempt.php*
// @include      *://*/*/*/mod/quiz/attempt.php*
// @include      *://*/*/*/*/mod/quiz/attempt.php*
// @include      /^https?:\/\/.*\/mod\/quiz\/attempt\.php.*/
// @icon         https://raw.githubusercontent.com/erseco/questionator/main/favicon.png
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @connect      api.typesafe.ai
// @connect      questionator-proxy.erseco.workers.dev
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  // Configuration Keys for GM Storage
  const STORAGE_KEY_API_KEY = 'questionator_api_key';
  const STORAGE_KEY_ENDPOINT = 'questionator_endpoint';
  const STORAGE_KEY_CONTEXT = 'questionator_context';
  const STORAGE_KEY_AUTO_SELECT = 'questionator_auto_select';
  const STORAGE_KEY_SHOW_PROBS = 'questionator_show_probs';
  const STORAGE_KEY_HIGHLIGHT_LOW_CONF = 'questionator_highlight_low_conf';
  const STORAGE_KEY_CONF_THRESHOLD = 'questionator_conf_threshold';
  const STORAGE_KEY_PANEL_OPEN = 'questionator_panel_open';
  const STORAGE_KEY_POS_X = 'questionator_pos_x';
  const STORAGE_KEY_POS_Y = 'questionator_pos_y';

  const DEFAULT_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
  const LOGO_URL = 'https://raw.githubusercontent.com/erseco/questionator/main/favicon.png';

  // State
  let detectedQuestions = [];
  let isEvaluating = false;

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  async function init() {
    // Only run on quiz attempt pages (works with root or subdirectory installations)
    const isAttemptPath = window.location.pathname.includes('/mod/quiz/attempt.php');
    const isAttemptBody = document.body && (document.body.id === 'page-mod-quiz-attempt' || document.body.classList.contains('path-mod-quiz'));
    if (!isAttemptPath && !isAttemptBody) {
      return;
    }

    createFloatingUI();
  }

  /**
   * Builds the Floating Button and Shadow DOM Panel.
   */
  async function createFloatingUI() {
    const hostEl = document.createElement('div');
    hostEl.id = 'questionator-moodle-host';
    hostEl.style.cssText = 'position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647; font-family: system-ui, -apple-system, sans-serif;';
    document.body.appendChild(hostEl);

    const shadow = hostEl.attachShadow({ mode: 'open' });

    // Styles for Shadow DOM
    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: inherit; }
      
      /* Floating Button */
      .fab-btn {
        position: fixed;
        bottom: 20px;
        left: 20px;
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: #0d6efd;
        border: 2px solid #ffffff;
        box-shadow: 0 4px 14px rgba(0,0,0,0.3);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s, box-shadow 0.2s;
        outline: none;
        z-index: 2147483647;
      }
      .fab-btn:hover {
        transform: scale(1.08);
        box-shadow: 0 6px 20px rgba(0,0,0,0.4);
      }
      .fab-btn img {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        object-fit: cover;
      }

      /* Panel */
      .panel {
        position: fixed;
        bottom: 80px;
        left: 20px;
        width: 380px;
        max-width: calc(100vw - 40px);
        max-height: calc(100vh - 100px);
        background: #ffffff;
        color: #212529;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.25);
        border: 1px solid #dee2e6;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: fadeIn 0.2s ease-out;
        z-index: 2147483648;
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .panel-header {
        background: #f8f9fa;
        border-bottom: 1px solid #dee2e6;
        padding: 10px 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: grab;
        user-select: none;
      }
      .panel-header:active {
        cursor: grabbing;
      }
      .panel-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 700;
        font-size: 14px;
        pointer-events: none;
      }
      .panel-title .drag-icon {
        font-size: 16px;
        color: #adb5bd;
        margin-right: 2px;
        letter-spacing: -2px;
      }
      .panel-title img {
        width: 22px;
        height: 22px;
        border-radius: 4px;
      }
      .close-btn {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #6c757d;
        line-height: 1;
        padding: 0 4px;
      }
      .close-btn:hover { color: #000; }

      .panel-body {
        padding: 14px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 12px;
        font-size: 13px;
      }

      label {
        font-weight: 600;
        color: #495057;
        margin-bottom: 4px;
        display: block;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      input[type="text"], input[type="password"], input[type="url"], textarea {
        width: 100%;
        padding: 8px 10px;
        border: 1px solid #ced4da;
        border-radius: 6px;
        font-size: 13px;
        outline: none;
        transition: border-color 0.15s;
      }
      input:focus, textarea:focus {
        border-color: #0d6efd;
        box-shadow: 0 0 0 2px rgba(13,110,253,0.15);
      }

      .context-stats {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: #6c757d;
        margin-top: 4px;
      }

      .btn {
        padding: 8px 12px;
        border-radius: 6px;
        border: none;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: background 0.15s, opacity 0.15s;
      }
      .btn-primary {
        background: #0d6efd;
        color: #ffffff;
      }
      .btn-primary:hover { background: #0b5ed7; }
      .btn-primary:disabled { opacity: 0.65; cursor: not-allowed; }

      .btn-secondary {
        background: #e9ecef;
        color: #495057;
      }
      .btn-secondary:hover { background: #dee2e6; }

      .btn-sm {
        padding: 5px 8px;
        font-size: 11px;
      }

      .checkbox-row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #495057;
        cursor: pointer;
      }

      .status-box {
        padding: 8px 10px;
        border-radius: 6px;
        font-size: 12px;
        display: none;
      }
      .status-info { background: #cff4fc; color: #055160; display: block; }
      .status-success { background: #d1e7dd; color: #0f5132; display: block; }
      .status-danger { background: #f8d7da; color: #842029; display: block; }

      details summary {
        cursor: pointer;
        color: #6c757d;
        font-size: 12px;
        margin-bottom: 6px;
        user-select: none;
      }
    `;
    shadow.appendChild(style);

    // Floating button
    const fab = document.createElement('button');
    fab.className = 'fab-btn';
    fab.title = 'Questionator for Moodle';
    fab.innerHTML = `<img src="${LOGO_URL}" alt="Questionator">`;
    shadow.appendChild(fab);

    // Panel container
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.style.display = 'none';

    // Retrieve saved settings
    const savedApiKey = (await GM.getValue(STORAGE_KEY_API_KEY)) || '';
    const savedEndpoint = (await GM.getValue(STORAGE_KEY_ENDPOINT)) || DEFAULT_ENDPOINT;
    const savedContext = (await GM.getValue(STORAGE_KEY_CONTEXT)) || '';
    const savedAutoSelect = (await GM.getValue(STORAGE_KEY_AUTO_SELECT, true));
    const savedShowProbs = (await GM.getValue(STORAGE_KEY_SHOW_PROBS, true));
    const savedHighlightLow = (await GM.getValue(STORAGE_KEY_HIGHLIGHT_LOW_CONF, true));
    const savedThreshold = (await GM.getValue(STORAGE_KEY_CONF_THRESHOLD, 60));
    const savedPanelOpen = (await GM.getValue(STORAGE_KEY_PANEL_OPEN, false));
    const savedPosX = await GM.getValue(STORAGE_KEY_POS_X, null);
    const savedPosY = await GM.getValue(STORAGE_KEY_POS_Y, null);

    // Position panel: use saved coordinates or default to bottom-left
    if (savedPosX !== null && savedPosY !== null) {
      const clampedX = Math.max(0, Math.min(savedPosX, window.innerWidth - 380));
      const clampedY = Math.max(0, Math.min(savedPosY, window.innerHeight - 200));
      panel.style.left = `${clampedX}px`;
      panel.style.top = `${clampedY}px`;
      panel.style.bottom = 'auto';
      panel.style.right = 'auto';
    } else {
      panel.style.bottom = '80px';
      panel.style.left = '20px';
    }

    panel.innerHTML = `
      <div class="panel-header" title="Drag to move">
        <div class="panel-title">
          <span class="drag-icon" title="Drag to move">⠿</span>
          <img src="${LOGO_URL}" alt="Q">
          <span>Questionator for Moodle</span>
        </div>
        <button class="close-btn" id="btn-close" title="Close">&times;</button>
      </div>

      <div class="panel-body">
        <!-- API Configuration -->
        <div>
          <label for="input-api-key">TypeSafe API Key</label>
          <input type="password" id="input-api-key" placeholder="ts_..." value="${escapeAttr(savedApiKey)}">
        </div>

        <details>
          <summary>API Endpoint (Direct / Proxy)</summary>
          <div style="margin-top: 6px;">
            <input type="url" id="input-endpoint" placeholder="https://api.typesafe.ai/v1/systemone" value="${escapeAttr(savedEndpoint)}">
            <div style="font-size: 10px; color: #6c757d; margin-top: 2px;">
              Direct <code>api.typesafe.ai</code> works natively via GM.xmlHttpRequest without CORS.
            </div>
          </div>
        </details>

        <!-- Reference Context -->
        <div>
          <label for="input-context">Reference Context</label>
          <textarea id="input-context" rows="6" placeholder="Paste reference notes, chapters, or documentation here...">${escapeHtml(savedContext)}</textarea>
          <div class="context-stats">
            <span id="context-count">0 chars · ~0 tokens</span>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-compression-prompt" title="Generate prompt to compress context with LLM">
              📋 Compress prompt
            </button>
          </div>
        </div>

        <!-- Options -->
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label class="checkbox-row">
            <input type="checkbox" id="check-auto-select" ${savedAutoSelect ? 'checked' : ''}>
            <span>Automatically select JEV's choice</span>
          </label>
          <label class="checkbox-row">
            <input type="checkbox" id="check-show-probs" ${savedShowProbs ? 'checked' : ''}>
            <span>Show probability bars on answers</span>
          </label>
          <label class="checkbox-row">
            <input type="checkbox" id="check-highlight-low" ${savedHighlightLow ? 'checked' : ''}>
            <span>Highlight low confidence (&lt; ${savedThreshold}%)</span>
          </label>
        </div>

        <!-- Status Box -->
        <div class="status-box" id="status-box"></div>

        <!-- Actions -->
        <div style="display: flex; gap: 8px; margin-top: 4px;">
          <button type="button" class="btn btn-secondary" id="btn-scan" style="flex: 1;">
            🔍 Scan Quiz
          </button>
          <button type="button" class="btn btn-primary" id="btn-answer" style="flex: 1;">
            ⚡ Answer with JEV
          </button>
        </div>
      </div>
    `;
    shadow.appendChild(panel);

    // Bind UI Events
    const inputApiKey = shadow.getElementById('input-api-key');
    const inputEndpoint = shadow.getElementById('input-endpoint');
    const inputContext = shadow.getElementById('input-context');
    const contextCount = shadow.getElementById('context-count');
    const checkAutoSelect = shadow.getElementById('check-auto-select');
    const checkShowProbs = shadow.getElementById('check-show-probs');
    const checkHighlightLow = shadow.getElementById('check-highlight-low');
    const btnClose = shadow.getElementById('btn-close');
    const btnScan = shadow.getElementById('btn-scan');
    const btnAnswer = shadow.getElementById('btn-answer');
    const btnCompress = shadow.getElementById('btn-compression-prompt');
    const statusBox = shadow.getElementById('status-box');

    // Restore open state: if open on previous page, keep it open and scan
    if (savedPanelOpen) {
      panel.style.display = 'flex';
      scanMoodleQuestions(statusBox);
    } else {
      panel.style.display = 'none';
    }

    // Draggable Panel functionality
    const panelHeader = shadow.querySelector('.panel-header');
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialPanelLeft = 0;
    let initialPanelTop = 0;

    function startDrag(clientX, clientY, target) {
      if (target && target.closest && target.closest('.close-btn')) return;
      isDragging = true;
      dragStartX = clientX;
      dragStartY = clientY;
      const rect = panel.getBoundingClientRect();
      initialPanelLeft = rect.left;
      initialPanelTop = rect.top;
      panelHeader.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    }

    function moveDrag(clientX, clientY) {
      if (!isDragging) return;
      const dx = clientX - dragStartX;
      const dy = clientY - dragStartY;
      const rect = panel.getBoundingClientRect();

      let newLeft = initialPanelLeft + dx;
      let newTop = initialPanelTop + dy;

      const maxLeft = Math.max(0, window.innerWidth - rect.width);
      const maxTop = Math.max(0, window.innerHeight - rect.height);
      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newTop = Math.max(0, Math.min(newTop, maxTop));

      panel.style.left = `${newLeft}px`;
      panel.style.top = `${newTop}px`;
      panel.style.bottom = 'auto';
      panel.style.right = 'auto';
    }

    function stopDrag() {
      if (!isDragging) return;
      isDragging = false;
      panelHeader.style.cursor = 'grab';
      document.body.style.userSelect = '';

      const rect = panel.getBoundingClientRect();
      GM.setValue(STORAGE_KEY_POS_X, Math.round(rect.left));
      GM.setValue(STORAGE_KEY_POS_Y, Math.round(rect.top));
    }

    panelHeader.addEventListener('mousedown', (e) => {
      startDrag(e.clientX, e.clientY, e.target);
    });

    window.addEventListener('mousemove', (e) => {
      moveDrag(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', () => {
      stopDrag();
    });

    panelHeader.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        startDrag(e.touches[0].clientX, e.touches[0].clientY, e.target);
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (isDragging && e.touches.length === 1) {
        moveDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      stopDrag();
    });

    function updateContextStats() {
      const text = inputContext.value;
      const chars = text.length;
      const tokens = Math.round(chars / 3.8);
      contextCount.textContent = `${chars.toLocaleString()} chars · ~${tokens.toLocaleString()} tokens`;
      GM.setValue(STORAGE_KEY_CONTEXT, text);
    }

    inputContext.addEventListener('input', updateContextStats);
    updateContextStats();

    inputApiKey.addEventListener('change', () => {
      GM.setValue(STORAGE_KEY_API_KEY, inputApiKey.value.trim());
    });

    inputEndpoint.addEventListener('change', () => {
      GM.setValue(STORAGE_KEY_ENDPOINT, inputEndpoint.value.trim());
    });

    checkAutoSelect.addEventListener('change', () => {
      GM.setValue(STORAGE_KEY_AUTO_SELECT, checkAutoSelect.checked);
    });

    checkShowProbs.addEventListener('change', () => {
      GM.setValue(STORAGE_KEY_SHOW_PROBS, checkShowProbs.checked);
    });

    checkHighlightLow.addEventListener('change', () => {
      GM.setValue(STORAGE_KEY_HIGHLIGHT_LOW_CONF, checkHighlightLow.checked);
    });

    fab.addEventListener('click', () => {
      const willOpen = panel.style.display === 'none';
      panel.style.display = willOpen ? 'flex' : 'none';
      GM.setValue(STORAGE_KEY_PANEL_OPEN, willOpen);
      if (willOpen) {
        scanMoodleQuestions(statusBox);
      }
    });

    btnClose.addEventListener('click', () => {
      panel.style.display = 'none';
      GM.setValue(STORAGE_KEY_PANEL_OPEN, false);
    });

    btnScan.addEventListener('click', () => {
      scanMoodleQuestions(statusBox);
    });

    btnAnswer.addEventListener('click', async () => {
      await answerQuizWithJev({
        apiKey: inputApiKey.value.trim(),
        endpoint: inputEndpoint.value.trim() || DEFAULT_ENDPOINT,
        context: inputContext.value.trim(),
        autoSelect: checkAutoSelect.checked,
        showProbs: checkShowProbs.checked,
        highlightLow: checkHighlightLow.checked,
        threshold: savedThreshold,
        statusBox,
        btnAnswer
      });
    });

    btnCompress.addEventListener('click', () => {
      generateCompressionPrompt(inputContext.value.trim(), statusBox);
    });
  }

  /**
   * Scans Moodle DOM for questions and multiple-choice radio inputs.
   */
  function scanMoodleQuestions(statusBox) {
    const questionBlocks = document.querySelectorAll('.que');
    detectedQuestions = [];

    questionBlocks.forEach((block, idx) => {
      // Find question text
      const qtextEl = block.querySelector('.qtext');
      const questionText = qtextEl ? qtextEl.innerText.trim() : `Question ${idx + 1}`;

      // Find radio options, excluding Moodle "clear choice" button
      const radios = Array.from(block.querySelectorAll('input[type="radio"]'))
        .filter(r => !r.closest('.qtype_multichoice_clearchoice') && r.value !== '-1');

      if (radios.length < 2) {
        return; // Only process multiple choice / single answer questions
      }

      const options = [];
      radios.forEach((radio, rIdx) => {
        const optId = String.fromCharCode(65 + rIdx); // A, B, C, D...

        // Find corresponding label or answer container
        let optText = '';
        let targetEl = null;

        if (radio.id) {
          try {
            targetEl = block.querySelector(`label[for="${CSS.escape(radio.id)}"]`);
          } catch {
            targetEl = block.querySelector(`label[for="${radio.id}"]`);
          }
        }
        if (!targetEl && radio.getAttribute('aria-labelledby')) {
          const labelledById = radio.getAttribute('aria-labelledby');
          targetEl = document.getElementById(labelledById) || block.querySelector(`[id="${labelledById}"]`);
        }
        if (!targetEl) {
          targetEl = radio.closest('.d-flex, .r0, .r1, div');
        }

        if (targetEl) {
          optText = targetEl.innerText.trim();
        } else {
          optText = `Option ${optId}`;
        }

        // Clean leading prefix like "a. ", "b) ", "1. ", etc.
        optText = optText.replace(/^[a-zA-Z0-9][\.\)\:\-]\s+/, '').trim();

        options.push({
          id: optId,
          radioInput: radio,
          text: optText
        });
      });

      const qnoEl = block.querySelector('.qno');
      const questionNumber = qnoEl ? qnoEl.innerText.trim() : (idx + 1);

      detectedQuestions.push({
        id: `q${idx + 1}`,
        number: questionNumber,
        text: questionText,
        options: options,
        blockEl: block
      });
    });

    if (statusBox) {
      if (detectedQuestions.length > 0) {
        showStatus(statusBox, `Found ${detectedQuestions.length} multiple-choice questions on this page.`, 'info');
      } else {
        showStatus(statusBox, 'No multiple-choice questions found on this page.', 'danger');
      }
    }

    return detectedQuestions;
  }

  /**
   * Sends all scanned questions to TypeSafe JEV and injects answers into Moodle.
   */
  async function answerQuizWithJev({
    apiKey,
    endpoint,
    context,
    autoSelect,
    showProbs,
    highlightLow,
    threshold,
    statusBox,
    btnAnswer
  }) {
    if (!apiKey) {
      showStatus(statusBox, 'Please enter your TypeSafe API key.', 'danger');
      return;
    }

    if (detectedQuestions.length === 0) {
      scanMoodleQuestions(statusBox);
      if (detectedQuestions.length === 0) {
        showStatus(statusBox, 'No questions to answer on this page.', 'danger');
        return;
      }
    }

    // Build JEV payload
    const jevQuestions = {};
    for (const q of detectedQuestions) {
      const criteria = {};
      for (const opt of q.options) {
        criteria[opt.id] = opt.text;
      }
      jevQuestions[q.id] = {
        type: 'choice',
        instructions: {
          question: q.text,
          guidance: 'Choose the option best supported by the reference context in state. Treat the reference context as the primary source.'
        },
        criteria: criteria
      };
    }

    const payload = {
      model: 'jev-latest',
      state: {
        reference_documents: [
          {
            name: 'moodle_context.txt',
            content: context || 'No reference context provided. Rely on general knowledge.'
          }
        ]
      },
      questions: jevQuestions
    };

    // UI Loading state
    btnAnswer.disabled = true;
    btnAnswer.textContent = '⏳ Evaluating…';
    showStatus(statusBox, `Evaluating ${detectedQuestions.length} questions with JEV…`, 'info');

    try {
      const response = await makeJevRequest(endpoint, apiKey, payload);
      const data = JSON.parse(response.responseText);

      if (!data.answers) {
        throw new Error('No answers returned in JEV response.');
      }

      // Map answers back to Moodle DOM
      let answeredCount = 0;
      for (const q of detectedQuestions) {
        const ans = data.answers[q.id];
        if (!ans) continue;

        const selectedOptId = ans.choice;
        const confidence = ans.confidence !== undefined ? ans.confidence : null;
        const probabilities = ans.probabilities || {};

        // Inject Question Confidence Header
        injectQuestionConfidence(q.blockEl, confidence, highlightLow, threshold);

        // Inject option probabilities and select choice
        for (const opt of q.options) {
          const isSelected = opt.id === selectedOptId;
          const prob = probabilities[opt.id] !== undefined ? probabilities[opt.id] : 0;

          if (showProbs) {
            injectOptionBadge(opt.radioInput, opt.id, prob, isSelected);
          }

          if (isSelected && autoSelect) {
            opt.radioInput.checked = true;
            opt.radioInput.dispatchEvent(new Event('change', { bubbles: true }));
            opt.radioInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
        answeredCount++;
      }

      showStatus(
        statusBox,
        `✓ Answered ${answeredCount} questions (${data.model || 'JEV'}) in ${data.usage?.input_tokens || '?'} tokens.`,
        'success'
      );
    } catch (err) {
      showStatus(statusBox, `Error: ${err.message}`, 'danger');
    } finally {
      btnAnswer.disabled = false;
      btnAnswer.textContent = '⚡ Answer with JEV';
    }
  }

  /**
   * GM.xmlHttpRequest wrapper for TypeSafe JEV.
   */
  function makeJevRequest(url, apiKey, payload) {
    return new Promise((resolve, reject) => {
      GM.xmlHttpRequest({
        method: 'POST',
        url: url,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        data: JSON.stringify(payload),
        timeout: 45000,
        onload: function (res) {
          if (res.status >= 200 && res.status < 300) {
            resolve(res);
          } else {
            let detail = '';
            try {
              const err = JSON.parse(res.responseText);
              detail = err.message || err.error || res.responseText;
            } catch {
              detail = res.responseText || res.statusText;
            }
            reject(new Error(`HTTP ${res.status}: ${detail}`));
          }
        },
        onerror: function (err) {
          reject(new Error('Network or GM.xmlHttpRequest error connecting to JEV.'));
        },
        ontimeout: function () {
          reject(new Error('Request timed out after 45 seconds.'));
        }
      });
    });
  }

  /**
   * Injects confidence badge on question container in Moodle.
   */
  function injectQuestionConfidence(blockEl, confidence, highlightLow, threshold) {
    const existing = blockEl.querySelector('.questionator-conf-badge');
    if (existing) existing.remove();

    if (confidence === null) return;

    const confPct = Math.round(confidence <= 1 ? confidence * 100 : confidence);
    const isLow = confPct < threshold;

    const badge = document.createElement('div');
    badge.className = 'questionator-conf-badge';
    badge.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      margin-bottom: 6px;
      background: ${isLow && highlightLow ? '#f8d7da' : '#e2f0d9'};
      color: ${isLow && highlightLow ? '#842029' : '#1e4620'};
      border: 1px solid ${isLow && highlightLow ? '#f5c2c7' : '#c3e6cb'};
    `;
    badge.innerHTML = `<span>JEV Confidence: ${confPct}%</span>${isLow && highlightLow ? ' ⚠️ Low' : ''}`;

    const qtext = blockEl.querySelector('.qtext');
    if (qtext) {
      qtext.parentNode.insertBefore(badge, qtext);
    }
  }

  /**
   * Injects probability badge and bar next to a Moodle radio input.
   */
  function injectOptionBadge(radioInput, optId, prob, isSelected) {
    const parent = radioInput.closest('div.d-flex, div.r0, div.r1, div') || radioInput.parentNode;
    const existing = parent.querySelector(`.questionator-prob-${optId}`);
    if (existing) existing.remove();

    const probPct = Math.round(prob <= 1 ? prob * 100 : prob);

    const badge = document.createElement('span');
    badge.className = `questionator-prob-${optId}`;
    badge.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-left: 8px;
      font-size: 11px;
      font-family: monospace;
      padding: 2px 6px;
      border-radius: 4px;
      background: ${isSelected ? '#0d6efd' : '#e9ecef'};
      color: ${isSelected ? '#ffffff' : '#495057'};
      font-weight: ${isSelected ? 'bold' : 'normal'};
    `;

    badge.innerHTML = `
      <span>${isSelected ? '✓ JEV ' : ''}${probPct}%</span>
      <span style="display:inline-block; width: 35px; height: 5px; background: rgba(0,0,0,0.15); border-radius: 3px; overflow: hidden;">
        <span style="display:block; height: 100%; width: ${probPct}%; background: ${isSelected ? '#ffffff' : '#6c757d'};"></span>
      </span>
    `;

    parent.appendChild(badge);
  }

  /**
   * Generates a targeted compression prompt for an LLM to compress the context against current quiz questions.
   */
  function generateCompressionPrompt(contextText, statusBox) {
    if (detectedQuestions.length === 0) {
      scanMoodleQuestions();
    }

    const formattedQuestions = detectedQuestions.map(q => {
      const opts = q.options.map(o => `  ${o.id}) ${o.text}`).join('\n');
      return `${q.number}. ${q.text}\n${opts}`;
    }).join('\n\n');

    const promptText = `You are a loss-minimizing context compressor.

Compress the SOURCE MATERIAL below to a maximum of 100,000 characters so that it remains useful as reference context for answering the MULTIPLE-CHOICE QUESTIONS provided below.

Preserve information that can distinguish one answer option from another, especially:
- definitions and terminology
- names and dates
- numerical values and thresholds
- rules and exceptions
- ordered procedures
- lists and classifications
- comparisons
- causes and consequences
- formulas
- conditions and constraints
- statements containing negation or exceptions

Prioritize information related to the supplied questions.

Do not answer the questions.
Do not add new facts.
Do not infer facts not present in the source.
Remove repetition, boilerplate, redundant examples and irrelevant material.

The resulting text MUST contain no more than 100,000 characters.

Return only the compressed reference text, with no introduction, explanation, Markdown fence or commentary.

MULTIPLE-CHOICE QUESTIONS:

${formattedQuestions || '(No questions detected on current page)'}

SOURCE MATERIAL:

${contextText || '(Paste your source material here)'}`;

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(promptText).then(() => {
        showStatus(statusBox, '✓ Compression prompt copied to clipboard! Paste it into Claude, ChatGPT, or Gemini.', 'success');
      });
    } else {
      showStatus(statusBox, 'Copy to clipboard not available. Please ensure HTTPS.', 'danger');
    }
  }

  function showStatus(el, message, type) {
    el.className = `status-box status-${type}`;
    el.textContent = message;
    el.style.display = 'block';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttr(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
