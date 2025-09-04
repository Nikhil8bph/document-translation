import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PdfTranslationComponent } from './components/pdf-translation/pdf-translation.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, PdfTranslationComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'translator-frontend';
}
