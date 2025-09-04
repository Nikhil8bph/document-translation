
import { Injectable } from '@angular/core';

export interface Language {
  code: string;
  name: string;
  flag: string;
  nativeName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  private languages: Language[] = [
    { code: 'auto', name: 'Auto-detect', flag: '🌐' },
    { code: 'en', name: 'English', flag: '🇺🇸', nativeName: 'English' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸', nativeName: 'Español' },
    { code: 'fr', name: 'French', flag: '🇫🇷', nativeName: 'Français' },
    { code: 'de', name: 'German', flag: '🇩🇪', nativeName: 'Deutsch' },
    { code: 'it', name: 'Italian', flag: '🇮🇹', nativeName: 'Italiano' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹', nativeName: 'Português' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺', nativeName: 'Русский' },
    { code: 'zh', name: 'Chinese', flag: '🇨🇳', nativeName: '中文' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵', nativeName: '日本語' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷', nativeName: '한국어' },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦', nativeName: 'العربية' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳', nativeName: 'हिन्दी' },
    { code: 'nl', name: 'Dutch', flag: '🇳🇱', nativeName: 'Nederlands' },
    { code: 'sv', name: 'Swedish', flag: '🇸🇪', nativeName: 'Svenska' },
    { code: 'pl', name: 'Polish', flag: '🇵🇱', nativeName: 'Polski' },
    { code: 'tr', name: 'Turkish', flag: '🇹🇷', nativeName: 'Türkçe' },
    { code: 'cs', name: 'Czech', flag: '🇨🇿', nativeName: 'Čeština' }
  ];

  constructor() { }

  getAllLanguages(): Language[] {
    return this.languages;
  }

  getSourceLanguages(): Language[] {
    return this.languages;
  }

  getTargetLanguages(): Language[] {
    return this.languages.filter(lang => lang.code !== 'auto');
  }

  getLanguageByCode(code: string): Language | undefined {
    return this.languages.find(lang => lang.code === code);
  }

  getLanguageName(code: string): string {
    const language = this.getLanguageByCode(code);
    return language ? language.name : code;
  }

  getLanguageFlag(code: string): string {
    const language = this.getLanguageByCode(code);
    return language ? language.flag : '🌐';
  }

  getMostCommonLanguages(): Language[] {
    const commonCodes = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja'];
    return this.languages.filter(lang => commonCodes.includes(lang.code));
  }
}
