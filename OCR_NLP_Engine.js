import { Term, Quiz, Question, AnswerOption } from './models.js';

/**
 * Handles image pre-validation, Arabic text extraction, Sharia lexicon detection,
 * contextual explanations, and formative quiz generation (FR-02 to FR-05, FR-07).
 */
export class OCR_NLP_Engine {
  constructor() {
    this.shariaLexicon = [
      {
        termId: 'T-01',
        arabicWord: 'الحدث الأكبر',
        contextualMeaning: 'وصف شرعي يطرأ على البدن كالجنابة والحيض ويمنع من صحة الصلاة والطواف حتى يرتفع بالغسل.'
      },
      {
        termId: 'T-02',
        arabicWord: 'الحدث الأصغر',
        contextualMeaning: 'ما ينقض الوضوء من بول أو غائط أو نوم مستغرق، ويرتفع بالوضوء الشرعي.'
      },
      {
        termId: 'T-03',
        arabicWord: 'التيمم',
        contextualMeaning: 'مسح الوجه واليدين بالتراب الطهور بنية استباحة الصلاة عند فقد الماء أو العجز عن استعماله.'
      },
      {
        termId: 'T-04',
        arabicWord: 'القياس',
        contextualMeaning: 'إلحاق فرعٍ لم يرد فيه نصٌّ بأصلٍ ورد فيه نصٌّ في الحكم الشرعي لاشتراكهما في علّة الحكم.'
      },
      {
        termId: 'T-05',
        arabicWord: 'العلّة',
        contextualMeaning: 'الوصف الظاهر المنضبط الذي شرع الحكم لأجله، وبوجوده في الفرع يتعدى إليه حكم الأصل.'
      },
      {
        termId: 'T-06',
        arabicWord: 'المجتهد',
        contextualMeaning: 'الفقيه الذي يبذل وسعه في استنباط الأحكام الشرعية العملية من أدلتها التفصيلية.'
      }
    ];

    this.samplePassages = {
      fiqh:
        'باب أحكام الطهارة والمياه: يجب على المكلف رفع الحدث الأكبر بالغسل الكامل قبل أداء الصلاة، بينما يرتفع الحدث الأصغر بالوضوء بالماء الطهور. فإذا عدم المسلم الماء أو تضرر باستعماله لمرض، انتقل إلى التيمم بالتراب الطاهر رخصة وتيسيراً من الشريعة.',
      usul:
        'فصل في حجية القياس الشرعي: يُعدّ القياس أحد المصادر التشريعية المعتبرة عند جمهور الأصوليين، ويقوم على أربعة أركان هي الأصل والفرع وحكم الأصل والعلّة الجامعة. ويشترط في المجتهد أن يتحقق من وجود العلّة في الفرع قبل إلحاقه بحكم الأصل.'
    };
  }

  validateImage(qualityPayload) {
    if (qualityPayload.isBlurry || qualityPayload.isDark) {
      return {
        valid: false,
        error:
          'The image is unclear. Please take another picture with better lighting and make sure the Arabic text is visible.'
      };
    }

    const textCandidate = qualityPayload.simulatedText || '';
    const arabicChars = (textCandidate.match(/[\u0600-\u06FF]/g) || []).length;

    if (arabicChars < 20) {
      return {
        valid: false,
        error:
          'No readable Arabic text was detected on this page. Please ensure you upload a page from an Arabic textbook.'
      };
    }

    return { valid: true };
  }

  extractText(qualityPayload) {
    return qualityPayload.simulatedText.trim();
  }

  detectTerms(extractedText) {
    const detected = [];
    for (const entry of this.shariaLexicon) {
      if (extractedText.includes(entry.arabicWord)) {
        detected.push(new Term(entry.termId, entry.arabicWord, entry.contextualMeaning));
      }
    }
    return detected;
  }

  getContextualExplanation(termId, termsList) {
    const found = termsList.find((t) => t.termId === termId);
    if (!found) {
      return 'Explanation temporarily unavailable for this term.';
    }
    return found.showExplanation();
  }

  generateQuestions(extractedText) {
    if (extractedText.includes('القياس')) {
      return new Quiz('QZ-USUL-01', [
        new Question(
          'Q1',
          'على كم ركن يقوم القياس الشرعي كما ورد في النص؟',
          [
            new AnswerOption('أربعة أركان', true),
            new AnswerOption('ركنان فقط', false),
            new AnswerOption('خمسة أركان', false)
          ],
          'ذكر النص صراحة أن القياس يقوم على أربعة أركان: الأصل والفرع وحكم الأصل والعلّة.'
        ),
        new Question(
          'Q2',
          'ما الذي يجب على المجتهد التحقق منه قبل إلحاق الفرع بالأصل؟',
          [
            new AnswerOption('وجود العلّة الجامعة في الفرع', true),
            new AnswerOption('إجماع جميع الفقهاء المعاصرين', false),
            new AnswerOption('تقديم التيمم على الوضوء', false)
          ],
          'يشترط في المجتهد التحقق من وجود العلّة في الفرع قبل تعدية حكم الأصل إليه.'
        )
      ]);
    }

    return new Quiz('QZ-FIQH-01', [
      new Question(
        'Q1',
        'بماذا يرتفع الحدث الأكبر وفقاً للنص المستخرج؟',
        [
          new AnswerOption('بالغسل الكامل', true),
          new AnswerOption('بالوضوء فقط', false),
          new AnswerOption('بمسح الخفين', false)
        ],
        'أوضح النص أن الحدث الأكبر يجب رفعه بالغسل الكامل قبل الصلاة.'
      ),
      new Question(
        'Q2',
        'متى ينتقل المسلم إلى التيمم بالتراب الطاهر؟',
        [
          new AnswerOption('عند عدم الماء أو التضرر باستعماله', true),
          new AnswerOption('في كل صلاة نافلة اختياراً', false),
          new AnswerOption('عند توفر الماء البارد فقط', false)
        ],
        'بيّن النص أن التيمم يُشرع رخصةً عند فقد الماء أو العجز عن استعماله لمرض.'
      )
    ]);
  }
}