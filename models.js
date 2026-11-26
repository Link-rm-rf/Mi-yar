/**
 * Domain Model Classes derived directly from the UML Class Diagram
 */

export class AnswerOption {
  constructor(optionText, isCorrect) {
    this.optionText = optionText;
    this.isCorrect = Boolean(isCorrect);
  }
}

export class Question {
  constructor(questionId, questionText, answerOptions, explanation) {
    this.questionId = questionId;
    this.questionText = questionText;
    this.answerOptions = answerOptions;
    this.explanation = explanation;
  }

  checkAnswer(selectedIndex) {
    if (selectedIndex < 0 || selectedIndex >= this.answerOptions.length) {
      return false;
    }
    return this.answerOptions[selectedIndex].isCorrect === true;
  }
}

export class Quiz {
  constructor(quizId, questions = []) {
    this.quizId = quizId;
    this.questions = questions;
    this.score = 0;
  }

  calculateScore(userSelections) {
    let correctCount = 0;
    this.questions.forEach((question, index) => {
      const chosenIndex = userSelections[index];
      if (question.checkAnswer(chosenIndex)) {
        correctCount += 1;
      }
    });
    this.score = correctCount;
    return this.score;
  }
}

export class Term {
  constructor(termId, arabicWord, contextualMeaning) {
    this.termId = termId;
    this.arabicWord = arabicWord;
    this.contextualMeaning = contextualMeaning;
  }

  showExplanation() {
    return this.contextualMeaning || 'Explanation temporarily unavailable for this term.';
  }

  playAudio(ttsService) {
    if (!ttsService) {
      return { success: false, message: 'Audio playback unavailable.' };
    }
    return ttsService.synthesizeTTS(this.arabicWord);
  }
}

export class TextbookPage {
  constructor(pageId, extractedText = '') {
    this.pageId = pageId;
    this.extractedText = extractedText;
    this.terms = [];
    this.quiz = null;
  }

  setDetectedTerms(terms) {
    this.terms = terms;
  }

  setQuiz(quiz) {
    this.quiz = quiz;
  }

  displayExtractedText() {
    return this.extractedText;
  }
}