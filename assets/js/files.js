/**
 * Questionator - Document Processing Module
 * Fully client-side extraction for PDF, DOCX, TXT, MD, JSON, CSV files.
 */

import { extractPdfText } from './pdf.js';

const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md', '.markdown', '.json', '.csv'];

/**
 * Checks if a file has a supported extension.
 * @param {File} file
 * @returns {boolean}
 */
export function isSupportedFile(file) {
  if (!file || !file.name) return false;
  const name = file.name.toLowerCase();
  return SUPPORTED_EXTENSIONS.some(ext => name.endsWith(ext));
}

/**
 * Gets a clean readable file type label.
 * @param {string} fileName
 * @returns {string}
 */
export function getFileTypeLabel(fileName) {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  switch (ext) {
    case 'pdf': return 'PDF';
    case 'docx': return 'DOCX';
    case 'md':
    case 'markdown': return 'Markdown';
    case 'json': return 'JSON';
    case 'csv': return 'CSV';
    case 'txt': return 'Text';
    default: return ext.toUpperCase() || 'Unknown';
  }
}

/**
 * Extracts text from a supported file entirely in the browser.
 * @param {File} file
 * @param {function(string): void} [onProgress] - Optional status message callback.
 * @returns {Promise<{ content: string, characters: number, warning?: string }>}
 */
export async function extractFileContent(file, onProgress) {
  const name = file.name.toLowerCase();

  if (name.endsWith('.pdf')) {
    if (onProgress) onProgress('Reading PDF...');
    const result = await extractPdfText(file, ({ current, total }) => {
      if (onProgress) onProgress(`Reading page ${current} of ${total}…`);
    });

    if (result.isScanned) {
      return {
        content: result.text,
        characters: result.characters,
        warning: 'No usable text was found. This PDF may contain scanned pages. OCR is not included in this version.'
      };
    }

    return {
      content: result.text,
      characters: result.characters
    };
  }

  if (name.endsWith('.docx')) {
    if (onProgress) onProgress('Extracting DOCX text...');
    if (!window.mammoth) {
      throw new Error('Mammoth.js library is not available to extract DOCX files.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await window.mammoth.extractRawText({ arrayBuffer });
    const text = (result.value || '').trim();

    return {
      content: text,
      characters: text.length
    };
  }

  // Plain-text formats: .txt, .md, .markdown, .json, .csv
  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.markdown') ||
      name.endsWith('.json') || name.endsWith('.csv')) {
    if (onProgress) onProgress('Reading text file...');
    const text = await file.text();
    const trimmed = text.trim();

    return {
      content: trimmed,
      characters: trimmed.length
    };
  }

  throw new Error(`Unsupported file type: "${file.name}". Supported formats: PDF, DOCX, TXT, MD, JSON, CSV.`);
}

/**
 * Generates a unique document ID.
 * @returns {string}
 */
export function generateDocId() {
  return 'doc_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
}
