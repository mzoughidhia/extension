import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * En-tête de page générique. Aucun métier, aucun store — composant `shared`.
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [],
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  readonly heading = input.required<string>();
  readonly subheading = input<string | null>(null);
}
