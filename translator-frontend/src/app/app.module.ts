
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { PdfTranslationComponent } from './components/pdf-translation/pdf-translation.component';
import { PdfViewerComponent } from './components/pdf-viewer/pdf-viewer.component';
import { LanguageSelectorComponent } from './components/language-selector/language-selector.component';
import { FileUploadComponent } from './components/file-upload/file-upload.component';
import { ProgressIndicatorComponent } from './components/progress-indicator/progress-indicator.component';

import { PdfTranslationService } from './services/pdf-translation.service';
import { LanguageService } from './services/language.service';

@NgModule({
  declarations: [
    AppComponent,
    PdfTranslationComponent,
    PdfViewerComponent,
    LanguageSelectorComponent,
    FileUploadComponent,
    ProgressIndicatorComponent
  ], 
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    ReactiveFormsModule,
    FormsModule,
    CommonModule
  ],
  providers: [
    PdfTranslationService,
    LanguageService
  ],
  bootstrap: [AppComponent]
}) 
export class AppModule { }
