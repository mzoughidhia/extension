import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { QuoteFileModel } from '../../models/quote-file.model';

/**
 * Composant DUMB — liste des dossiers du courtier connecté ("Mes devis").
 *
 * Aucun accès Firestore ici : uniquement de l'affichage et des événements.
 */
@Component({
  selector: 'app-quote-file-list',
  standalone: true,
  imports: [MatButtonModule, MatChipsModule, MatIconModule, RouterLink],
  templateUrl: './quote-file-list.component.html',
  styleUrl: './quote-file-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteFileListComponent {
  readonly files = input.required<QuoteFileModel[]>();
  readonly isLoading = input(false);

  readonly resumeFile = output<QuoteFileModel>();

  clientLabel(file: QuoteFileModel): string {
    const { firstName, lastName } = file.quote.client;
    const name = `${firstName} ${lastName}`.trim();
    return name || 'Client non renseigné';
  }

  vehicleLabel(file: QuoteFileModel): string {
    const { brand, model } = file.quote.vehicle;
    const label = `${brand ?? ''} ${model ?? ''}`.trim();
    return label || 'Véhicule non renseigné';
  }

  lastActivityLabel(file: QuoteFileModel): string {
    const last = file.history[file.history.length - 1];
    if (!last) return '—';
    return `${last.label} — ${this.formatDateTime(last.timestamp)}`;
  }

  statusLabel(file: QuoteFileModel): string {
    return file.status === 'submitted' ? '✓ Dossier prêt' : '● Brouillon';
  }

  formatDateTime(epochMs: number): string {
    return new Date(epochMs).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  onResume(file: QuoteFileModel): void {
    this.resumeFile.emit(file);
  }
}
