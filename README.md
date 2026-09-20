# Questionator

> **Context-powered quiz answers with TypeSafe JEV**

[![Deploy to GitHub Pages](https://github.com/erseco/questionator/actions/workflows/pages.yml/badge.svg)](https://github.com/erseco/questionator/actions/workflows/pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Live Application:** [https://erseco.github.io/questionator/](https://erseco.github.io/questionator/)

![Questionator Screenshot](.github/screenshot.png)

---

## Overview

**Questionator** is a lightweight, privacy-first client-side web application designed to help answer multiple-choice questionnaires using user-provided reference documents as context.

Unlike traditional chatbots that generate free-form text, Questionator leverages **TypeSafe's JEV System One** model to make typed, calibrated decisions across all questions in a single parallel evaluation.

---

## Key Features

* **100% Client-Side Processing:** All document text extraction and questionnaire parsing happen locally inside your web browser.
* **Multi-Format Document Support:** Extracts text from `.pdf`, `.docx`, `.txt`, `.md`, `.markdown`, `.json`, and `.csv`.
* **Smart Questionnaire Parser:** Handles diverse question formats (numbered, unnumbered, `A.`, `A)`, `A -`, lowercase options, inline choices, and True/False questions).
* **Interactive Question Workbench:** Review, edit, add, or delete questions and options before evaluating.
* **Single-Pass JEV Batching:** Evaluates all valid questions against reference material in a single API call for optimal latency and consistency.
* **Visual Calibrated Results:** Displays the winning answer with high visual prominence alongside confidence scores and complete probability distribution bars.
* **One-Click Answer Export:** Copy compact answer keys (e.g., `1. C`, `2. B`) or detailed answers with option text.
* **Zero Tracking & No Backend:** No accounts, no database, no telemetry, no tracking cookies, and no third-party proxies.

---

## Privacy Model

**Private by Design:**
* **Local File Processing:** Documents never leave your computer during extraction.
* **Explicit Transmission Only:** Extracted text and questions are sent to TypeSafe/JEV **only** when you explicitly click the **"Ask JEV"** button.
* **API Key Security:** Held in memory by default. An optional "Remember API key" switch persists it strictly to your browser's local storage. Your key is never logged, never committed, and never sent anywhere other than TypeSafe.
* **Strict Content Security Policy (CSP):** Network requests (`connect-src`) are restricted exclusively to `'self'` and `https://api.typesafe.ai`.

For complete details, see [PRIVACY.md](PRIVACY.md).

---

## Supported Formats

### Reference Documents
* **PDF (`.pdf`):** Extracted page-by-page using PDF.js. Detects and warns about scanned or image-only pages.
* **DOCX (`.docx`):** Extracted client-side via Mammoth.js.
* **Plain Text (`.txt`, `.md`, `.markdown`, `.json`, `.csv`):** Processed natively with the browser's `FileReader` and text APIs.

### Questionnaire Formats
Questionator supports standard test formats:

#### Format 1: Standard Letters
```text
1. What is the capital of France?
A. Rome
B. Madrid
C. Paris
D. Berlin
```

#### Format 2: Parentheses & Numbers
```text
2) Which protocol is used for secure web traffic?
A) FTP
B) HTTPS
C) SMTP
D) DNS
```

#### Format 3: Dashes and Lowercase
```text
Question 1
What is the largest ocean?
a - Atlantic
b - Indian
c - Pacific
d - Arctic
```

#### Format 4: Inline Choices
```text
What is the capital of Spain? A) Lisbon B) Madrid C) Paris D) Rome
```

#### Format 5: True/False Questions
```text
1. The Earth revolves around the Sun. (True/False)
```
or:
```text
2. ¿El cielo es azul?
Verdadero
Falso
```

---

## How JEV Is Used

Questionator communicates with TypeSafe's official endpoint:
`POST https://api.typesafe.ai/v1/systemone`

* **Model:** `jev-latest`
* **State:** User reference documents provided in `state.reference_documents` (`[{ name: "doc.pdf", content: "..." }]`).
* **Questions:** Each multiple-choice question is structured as a typed `choice` question with `criteria` mapping option IDs (`A`, `B`, `C`, etc.) to option text.
* **Batching:** All questions are submitted in a single request, allowing JEV to evaluate the questionnaire concurrently against the shared state.

### Getting a TypeSafe API Key
To obtain an API key:
1. Visit the [TypeSafe Console](https://console.typesafe.ai).
2. Generate an API key.
3. Paste the key into Questionator's **TypeSafe API key** input.

---

## CORS Notice & Current API Status

> [!IMPORTANT]
> **Direct Browser Request Status (CORS):**
> TypeSafe's API endpoint (`https://api.typesafe.ai/v1/systemone`) currently enforces an origin check that rejects preflight `OPTIONS` requests from web browsers (returning `400 Disallowed CORS origin`).
>
> In accordance with our core privacy principles:
> 1. Questionator **does not** route your data through unauthorized third-party CORS proxies (`cors-anywhere`, etc.) or custom relay backends.
> 2. The transport client in `assets/js/jev-client.js` detects this network/preflight failure cleanly and presents an honest explanation.
> 3. Once TypeSafe enables CORS support for browser applications or provides a browser-accessible gateway, Questionator will communicate immediately without architectural changes.

---

## Local Development

Questionator requires no build tools or package managers to run. Any static web server will work:

### Using Python 3
```bash
python3 -m http.server 8000
```
Open `http://localhost:8000` in your browser.

### Using Node.js (npx)
```bash
npx serve .
```

> **Note:** Opening `index.html` via `file:///` is not supported due to browser security restrictions on ES modules and Web Workers. Always use a local HTTP server.

---

## Automated Tests

Pure JavaScript tests for the questionnaire parser and JEV payload formatter are run using Node's native test runner:

```bash
npm test
```

---

## GitHub Pages Deployment

The application is deployed to GitHub Pages using the GitHub Actions workflow defined in [`.github/workflows/pages.yml`](.github/workflows/pages.yml).

### Repository Configuration
To activate GitHub Pages for your repository:
1. Go to **Settings** > **Pages**.
2. Under **Build and deployment** > **Source**, select **GitHub Actions**.
3. Pushes to `main` will automatically deploy the site.

---

## Project Structure

```text
questionator/
├── index.html                  # Main application HTML with strict CSP
├── favicon.svg                 # Application favicon
├── package.json                # Development test script configuration
├── README.md                   # Project documentation
├── PRIVACY.md                  # Privacy policy and security disclosure
├── AGENTS.md                   # Guidelines for AI coding agents
├── LICENSE                     # MIT License
├── .github/
│   ├── screenshot.png          # Application screenshot
│   └── workflows/
│       └── pages.yml           # GitHub Actions workflow for GitHub Pages
├── assets/
│   ├── css/
│   │   └── app.css             # Application CSS complementing Bootstrap 5
│   └── js/
│       ├── app.js              # Main application controller
│       ├── state.js            # Central reactive application state
│       ├── storage.js          # Local storage for opt-in key and theme
│       ├── files.js            # Client-side multi-format file extraction
│       ├── pdf.js              # PDF.js text layer extraction & progress
│       ├── question-parser.js  # Pure questionnaire parsing & JEV formatting
│       ├── jev-client.js       # Isolated TypeSafe JEV transport & retry logic
│       ├── results.js          # Answer cards & probability distribution UI
│       └── utils.js            # HTML escaping, formatting, and clipboard
└── test/
    └── question-parser.test.js # Test suite for the questionnaire parser
```

---

## License

This project is licensed under the [MIT License](LICENSE).
