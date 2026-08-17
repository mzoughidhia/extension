import { FieldKnowledge, KnowledgeField, knownField, unknownField } from './field-knowledge.model';

export interface ClientData {
  firstName: string;
  lastName: string;
  nationalId: string | null;
  birthDate: string | null; // ISO 8601 YYYY-MM-DD
  phone: string | null;
  email: string | null;
  address?: {
    street?: string | null;
    postalCode?: string | null;
    city?: string | null;
    country?: string | null;
  } | null;
  // Compatibilité aplatie
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
}

export enum VehicleUsageEnum {
  PRIVATE = 'PRIVATE',
  COMMUTE = 'COMMUTE',
  PROFESSIONAL = 'PROFESSIONAL',
  TRANSPORT = 'TRANSPORT',
}

export interface VehicleData {
  registration: string | null;
  brand: string | null;
  model: string | null;
  version: string | null;
  firstRegistrationDate: string | null;
  fiscalPower: number | null;
  vehicleValue: number | null;
  vehicleType: string | null;
  usage: VehicleUsageEnum | string | null;
  parkingType?: string | null;
  purchaseDate?: string | null;
}

export interface DriverData {
  sameAsClient?: boolean;
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  licenseDate: string | null;
  licenseType?: string | null;
  profession: string | null;
  phone?: string | null;
}

export interface InsuranceHistoryData {
  currentlyInsured?: boolean;
  previousInsurer: string | null;
  previousContractStartDate: string | null;
  previousContractEndDate: string | null;
  seniority: KnowledgeField<number>;
  bonusMalus: KnowledgeField<number>;
  claimsCount: KnowledgeField<number>;
  responsibleClaimsCount: KnowledgeField<number>;
  nonResponsibleClaimsCount: KnowledgeField<number>;
  wasTerminated: boolean;
  terminatedByInsurer: boolean;
  terminationReason: string | null;
  terminationDate: string | null;
}

export interface CanonicalQuoteRequest {
  client: ClientData;
  vehicle: VehicleData;
  driver: DriverData;
  insuranceHistory: InsuranceHistoryData;
}

/**
 * Accède à une valeur canonique via son chemin pointé (ex: "vehicle.brand", "insuranceHistory.claimsCount").
 */
export function getCanonicalValue(
  data: CanonicalQuoteRequest,
  canonicalPath: string
): { value: unknown; knowledge: FieldKnowledge } {
  const parts = canonicalPath.split('.');
  let current: any = data;

  for (let i = 0; i < parts.length; i++) {
    const key = parts[i];
    if (current === null || current === undefined) {
      return { value: null, knowledge: FieldKnowledge.UNKNOWN };
    }
    // Gérer l'adresse imbriquée ou aplatie
    if (key === 'street' && !current.street && current.address?.street) {
      current = current.address.street;
      continue;
    }
    if (key === 'postalCode' && !current.postalCode && current.address?.postalCode) {
      current = current.address.postalCode;
      continue;
    }
    if (key === 'city' && !current.city && current.address?.city) {
      current = current.address.city;
      continue;
    }
    if (key === 'country' && !current.country && current.address?.country) {
      current = current.address.country;
      continue;
    }
    current = current[key];
  }

  if (current === null || current === undefined) {
    return { value: null, knowledge: FieldKnowledge.UNKNOWN };
  }

  // Si c'est un KnowledgeField
  if (typeof current === 'object' && 'knowledge' in current) {
    return {
      value: current.value,
      knowledge: current.knowledge as FieldKnowledge,
    };
  }

  return {
    value: current,
    knowledge: FieldKnowledge.KNOWN,
  };
}
