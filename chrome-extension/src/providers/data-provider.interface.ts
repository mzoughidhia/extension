import { CanonicalQuoteRequest, ClientData, VehicleData, InsuranceHistoryData } from '../models/canonical-data.model';

/**
 * Interface générique de source de données pour l'extension Chrome (Form Agent).
 *
 * Découple le moteur d'analyse et de remplissage de la provenance des données :
 * - MockDataProvider        : données de test complètes pour simulation et développement
 * - CrmApiDataProvider      : intégration future avec l'API REST / GraphQL du CRM
 * - LocalStorageDataProvider: récupération directe depuis une session CRM locale
 */
export interface DataProvider {
  /** Récupère l'intégralité du dossier en cours (client, véhicule, conducteur, antécédents) */
  getQuoteRequest(): Promise<CanonicalQuoteRequest>;

  /** Récupère uniquement les informations du client actif */
  getCurrentCustomer?(): Promise<ClientData | null>;

  /** Récupère un client par son identifiant unique */
  getCustomerById?(id: string): Promise<ClientData | null>;

  /** Récupère les données du véhicule actif */
  getVehicle?(): Promise<VehicleData | null>;

  /** Récupère l'historique et les antécédents d'assurance */
  getInsuranceHistory?(): Promise<InsuranceHistoryData | null>;
}
