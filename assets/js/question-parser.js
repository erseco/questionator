/**
 * Questionator - Question Parser Module
 * Pure client-side parsing for multiple-choice questionnaires.
 */

/**
 * Parses raw questionnaire text into structured question objects.
 * @param {string} rawText - The unformatted questionnaire text.
 * @returns {Array<object>} Array of parsed question objects.
 */
export function parseQuestionnaire(rawText) {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return [];
  }

  // Normalize line breaks
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  // Pre-process: split into candidate question blocks or parse line by line
  const questions = [];
  let currentQuestion = null;
  let currentOption = null;
  let questionCounter = 0;

  // Regex patterns
  // 1. Explicit question header, e.g.:
  //    "1. What is...", "1) What is...", "Question 1: What is...", "Q1. What is...", "Pregunta 1: ..."
  const questionHeaderRegex = /^\s*(?:(?:Question|Pregunta|Pregunta\s+n[ºo°]|Q)\s*(\d+)[:.]?|(\d+)[\.\)\:\-]\s+|(\d+)\s+)(.*)$/i;

  // 2. Standalone question indicator line, e.g.: "Question 1", "Pregunta 2"
  const standaloneQuestionLabelRegex = /^\s*(?:Question|Pregunta|Pregunta\s+n[ºo°]|Q)\s*(\d+)[:.]?\s*$/i;

  // 3. Option prefix at line start, e.g.:
  //    "A. Rome", "A) Rome", "(A) Rome", "A: Rome", "A - Rome", "a. Rome", "a) Rome"
  const optionPrefixRegex = /^\s*(?:\(?([A-Za-z])\)[\.\:\-]?|([A-Za-z])[\.\:\-]|([A-Za-z])\s*[-–—])\s+(.*)$/;

  // 4. Standalone True/False lines, e.g. "True", "False", "Verdadero", "Falso"
  const trueFalseRegex = /^\s*(True|False|Verdadero|Falso)\b(?:\s*[\:\.\-]\s*(.*))?$/i;

  // 5. Detect if a line has inline options, e.g.:
  //    "What is the capital of France? A) Rome B) Madrid C) Paris D) Berlin"
  const inlineOptionSplitRegex = /(?:^|\s+)(?:\(?([A-Za-z])\)[\.\:\-]?|([A-Za-z])[\.\:\-]|([A-Za-z])\s*[-–—])\s+/g;

  function finalizeOption() {
    if (currentOption && currentQuestion) {
      currentOption.text = currentOption.text.trim();
      currentQuestion.options.push(currentOption);
      currentOption = null;
    }
  }

  function finalizeQuestion() {
    finalizeOption();
    if (currentQuestion) {
      currentQuestion.text = currentQuestion.text.trim();

      // Check if question has inline True/False indicator in text and no options were parsed
      if (currentQuestion.options.length === 0) {
        const tfMatch = currentQuestion.text.match(/\s*[\(\[]\s*(True\s*[\/\\]\s*False|Verdadero\s*[\/\\]\s*Falso|T\s*[\/\\]\s*F|V\s*[\/\\]\s*F)\s*[\)\]]\s*$/i);
        if (tfMatch) {
          const matchedPair = tfMatch[1].toLowerCase();
          const isSpanish = matchedPair.includes('verdadero') || matchedPair.includes('v');
          currentQuestion.text = currentQuestion.text.replace(tfMatch[0], '').trim();
          currentQuestion.options.push({
            id: 'A',
            text: isSpanish ? 'Verdadero' : 'True'
          });
          currentQuestion.options.push({
            id: 'B',
            text: isSpanish ? 'Falso' : 'False'
          });
        }
      }

      // Validate question
      validateQuestion(currentQuestion);
      questions.push(currentQuestion);
      currentQuestion = null;
    }
  }

  function startNewQuestion(number, text) {
    finalizeQuestion();
    questionCounter++;
    currentQuestion = {
      id: `q${questionCounter}`,
      number: number ? parseInt(number, 10) : questionCounter,
      text: text || '',
      options: [],
      isValid: false,
      validationError: null
    };
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      // Blank line: could separate options or questions.
      // If we are currently accumulating an option, a blank line can finalize the option text
      if (currentOption) {
        finalizeOption();
      }
      continue;
    }

    // Check if line is a standalone question label (e.g. "Question 1")
    const standaloneMatch = trimmed.match(standaloneQuestionLabelRegex);
    if (standaloneMatch) {
      startNewQuestion(standaloneMatch[1], '');
      continue;
    }

    // Check if line is a question header (e.g. "1. What is...")
    const qHeaderMatch = trimmed.match(questionHeaderRegex);
    if (qHeaderMatch) {
      const qNum = qHeaderMatch[1] || qHeaderMatch[2] || qHeaderMatch[3];
      const rest = qHeaderMatch[4] || '';

      // Check if this rest contains inline options
      const inlineMatches = parseInlineOptions(rest);
      if (inlineMatches) {
        startNewQuestion(qNum, inlineMatches.questionText);
        for (const opt of inlineMatches.options) {
          currentQuestion.options.push(opt);
        }
        finalizeQuestion();
      } else {
        startNewQuestion(qNum, rest);
      }
      continue;
    }

    // Check if line matches an option prefix (e.g. "A. Rome", "b) Madrid")
    const optionMatch = trimmed.match(optionPrefixRegex);
    if (optionMatch) {
      const letter = (optionMatch[1] || optionMatch[2] || optionMatch[3]).toUpperCase();
      const optionText = optionMatch[4] || '';

      // If we don't have a current question yet, start one implicitly
      if (!currentQuestion) {
        startNewQuestion(null, '');
      }

      finalizeOption();
      currentOption = {
        id: letter,
        text: optionText
      };
      continue;
    }

    // Check for standalone True/False lines (e.g. "True" or "Verdadero")
    const tfMatch = trimmed.match(trueFalseRegex);
    if (tfMatch && currentQuestion) {
      finalizeOption();
      const tfVal = tfMatch[1].trim();
      const extra = tfMatch[2] ? ` - ${tfMatch[2].trim()}` : '';
      const letter = currentQuestion.options.length === 0 ? 'A' : (currentQuestion.options.length === 1 ? 'B' : String.fromCharCode(65 + currentQuestion.options.length));
      currentQuestion.options.push({
        id: letter,
        text: tfVal + extra
      });
      continue;
    }

    // Check if a line without question number has inline options
    const inlineMatches = parseInlineOptions(trimmed);
    if (inlineMatches && inlineMatches.options.length >= 2) {
      startNewQuestion(null, inlineMatches.questionText);
      for (const opt of inlineMatches.options) {
        currentQuestion.options.push(opt);
      }
      finalizeQuestion();
      continue;
    }

    // If we're inside an option, this line might be a continuation of the option text
    if (currentOption) {
      currentOption.text += ' ' + trimmed;
      continue;
    }

    // If we're inside a question but haven't seen any options yet
    if (currentQuestion && currentQuestion.options.length === 0) {
      if (currentQuestion.text) {
        currentQuestion.text += ' ' + trimmed;
      } else {
        currentQuestion.text = trimmed;
      }
      continue;
    }

    // If we reach here and we have a currentQuestion with options already finalized,
    // a non-option line indicates the start of a new question without a formal number!
    // E.g.:
    // What is the capital of Italy?
    // A. Rome
    // B. Milan
    if (currentQuestion && currentQuestion.options.length > 0) {
      startNewQuestion(null, trimmed);
      continue;
    }

    // Fallback: start a new question
    startNewQuestion(null, trimmed);
  }

  // Finalize the last question
  finalizeQuestion();

  return questions;
}

/**
 * Checks if a string contains inline options like:
 * "What is ...? A) Option 1 B) Option 2 C) Option 3"
 * @param {string} text
 * @returns {{ questionText: string, options: Array<{id: string, text: string}> } | null}
 */
function parseInlineOptions(text) {
  if (!text) return null;

  // Search for inline patterns: e.g. A) ... B) ... or A. ... B. ...
  const regex = /(?:^|\s+)(?:\(?([A-Za-z])\)[\.\:\-]?|([A-Za-z])[\.\:\-]|([A-Za-z])\s*[-–—])\s+/g;
  const matches = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    const letter = (match[1] || match[2] || match[3]).toUpperCase();
    matches.push({
      index: match.index,
      matchLength: match[0].length,
      letter: letter
    });
  }

  // Needs at least 2 options in reasonable order (e.g. A, B or sequential letters)
  if (matches.length < 2) {
    return null;
  }

  // Verify that the first option is A (or letters are ascending)
  const firstLetterCode = matches[0].letter.charCodeAt(0);
  const secondLetterCode = matches[1].letter.charCodeAt(0);
  if (secondLetterCode !== firstLetterCode + 1 && matches[0].letter !== 'A') {
    return null;
  }

  const questionText = text.substring(0, matches[0].index).trim();
  const options = [];

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].matchLength;
    const end = (i + 1 < matches.length) ? matches[i + 1].index : text.length;
    const optText = text.substring(start, end).trim();
    options.push({
      id: matches[i].letter,
      text: optText
    });
  }

  return {
    questionText,
    options
  };
}

/**
 * Validates a parsed question object and assigns isValid and validationError.
 * @param {object} question
 */
export function validateQuestion(question) {
  if (!question.text || !question.text.trim()) {
    question.isValid = false;
    question.validationError = 'Question text is empty.';
    return;
  }

  if (!question.options || question.options.length < 2) {
    question.isValid = false;
    question.validationError = 'This question needs at least two answer options.';
    return;
  }

  // Check if any option is empty
  for (const opt of question.options) {
    if (!opt.text || !opt.text.trim()) {
      question.isValid = false;
      question.validationError = `Option ${opt.id} text is empty.`;
      return;
    }
  }

  question.isValid = true;
  question.validationError = null;
}

/**
 * Formats parsed questions into JEV System One format.
 * @param {Array<object>} questions - Valid parsed questions.
 * @param {string} [guidance] - Optional guidance for JEV.
 * @returns {object} JEV questions payload map.
 */
export function formatQuestionsForJev(questions, guidance) {
  const defaultGuidance = 'Choose the option best supported by the reference documents in state. Treat the provided reference documents as the primary source.';
  const formatted = {};

  for (const q of questions) {
    if (!q.isValid) continue;

    const criteria = {};
    for (const opt of q.options) {
      criteria[opt.id] = opt.text;
    }

    formatted[q.id] = {
      type: 'choice',
      instructions: {
        question: q.text,
        guidance: guidance || defaultGuidance
      },
      criteria: criteria
    };
  }

  return formatted;
}
