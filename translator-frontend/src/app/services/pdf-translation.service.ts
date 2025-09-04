
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface UploadResponse {
  file_id: string;
  filename: string;
  detected_language: string;
  pages: number;
  message: string;
}

export interface TranslationResponse {
  success: boolean;
  output_filename: string;
  message: string;
}

export interface PreviewResponse {
  success: boolean;
  pages: Array<{
    page_number: number;
    image_data: string;
  }>;
  total_pages: number;
}

export interface TranslationProgress {
  stage: 'upload' | 'select-language' | 'translate' | 'complete';
  progress: number;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class PdfTranslationService {
  private readonly baseUrl = environment.apiUrl;

  private translationProgressSubject = new BehaviorSubject<TranslationProgress>({
    stage: 'upload',
    progress: 0,
    message: 'Ready to start'
  });

  public translationProgress$ = this.translationProgressSubject.asObservable();

  constructor(private http: HttpClient) { }

  uploadPdf(file: File): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    this.updateProgress('upload', 10, 'Uploading file...');

    return this.http.post<UploadResponse>(`${this.baseUrl}/upload`, formData)
      .pipe(
        tap(() => this.updateProgress('select-language', 30, 'Language detected...')),
        catchError(this.handleError)
      );
  }

  translatePdf(fileId: string, sourceLanguage: string, targetLanguage: string): Observable<TranslationResponse> {
    const formData = new FormData();
    formData.append('file_id', fileId);
    formData.append('source_lang', sourceLanguage);
    formData.append('target_lang', targetLanguage);

    this.updateProgress('translate', 50, 'Translating content...');

    return this.http.post<TranslationResponse>(`${this.baseUrl}/translate`, formData)
      .pipe(
        tap(() => this.updateProgress('complete', 80, 'Generating translated PDF...')),
        catchError(this.handleError)
      );
  }

  getPreview(fileId: string, fileType: 'original' | 'translated'): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/preview/${fileId}/${fileType}`, {
      responseType: 'blob'
    }).pipe(
      catchError(this.handleError)
    );
  }

  downloadTranslatedPdf(fileId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/download/${fileId}`, {
      responseType: 'blob'
    }).pipe(
      tap(() => this.updateProgress('complete', 100, 'Translation complete!')),
      catchError(this.handleError)
    );
  }

  checkHealth(): Observable<any> {
    return this.http.get(`${this.baseUrl}/health`)
      .pipe(catchError(this.handleError));
  }

  private updateProgress(stage: TranslationProgress['stage'], progress: number, message: string) {
    this.translationProgressSubject.next({ stage, progress, message });
  }

  private handleError(error: any): Observable<never> {
    console.error('PDF Translation Service Error:', error);
    throw error;
  }
}
