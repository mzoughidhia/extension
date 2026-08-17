import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { QuoteFileModel } from '../../models/quote-file.model';
import { computeQuoteRequestCompleteness } from '../../models/quote-request-canonical.util';

/**
 * Composant DUMB — en-tête du dossier : titre, progression, informations
 * client déjà connues. Aucun accès Firestore ici.
 */
@Component({
  selector: 'app-quote-file-detail',
  standalone: true,
  imports: [],
  templateUrl: './quote-file-detail.component.html',
  styleUrl: './quote-file-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteFileDetailComponent {
  readonly quoteFile = input.required<QuoteFileModel>();

  clientLabel(): string {
    const { firstName, lastName } = this.quoteFile().quote.client;
    const name = `${firstName} ${lastName}`.trim();
    return name || 'Client non renseigné';
  }

  vehicleLabel(): string {
    const { brand, model } = this.quoteFile().quote.vehicle;
    const label = `${brand ?? ''} ${model ?? ''}`.trim();
    return label || 'Véhicule non renseigné';
  }

  completeness(): number {
    return computeQuoteRequestCompleteness(this.quoteFile().quote);
  }

  knownClientFields(): { label: string; value: string }[] {
    const client = this.quoteFile().quote.client;
    const rows: { label: string; value: string | null }[] = [
      { label: 'Nom', value: client.firstName && client.lastName ? `${client.firstName} ${client.lastName}` : null },
      { label: 'Date de naissance', value: client.birthDate },
      { label: 'Adresse', value: client.address },
    ];
    return rows.filter((row): row is { label: string; value: string } => Boolean(row.value));
  }
}
