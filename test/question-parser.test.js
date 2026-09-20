import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuestionnaire, validateQuestion, formatQuestionsForJev } from '../assets/js/question-parser.js';

describe('Questionnaire Parser', () => {
  it('parses a single question with A. B. C. D. format', () => {
    const raw = `1. What is the capital of France?
A. Rome
B. Madrid
C. Paris
D. Berlin`;

    const questions = parseQuestionnaire(raw);
    assert.equal(questions.length, 1);
    assert.equal(questions[0].number, 1);
    assert.equal(questions[0].text, 'What is the capital of France?');
    assert.equal(questions[0].options.length, 4);
    assert.equal(questions[0].options[0].id, 'A');
    assert.equal(questions[0].options[0].text, 'Rome');
    assert.equal(questions[0].options[2].id, 'C');
    assert.equal(questions[0].options[2].text, 'Paris');
    assert.equal(questions[0].isValid, true);
  });

  it('parses several questions with A) B) C) format', () => {
    const raw = `1. What is the capital of France?
A) Rome
B) Madrid
C) Paris

2) Which protocol is used for secure web traffic?
A) FTP
B) HTTPS
C) SMTP
D) DNS`;

    const questions = parseQuestionnaire(raw);
    assert.equal(questions.length, 2);
    assert.equal(questions[0].number, 1);
    assert.equal(questions[0].options.length, 3);
    assert.equal(questions[1].number, 2);
    assert.equal(questions[1].text, 'Which protocol is used for secure web traffic?');
    assert.equal(questions[1].options.length, 4);
    assert.equal(questions[1].options[1].id, 'B');
    assert.equal(questions[1].options[1].text, 'HTTPS');
  });

  it('parses lowercase options and maps IDs to uppercase', () => {
    const raw = `Question 1
What is the largest ocean?
a) Atlantic
b) Indian
c) Pacific
d) Arctic`;

    const questions = parseQuestionnaire(raw);
    assert.equal(questions.length, 1);
    assert.equal(questions[0].number, 1);
    assert.equal(questions[0].text, 'What is the largest ocean?');
    assert.equal(questions[0].options.length, 4);
    assert.equal(questions[0].options[0].id, 'A');
    assert.equal(questions[0].options[0].text, 'Atlantic');
    assert.equal(questions[0].options[2].id, 'C');
    assert.equal(questions[0].options[2].text, 'Pacific');
  });

  it('parses option formats with dashes A - option', () => {
    const raw = `1) Question
A - First option
B - Second option
C - Third option`;

    const questions = parseQuestionnaire(raw);
    assert.equal(questions.length, 1);
    assert.equal(questions[0].options.length, 3);
    assert.equal(questions[0].options[0].text, 'First option');
    assert.equal(questions[0].options[1].text, 'Second option');
  });

  it('parses true/false formats', () => {
    const raw1 = `1. The earth is round. (True/False)`;
    const q1 = parseQuestionnaire(raw1);
    assert.equal(q1.length, 1);
    assert.equal(q1[0].options.length, 2);
    assert.equal(q1[0].options[0].id, 'A');
    assert.equal(q1[0].options[0].text, 'True');
    assert.equal(q1[0].options[1].id, 'B');
    assert.equal(q1[0].options[1].text, 'False');

    const raw2 = `2. El cielo es azul.
Verdadero
Falso`;
    const q2 = parseQuestionnaire(raw2);
    assert.equal(q2.length, 1);
    assert.equal(q2[0].options.length, 2);
    assert.equal(q2[0].options[0].text, 'Verdadero');
    assert.equal(q2[0].options[1].text, 'Falso');
  });

  it('handles blank lines gracefully', () => {
    const raw = `

1. What is 2 + 2?

A. 3

B. 4


C. 5

`;
    const questions = parseQuestionnaire(raw);
    assert.equal(questions.length, 1);
    assert.equal(questions[0].options.length, 3);
    assert.equal(questions[0].options[1].text, '4');
  });

  it('handles multiline question text and multiline option text', () => {
    const raw = `1. In a distributed system with multiple nodes,
where network partitions can occur at any time,
which property guarantees that every read receives the most recent write?
A. Availability
B. Consistency: This means that all nodes see the same data
at the same time.
C. Partition tolerance`;

    const questions = parseQuestionnaire(raw);
    assert.equal(questions.length, 1);
    assert.ok(questions[0].text.includes('where network partitions can occur'));
    assert.ok(questions[0].options[1].text.includes('at the same time'));
  });

  it('marks malformed questions and questions missing options as needing review', () => {
    const raw = `1. Question without any options

2. Question with only one option
A. Only this one

3. Complete question
A. First
B. Second`;

    const questions = parseQuestionnaire(raw);
    assert.equal(questions.length, 3);
    assert.equal(questions[0].isValid, false);
    assert.equal(questions[0].validationError, 'This question needs at least two answer options.');

    assert.equal(questions[1].isValid, false);
    assert.equal(questions[1].validationError, 'This question needs at least two answer options.');

    assert.equal(questions[2].isValid, true);
    assert.equal(questions[2].validationError, null);
  });

  it('handles Windows line endings (\\r\\n)', () => {
    const raw = "1. What is Node.js?\r\nA. A runtime\r\nB. A database\r\nC. A framework\r\n";
    const questions = parseQuestionnaire(raw);
    assert.equal(questions.length, 1);
    assert.equal(questions[0].options.length, 3);
    assert.equal(questions[0].options[0].text, 'A runtime');
  });

  it('handles accented and non-English text (Spanish)', () => {
    const raw = `1. ¿Cuál es el protocolo de comunicación estándar en la web?
A. Protocolo de Transferencia de Archivos (FTP)
B. Protocolo Seguro de Transferencia de Hipertexto (HTTPS)
C. Protocolo Simple de Transferencia de Correo (SMTP)`;

    const questions = parseQuestionnaire(raw);
    assert.equal(questions.length, 1);
    assert.equal(questions[0].text, '¿Cuál es el protocolo de comunicación estándar en la web?');
    assert.equal(questions[0].options.length, 3);
    assert.equal(questions[0].options[1].id, 'B');
    assert.ok(questions[0].options[1].text.startsWith('Protocolo Seguro'));
  });

  it('parses inline options in a single line', () => {
    const raw = `What is the capital of Spain? A) Lisbon B) Madrid C) Paris D) Rome`;
    const questions = parseQuestionnaire(raw);
    assert.equal(questions.length, 1);
    assert.equal(questions[0].text, 'What is the capital of Spain?');
    assert.equal(questions[0].options.length, 4);
    assert.equal(questions[0].options[0].id, 'A');
    assert.equal(questions[0].options[0].text, 'Lisbon');
    assert.equal(questions[0].options[1].id, 'B');
    assert.equal(questions[0].options[1].text, 'Madrid');
  });

  it('formats questions correctly for JEV System One API', () => {
    const questions = [
      {
        id: 'q1',
        number: 1,
        text: 'What is the capital of France?',
        options: [
          { id: 'A', text: 'Rome' },
          { id: 'B', text: 'Madrid' },
          { id: 'C', text: 'Paris' }
        ],
        isValid: true
      },
      {
        id: 'q2',
        number: 2,
        text: 'Invalid question without options',
        options: [],
        isValid: false
      }
    ];

    const jevQuestions = formatQuestionsForJev(questions);
    assert.ok(jevQuestions.q1);
    assert.equal(jevQuestions.q2, undefined); // Invalid questions should be skipped
    assert.equal(jevQuestions.q1.type, 'choice');
    assert.equal(jevQuestions.q1.instructions.question, 'What is the capital of France?');
    assert.deepEqual(jevQuestions.q1.criteria, {
      A: 'Rome',
      B: 'Madrid',
      C: 'Paris'
    });
  });
});
