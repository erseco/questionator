/**
 * Questionator - PDF Extraction Module
 * Extracts text layers from PDF files locally using PDF.js.
 */

// Initialize worker source if pdfjsLib is available
if (typeof window !== 'undefined' && window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

/**
 * Extracts text from a PDF File or ArrayBuffer.
 * @param {File | ArrayBuffer} source - PDF file or buffer.
 * @param {function({ current: number, total: number }): void} [onProgress] - Optional progress callback.
 * @returns {Promise<{ text: string, characters: number, numPages: number, isScanned: boolean }>}
 */
export async function extractPdfText(source, onProgress) {
  if (!window.pdfjsLib) {
    throw new Error('PDF.js library is not loaded. Cannot extract PDF text.');
  }

  let data;
  if (source instanceof ArrayBuffer) {
    data = source;
  } else if (source instanceof Blob) {
    data = await source.arrayBuffer();
  } else {
    throw new Error('Invalid PDF source. Expected File, Blob, or ArrayBuffer.');
  }

  const loadingTask = window.pdfjsLib.getDocument({ data });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  let fullText = '';
  let totalCharacters = 0;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    if (onProgress && typeof onProgress === 'function') {
      onProgress({ current: pageNum, total: numPages });
    }

    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    let pageText = '';
    let lastY = null;

    for (const item of textContent.items) {
      if (!item.str) continue;

      // Group text with newlines when vertical position changes significantly
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
        pageText += '\n';
      } else if (pageText.length > 0 && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
        pageText += ' ';
      }

      pageText += item.str;
      lastY = item.transform[5];
    }

    const trimmedPage = pageText.trim();
    if (trimmedPage) {
      fullText += `\n--- Page ${pageNum} ---\n` + trimmedPage + '\n';
      totalCharacters += trimmedPage.length;
    }
  }

  fullText = fullText.trim();

  // Detect scanned or image-only PDFs with very little or zero extracted text
  const isScanned = totalCharacters < 20;

  return {
    text: fullText,
    characters: totalCharacters,
    numPages: numPages,
    isScanned: isScanned
  };
}
