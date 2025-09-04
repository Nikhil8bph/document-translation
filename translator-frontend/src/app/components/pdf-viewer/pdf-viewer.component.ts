
import { Component, Input, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

interface PDFPage {
  page_number: number;
  pdf_url?: string;
  image_data?: string;
}

@Component({
  selector: 'app-pdf-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pdf-viewer.component.html',
  styleUrls: ['./pdf-viewer.component.scss']
})
export class PdfViewerComponent implements OnChanges, AfterViewInit {
  @Input() pages: PDFPage[] = [];
  @Input() currentPage = 1;
  @Input() zoomLevel = 100;
  @Input() viewerType: 'original' | 'translated' = 'original';

  @ViewChild('viewerContainer', { static: false }) viewerContainer!: ElementRef;
 
  constructor(private sanitizer: DomSanitizer) {}

  ngAfterViewInit() {
    this.setupScrollSync();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['currentPage'] || changes['zoomLevel']) {
      this.updateDisplay();
    }
  }

  private setupScrollSync() {
    if (!this.viewerContainer) return;

    const container = this.viewerContainer.nativeElement;

    // Sync scrolling between original and translated viewers
    container.addEventListener('scroll', (event: any) => {
      const otherViewerType = this.viewerType === 'original' ? 'translated' : 'original';
      const otherViewer = document.querySelector(`.${otherViewerType}-viewer .pdf-viewer-container`);

      if (otherViewer && otherViewer !== event.target) {
        otherViewer.scrollTop = event.target.scrollTop;
        otherViewer.scrollLeft = event.target.scrollLeft;
      }
    });
  }

  private updateDisplay() {
    // Update iframe src with new page parameter
    if (this.pages.length > 0) {
      const iframe = this.viewerContainer?.nativeElement.querySelector('iframe');
      if (iframe) {
        const baseUrl = this.pages[0].pdf_url || '';
        const newUrl = `${baseUrl}#page=${this.currentPage}`;
        iframe.src = newUrl;
      }
    }
  }

  getCurrentPageData(): PDFPage | null {
    return this.pages.find(page => page.page_number === this.currentPage) || null;
  }

  getPdfUrl(page: PDFPage): SafeResourceUrl {
    const url = page.pdf_url || '';
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
  
  getPdfJsUrl(page: PDFPage): SafeResourceUrl {
    // Use direct PDF URL with page parameter
    const url = page.pdf_url || '';
    const urlWithPage = `${url}#page=${this.currentPage}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(urlWithPage);
  }

  get containerStyle() {
    return {
      'transform': `scale(${this.zoomLevel / 100})`,
      'transform-origin': 'top left'
    };
  }

  trackByPageNumber(index: number, page: PDFPage): number {
    return page.page_number;
  }
}
