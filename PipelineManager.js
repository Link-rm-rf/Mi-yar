import { TextbookPage } from './models.js';

/**
 * Coordinates file validation, image quality pre-checks, OCR, term detection,
 * quiz generation, and 15-minute temporary file cleanup (FR-01 to FR-07, NFR-06).
 */
export class PipelineManager {
  constructor(ocrNlpEngine) {
    this.ocrNlpEngine = ocrNlpEngine;
    this.allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    this.maxSizeBytes = 10 * 1024 * 1024; // 10.0 MB
    this.cleanupTimerId = null;
  }

  validateFile(file) {
    if (!file) {
      return {
        valid: false,
        error:
          'Invalid file type or size. Please upload a single-page image (JPEG, PNG, WebP) or PDF under 10MB.'
      };
    }

    const isAllowedType = this.allowedTypes.includes(file.type);
    const isAllowedSize = file.size > 0 && file.size <= this.maxSizeBytes;

    if (!isAllowedType || !isAllowedSize) {
      return {
        valid: false,
        error:
          'Invalid file type or size. Please upload a single-page image (JPEG, PNG, WebP) or PDF under 10MB.'
      };
    }

    return { valid: true };
  }

  scheduleTempCleanup(onExpireCallback) {
    if (this.cleanupTimerId) {
      clearTimeout(this.cleanupTimerId);
    }
    // NFR-06: Delete temporary uploaded file after 15 minutes (900,000 ms)
    this.cleanupTimerId = setTimeout(() => {
      if (typeof onExpireCallback === 'function') {
        onExpireCallback();
      }
    }, 15 * 60 * 1000);
  }

  processPage(qualityPayload, onExpireCallback) {
    const imgCheck = this.ocrNlpEngine.validateImage(qualityPayload);
    if (!imgCheck.valid) {
      return { success: false, error: imgCheck.error };
    }

    const extractedText = this.ocrNlpEngine.extractText(qualityPayload);
    const page = new TextbookPage(`PAGE-${Date.now()}`, extractedText);

    const detectedTerms = this.ocrNlpEngine.detectTerms(extractedText);
    page.setDetectedTerms(detectedTerms);

    try {
      const quiz = this.ocrNlpEngine.generateQuestions(extractedText);
      page.setQuiz(quiz);
    } catch {
      // NFR-05: Quiz failure must not break reading experience
      page.setQuiz(null);
    }

    this.scheduleTempCleanup(onExpireCallback);

    return {
      success: true,
      page,
      noTermsNotice:
        detectedTerms.length === 0
          ? 'No specialized Sharia terminology detected on this page. Proceed to quiz generation.'
          : null
    };
  }
}