import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AdminRouteContainerModel } from '../../../../../core/routing/admin-routes/admin-route-container.model';
import { Credentials } from '../../models/credentials.model';
import { AuthStore } from '../../store/auth.store';
import { SigninComponent } from '../signin/signin.component';

/**
 * Composant SMART.
 *
 * Injecte le store, orchestre, et gère la navigation. La redirection vit ici
 * (et non dans le store) : le store décrit l'état d'authentification, le
 * container décide ce que l'application en fait.
 */
@Component({
  selector: 'app-signin-container',
  standalone: true,
  imports: [SigninComponent],
  templateUrl: './signin-container.component.html',
  styleUrl: './signin-container.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SigninContainerComponent {
  readonly store = inject(AuthStore);
  private readonly router = inject(Router);

  constructor() {
    effect(() => {
      if (this.store.isAuthenticated()) {
        void this.router.navigateByUrl(AdminRouteContainerModel.HOME_ROUTE.fullPath);
      }
    });
  }

  onSignin(credentials: Credentials): void {
    this.store.signIn(credentials);
  }
}
