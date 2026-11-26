import { OCR_NLP_Engine } from './OCR_NLP_Engine.js';
import { TTS_DataService } from './TTS_DataService.js';
import { VocabularyNotebook } from './VocabularyNotebook.js';
import { PipelineManager } from './PipelineManager.js';

/**
 * Boundary UI Controller handling user interactions, bilingual AR/EN state,
 * term popover, quiz grading, and vocabulary rendering.
 */
export class PresentationUI {
  constructor() {
    this.ocrEngine = new OCR_NLP_Engine();
    this.ttsService = new TTS_DataService();
    this.vocabNotebook = new VocabularyNotebook();
    this.pipelineManager = new PipelineManager(this.ocrEngine);

    this.currentLang = 'ar';
    this.selectedFile = null;
    this.selectedSampleKey = 'fiqh';
    this.currentPage = null;
    this.activeTerm = null;
    this.cameraStream = null;
  }

  init() {
    this.bindNavigation();
    this.bindUploadAndSamples();
    this.bindPopoverAndQuiz();
    this.bindLanguageToggle();
    this.renderVocabularyList();
  }

  showAlert(message, isError = true) {
    const alertEl = document.getElementById('global-alert');
    alertEl.textContent = message;
    alertEl.classList.toggle('error', isError);
    alertEl.classList.remove('hidden');
  }

  clearAlert() {
    const alertEl = document.getElementById('global-alert');
    alertEl.classList.add('hidden');
    alertEl.textContent = '';
  }

  switchView(viewName) {
    document.querySelectorAll('.view-section').forEach((sec) => sec.classList.add('hidden'));
    document.getElementById(`view-${viewName}`).classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });
  }

  bindNavigation() {
    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.clearAlert();
        this.switchView(btn.dataset.view);
      });
    });
  }

  bindUploadAndSamples() {
    const fileInput = document.getElementById('file-input');
    const dropZone = document.getElementById('drop-zone');

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.handleFileSelected(e.target.files[0]);
      }
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        this.handleFileSelected(e.dataTransfer.files[0]);
      }
    });

    document.getElementById('btn-open-camera').addEventListener('click', () => this.openCamera());
    document.getElementById('btn-close-camera').addEventListener('click', () => this.closeCamera());
    document.getElementById('btn-capture').addEventListener('click', () => this.capturePhoto());

    document.getElementById('btn-analyze').addEventListener('click', () => {
      this.runAnalysis({
        isBlurry: false,
        isDark: false,
        simulatedText: this.ocrEngine.samplePassages[this.selectedSampleKey]
      });
    });

    document.querySelectorAll('.sample-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.sample;
        if (key === 'blurry') {
          this.runAnalysis({ isBlurry: true, isDark: true, simulatedText: '' });
        } else if (key === 'non_arabic') {
          this.runAnalysis({
            isBlurry: false,
            isDark: false,
            simulatedText: 'Chapter 1: Introduction to Comparative Jurisprudence in English.'
          });
        } else {
          this.selectedSampleKey = key;
          this.runAnalysis({
            isBlurry: false,
            isDark: false,
            simulatedText: this.ocrEngine.samplePassages[key]
          });
        }
      });
    });
  }

  handleFileSelected(file) {
    this.clearAlert();
    const validation = this.pipelineManager.validateFile(file);
    if (!validation.valid) {
      this.showAlert(validation.error, true);
      return;
    }

    this.selectedFile = file;
    const previewBox = document.getElementById('preview-box');
    const previewImg = document.getElementById('preview-image');
    const previewMeta = document.getElementById('preview-meta');

    previewMeta.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
    if (file.type.startsWith('image/')) {
      previewImg.src = URL.createObjectURL(file);
      previewImg.classList.remove('hidden');
    } else {
      previewImg.classList.add('hidden');
    }
    previewBox.classList.remove('hidden');
  }

  async openCamera() {
    this.clearAlert();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.showAlert('Camera API is not supported in this browser.', true);
      return;
    }
    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoEl = document.getElementById('camera-video');
      videoEl.srcObject = this.cameraStream;
      document.getElementById('camera-box').classList.remove('hidden');
    } catch {
      this.showAlert('Unable to access device camera.', true);
    }
  }

  closeCamera() {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((track) => track.stop());
      this.cameraStream = null;
    }
    document.getElementById('camera-box').classList.add('hidden');
  }

  capturePhoto() {
    const videoEl = document.getElementById('camera-video');
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth || 640;
    canvas.height = videoEl.videoHeight || 480;
    canvas.getContext('2d').drawImage(videoEl, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        const capturedFile = new File([blob], 'captured-page.jpg', { type: 'image/jpeg' });
        this.handleFileSelected(capturedFile);
      }
      this.closeCamera();
    }, 'image/jpeg');
  }

  runAnalysis(qualityPayload) {
    this.clearAlert();
    const result = this.pipelineManager.processPage(qualityPayload, () => {
      this.selectedFile = null;
      document.getElementById('preview-box').classList.add('hidden');
    });

    if (!result.success) {
      this.showAlert(result.error, true);
      return;
    }

    this.currentPage = result.page;
    if (result.noTermsNotice) {
      this.showAlert(result.noTermsNotice, false);
    }

    this.renderPageWithTerms(this.currentPage);
    this.renderQuiz(this.currentPage.quiz);
    this.switchView('reading');
  }

  renderPageWithTerms(page) {
    document.getElementById('reading-empty').classList.add('hidden');
    document.getElementById('reading-workspace').classList.remove('hidden');

    const container = document.getElementById('extracted-text-container');
    let htmlText = page.displayExtractedText();

    page.terms.forEach((termObj) => {
      const badge = `<button type="button" class="term-highlight" data-term-id="${termObj.termId}">${termObj.arabicWord}</button>`;
      htmlText = htmlText.replace(termObj.arabicWord, badge);
    });

    container.innerHTML = `<p>${htmlText}</p>`;

    container.querySelectorAll('.term-highlight').forEach((btn) => {
      btn.addEventListener('click', () => {
        const termId = btn.dataset.termId;
        this.openTermPopover(termId);
      });
    });
  }

  openTermPopover(termId) {
    const termObj = this.currentPage.terms.find((t) => t.termId === termId);
    if (!termObj) return;

    this.activeTerm = termObj;
    document.getElementById('popover-term').textContent = termObj.arabicWord;
    document.getElementById('popover-definition').textContent =
      this.ocrEngine.getContextualExplanation(termId, this.currentPage.terms);

    const statusEl = document.getElementById('popover-status');
    statusEl.classList.add('hidden');
    statusEl.textContent = '';

    document.getElementById('term-popover').classList.remove('hidden');
  }

  bindPopoverAndQuiz() {
    document.getElementById('popover-close').addEventListener('click', () => {
      document.getElementById('term-popover').classList.add('hidden');
    });

    document.getElementById('btn-play-audio').addEventListener('click', () => {
      if (!this.activeTerm) return;
      const res = this.activeTerm.playAudio(this.ttsService);
      const statusEl = document.getElementById('popover-status');
      statusEl.textContent = res.success
        ? this.currentLang === 'ar'
          ? 'جارٍ تشغيل النطق...'
          : 'Playing pronunciation...'
        : res.message;
      statusEl.classList.remove('hidden');
    });

    document.getElementById('btn-save-term').addEventListener('click', () => {
      if (!this.activeTerm) return;
      const res = this.vocabNotebook.addTerm(this.activeTerm);
      const statusEl = document.getElementById('popover-status');
      if (!res.success) {
        statusEl.textContent = res.message;
      } else {
        statusEl.textContent =
          this.currentLang === 'ar' ? 'تم حفظ المصطلح في دفترك.' : 'Term saved to notebook.';
        this.renderVocabularyList();
      }
      statusEl.classList.remove('hidden');
    });

    document.getElementById('quiz-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.gradeQuiz();
    });
  }

  renderQuiz(quiz) {
    const quizSection = document.getElementById('quiz-section');
    const container = document.getElementById('quiz-questions-container');
    const scoreEl = document.getElementById('quiz-score');

    scoreEl.classList.add('hidden');
    container.innerHTML = '';

    if (!quiz || !quiz.questions.length) {
      quizSection.classList.add('hidden');
      this.showAlert('Comprehension questions could not be generated for this page. Text reading remains unaffected.', false);
      return;
    }

    quiz.questions.forEach((q, qIdx) => {
      const block = document.createElement('div');
      block.className = 'question-block';
      block.dataset.qIndex = qIdx;

      const optionsHtml = q.answerOptions
        .map(
          (opt, oIdx) => `
          <label class="option-label" data-q="${qIdx}" data-o="${oIdx}">
            <input type="radio" name="q_${qIdx}" value="${oIdx}" />
            <span>${opt.optionText}</span>
          </label>`
        )
        .join('');

      block.innerHTML = `
        <p><strong>${qIdx + 1}. ${q.questionText}</strong></p>
        ${optionsHtml}
        <p class="question-explanation hidden" id="exp_${qIdx}">${q.explanation}</p>
      `;
      container.appendChild(block);
    });

    quizSection.classList.remove('hidden');
  }

  gradeQuiz() {
    if (!this.currentPage || !this.currentPage.quiz) return;
    const quiz = this.currentPage.quiz;
    const selections = [];

    for (let i = 0; i < quiz.questions.length; i += 1) {
      const checked = document.querySelector(`input[name="q_${i}"]:checked`);
      if (!checked) {
        this.showAlert(
          this.currentLang === 'ar'
            ? 'يرجى الإجابة على جميع الأسئلة قبل التحقق.'
            : 'Please answer all questions before checking.',
          true
        );
        return;
      }
      selections.push(Number(checked.value));
    }

    this.clearAlert();
    const score = quiz.calculateScore(selections);

    quiz.questions.forEach((q, qIdx) => {
      const chosen = selections[qIdx];
      q.answerOptions.forEach((opt, oIdx) => {
        const label = document.querySelector(`.option-label[data-q="${qIdx}"][data-o="${oIdx}"]`);
        label.classList.remove('correct', 'wrong');
        if (opt.isCorrect) {
          label.classList.add('correct');
        } else if (oIdx === chosen) {
          label.classList.add('wrong');
        }
      });
      document.getElementById(`exp_${qIdx}`).classList.remove('hidden');
    });

    const scoreEl = document.getElementById('quiz-score');
    scoreEl.textContent =
      this.currentLang === 'ar'
        ? `النتيجة: ${score} من ${quiz.questions.length}`
        : `Score: ${score} / ${quiz.questions.length}`;
    scoreEl.classList.remove('hidden');
  }

  renderVocabularyList() {
    const terms = this.vocabNotebook.viewSavedTerms();
    const listEl = document.getElementById('vocab-list');
    const emptyEl = document.getElementById('vocab-empty');
    const badgeEl = document.getElementById('vocab-badge');

    badgeEl.textContent = String(terms.length);
    listEl.innerHTML = '';

    if (terms.length === 0) {
      emptyEl.classList.remove('hidden');
      return;
    }

    emptyEl.classList.add('hidden');
    terms.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'vocab-item';
      li.innerHTML = `
        <div>
          <strong>${item.term}</strong>
          <p>${item.definition}</p>
          <small class="muted-text">${item.date_added}</small>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" data-remove="${item.term}">
          ${this.currentLang === 'ar' ? 'حذف' : 'Remove'}
        </button>
      `;
      li.querySelector('button').addEventListener('click', () => {
        this.vocabNotebook.removeTerm(item.term);
        this.renderVocabularyList();
      });
      listEl.appendChild(li);
    });
  }

  bindLanguageToggle() {
    document.getElementById('lang-toggle').addEventListener('click', () => {
      this.currentLang = this.currentLang === 'ar' ? 'en' : 'ar';
      const isAr = this.currentLang === 'ar';

      document.documentElement.lang = this.currentLang;
      document.documentElement.dir = isAr ? 'rtl' : 'ltr';

      document.getElementById('lang-toggle').textContent = isAr ? 'English' : 'العربية';
      document.getElementById('nav-home').textContent = isAr ? 'الرئيسية / الرفع' : 'Home / Upload';
      document.getElementById('nav-reading').textContent = isAr ? 'صفحة القراءة' : 'Reading Page';
      document.getElementById('upload-heading').textContent = isAr
        ? 'رفع أو تصوير صفحة من الكتاب الدراسي'
        : 'Upload or Capture a Textbook Page';
      document.getElementById('btn-analyze').textContent = isAr ? 'تحليل الصفحة الآن' : 'Analyze Page';
      document.getElementById('quiz-heading').textContent = isAr
        ? 'اختبار الفهم السريع'
        : 'Comprehension Quiz';
      document.getElementById('btn-check-answers').textContent = isAr
        ? 'التحقق من الإجابات'
        : 'Check Answers';
      document.getElementById('vocab-heading').textContent = isAr
        ? 'دفتر المفردات الشخصي'
        : 'Personal Vocabulary Notebook';

      this.renderVocabularyList();
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new PresentationUI();
  app.init();
});