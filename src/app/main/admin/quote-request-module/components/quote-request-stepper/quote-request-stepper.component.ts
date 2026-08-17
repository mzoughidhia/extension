import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatStepperModule, MatStepper } from '@angular/material/stepper';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';

import { QuoteRequestStore, StepIndex } from '../../store/quote-request.store';
import { ClientFormComponent } from '../client-form/client-form.component';
import { VehicleFormComponent } from '../vehicle-form/vehicle-form.component';
import { DriverFormComponent } from '../driver-form/driver-form.component';
import { InsuranceHistoryFormComponent } from '../insurance-history-form/insurance-history-form.component';
import { QuoteSummaryComponent } from '../quote-summary/quote-summary.component';
import { Client } from '../../models/client.model';
import { Vehicle } from '../../models/vehicle.model';
import { Driver } from '../../models/driver.model';
import { InsuranceHistory } from '../../models/insurance-history.model';

/**
 * Composant SMART — orchestre le Stepper Angular Material.
 *
 * Injecte le `QuoteRequestStore` et distribue les données/événements
 * vers les composants de formulaire (dumb).
 *
 * Si `quoteFileId` est fourni (reprise depuis "Mes devis"), recharge ce
 * dossier au lieu d'en créer un nouveau. Sinon, amorce silencieusement un
 * nouveau dossier Firestore dès le montage (si un courtier est authentifié)
 * afin qu'aucune information saisie ne soit perdue.
 */
@Component({
  selector: 'app-quote-request-stepper',
  standalone: true,
  imports: [
    MatStepperModule,
    MatSnackBarModule,
    MatIconModule,
    ClientFormComponent,
    VehicleFormComponent,
    DriverFormComponent,
    InsuranceHistoryFormComponent,
    QuoteSummaryComponent,
  ],
  templateUrl: './quote-request-stepper.component.html',
  styleUrl: './quote-request-stepper.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteRequestStepperComponent {
  @ViewChild('stepper') stepper!: MatStepper;
  @ViewChild(ClientFormComponent) clientForm!: ClientFormComponent;
  @ViewChild(VehicleFormComponent) vehicleForm!: VehicleFormComponent;
  @ViewChild(DriverFormComponent) driverForm!: DriverFormComponent;
  @ViewChild(InsuranceHistoryFormComponent) historyForm!: InsuranceHistoryFormComponent;

  readonly store = inject(QuoteRequestStore);
  private readonly snackBar = inject(MatSnackBar);

  /** Id du dossier à reprendre (query param `quoteFileId`), ou `undefined` pour un nouveau dossier. */
  readonly quoteFileId = input<string>();

  /** Étape sélectionnée dans le stepper (index). */
  readonly selectedIndex = signal(0);

  constructor() {
    effect(() => {
      const idToResume = this.quoteFileId();
      if (idToResume) {
        this.store.resumeQuoteFile(idToResume).then(() => {
          this.goToStep(this.store.activeStep());
        });
      } else {
        void this.store.ensureQuoteFile();
      }
    });
  }

  // ─── Client ───────────────────────────────────────────────────────────────

  onClientSubmit(client: Client): void {
    this.store.patchDraft({ client });
    this.goToStep(1);
  }

  // ─── Véhicule ─────────────────────────────────────────────────────────────

  onVehicleSubmit(vehicle: Vehicle): void {
    this.store.patchDraft({ vehicle });
    this.goToStep(2);
  }

  onVehiclePrev(): void {
    this.goToStep(0);
  }

  // ─── Conducteur ───────────────────────────────────────────────────────────

  onDriverSubmit(driver: Driver): void {
    this.store.patchDraft({ driver });
    this.goToStep(3);
  }

  onDriverPrev(): void {
    this.goToStep(1);
  }

  // ─── Historique ───────────────────────────────────────────────────────────

  onHistorySubmit(insuranceHistory: InsuranceHistory): void {
    this.store.patchDraft({ insuranceHistory });
    this.goToStep(4);
  }

  onHistoryPrev(): void {
    this.goToStep(2);
  }

  // ─── Récapitulatif ────────────────────────────────────────────────────────

  onEditStep(step: StepIndex): void {
    this.goToStep(step);
  }

  onSummaryPrev(): void {
    this.goToStep(3);
  }

  onSubmit(): void {
    this.store.submitDraft();
    this.snackBar.open('✅ Demande préparée avec succès.', 'Fermer', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
      panelClass: ['snack-success'],
    });
  }

  // ─── Navigation ───────────────────────────────────────────────────────────

  private goToStep(index: number): void {
    this.selectedIndex.set(index);
    if (this.stepper) {
      this.stepper.selectedIndex = index;
    }
  }
}
