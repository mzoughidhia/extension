import { Injectable, signal } from '@angular/core';

import { Client } from '../models/client.model';
import { Driver } from '../models/driver.model';
import { InsuranceHistory } from '../models/insurance-history.model';
import { QuoteRequest, createEmptyQuoteRequest } from '../models/quote-request.model';
import { Vehicle } from '../models/vehicle.model';

/**
 * Service de brouillon — conserve le QuoteRequest en mémoire pendant la saisie.
 *
 * Portée : `providedIn: 'root'` pour que le brouillon survive à la navigation
 * entre les étapes du Stepper (qui sont des composants distincts).
 *
 * Ce service n'interagit avec aucun backend.
 * Il n'a pas connaissance de Firebase, du CRM ni de l'agent IA.
 */
@Injectable({ providedIn: 'root' })
export class QuoteRequestDraftService {
  private readonly _draft = signal<QuoteRequest>(createEmptyQuoteRequest());

  /** Snapshot courant du brouillon (lecture seule). */
  readonly draft = this._draft.asReadonly();

  /** Remplace la section client du brouillon. */
  patchClient(client: Client): void {
    this._draft.update((d) => ({ ...d, client }));
  }

  /** Remplace la section véhicule du brouillon. */
  patchVehicle(vehicle: Vehicle): void {
    this._draft.update((d) => ({ ...d, vehicle }));
  }

  /** Remplace la section conducteur du brouillon. */
  patchDriver(driver: Driver): void {
    this._draft.update((d) => ({ ...d, driver }));
  }

  /** Remplace la section historique du brouillon. */
  patchInsuranceHistory(insuranceHistory: InsuranceHistory): void {
    this._draft.update((d) => ({ ...d, insuranceHistory }));
  }

  /** Réinitialise complètement le brouillon. */
  reset(): void {
    this._draft.set(createEmptyQuoteRequest());
  }

  /**
   * Construit et retourne le QuoteRequest final.
   * Ne valide pas les données — la validation est du ressort du formulaire.
   */
  build(): QuoteRequest {
    return this._draft();
  }
}
