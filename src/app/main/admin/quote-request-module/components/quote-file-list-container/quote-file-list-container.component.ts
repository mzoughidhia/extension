import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

import { PageHeaderComponent } from '../../../../../shared/components/page-header/page-header.component';
import { QuoteFileModel } from '../../models/quote-file.model';
import { QuoteFileService } from '../../services/quote-file.service';
import { QuoteRequestStore } from '../../store/quote-request.store';
import { QuoteFileListComponent } from '../quote-file-list/quote-file-list.component';

/**
 * Composant conteneur de la page "Mes devis".
 *
 * Route : /admin/mes-devis
 *
 * Affiche les dossiers du courtier connecté et permet de reprendre un
 * dossier existant exactement là où il a été laissé (aucune re-saisie,
 * aucun rechargement du questionnaire).
 */
@Component({
  selector: 'app-quote-file-list-container',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, PageHeaderComponent, QuoteFileListComponent],
  templateUrl: './quote-file-list-container.component.html',
  styleUrl: './quote-file-list-container.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteFileListContainerComponent {
  private readonly quoteFileService = inject(QuoteFileService);
  private readonly quoteRequestStore = inject(QuoteRequestStore);
  private readonly router = inject(Router);

  readonly files = toSignal(this.quoteFileService.listMine(), { initialValue: [] as QuoteFileModel[] });

  onResume(file: QuoteFileModel): void {
    if (!file.id) return;
    void this.router.navigate(['/admin/quote-request'], { queryParams: { quoteFileId: file.id } });
  }

  onNewQuote(): void {
    this.quoteRequestStore.reset();
    void this.router.navigate(['/admin/quote-request']);
  }
}
