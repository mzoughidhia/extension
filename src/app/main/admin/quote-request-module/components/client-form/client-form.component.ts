import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  output,
  inject,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';

import { Client } from '../../models/client.model';

/** Regex permissif pour le téléphone international. */
const PHONE_REGEX = /^[+]?[\d\s\-().]{6,20}$/;

/**
 * Composant DUMB — formulaire de saisie du client.
 *
 * Émet `formSubmit` avec les données validées.
 * Ne connaît pas le store — c'est le container qui orchestre.
 */
@Component({
  selector: 'app-client-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
  ],
  templateUrl: './client-form.component.html',
  styleUrl: './client-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly formSubmit = output<Client>();

  form!: FormGroup;

  ngOnInit(): void {
    this.form = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      nationalId: [null],
      birthDate: [null],
      phone: [null, [Validators.pattern(PHONE_REGEX)]],
      email: [null, [Validators.email]],
      address: [null],
      postalCode: [null],
      city: [null],
      country: [null],
    });
  }

  /** Pré-remplit le formulaire avec les données existantes du brouillon. */
  patchValue(client: Client): void {
    this.form.patchValue({
      ...client,
      birthDate: client.birthDate ? new Date(client.birthDate) : null,
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const client: Client = {
      firstName: raw['firstName'] ?? '',
      lastName: raw['lastName'] ?? '',
      nationalId: raw['nationalId'] ?? null,
      birthDate: raw['birthDate']
        ? (raw['birthDate'] as Date).toISOString().split('T')[0]
        : null,
      phone: raw['phone'] ?? null,
      email: raw['email'] ?? null,
      address: raw['address'] ?? null,
      postalCode: raw['postalCode'] ?? null,
      city: raw['city'] ?? null,
      country: raw['country'] ?? null,
    };
    this.formSubmit.emit(client);
  }

  getError(field: string, error: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.hasError(error) && ctrl.touched);
  }
}
