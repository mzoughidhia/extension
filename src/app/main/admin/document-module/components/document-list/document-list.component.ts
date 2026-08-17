import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { DOCUMENT_TYPE_LABELS, DocumentRef } from '../../models/document-ref.model';

/**
 * Composant DUMB — liste des documents d'un dossier avec leur statut OCR.
 * Le détail des champs extraits reste replié par défaut (secondaire).
 */
@Component({
  selector: 'app-document-list',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './document-list.component.html',
  styleUrl: './document-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentListComponent {
  readonly documents = input.required<DocumentRef[]>();

  readonly runOcr = output<DocumentRef>();

  readonly documentTypeLabels = DOCUMENT_TYPE_LABELS;

  private readonly expandedIds = signal<Set<string>>(new Set());

  isExpanded(document: DocumentRef): boolean {
    return this.expandedIds().has(document.id);
  }

  toggleExpanded(document: DocumentRef): void {
    const next = new Set(this.expandedIds());
    if (next.has(document.id)) {
      next.delete(document.id);
    } else {
      next.add(document.id);
    }
    this.expandedIds.set(next);
  }

  statusLabel(document: DocumentRef): string {
    switch (document.ocrStatus) {
      case 'pending':
        return 'En attente de lecture';
      case 'processing':
        return 'Lecture en cours...';
      case 'done':
        return `${document.extractedFieldCount ?? 0} information(s) détectée(s)`;
      case 'error':
        return 'Échec de la lecture';
    }
  }

  onRunOcr(document: DocumentRef): void {
    this.runOcr.emit(document);
  }
}
