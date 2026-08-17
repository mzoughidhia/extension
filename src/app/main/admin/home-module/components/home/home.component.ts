import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

import { SHARED_COMPONENTS } from '../../../../../shared/shared.module';

/**
 * Composant DUMB — page d'accueil de l'espace admin.
 *
 * Sert de route admin de vérification pour la Phase 0 : elle prouve que la
 * chaîne Emulator → AuthStore → adminGuard → route protégée fonctionne.
 * La véritable première page métier (`quote-request`) arrive en Phase 1.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [MatButtonModule, ...SHARED_COMPONENTS],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  readonly email = input<string | null>(null);
  readonly isLoading = input(false);

  readonly signout = output<void>();
}
