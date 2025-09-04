
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-progress-indicator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './progress-indicator.component.html',
  styleUrls: ['./progress-indicator.component.scss']
})
export class ProgressIndicatorComponent {
  @Input() progress = 0;
  @Input() message = '';
  @Input() stage: 'upload' | 'select-language' | 'translate' | 'complete' = 'upload';



  get stageTitle(): string {
    switch (this.stage) {
      case 'upload': return 'Uploading';
      case 'select-language': return 'Select Language';
      case 'translate': return 'Translating';
      case 'complete': return 'Complete';
      default: return 'Processing';
    }
  }

  get progressBarStyle() {
    return {
      'width': `${this.progress}%`
    };
  }
}
