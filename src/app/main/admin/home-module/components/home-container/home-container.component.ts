import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';

import { CommonRouteContainerModel } from '../../../../../core/routing/common-routes/common-route-container.model';
import { AuthStore } from '../../../../commons/authentication-module/store/auth.store';
import { HomeComponent } from '../home/home.component';

/** Composant SMART — injecte le store, orchestre, gère la navigation. */
@Component({
  selector: 'app-home-container',
  standalone: true,
  imports: [HomeComponent],
  templateUrl: './home-container.component.html',
  styleUrl: './home-container.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeContainerComponent {
  readonly store = inject(AuthStore);
  private readonly router = inject(Router);

  constructor() {
    effect(() => {
      if (this.store.isResolved() && !this.store.isAuthenticated()) {
        void this.router.navigateByUrl(CommonRouteContainerModel.SIGNIN_ROUTE.fullPath);
      }
    });
  }

  onSignout(): void {
    this.store.signOut();
  }
}
