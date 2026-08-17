import { CanonicalQuoteRequest, ClientData, VehicleData, InsuranceHistoryData, VehicleUsageEnum } from '../models/canonical-data.model';
import { declaredUnknownField, knownField } from '../models/field-knowledge.model';
import { DataProvider } from './data-provider.interface';

export class MockDataProvider implements DataProvider {
  private readonly defaultData: CanonicalQuoteRequest = {
    client: {
      firstName: 'Mohamed',
      lastName: 'Mzoughi',
      nationalId: '12345678',
      birthDate: '1998-05-12',
      phone: '+21698123456',
      email: 'mohamed.mzoughi@example.com',
      address: {
        street: '15 Avenue Habib Bourguiba',
        postalCode: '1000',
        city: 'Tunis',
        country: 'Tunisie',
      },
      street: '15 Avenue Habib Bourguiba',
      postalCode: '1000',
      city: 'Tunis',
      country: 'Tunisie',
    },
    vehicle: {
      registration: '123 TN 4567',
      brand: 'Yamaha',
      model: 'MT-07',
      version: '689cc ABS',
      firstRegistrationDate: '2021-06-15',
      fiscalPower: 7,
      vehicleValue: 7500,
      vehicleType: 'Moto',
      usage: VehicleUsageEnum.PRIVATE,
      purchaseDate: '2022-03-10',
      // Intentionnellement absent pour tester la question interactive :
      parkingType: null,
    },
    driver: {
      sameAsClient: true,
      firstName: 'Mohamed',
      lastName: 'Mzoughi',
      birthDate: '1998-05-12',
      licenseDate: '2017-09-20',
      licenseType: 'A2',
      profession: 'Ingénieur',
      phone: '+21698123456',
    },
    insuranceHistory: {
      previousInsurer: 'STAR Assurances',
      previousContractStartDate: '2023-01-01',
      previousContractEndDate: '2024-01-01',
      seniority: knownField<number>(3),
      bonusMalus: knownField<number>(0.8),
      // Exemple de sinistre : 0 sinistre connu (RÈGLE ABSOLUE : doit être rempli 0)
      claimsCount: knownField<number>(0),
      responsibleClaimsCount: knownField<number>(0),
      // Exemple d'un champ déclaré inconnu par le courtier (RÈGLE ABSOLUE : ne jamais remplir)
      nonResponsibleClaimsCount: declaredUnknownField<number>(),
      wasTerminated: false,
      terminatedByInsurer: false,
      terminationReason: null,
      terminationDate: null,
    },
  };

  async getQuoteRequest(): Promise<CanonicalQuoteRequest> {
    return Promise.resolve(JSON.parse(JSON.stringify(this.defaultData)));
  }

  async getCurrentCustomer(): Promise<ClientData | null> {
    return Promise.resolve(JSON.parse(JSON.stringify(this.defaultData.client)));
  }

  async getCustomerById(id: string): Promise<ClientData | null> {
    if (id === this.defaultData.client.nationalId) {
      return Promise.resolve(JSON.parse(JSON.stringify(this.defaultData.client)));
    }
    return Promise.resolve(null);
  }

  async getVehicle(): Promise<VehicleData | null> {
    return Promise.resolve(JSON.parse(JSON.stringify(this.defaultData.vehicle)));
  }

  async getInsuranceHistory(): Promise<InsuranceHistoryData | null> {
    return Promise.resolve(JSON.parse(JSON.stringify(this.defaultData.insuranceHistory)));
  }
}
