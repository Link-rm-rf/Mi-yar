/**
 * Manages student's personal vocabulary in browser localStorage (FR-08, NFR-08)
 */
export class VocabularyNotebook {
  constructor(storageKey = 'miyar_vocabulary_v1') {
    this.storageKey = storageKey;
    this.maxBytes = 500 * 1024; // < 500KB target (Section 7)
    this.savedTerms = this.loadFromStorage();
  }

  loadFromStorage() {
    try {
      const raw = window.localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  persistToStorage(list) {
    try {
      const serialized = JSON.stringify(list);
      if (new Blob([serialized]).size > this.maxBytes) {
        return {
          success: false,
          message: 'Unable to save term: Browser local storage is disabled or full.'
        };
      }
      window.localStorage.setItem(this.storageKey, serialized);
      this.savedTerms = list;
      return { success: true };
    } catch {
      return {
        success: false,
        message: 'Unable to save term: Browser local storage is disabled or full.'
      };
    }
  }

  addTerm(termObj) {
    const exists = this.savedTerms.some((item) => item.term === termObj.arabicWord);
    if (exists) {
      return { success: true, duplicate: true };
    }
    const record = {
      term: termObj.arabicWord,
      definition: termObj.contextualMeaning,
      date_added: new Date().toISOString().split('T')[0]
    };
    const updated = [record, ...this.savedTerms];
    return this.persistToStorage(updated);
  }

  removeTerm(termWord) {
    const updated = this.savedTerms.filter((item) => item.term !== termWord);
    return this.persistToStorage(updated);
  }

  viewSavedTerms() {
    this.savedTerms = this.loadFromStorage();
    return this.savedTerms;
  }
}