import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { PageHeaderComponent } from '../../../../../shared/components/page-header/page-header.component';
import { QuoteRequestStepperComponent } from '../quote-request-stepper/quote-request-stepper.component';

/**
 * Composant conteneur de la page "Nouvelle demande d'assurance automobile".
 *
 * Route : /admin/quote-request (et /quote-request, raccourci Phase 1)
 *
 * Responsabilités :
 *   - Afficher l'en-tête de page
 *   - Héberger le stepper
 *   - Transmettre `quoteFileId` (query param `?quoteFileId=...`, lié
 *     automatiquement par `withComponentInputBinding()`) pour la reprise
 *     d'un dossier existant depuis "Mes devis".
 *
 * Aucun store injecté ici — délégué au stepper.
 */
@Component({
  selector: 'app-quote-request-container',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    RouterLink,
    PageHeaderComponent,
    QuoteRequestStepperComponent,
  ],
  templateUrl: './quote-request-container.component.html',
  styleUrl: './quote-request-container.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteRequestContainerComponent {
  /** Id du dossier à reprendre, fourni via le query param `quoteFileId`. */
  readonly quoteFileId = input<string>();
}
