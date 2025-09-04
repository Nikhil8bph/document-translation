
import { Component, Input, Output, EventEmitter, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Language } from '../../services/language.service';

@Component({
  selector: 'app-language-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './language-selector.component.html',
  styleUrls: ['./language-selector.component.scss']
})
export class LanguageSelectorComponent implements OnDestroy {
  @Input() label = '';
  @Input() languages: Language[] = [];
  @Input() selectedLanguage = '';
  @Input() showDetectedLanguage: string | null = null;
  @Output() languageSelected = new EventEmitter<string>();

  isDropdownOpen = false;
  searchTerm = '';

  get filteredLanguages(): Language[] {
    if (!this.searchTerm) {
      return this.languages;
    }

    return this.languages.filter(lang => 
      lang.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      lang.code.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  get selectedLanguageObject(): Language | undefined {
    return this.languages.find(lang => lang.code === this.selectedLanguage);
  }

  get displayText(): string {
    const selected = this.selectedLanguageObject;
    if (!selected) return 'Select language...';

    if (selected.code === 'auto' && this.showDetectedLanguage) {
      const detectedLang = this.languages.find(lang => lang.code === this.showDetectedLanguage);
      return `Auto (detected: ${detectedLang?.name || this.showDetectedLanguage})`;
    }

    return `${selected.flag} ${selected.name}`;
  }

  toggleDropdown() {
    this.isDropdownOpen = !this.isDropdownOpen;
    if (typeof document !== 'undefined') {
      if (this.isDropdownOpen) {
        setTimeout(() => {
          document.addEventListener('click', this.onDocumentClick.bind(this));
        }, 0);
      } else {
        document.removeEventListener('click', this.onDocumentClick.bind(this));
      }
    }
  }

  selectLanguage(language: Language) {
    this.languageSelected.emit(language.code);
    this.isDropdownOpen = false;
    this.searchTerm = '';
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', this.onDocumentClick.bind(this));
    }
  }

  onSearchChange(event: any) {
    this.searchTerm = event.target.value;
  }

  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    const dropdown = target.closest('.language-selector');
    if (!dropdown) {
      this.isDropdownOpen = false;
      this.searchTerm = '';
      if (typeof document !== 'undefined') {
        document.removeEventListener('click', this.onDocumentClick.bind(this));
      }
    }
  }

  ngOnDestroy() {
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', this.onDocumentClick.bind(this));
    }
  }
}
