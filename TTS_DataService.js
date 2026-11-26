/**
 * Synthesizes Arabic pronunciation via Web Speech API without page reload (FR-06, NFR-05)
 */
export class TTS_DataService {
  synthesizeTTS(arabicWord) {
    try {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        return {
          success: false,
          message: 'Audio playback unavailable. Popover text remains visible.'
        };
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(arabicWord);
      utterance.lang = 'ar-SA';
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);

      return { success: true };
    } catch {
      return {
        success: false,
        message: 'Audio playback unavailable. Popover text remains visible.'
      };
    }
  }
}