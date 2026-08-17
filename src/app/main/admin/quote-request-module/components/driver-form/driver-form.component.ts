import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  OnChanges,
  SimpleChanges,
  input,
  output,
  inject,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';

import { Client } from '../../models/client.model';
import { Driver } from '../../models/driver.model';

@Component({
  selector: 'app-driver-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatDividerModule,
  ],
  templateUrl: './driver-form.component.html',
  styleUrl: './driver-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriverFormComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);

  /** Données du client — utilisées pour la recopie automatique. */
  readonly client = input.required<Client>();

  readonly formSubmit = output<Driver>();
  readonly prevStep = output<void>();

  form!: FormGroup;

  ngOnInit(): void {
    this.form = this.fb.group({
      sameAsClient: [false],
      firstName: [null],
      lastName: [null],
      birthDate: [null],
      licenseDate: [null],
      profession: [null],
      phone: [null],
      isPrimaryDriver: [true],
    });

    // Quand "sameAsClient" change, recopier ou effacer les champs communs.
    this.form.get('sameAsClient')?.valueChanges.subscribe((same: boolean) => {
      if (same) {
        this.copyFromClient();
      } else {
        this.clearClientFields();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['client'] && this.form?.get('sameAsClient')?.value === true) {
      this.copyFromClient();
    }
  }

  patchValue(driver: Driver): void {
    this.form.patchValue({
      ...driver,
      birthDate: driver.birthDate ? new Date(driver.birthDate) : null,
      licenseDate: driver.licenseDate ? new Date(driver.licenseDate) : null,
    });
  }

  private copyFromClient(): void {
    const c = this.client();
    this.form.patchValue({
      firstName: c.firstName,
      lastName: c.lastName,
      birthDate: c.birthDate ? new Date(c.birthDate) : null,
      phone: c.phone,
    });
  }

  private clearClientFields(): void {
    this.form.patchValue({
      firstName: null,
      lastName: null,
      birthDate: null,
      phone: null,
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const driver: Driver = {
      sameAsClient: raw['sameAsClient'] ?? false,
      firstName: raw['firstName'] ?? null,
      lastName: raw['lastName'] ?? null,
      birthDate: raw['birthDate']
        ? (raw['birthDate'] as Date).toISOString().split('T')[0]
        : null,
      licenseDate: raw['licenseDate']
        ? (raw['licenseDate'] as Date).toISOString().split('T')[0]
        : null,
      profession: raw['profession'] ?? null,
      phone: raw['phone'] ?? null,
      isPrimaryDriver: raw['isPrimaryDriver'] ?? true,
    };
    this.formSubmit.emit(driver);
  }

  onPrev(): void {
    this.prevStep.emit();
  }
}
