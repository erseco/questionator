# Build Questionator

You are an experienced frontend engineer. Build the complete application in this GitHub repository:

https://github.com/erseco/questionator

The project name is **Questionator**.

Do not just create a prototype. Implement the complete usable application, documentation, repository structure, GitHub Pages deployment, tests where practical, and `AGENTS.md`.

Work directly against the existing repository structure and preserve the existing `LICENSE`.

---

# 1. Product goal

Questionator is a small, privacy-oriented web application that helps answer multiple-choice questionnaires using user-provided reference documents as context.

The workflow is:

1. The user opens Questionator.
2. The user pastes their own TypeSafe/JEV API key.
3. The user uploads or drops reference documents.
4. All document extraction happens locally in the browser.
5. The user pastes one or many questionnaire questions.
6. Questionator parses the questions and answer options.
7. The user can review and correct the parsed questions.
8. The application sends the extracted document text plus typed questions to JEV.
9. JEV evaluates all questions.
10. The application presents the selected answers very visually, including confidence and probability information.
11. The user can copy a compact answer list.

The UX should take inspiration from:

https://jev-explained-repo.vercel.app/

and:

https://github.com/davila7/jev-explained

but Questionator is a separate product with a different purpose and should not copy its code or branding unnecessarily.

---

# 2. Core principle

Questionator must be a **client-side application**.

There must be:

* no application backend;
* no database;
* no user accounts;
* no analytics;
* no telemetry;
* no tracking;
* no cookies;
* no server-side document processing;
* no third-party AI service other than TypeSafe/JEV;
* no public CORS proxy;
* no hidden API;
* no serverless backend unless explicitly approved later.

The uploaded files and extracted text must stay inside the user's browser.

Questionnaire contents and document contents may leave the browser **only as part of an explicit JEV request**.

The API key must never be committed, embedded in the build, included in a URL, printed in the console, or sent anywhere other than TypeSafe/JEV.

Static CDN assets may be downloaded by the browser, but application data must never be sent to those CDNs.

Do not add Google Analytics, Sentry, telemetry libraries, remote logging, fonts from third-party services, advertising, or equivalent services.

---

# 3. Technology

Keep the application deliberately simple.

Prefer:

* HTML5
* modern vanilla JavaScript using ES modules
* CSS
* Bootstrap 5 loaded from a pinned CDN URL
* Bootstrap Icons from CDN if useful

Do not use:

* React
* Vue
* Angular
* Next.js
* Nuxt
* a server runtime
* unnecessary npm dependencies
* a bundler unless there is a compelling technical reason

The application must be deployable directly to GitHub Pages as static files.

Prefer browser-native APIs wherever possible.

External libraries are allowed through pinned CDN URLs when useful.

Suggested libraries:

* Bootstrap 5 for layout and UI
* PDF.js for client-side PDF text extraction
* Mammoth.js for client-side `.docx` extraction, if practical

Do not add a Markdown rendering library merely to extract Markdown text. Markdown files can be read as plain text.

Do not use a library when the browser can perform the same task clearly with a small amount of code.

Pin CDN library versions. Use Subresource Integrity (`integrity`) and `crossorigin` where the selected CDN provides compatible SRI hashes.

---

# 4. GitHub Pages compatibility

The final site must work as a GitHub project site, for example:

https://erseco.github.io/questionator/

Do not assume the application is deployed at `/`.

All internal resources must therefore use relative URLs.

Do not implement client-side routing.

Create a GitHub Actions workflow under:

`.github/workflows/pages.yml`

that deploys the static application to GitHub Pages using the official GitHub Pages actions.

Use current official action versions.

The site must not require a build step unless absolutely necessary.

If no build step is needed, deploy the repository's static web root directly.

Document in the README any GitHub repository setting that has to be enabled manually.

---

# 5. Important CORS constraint

This requirement is critical.

Questionator is intended to communicate directly from the browser to TypeSafe/JEV.

The official endpoint is currently:

`POST https://api.typesafe.ai/v1/systemone`

with:

`Authorization: Bearer <API_KEY>`

and:

`Content-Type: application/json`

The model should be:

`jev-latest`

Before choosing the final transport implementation, inspect the current TypeSafe documentation:

https://docs.typesafe.ai/introduction

https://docs.typesafe.ai/api

https://docs.typesafe.ai/sdk/javascript

The TypeSafe JavaScript SDK documents browser use through `dangerouslyAllowBrowser`, but browser execution does not by itself guarantee that the API endpoint permits the required CORS request.

Do not assume CORS works.

Do not try to bypass CORS.

Do not use `cors-anywhere`, third-party proxies, JSONP hacks, browser extensions, Vercel functions, Cloudflare Workers, or another relay without explicit authorization.

Implement the direct browser request cleanly.

If direct browser access is currently prevented by TypeSafe's CORS policy:

1. keep the architecture client-only;
2. detect and handle the network failure cleanly;
3. display a specific and understandable error explaining that the TypeSafe endpoint is not currently allowing direct browser requests;
4. document the limitation in the README;
5. do not pretend that the request succeeded;
6. do not silently redirect the data through another service.

Architect the JEV transport behind a small isolated module so that a future supported browser endpoint or transport can be substituted easily.

For example:

`assets/js/jev-client.js`

No UI component should know implementation details of the HTTP transport.

---

# 6. JEV model

Use TypeSafe/JEV according to the official API.

JEV is not a text-generation chatbot.

Questionator should use typed decisions.

Uploaded documents are the shared `state`.

Each multiple-choice quiz question becomes a JEV `choice` question.

Example conceptual request:

```json
{
  "model": "jev-latest",
  "state": {
    "reference_documents": [
      {
        "name": "chapter-1.pdf",
        "content": "Extracted text..."
      },
      {
        "name": "notes.md",
        "content": "..."
      }
    ]
  },
  "questions": {
    "q1": {
      "type": "choice",
      "instructions": {
        "question": "What is ...?",
        "guidance": "Choose the option best supported by the reference documents in state. Treat the provided reference documents as the primary source."
      },
      "criteria": {
        "A": "First option",
        "B": "Second option",
        "C": "Third option",
        "D": "Fourth option"
      }
    },
    "q2": {
      "type": "choice",
      "instructions": {
        "question": "Which statement ...?",
        "guidance": "Choose the option best supported by the reference documents in state. Treat the provided reference documents as the primary source."
      },
      "criteria": {
        "A": "Option one",
        "B": "Option two"
      }
    }
  }
}
```

This is an example of the desired shape, not something to blindly hard-code. Verify the current API documentation while implementing.

One of the main benefits of JEV is that multiple typed questions can be evaluated against the same state.

Therefore:

**Send all parsed questionnaire questions in a single JEV request whenever practical.**

Do not make one HTTP request per question by default.

Preserve the association between:

* local question ID;
* displayed question number;
* question text;
* option IDs;
* option text;
* JEV response.

Use stable internal IDs such as:

* `q1`
* `q2`
* `q3`

Do not use the question text itself as an object key.

---

# 7. Supported questionnaire types

Version 1 is primarily for:

* multiple-choice questions;
* single-answer questions;
* true/false questions.

JEV does not generate arbitrary free-text responses, so Questionator must not pretend it can answer open-ended questions through a `choice` primitive when no choices exist.

If a pasted question has no identifiable options:

* mark it as needing review;
* do not send it to JEV until the user supplies options;
* explain why.

True/false questions can be represented as `choice` questions with two options.

The parser should not depend on the language of the actual questionnaire.

Questions and documents may be in:

* English;
* Spanish;
* or another language.

The interface itself can initially be English.

---

# 8. Questionnaire input

Provide a large textarea titled something similar to:

**Paste questionnaire**

It must accept a single question or many questions at once.

Support common forms such as:

```text
1. What is the capital of France?
A. Rome
B. Madrid
C. Paris
D. Berlin

2. Which protocol is used for secure web traffic?
A) FTP
B) HTTPS
C) SMTP
D) DNS
```

Also support variations such as:

```text
Question 1
What is ...?

a) First
b) Second
c) Third
```

and:

```text
1) Question
A - First option
B - Second option
C - Third option
```

and simple true/false formats.

Handle common option prefixes:

* `A.`
* `A)`
* `A:`
* `A -`
* `a.`
* `a)`
* etc.

Support inline options when reasonably detectable:

```text
What is ...? A) One B) Two C) Three D) Four
```

Do not make parsing magical or overly fragile.

The parser must return structured objects.

For example:

```js
{
    id: 'q1',
    number: 1,
    text: 'What is the capital of France?',
    options: [
        { id: 'A', text: 'Rome' },
        { id: 'B', text: 'Madrid' },
        { id: 'C', text: 'Paris' },
        { id: 'D', text: 'Berlin' }
    ]
}
```

Keep parsing logic separate from the UI.

Suggested module:

`assets/js/question-parser.js`

---

# 9. Parsed-question review

Do not send pasted text immediately to JEV.

After parsing, show a review screen or section.

Each parsed question should be displayed as an editable card.

Users must be able to:

* edit question text;
* edit option text;
* add an option;
* delete an option;
* delete a question;
* reorder questions if practical;
* correct wrongly parsed labels.

Clearly highlight questions that cannot yet be sent.

Show a summary such as:

`12 questions detected · 11 ready · 1 needs review`

Only send valid questions.

---

# 10. Document upload

Create a clear reference-material section.

Support drag and drop and a regular file picker.

At minimum support:

* `.pdf`
* `.txt`
* `.md`
* `.markdown`
* `.json`
* `.csv`

Also support `.docx` using Mammoth.js if this can remain clean and fully client-side.

All extraction must happen in the browser.

Never upload the original files to a backend.

For each document show:

* file name;
* file type;
* extracted character count;
* extraction status;
* remove button.

Allow multiple documents.

Provide a button to remove all documents.

For plain-text formats, use `FileReader` or modern browser file APIs.

For PDF:

* use PDF.js;
* iterate through pages;
* extract the text layer;
* preserve page boundaries in a useful textual form;
* do not render every page merely to extract text.

For scanned/image-only PDFs:

* detect when little or no text can be extracted;
* display a warning such as:
  `No usable text was found. This PDF may contain scanned pages. OCR is not included in this version.`
* do not silently pretend extraction succeeded.

Do not add OCR in version 1.

For DOCX:

* extract plain text locally;
* do not send the document to an online conversion service.

---

# 11. Reference context

Store extracted documents as structured client-side data.

For example:

```js
[
    {
        id: '...',
        name: 'chapter1.pdf',
        type: 'application/pdf',
        content: '...',
        characters: 12345
    }
]
```

When constructing the JEV state, strip UI-only properties if unnecessary.

Keep document boundaries.

Do not concatenate everything into an ambiguous blob when structured state can preserve useful information.

The JEV state should identify each source by filename.

Uploaded documents should be treated as the primary reference material for answering questions.

Do not invent citations or textual explanations that JEV has not returned.

---

# 12. API key handling

Add an API key input labelled:

**TypeSafe API key**

The input should be `type="password"` by default.

Add a show/hide button.

Include a link to the appropriate official TypeSafe API key page/documentation.

The key:

* must not be hard-coded;
* must never be committed;
* must not appear in query parameters;
* must not be sent to analytics;
* must not be logged;
* must not be inserted into error messages;
* must not be included when copying debug data.

Default behavior:

* keep the key only in memory for the current page session.

Optionally provide:

**Remember API key on this device**

If enabled, store it only in `localStorage`.

Make this opt-in, not opt-out.

Explain briefly:

`Stored only in this browser.`

Provide a clear/remove stored key action.

---

# 13. Main layout

Use Bootstrap.

The desktop interface should feel like a practical tool, not a marketing landing page.

A three-area layout similar in spirit to Jev Explained would work well:

### Left panel

Configuration and context:

* Questionator logo/name
* TypeSafe API key
* reference documents
* document status

### Center panel

Questionnaire workbench:

* pasted questionnaire textarea
* Parse questions button
* parsed question editor
* Run Questionator button

### Right panel

Results:

* answer cards
* confidence
* probability distributions
* compact answer summary
* copy buttons

On tablets and phones, stack the sections sensibly.

Use Bootstrap grid/offcanvas/collapse where appropriate.

Avoid excessive custom UI code where Bootstrap already provides the component.

---

# 14. Branding

Product name:

**Questionator**

Suggested subtitle:

**Context-powered quiz answers with JEV**

The tone can be slightly playful, but the application itself should remain clean and useful.

A simple stylized `Q` icon or CSS/Bootstrap-icon based mark is enough.

Do not introduce an external image-generation dependency.

Create a simple local SVG favicon if useful.

---

# 15. Results design

Results are a core feature.

Make the selected answer immediately visible.

Each answer card should show approximately:

```text
Question 3

Which protocol ...?

┌───────────────────────────────┐
│            B                  │
│            HTTPS              │
│                               │
│      confidence 92%           │
└───────────────────────────────┘
```

Below it, show the probability distribution returned by JEV:

```text
A  FTP      2%   ▏
B  HTTPS   94%   ███████████████████
C  SMTP     3%   ▍
D  DNS      1%   ▏
```

Use Bootstrap progress bars or equivalent accessible markup.

Do not hide the uncertainty.

Display the actual confidence value returned by JEV.

Do not present model output as mathematically guaranteed correctness.

The selected option should have strong visual prominence.

Use accessible color contrast.

Do not rely exclusively on color to communicate the selected answer.

---

# 16. Multiple-question summary

When several questions were answered, provide a compact summary at the top or bottom:

```text
1. C
2. B
3. A
4. D
5. B
```

Include:

**Copy answers**

which copies exactly that compact form.

Also provide:

**Copy answers with text**

which can produce:

```text
1. C — Paris
2. B — HTTPS
3. A — ...
```

Keep original questionnaire numbering when possible.

---

# 17. Request status

While running JEV, provide useful feedback.

Show:

* spinner;
* `Evaluating 12 questions with JEV…`
* disabled submit button while active.

When complete, if available from the API, show unobtrusively:

* model;
* input token count;
* output token count;
* request duration measured by the browser.

Do not make technical metadata more prominent than the answers.

---

# 18. Errors

Handle errors carefully.

Distinguish at least:

* missing API key;
* no questions;
* invalid parsed questions;
* invalid API key / HTTP 401;
* malformed request / HTTP 422;
* rate limiting / HTTP 429;
* overloaded service / HTTP 529;
* network error;
* CORS/browser transport failure;
* invalid/unexpected API response;
* PDF extraction failure;
* unsupported file type.

Use Bootstrap alerts.

Do not expose the API key in an error.

For 429 and 529, implement a reasonable bounded exponential retry strategy or follow the official SDK/API recommendations.

Do not retry authentication or validation failures automatically.

---

# 19. Privacy indicator

Include a small privacy note in the UI.

Suggested wording:

**Private by design**

`Files are processed locally in your browser. Extracted content is only sent when you explicitly ask JEV to evaluate the questionnaire.`

If CDN assets are used, do not falsely claim that the browser makes literally zero other HTTP connections.

Be precise: application data is not sent to the CDNs.

Create a short `PRIVACY.md` explaining:

* what stays local;
* what is sent to TypeSafe;
* API key handling;
* localStorage behavior;
* CDN asset loading;
* absence of analytics;
* absence of backend storage.

---

# 20. Network restrictions

Because privacy is a central design constraint, configure a Content Security Policy where practical.

At minimum, constrain `connect-src` so application JavaScript can only make data/network API requests to:

* the current origin as required by the page;
* TypeSafe's official API endpoint.

Allow only the CDN origins actually needed for scripts/styles/workers.

PDF.js workers may require specific `worker-src` configuration.

Do not add wildcard network permissions such as:

`connect-src *`

Do not weaken the policy just to hide an integration problem.

---

# 21. State persistence

It is acceptable to persist non-sensitive convenience settings such as:

* dark/light preference;
* whether the key should be remembered.

Do not automatically persist:

* uploaded document contents;
* questionnaire text;
* answers;
* extracted text.

A page reload should normally clear those.

The optional remembered API key is the only sensitive persisted item and must require explicit opt-in.

---

# 22. Theme

Use a clean technical interface.

Support both light and dark appearance if it can be done simply using Bootstrap 5's color mode support.

Default to the user's system preference.

A theme toggle is desirable but not mandatory if it complicates the architecture.

Keep custom CSS restrained.

Do not create hundreds of utility classes that duplicate Bootstrap.

---

# 23. Accessibility

Use semantic HTML.

Ensure:

* every form element has a label;
* keyboard navigation works;
* focus states are visible;
* buttons have understandable accessible names;
* drag-and-drop has a normal file-input alternative;
* status updates use suitable ARIA live regions;
* progress indicators contain textual values;
* selected answers are identifiable without color alone.

Aim for WCAG 2.1 AA basics.

---

# 24. JavaScript architecture

Do not put the entire application into one enormous script.

A suggested structure is:

```text
/
├── index.html
├── AGENTS.md
├── README.md
├── PRIVACY.md
├── LICENSE
├── favicon.svg
│
├── assets/
│   ├── css/
│   │   └── app.css
│   │
│   └── js/
│       ├── app.js
│       ├── state.js
│       ├── files.js
│       ├── pdf.js
│       ├── question-parser.js
│       ├── jev-client.js
│       ├── results.js
│       ├── storage.js
│       └── utils.js
│
└── .github/
    └── workflows/
        └── pages.yml
```

This is a suggestion, not an obligation.

Prefer cohesive modules with clear responsibilities.

Do not over-engineer with classes when plain functions and modules are clearer.

Use modern JavaScript consistently.

Source code, variable names, comments, documentation, commit-facing text, and UI copy should be in English.

---

# 25. App state

Keep a clear centralized application state rather than deriving critical data from arbitrary DOM elements.

Conceptually:

```js
const state = {
    apiKey: '',
    rememberApiKey: false,
    documents: [],
    rawQuestionnaire: '',
    questions: [],
    results: null,
    requestStatus: 'idle'
};
```

This can be implemented simply.

No Redux-like library is needed.

---

# 26. Security

Treat all pasted and uploaded text as untrusted input.

Never inject document text or questionnaire text using unsafe `innerHTML`.

Prefer:

* `textContent`;
* DOM construction;
* safe form values.

If HTML rendering is ever needed, sanitize it first.

Do not execute content from uploaded HTML, Markdown, JSON, CSV, DOCX or PDF files.

Do not dynamically execute JavaScript from questionnaire text.

Never use `eval()` or `new Function()`.

Do not include the API key in DOM attributes unnecessarily.

Do not expose it in diagnostic output.

---

# 27. Debugging

It is useful to provide a collapsible developer/debug view similar to Jev Explained.

It may show:

* normalized parsed questions;
* request body;
* raw API response;
* latency;
* token usage.

But:

**The API key must never appear in this debug view.**

The debug section should be collapsed by default.

Make it visually secondary.

Use `<details>` if that keeps the implementation simple.

---

# 28. Testing

Add useful automated tests without turning this simple static project into a framework-heavy application.

At minimum, test the pure questionnaire parser thoroughly.

Cover:

* one question;
* several questions;
* `A.`;
* `A)`;
* lowercase options;
* true/false;
* blank lines;
* multiline question text;
* malformed question;
* missing options;
* pasted content with Windows line endings;
* accented/non-English text.

If using a small Node-based test runner greatly improves maintainability, that is acceptable as a development-only dependency, but the production application must remain static and must not depend on Node.

Prefer tests for pure functions rather than DOM-heavy tests.

If you introduce `package.json`, keep it small and clearly development-only.

Provide sensible scripts such as:

```json
{
  "scripts": {
    "test": "...",
    "lint": "..."
  }
}
```

Do not introduce a frontend build pipeline merely because tests use Node.

---

# 29. README

Create a useful `README.md`.

Include:

1. project name;
2. concise description;
3. screenshot placeholder or live-site section;
4. live GitHub Pages URL;
5. features;
6. privacy model;
7. supported file formats;
8. supported question formats;
9. how JEV is used;
10. how to obtain an API key;
11. local development instructions;
12. GitHub Pages deployment;
13. CORS limitations if they currently apply;
14. project structure;
15. security notes;
16. license.

Local development should be trivial.

For example:

```bash
python3 -m http.server 8000
```

or another simple static server.

Do not tell developers to open `index.html` directly if PDF workers, ES modules, or browser security policies require HTTP.

---

# 30. AGENTS.md

Create a root-level `AGENTS.md`.

It must give future coding agents explicit project rules.

Include at least:

## Project

Questionator is a static browser-only application that uses TypeSafe/JEV to answer multiple-choice questionnaires from locally extracted document context.

## Architecture rules

* Keep the production application static.
* Do not introduce a backend without explicit approval.
* Do not introduce a framework without a strong reason.
* Prefer vanilla JavaScript and Bootstrap.
* Keep external libraries minimal.
* CDN dependencies must be pinned.
* All document parsing happens locally.
* User data may only be sent to TypeSafe/JEV through the explicit evaluation action.
* Never add analytics or telemetry.
* Never add a public CORS proxy.
* Never commit API keys.
* Keep the JEV transport isolated.
* Preserve GitHub Pages compatibility.
* Use relative asset paths.

## Code style

* English source code and comments.
* Small cohesive ES modules.
* Prefer functions over unnecessary classes.
* Avoid global variables.
* Avoid inline JavaScript.
* Avoid inline CSS except where genuinely useful.
* Use strict equality.
* Handle async errors explicitly.
* Sanitize or safely render untrusted text.
* Keep accessibility in mind.

## UI

* Bootstrap first.
* Responsive.
* Keyboard accessible.
* Do not hide JEV uncertainty.
* Do not describe model output as guaranteed correctness.

## Testing

* Parser changes require parser tests.
* File extraction changes should preserve client-only processing.
* Changes to JEV requests must be checked against the current TypeSafe documentation.

## Privacy

Treat privacy constraints as architectural requirements, not optional features.

---

# 31. GitHub Actions

Create a Pages deployment workflow.

Use the official GitHub actions designed for Pages, such as the current supported versions of:

* `actions/checkout`
* `actions/configure-pages`
* `actions/upload-pages-artifact`
* `actions/deploy-pages`

Use the correct permissions:

```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

Use the GitHub Pages deployment environment.

Deploy on pushes to `main`.

Also support manual `workflow_dispatch`.

Do not place API keys in GitHub Actions secrets because the application uses the visitor's own API key.

---

# 32. No fake functionality

This is important.

Do not mock the final answer in production.

Do not return hard-coded quiz responses when JEV fails.

Do not substitute another LLM.

Do not silently call OpenAI, Anthropic, Gemini, Vercel AI Gateway, or another provider.

Do not implement a hidden proxy.

Do not pretend CORS is solved when it is not.

A clear limitation is preferable to misleading behavior.

---

# 33. Desired user experience

The happy path should feel approximately like this:

1. Open Questionator.
2. Paste TypeSafe key.
3. Drop `tema-3.pdf`.
4. UI shows:
   `tema-3.pdf · PDF · 38,421 characters · Ready`
5. Paste 15 Moodle-style questions.
6. Click **Parse questions**.
7. UI displays:
   `15 questions detected · all ready`
8. Review them.
9. Click a prominent:
   **Ask JEV**
10. UI displays:
    `Evaluating 15 questions with JEV…`
11. One JEV request evaluates them.
12. Right panel fills with 15 answer cards.
13. Each card prominently shows:

* option letter;
* option text;
* confidence;
* probability bars.

14. At the top:
    `15 answers · Copy answers`
15. Copy produces:

```text
1. B
2. D
3. A
4. C
...
```

The application should be fast enough that the browser UI itself never feels like the bottleneck.

---

# 34. Empty states

Design useful empty states.

No documents:

`Add reference material to give JEV the context for your questionnaire.`

No questionnaire:

`Paste one or more multiple-choice questions here.`

No results:

`Your answers will appear here.`

Malformed question:

`This question needs at least two answer options.`

No PDF text:

`No usable text could be extracted. The PDF may contain scanned pages.`

---

# 35. Buttons and labels

Prefer concise labels such as:

* `Add documents`
* `Remove all`
* `Parse questions`
* `Add option`
* `Delete question`
* `Ask JEV`
* `Copy answers`
* `Copy with text`
* `Clear results`
* `Show API key`
* `Remember API key`
* `Debug`
* `Try again`

Avoid vague labels like `Submit`.

---

# 36. Loading and concurrency

Do not allow multiple accidental simultaneous evaluations.

Use `AbortController` where appropriate so an in-flight request can be cancelled if the architecture supports it cleanly.

Keep parsed questions and uploaded documents intact after an API error so the user can retry.

A successful new evaluation should replace or clearly separate the previous result.

---

# 37. Performance

Do not unnecessarily duplicate extracted document strings in application state.

Avoid repeatedly re-extracting the same file.

For large PDFs, update extraction progress if practical:

`Reading page 12 of 63…`

Do not block the interface unnecessarily.

Avoid creating huge DOM trees to display full reference documents.

The UI only needs metadata and perhaps a small optional text preview.

---

# 38. Code quality

Before considering the implementation complete:

* remove dead code;
* remove console debugging;
* ensure no API key can be logged;
* ensure CDN URLs are pinned;
* check all relative paths under a GitHub project Pages URL;
* check responsive layouts;
* check keyboard operation;
* run tests;
* validate the GitHub Actions YAML;
* verify the app locally over HTTP;
* verify direct JEV communication as far as current CORS policy permits.

---

# 39. Acceptance criteria

The implementation is complete only when all of these are true:

* [ ] Static application.
* [ ] Runs locally from a simple HTTP server.
* [ ] Deployable to GitHub Pages.
* [ ] Bootstrap loaded from CDN.
* [ ] No frontend framework.
* [ ] User can enter their own JEV key.
* [ ] Key is hidden by default.
* [ ] Key is not logged.
* [ ] Optional key persistence is opt-in.
* [ ] Multiple reference documents can be loaded.
* [ ] PDF text extraction happens locally.
* [ ] TXT/MD/JSON/CSV work locally.
* [ ] DOCX works locally if included.
* [ ] Scanned PDFs are reported clearly.
* [ ] One questionnaire question can be parsed.
* [ ] Multiple questionnaire questions can be parsed.
* [ ] Parsed questions can be reviewed/edited.
* [ ] Invalid questions are identified.
* [ ] JEV questions use `choice`.
* [ ] Multiple quiz questions are batched into one JEV request.
* [ ] JEV response maps correctly back to question cards.
* [ ] Selected option is highly visible.
* [ ] Option text is visible.
* [ ] Confidence is visible.
* [ ] Probability distribution is visible.
* [ ] Compact answer list is available.
* [ ] Answer list can be copied.
* [ ] Errors are useful and safe.
* [ ] CORS failure is reported honestly.
* [ ] No third-party proxy exists.
* [ ] No analytics or telemetry exists.
* [ ] User application data is not sent to CDN providers.
* [ ] `README.md` exists and is complete.
* [ ] `PRIVACY.md` exists.
* [ ] `AGENTS.md` exists.
* [ ] GitHub Pages workflow exists.
* [ ] Existing LICENSE is preserved.
* [ ] Parser tests exist.
* [ ] No secrets exist in the repository.

---

# 40. Implementation process

Start by inspecting the repository and current official TypeSafe/JEV documentation.

Then implement the application completely.

Do not stop after creating scaffolding.

Do not leave essential behavior as TODOs.

Do not ask for decisions that can reasonably be made from this specification.

Make sensible implementation choices while keeping the product simple.

After implementing:

1. inspect the final repository tree;
2. run the available tests;
3. run linting if configured;
4. verify the static application locally;
5. inspect the network paths for privacy violations;
6. inspect the JEV request shape;
7. verify GitHub Pages paths;
8. verify the deployment workflow;
9. summarize what was implemented;
10. explicitly mention whether current TypeSafe CORS policy allows the GitHub Pages deployment to communicate directly with JEV.

If CORS is the only blocker, leave the application otherwise fully operational and clearly document the exact blocker instead of introducing an unauthorized intermediary.

The end result should be a small, maintainable, visually clear tool that does one job well:

**load context, paste a questionnaire, ask JEV, and make the answers immediately obvious.**

