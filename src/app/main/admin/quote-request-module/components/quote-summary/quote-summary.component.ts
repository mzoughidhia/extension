import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';

import { QuoteRequest } from '../../models/quote-request.model';
import { VEHICLE_USAGE_LABELS } from '../../models/vehicle.model';
import { FieldKnowledge } from '../../models/field-knowledge.model';
import type { KnowledgeField } from '../../models/field-knowledge.model';
import { StepIndex } from '../../store/quote-request.store';

@Component({
  selector: 'app-quote-summary',
  standalone: true,
  imports: [DecimalPipe, MatButtonModule, MatIconModule, MatDividerModule, MatChipsModule],
  templateUrl: './quote-summary.component.html',
  styleUrl: './quote-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteSummaryComponent {
  readonly quote = input.required<QuoteRequest>();

  readonly editStep = output<StepIndex>();
  readonly prevStep = output<void>();
  readonly submitQuote = output<void>();

  readonly vehicleUsageLabels = VEHICLE_USAGE_LABELS;

  /** Formate un KnowledgeField<number> pour l'affichage. */
  formatKnowledge(field: KnowledgeField<number>, suffix = ''): string {
    switch (field.knowledge) {
      case FieldKnowledge.KNOWN:
        return field.value !== null ? `${field.value}${suffix}` : '—';
      case FieldKnowledge.DECLARED_UNKNOWN:
        return '❓ Déclaré inconnu';
      case FieldKnowledge.NEEDS_CONFIRMATION:
        return '⚠️ À confirmer';
      case FieldKnowledge.UNKNOWN:
      default:
        return '—';
    }
  }

  /** Formate une date ISO pour l'affichage. */
  formatDate(isoDate: string | null): string {
    if (!isoDate) return '—';
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
  }

  onEditStep(step: StepIndex): void {
    this.editStep.emit(step);
  }

  onPrev(): void {
    this.prevStep.emit();
  }

  onSubmit(): void {
    this.submitQuote.emit();
  }
}
