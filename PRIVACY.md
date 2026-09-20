# Privacy Policy — Questionator

**Questionator is private by design.**

The application was built from the ground up to ensure that your documents, questionnaires, and API credentials remain under your control.

---

## 1. What Stays Inside Your Browser

Everything you do in Questionator happens locally on your device by default:

* **Uploaded Documents:** Files (`.pdf`, `.docx`, `.txt`, `.md`, `.json`, `.csv`) are read and processed entirely within your browser using modern client-side APIs (such as `FileReader`, PDF.js, and Mammoth.js). Files are **never** uploaded to an application server or cloud storage.
* **Extracted Text:** Text extracted from your documents is held exclusively in browser memory.
* **Pasted Questionnaires:** Any questionnaire text you paste is parsed locally using client-side JavaScript.
* **Parsed & Edited Questions:** The questionnaire review workbench operates strictly within browser memory.
* **Results & Probabilities:** Model evaluations and probability distributions remain in browser memory.
* **Page Reloads:** Refreshing or closing the browser tab clears all documents, questionnaires, and evaluation results.

---

## 2. What Is Sent to TypeSafe/JEV

Application data leaves your browser **only when you explicitly click the "Ask JEV" button**.

When you trigger an evaluation, Questionator sends an HTTP POST request directly from your browser to TypeSafe's official API endpoint (`https://api.typesafe.ai/v1/systemone`).

This request contains:
1. **Bearer Token:** Your TypeSafe API key in the `Authorization` header.
2. **State:** The extracted text of the uploaded reference documents (`state.reference_documents`).
3. **Questions:** The parsed multiple-choice questions with their answer options formatted as JEV `choice` questions.

**No other data is transmitted.** Questionator does not use intermediate proxy servers, hidden APIs, or third-party AI relays.

---

## 3. API Key Handling

* **In-Memory by Default:** Your TypeSafe API key is held only in JavaScript memory for the current page session.
* **Optional Persistence:** You may optionally choose "Remember API key on this device". If enabled, your key is stored strictly in your browser's `localStorage`. You can revoke and delete this key at any time using the "Clear stored key" button.
* **Never Logged:** The API key is never output to the browser console, never included in error messages, never displayed in debug logs, and never embedded in URLs or build artifacts.

---

## 4. No Analytics, Telemetry, or Tracking

Questionator contains:
* **No analytics** (e.g., Google Analytics, Plausible, Mixpanel).
* **No telemetry or remote error reporting** (e.g., Sentry, LogRocket).
* **No user accounts or authentication servers**.
* **No cookies**.
* **No advertising or tracking pixels**.

---

## 5. CDN Assets and Content Security Policy

To provide a modern interface and client-side extraction capabilities without a build step, static vendor libraries (Bootstrap 5, Bootstrap Icons, PDF.js, Mammoth.js) are loaded from pinned public CDNs (`cdn.jsdelivr.net`, `cdnjs.cloudflare.com`) with Subresource Integrity (SRI) hashes.

* **No User Data to CDNs:** Your documents, questionnaire text, and API keys are **never** sent to these CDN providers.
* **Content Security Policy (CSP):** The application enforces a strict Content Security Policy that explicitly restricts network connections (`connect-src`) to `'self'`, `https://api.typesafe.ai`, and `https://*.workers.dev`. Network connections to any other domain are blocked by the browser.

---

## 6. Self-Hosted Cloudflare Worker Proxy (Optional)

Because TypeSafe's API currently rejects browser preflight requests with `Disallowed CORS origin`, an optional self-hosted Cloudflare Worker proxy script is provided in [`scripts/typesafe-proxy-worker.js`](scripts/typesafe-proxy-worker.js).

* **Zero Storage Guarantee:** The worker contains NO persistent storage, NO database bindings (KV, D1, R2), and NO caching layers. Nothing is saved to disk.
* **Zero Logging Guarantee:** Observability and logging are strictly disabled (`[observability] enabled = false`). The script contains no `console.log` and records zero headers, tokens, request bodies, or responses.
* **Token Protection:** The `Authorization` header is forwarded directly in-flight to TypeSafe and is never copied, stored, or inspected.
* **Origin Restriction:** Only requests originating from `https://erseco.github.io` (and localhost for development) are accepted; all other origins are rejected with `403 Forbidden`.

---

## 7. Open Source and Verifiable

Questionator is open-source software under the MIT License. You can inspect the complete source code, audit the network activity using your browser's Developer Tools (Network tab), or host your own copy locally or on GitHub Pages.
