# AGENTS.md — Development Guidelines for Questionator

This document defines explicit architectural and engineering guidelines for AI coding agents and human contributors working on the **Questionator** repository.

---

## 1. Project Overview

Questionator is a static, browser-only web application that uses **TypeSafe/JEV** to answer multiple-choice questionnaires using user-provided reference documents as context.

---

## 2. Architecture Rules

* **Static Architecture:** Keep the production application strictly static. It must run from any standard static web server or GitHub Pages without a build step or server runtime.
* **No Backend:** Do not introduce a backend, database, serverless function, or cloud service without explicit user approval.
* **No Frameworks:** Do not introduce frontend frameworks (React, Vue, Angular, Svelte, Next.js, etc.) unless there is an overwhelming, approved justification.
* **Vanilla JavaScript & Bootstrap:** Prefer modern vanilla JavaScript (ES modules) and Bootstrap 5.
* **Minimal External Libraries:** Keep external libraries minimal. Use browser-native APIs wherever practical.
* **Pinned CDN Dependencies:** External library URLs from CDNs must be pinned to specific versions and include Subresource Integrity (`integrity`) and `crossorigin="anonymous"`.
* **Local Processing:** All document text extraction (PDF, DOCX, TXT, MD, JSON, CSV) and questionnaire parsing must happen locally in the browser.
* **Controlled Data Transmission:** User data (extracted document text and parsed questions) may **only** leave the browser when the user explicitly triggers an evaluation request to TypeSafe/JEV.
* **Zero Telemetry:** Never add analytics, tracking scripts, telemetry, remote error reporting (e.g., Sentry), or third-party fonts.
* **No CORS Proxies:** Never introduce third-party CORS proxies, relays, or hidden endpoints (`cors-anywhere`, etc.). If CORS blocks browser communication, report the restriction honestly to the user.
* **Credential Protection:** Never commit API keys, log API keys to the console, embed them in URLs, or display them in debug views or error messages.
* **Isolated JEV Transport:** Keep the JEV transport logic completely encapsulated inside `assets/js/jev-client.js`. UI components must never deal directly with low-level HTTP transport details.
* **GitHub Pages Compatibility:** All asset URLs must remain relative (e.g., `./assets/css/app.css`) so the site functions correctly under subpath project URLs like `https://erseco.github.io/questionator/`.

---

## 3. Code Style

* **Language:** All source code, comments, documentation, commit messages, and UI text must be in English.
* **Modular Design:** Use small, cohesive ES modules with single responsibilities.
* **Functions over Classes:** Prefer plain functions and plain objects over complex class hierarchies.
* **No Global Variables:** Avoid polluting the global scope; export and import module members cleanly.
* **No Inline JavaScript:** Avoid `onclick="..."` attributes in HTML. Attach event listeners in JavaScript.
* **Strict Equality:** Always use `===` and `!==`.
* **Explicit Error Handling:** Handle asynchronous operations and promises with `try...catch` and explicit error boundaries.
* **XSS Prevention:** Treat all uploaded files and pasted text as untrusted user input. Never use unsafe `innerHTML` with unsanitized user content. Use `escapeHtml()`, `textContent`, or structured DOM construction.
* **Accessibility (a11y):** Maintain WCAG 2.1 AA basics: semantic HTML, accessible form labels, keyboard navigation, visible focus indicators, and ARIA live regions for dynamic alerts.

---

## 4. UI & Results Guidelines

* **Bootstrap First:** Use Bootstrap 5 grid and components. Avoid redundant custom utility classes.
* **Responsive Layout:** Ensure clean stacking on tablets and mobile devices.
* **Uncertainty & Calibration:** Display the actual confidence and probability distributions returned by JEV. Never hide uncertainty or describe model output as mathematically guaranteed truth.
* **Visual Prominence:** Make the selected answer immediately clear with strong typographic contrast, not color alone.

---

## 5. Testing Guidelines

* **Parser Tests:** Any modification to `assets/js/question-parser.js` must be accompanied by corresponding tests in `test/question-parser.test.js`.
* **Zero Dependency Tests:** Tests should run directly with Node's built-in test runner (`npm test` / `node --test test/*.test.js`).
* **JEV Request Verification:** Changes to the JEV request payload must be verified against current TypeSafe API specifications (`POST https://api.typesafe.ai/v1/systemone`).

---

## 6. Privacy First

Treat privacy constraints as immutable architectural requirements, not optional features.
