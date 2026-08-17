import { Client, createEmptyClient } from './client.model';
import { Vehicle, createEmptyVehicle } from './vehicle.model';
import { Driver, createEmptyDriver } from './driver.model';
import { InsuranceHistory, createEmptyInsuranceHistory } from './insurance-history.model';

/**
 * Objet canonique central d'une demande d'assurance automobile.
 *
 * C'est la source de vérité unique produite par le formulaire de saisie.
 * Elle sera consommée plus tard par :
 *   - le moteur de mapping (extranet → champ canonique)
 *   - l'agent IA (complétion des champs manquants avec l'accord du courtier)
 *   - le CRM (enregistrement du dossier)
 *
 * Les noms des propriétés de cette interface (et de ses sous-interfaces)
 * constituent le vocabulaire canonique STABLE de l'application.
 */
export interface QuoteRequest {
  /** Informations du souscripteur */
  client: Client;
  /** Informations du véhicule à assurer */
  vehicle: Vehicle;
  /** Informations du conducteur principal */
  driver: Driver;
  /** Historique d'assurance */
  insuranceHistory: InsuranceHistory;
}

/** Valeur initiale vide d'un QuoteRequest. */
export function createEmptyQuoteRequest(): QuoteRequest {
  return {
    client: createEmptyClient(),
    vehicle: createEmptyVehicle(),
    driver: createEmptyDriver(),
    insuranceHistory: createEmptyInsuranceHistory(),
  };
}

// Re-export des sous-modèles pour faciliter les imports dans les composants.
export type { Client } from './client.model';
export type { Vehicle } from './vehicle.model';
export type { Driver } from './driver.model';
export type { InsuranceHistory } from './insurance-history.model';
export { VehicleUsage, VEHICLE_USAGE_LABELS } from './vehicle.model';
export { FieldKnowledge, unknownField, declaredUnknownField, knownField } from './field-knowledge.model';
export type { KnowledgeField } from './field-knowledge.model';
