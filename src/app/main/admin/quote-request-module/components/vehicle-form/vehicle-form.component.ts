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
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';

import { Vehicle, VehicleUsage, VEHICLE_USAGE_LABELS } from '../../models/vehicle.model';

/** Types de véhicules disponibles. */
export const VEHICLE_TYPES: string[] = [
  'Voiture',
  'Utilitaire',
  'Moto',
  'Autre',
];

@Component({
  selector: 'app-vehicle-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
  ],
  templateUrl: './vehicle-form.component.html',
  styleUrl: './vehicle-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly formSubmit = output<Vehicle>();
  readonly prevStep = output<void>();

  form!: FormGroup;

  /** Expose les valeurs de l'enum au template. */
  readonly vehicleUsageValues = Object.values(VehicleUsage);
  readonly vehicleUsageLabels = VEHICLE_USAGE_LABELS;
  readonly vehicleTypes = VEHICLE_TYPES;

  ngOnInit(): void {
    this.form = this.fb.group({
      registration: [null],
      brand: [null],
      model: [null],
      version: [null],
      firstRegistrationDate: [null],
      fiscalPower: [null, [Validators.min(1), Validators.max(99)]],
      vehicleValue: [null, [Validators.min(0)]],
      vehicleType: [null],
      usage: [null],
    });
  }

  /**
   * Champs du modèle non couverts par ce formulaire (ex : `parkingType`,
   * renseigné plus tard via le questionnaire dynamique) — conservés tels
   * quels pour ne jamais perdre une information déjà connue du dossier.
   */
  private carriedOverFields: Pick<Vehicle, 'parkingType'> = { parkingType: null };

  patchValue(vehicle: Vehicle): void {
    this.carriedOverFields = { parkingType: vehicle.parkingType };
    this.form.patchValue({
      ...vehicle,
      firstRegistrationDate: vehicle.firstRegistrationDate
        ? new Date(vehicle.firstRegistrationDate)
        : null,
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const vehicle: Vehicle = {
      registration: raw['registration'] ?? null,
      brand: raw['brand'] ?? null,
      model: raw['model'] ?? null,
      version: raw['version'] ?? null,
      firstRegistrationDate: raw['firstRegistrationDate']
        ? (raw['firstRegistrationDate'] as Date).toISOString().split('T')[0]
        : null,
      fiscalPower: raw['fiscalPower'] != null ? Number(raw['fiscalPower']) : null,
      vehicleValue: raw['vehicleValue'] != null ? Number(raw['vehicleValue']) : null,
      vehicleType: raw['vehicleType'] ?? null,
      usage: raw['usage'] ?? null,
      ...this.carriedOverFields,
    };
    this.formSubmit.emit(vehicle);
  }

  onPrev(): void {
    this.prevStep.emit();
  }

  getError(field: string, error: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.hasError(error) && ctrl.touched);
  }
}
