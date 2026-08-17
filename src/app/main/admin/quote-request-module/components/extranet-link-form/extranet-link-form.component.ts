import { ChangeDetectionStrategy, Component, OnInit, inject, input, output } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { ExtranetLinkInput } from '../../services/extranet-link.service';

/**
 * Composant DUMB — formulaire d'ajout/modification d'un extranet.
 *
 * N'accepte jamais de mot de passe, cookie, token ou identifiant de
 * connexion : seuls compagnie/produit/nom/URL/description/actif existent
 * dans ce formulaire (conforme à ADR-008).
 */
@Component({
  selector: 'app-extranet-link-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './extranet-link-form.component.html',
  styleUrl: './extranet-link-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExtranetLinkFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  /** Valeur initiale en mode modification ; absent en création. */
  readonly initialValue = input<ExtranetLinkInput | null>(null);

  readonly save = output<ExtranetLinkInput>();
  readonly formCancel = output<void>();

  form!: FormGroup;

  ngOnInit(): void {
    const initial = this.initialValue();
    this.form = this.fb.group({
      company: [initial?.company ?? null, [Validators.required]],
      product: [initial?.product ?? null, [Validators.required]],
      name: [initial?.name ?? null, [Validators.required]],
      url: [initial?.url ?? null, [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
      description: [initial?.description ?? null],
      active: [initial?.active ?? true],
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const input: ExtranetLinkInput = {
      company: raw['company'],
      product: raw['product'],
      name: raw['name'],
      url: raw['url'],
      description: raw['description'] || undefined,
      active: raw['active'],
    };
    this.save.emit(input);
  }

  onCancel(): void {
    this.formCancel.emit();
  }

  getError(field: string, error: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.hasError(error) && ctrl.touched);
  }
}
