import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

import { PendingConfirmation } from '../../models/pending-confirmation.model';

export interface ConfirmationDecision {
  confirmation: PendingConfirmation;
  decision: 'keepCurrent' | 'useOcr';
}

/**
 * Composant DUMB — informations extraites par OCR qui nécessitent une
 * décision du courtier (conflit avec le dossier, ou valeur peu fiable).
 *
 * Jamais de jargon technique affiché : uniquement les deux valeurs et un choix.
 */
@Component({
  selector: 'app-pending-confirmation-list',
  standalone: true,
  imports: [MatButtonModule],
  templateUrl: './pending-confirmation-list.component.html',
  styleUrl: './pending-confirmation-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PendingConfirmationListComponent {
  readonly confirmations = input.required<PendingConfirmation[]>();

  readonly decide = output<ConfirmationDecision>();

  displayValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    return String(value);
  }

  onKeepCurrent(confirmation: PendingConfirmation): void {
    this.decide.emit({ confirmation, decision: 'keepCurrent' });
  }

  onUseOcr(confirmation: PendingConfirmation): void {
    this.decide.emit({ confirmation, decision: 'useOcr' });
  }
}
