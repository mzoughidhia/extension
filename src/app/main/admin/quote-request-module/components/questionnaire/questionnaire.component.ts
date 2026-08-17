import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';

import { QuestionnaireQuestion } from '../../models/questionnaire.model';

/**
 * Composant DUMB — pose UNE question à la fois. Aucun terme technique,
 * jamais le chemin canonique : uniquement le libellé humain fourni par
 * `RequiredField.label`.
 */
@Component({
  selector: 'app-questionnaire',
  standalone: true,
  imports: [FormsModule, MatButtonModule],
  templateUrl: './questionnaire.component.html',
  styleUrl: './questionnaire.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuestionnaireComponent {
  readonly question = input.required<QuestionnaireQuestion>();
  readonly remainingCount = input.required<number>();

  readonly answer = output<unknown>();

  readonly textValue = signal('');

  onChoice(value: string): void {
    this.answer.emit(value);
  }

  onBoolean(value: boolean): void {
    this.answer.emit(value);
  }

  submitTextValue(): void {
    const raw = this.textValue().trim();
    if (!raw) return;

    const value = this.question().type === 'number' ? Number(raw) : raw;
    this.answer.emit(value);
    this.textValue.set('');
  }
}
