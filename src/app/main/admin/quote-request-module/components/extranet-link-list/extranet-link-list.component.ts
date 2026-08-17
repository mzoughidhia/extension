import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { ExtranetLinkModel } from '../../models/extranet-link.model';

/**
 * Composant DUMB — cartes des extranets enregistrés ("Mes extranets").
 *
 * Aucun accès Firestore ici : uniquement de l'affichage et des événements.
 */
@Component({
  selector: 'app-extranet-link-list',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, RouterLink],
  templateUrl: './extranet-link-list.component.html',
  styleUrl: './extranet-link-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExtranetLinkListComponent {
  readonly links = input.required<ExtranetLinkModel[]>();

  readonly toggleActive = output<ExtranetLinkModel>();

  statusLabel(link: ExtranetLinkModel): string {
    return link.active ? '● Actif' : '○ Inactif';
  }

  onToggleActive(link: ExtranetLinkModel): void {
    this.toggleActive.emit(link);
  }
}
