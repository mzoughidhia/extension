import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { PageHeaderComponent } from '../../../../../shared/components/page-header/page-header.component';
import { ExtranetLinkModel } from '../../models/extranet-link.model';
import { ExtranetLinkService } from '../../services/extranet-link.service';
import { ExtranetLinkListComponent } from '../extranet-link-list/extranet-link-list.component';

/**
 * Composant conteneur de la page "Mes extranets".
 *
 * Route : /admin/mes-extranets
 *
 * Registre des extranets du courtier — remplace les compagnies codées en dur
 * dans le workflow de préparation/remplissage.
 */
@Component({
  selector: 'app-extranet-link-list-container',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, RouterLink, PageHeaderComponent, ExtranetLinkListComponent],
  templateUrl: './extranet-link-list-container.component.html',
  styleUrl: './extranet-link-list-container.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExtranetLinkListContainerComponent {
  private readonly extranetLinkService = inject(ExtranetLinkService);

  readonly links = toSignal(this.extranetLinkService.listMine(), { initialValue: [] as ExtranetLinkModel[] });

  onToggleActive(link: ExtranetLinkModel): void {
    if (!link.id) return;
    void this.extranetLinkService.setActive(link.id, !link.active);
  }
}
