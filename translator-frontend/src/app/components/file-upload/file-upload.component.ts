
import { Component, EventEmitter, Output, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-file-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './file-upload.component.html',
  styleUrls: ['./file-upload.component.scss']
})
export class FileUploadComponent {
  @Output() fileSelected = new EventEmitter<File>();
  @Input() isUploading = false;

  isDragOver = false;
  selectedFileName = '';

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  onFileInputChange(event: any) {
    const file = event.target.files?.[0];
    if (file) {
      this.handleFile(file);
    }
  }

  private handleFile(file: File) {
    if (this.validateFile(file)) {
      this.selectedFileName = file.name;
      this.fileSelected.emit(file);
    }
  }

  private validateFile(file: File): boolean {
    // Check file type
    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file only.');
      return false;
    }

    // Check file size (50MB limit)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('File size must be less than 50MB.');
      return false;
    }

    return true;
  }

  triggerFileInput() {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    fileInput?.click();
  }
}
