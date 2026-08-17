import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { PageHeaderComponent } from '../../../../../shared/components/page-header/page-header.component';
import { ExtranetLinkModel } from '../../models/extranet-link.model';
import { ExtranetLinkInput, ExtranetLinkService } from '../../services/extranet-link.service';
import { ExtranetLinkFormComponent } from '../extranet-link-form/extranet-link-form.component';

/**
 * Composant conteneur du formulaire d'ajout/modification d'un extranet.
 *
 * Routes :
 *  - /admin/mes-extranets/nouveau (création)
 *  - /admin/mes-extranets/:extranetLinkId (modification)
 */
@Component({
  selector: 'app-extranet-link-form-container',
  standalone: true,
  imports: [PageHeaderComponent, ExtranetLinkFormComponent],
  templateUrl: './extranet-link-form-container.component.html',
  styleUrl: './extranet-link-form-container.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExtranetLinkFormContainerComponent {
  private readonly extranetLinkService = inject(ExtranetLinkService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly editingId = this.route.snapshot.paramMap.get('extranetLinkId');

  readonly isEditMode = this.editingId !== null;
  readonly heading = this.isEditMode ? "Modifier l'extranet" : 'Ajouter un extranet';

  readonly existingLink = signal<ExtranetLinkModel | null>(null);
  readonly loading = signal(this.isEditMode);

  constructor() {
    if (this.editingId) {
      void this.extranetLinkService.getById(this.editingId).then((link) => {
        this.existingLink.set(link ?? null);
        this.loading.set(false);
      });
    }
  }

  async onSave(input: ExtranetLinkInput): Promise<void> {
    if (this.editingId) {
      await this.extranetLinkService.update(this.editingId, input);
    } else {
      await this.extranetLinkService.create(input);
    }
    void this.router.navigate(['/admin/mes-extranets']);
  }

  onCancel(): void {
    void this.router.navigate(['/admin/mes-extranets']);
  }
}
