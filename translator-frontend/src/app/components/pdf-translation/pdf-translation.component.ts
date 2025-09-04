
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { PdfTranslationService, TranslationProgress } from '../../services/pdf-translation.service';
import { LanguageService, Language } from '../../services/language.service';
import { PdfViewerComponent } from '../pdf-viewer/pdf-viewer.component';
import { FileUploadComponent } from '../file-upload/file-upload.component';
import { LanguageSelectorComponent } from '../language-selector/language-selector.component';
import { ProgressIndicatorComponent } from '../progress-indicator/progress-indicator.component';

@Component({
  selector: 'app-pdf-translation',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PdfViewerComponent, FileUploadComponent, LanguageSelectorComponent, ProgressIndicatorComponent],
  templateUrl: './pdf-translation.component.html',
  styleUrls: ['./pdf-translation.component.scss']
})
export class PdfTranslationComponent implements OnInit, OnDestroy {
  translationForm: FormGroup;
  languages: Language[] = [];
  targetLanguages: Language[] = [];

  currentFile: File | null = null;
  fileId: string | null = null;
  detectedLanguage: string | null = null;
  isUploading = false;
  isTranslating = false;
  translationProgress: TranslationProgress | null = null;

  originalPreviewPages: any[] = [];
  translatedPreviewPages: any[] = [];
  currentPage = 1;
  totalPages = 1;
  zoomLevel = 100;

  isMobileView = false;
  currentMobileView: 'original' | 'translated' = 'original';
  showSuccessMessage = false;
  showDemoMessage = false;
  hasStartedTranslation = false;
  showBackendWarning = false;
  savedFileId: string | null = null;

  private subscriptions: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private pdfTranslationService: PdfTranslationService,
    private languageService: LanguageService
  ) {
    this.translationForm = this.fb.group({
      sourceLanguage: ['auto', Validators.required],
      targetLanguage: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.languages = this.languageService.getSourceLanguages();
    this.targetLanguages = this.languageService.getTargetLanguages();
    this.checkMobileView();
    this.setupProgressTracking();
    
    // Show demo message initially
    this.showDemoMessage = true;
    
    // Check backend health
    this.checkBackendHealth();

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.checkMobileView.bind(this));
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.checkMobileView.bind(this));
    }
  }

  private setupProgressTracking() {
    const progressSub = this.pdfTranslationService.translationProgress$
      .subscribe(progress => {
        this.translationProgress = progress;
      });
    this.subscriptions.push(progressSub);
  }

  private checkMobileView() {
    if (typeof window !== 'undefined') {
      this.isMobileView = window.innerWidth <= 768;
    }
  }

  onFileSelected(file: File) {
    this.currentFile = file;
    this.showDemoMessage = false;
    this.uploadFile();
  }

  private uploadFile() {
    if (!this.currentFile) return;

    this.isUploading = true;

    const uploadSub = this.pdfTranslationService.uploadPdf(this.currentFile)
      .subscribe({
        next: (response) => {
          this.fileId = response.file_id;
          this.savedFileId = response.file_id; // Save for session
          this.detectedLanguage = response.detected_language;
          this.totalPages = response.pages;

          // Set detected language in form
          this.translationForm.patchValue({
            sourceLanguage: response.detected_language
          });

          // Load original preview
          this.loadOriginalPreview();
          this.isUploading = false;
        },
        error: (error) => {
          console.error('Upload failed:', error);
          this.isUploading = false;
        }
      });

    this.subscriptions.push(uploadSub);
  }

  private loadOriginalPreview() {
    if (!this.fileId) return;

    const previewSub = this.pdfTranslationService.getPreview(this.fileId, 'original')
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          this.originalPreviewPages = [{ page_number: 1, pdf_url: url }];
        },
        error: (error) => {
          console.error('Failed to load preview:', error);
        }
      });

    this.subscriptions.push(previewSub);
  }

  onTranslate() {
    if (!this.fileId || !this.translationForm.valid) return;

    this.hasStartedTranslation = true;
    this.isTranslating = true;
    const { sourceLanguage, targetLanguage } = this.translationForm.value;

    const translateSub = this.pdfTranslationService.translatePdf(
      this.fileId,
      sourceLanguage,
      targetLanguage
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.loadTranslatedPreview();
        }
        this.isTranslating = false;
      },
      error: (error) => {
        console.error('Translation failed:', error);
        this.isTranslating = false;
      }
    });

    this.subscriptions.push(translateSub);
  }
  
  private simulateTranslation() {
    // Simulate translation progress
    this.translationProgress = { progress: 0, message: 'Detecting language...', stage: 'select-language' };
    
    setTimeout(() => {
      this.translationProgress = { progress: 25, message: 'Analyzing content...', stage: 'translate' };
    }, 500);
    
    setTimeout(() => {
      this.translationProgress = { progress: 50, message: 'Translating text...', stage: 'translate' };
    }, 1000);
    
    setTimeout(() => {
      this.translationProgress = { progress: 75, message: 'Generating PDF...', stage: 'translate' };
    }, 1500);
    
    setTimeout(() => {
      this.translationProgress = { progress: 100, message: 'Translation complete!', stage: 'complete' };
      this.isTranslating = false;
      this.loadDemoTranslatedContent();
    }, 2000);
  }

  private loadTranslatedPreview() {
    if (!this.fileId) return;

    const previewSub = this.pdfTranslationService.getPreview(this.fileId, 'translated')
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          this.translatedPreviewPages = [{ page_number: 1, pdf_url: url }];
          this.showSuccessMessage = true;
          setTimeout(() => {
            this.showSuccessMessage = false;
          }, 5000);
        },
        error: (error) => {
          console.error('Failed to load translated preview:', error);
        }
      });

    this.subscriptions.push(previewSub);
  }

  onDownload() {
    if (!this.fileId) return;

    const downloadSub = this.pdfTranslationService.downloadTranslatedPdf(this.fileId)
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `translated_${this.currentFile?.name || 'document'}.pdf`;
          link.click();
          window.URL.revokeObjectURL(url);
        },
        error: (error) => {
          console.error('Download failed:', error);
        }
      });

    this.subscriptions.push(downloadSub);
  }

  onPageChange(page: number) {
    this.currentPage = Math.max(1, Math.min(page, this.totalPages));
  }

  onZoomChange(zoom: number) {
    this.zoomLevel = Math.max(50, Math.min(zoom, 200));
  }

  switchMobileView(view: 'original' | 'translated') {
    this.currentMobileView = view;
  }

  getLanguageName(code: string): string {
    return this.languageService.getLanguageName(code);
  }

  getLanguageFlag(code: string): string {
    return this.languageService.getLanguageFlag(code);
  }

  get canTranslate(): boolean {
    return !!(this.fileId && this.translationForm.valid && !this.isTranslating);
  }

  get hasTranslatedContent(): boolean {
    return this.translatedPreviewPages.length > 0;
  }

  get progressPercentage(): number {
    return this.translationProgress?.progress || 0;
  }

  get progressMessage(): string {
    return this.translationProgress?.message || '';
  }

  get progressStage(): 'upload' | 'select-language' | 'translate' | 'complete' {
    return this.translationProgress?.stage || 'upload';
  }
  
  private loadDemoContent() {
    // Simulate demo PDF pages for demonstration
    const svgContent = `<svg width="400" height="600" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white"/>
      <text x="50" y="50" font-family="Arial" font-size="24" font-weight="bold">Sample Document</text>
      <text x="50" y="100" font-family="Arial" font-size="16">This is a sample PDF document that demonstrates the translation capabilities</text>
      <text x="50" y="120" font-family="Arial" font-size="16">of our system. The document contains various types of content including</text>
      <text x="50" y="140" font-family="Arial" font-size="16">headers, paragraphs, and formatted text that will be preserved during the</text>
      <text x="50" y="160" font-family="Arial" font-size="16">translation process.</text>
      <text x="50" y="200" font-family="Arial" font-size="20" font-weight="bold">Features</text>
      <text x="70" y="230" font-family="Arial" font-size="14">• Automatic language detection using Granite AI</text>
      <text x="70" y="250" font-family="Arial" font-size="14">• Advanced OCR for images and charts</text>
      <text x="70" y="270" font-family="Arial" font-size="14">• Maintains original formatting and layout</text>
      <text x="70" y="290" font-family="Arial" font-size="14">• Supports multiple languages</text>
      <text x="50" y="330" font-family="Arial" font-size="20" font-weight="bold">Technology Stack</text>
      <text x="50" y="360" font-family="Arial" font-size="14">Our system leverages cutting-edge AI models including Granite 3.3-2b for text</text>
      <text x="50" y="380" font-family="Arial" font-size="14">translation and Granite 3.2-vision for processing images and visual elements</text>
      <text x="50" y="400" font-family="Arial" font-size="14">within documents.</text>
      <rect x="50" y="430" width="300" height="80" fill="#8B4513" rx="5"/>
      <text x="60" y="450" font-family="Arial" font-size="14" font-weight="bold" fill="white">[Chart: Translation Accuracy by Language]</text>
      <text x="60" y="470" font-family="Arial" font-size="12" fill="white">English to Spanish: 98%</text>
      <text x="60" y="485" font-family="Arial" font-size="12" fill="white">English to French: 97%</text>
      <text x="60" y="500" font-family="Arial" font-size="12" fill="white">English to German: 96%</text>
    </svg>`;
    
    this.originalPreviewPages = [
      {
        page_number: 1,
        image_data: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgContent)
      }
    ];
    
    this.totalPages = 1;
    this.fileId = 'demo-file-id';
    this.detectedLanguage = 'en';
    this.translationForm.patchValue({
      sourceLanguage: 'en',
      targetLanguage: 'es'
    });
  }
  
  private loadDemoTranslatedContent() {
    // Simulate translated content
    const translatedSvgContent = `<svg width="400" height="600" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white"/>
      <text x="50" y="50" font-family="Arial" font-size="24" font-weight="bold">Documento de Muestra</text>
      <text x="50" y="100" font-family="Arial" font-size="16">Este es un documento PDF de muestra que demuestra las capacidades de</text>
      <text x="50" y="120" font-family="Arial" font-size="16">traduccion de nuestro sistema. El documento contiene varios tipos de</text>
      <text x="50" y="140" font-family="Arial" font-size="16">contenido, incluidos encabezados, parrafos y texto formateado que se</text>
      <text x="50" y="160" font-family="Arial" font-size="16">conservara durante el proceso de traduccion.</text>
      <text x="50" y="200" font-family="Arial" font-size="20" font-weight="bold">Caracteristicas</text>
      <text x="70" y="230" font-family="Arial" font-size="14">• Deteccion automatica de idioma usando Granite AI</text>
      <text x="70" y="250" font-family="Arial" font-size="14">• OCR avanzado para imagenes y graficos</text>
      <text x="70" y="270" font-family="Arial" font-size="14">• Mantiene el formato y diseno original</text>
      <text x="70" y="290" font-family="Arial" font-size="14">• Soporta multiples idiomas</text>
      <text x="50" y="330" font-family="Arial" font-size="20" font-weight="bold">Pila Tecnologica</text>
      <text x="50" y="360" font-family="Arial" font-size="14">Nuestro sistema aprovecha modelos de IA de vanguardia, incluyendo Granite</text>
      <text x="50" y="380" font-family="Arial" font-size="14">3.3-2b para traduccion de texto y Granite 3.2-vision para procesar imagenes y</text>
      <text x="50" y="400" font-family="Arial" font-size="14">elementos visuales dentro de los documentos.</text>
      <rect x="50" y="430" width="300" height="80" fill="#8B4513" rx="5"/>
      <text x="60" y="450" font-family="Arial" font-size="14" font-weight="bold" fill="white">[Grafico: Precision de Traduccion por Idioma]</text>
      <text x="60" y="470" font-family="Arial" font-size="12" fill="white">Ingles a Espanol: 98%</text>
      <text x="60" y="485" font-family="Arial" font-size="12" fill="white">Ingles a Frances: 97%</text>
      <text x="60" y="500" font-family="Arial" font-size="12" fill="white">Ingles a Aleman: 96%</text>
    </svg>`;
    
    this.translatedPreviewPages = [
      {
        page_number: 1,
        image_data: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(translatedSvgContent)
      }
    ];
    
    this.showSuccessMessage = true;
    setTimeout(() => {
      this.showSuccessMessage = false;
    }, 5000);
  }
  
  private checkBackendHealth() {
    const healthSub = this.pdfTranslationService.checkHealth()
      .subscribe({
        next: (response) => {
          console.log('Backend is healthy:', response);
        },
        error: (error) => {
          console.warn('Backend not available:', error);
          this.showBackendWarning = true;
        }
      });
    
    this.subscriptions.push(healthSub);
  }
  
  dismissBackendWarning() {
    this.showBackendWarning = false;
  }
  
  startNew() {
    this.fileId = null;
    this.savedFileId = null;
    this.currentFile = null;
    this.detectedLanguage = null;
    this.hasStartedTranslation = false;
    this.isTranslating = false;
    this.originalPreviewPages = [];
    this.translatedPreviewPages = [];
    this.showSuccessMessage = false;
    this.translationForm.reset({
      sourceLanguage: 'auto',
      targetLanguage: ''
    });
  }
}
