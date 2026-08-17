import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadRealModule } from './helpers/load-module.js';

// Charge le VRAI code src/ (pont de traduction entre les deux catalogues canoniques réels).
const { toAngularCanonicalPath, toExtensionCanonicalQuoteRequest } = await loadRealModule(
  'src/shared/canonical-path-bridge.ts'
);

function buildAngularQuoteRequest(overrides = {}) {
  return {
    client: {
      firstName: 'Mohamed',
      lastName: 'Mzoughi',
      nationalId: null,
      birthDate: '1998-05-15',
      phone: null,
      email: null,
      address: '12 rue de la paix',
      postalCode: '75001',
      city: 'Paris',
      country: 'France',
    },
    vehicle: {
      registration: '123 TUN 456',
      brand: 'Yamaha',
      model: 'MT-07',
      version: null,
      firstRegistrationDate: '2021-03-15',
      fiscalPower: 7,
      vehicleValue: null,
      vehicleType: null,
      usage: 'PRIVATE',
      parkingType: 'GARAGE_CLOS',
    },
    driver: {
      sameAsClient: true,
      firstName: 'Mohamed',
      lastName: 'Mzoughi',
      birthDate: '1998-05-15',
      licenseDate: '2016-06-01',
      profession: null,
      phone: null,
    },
    insuranceHistory: {
      previousInsurer: 'AXA',
      previousContractStartDate: null,
      previousContractEndDate: null,
      seniority: { value: null, knowledge: 'UNKNOWN' },
      bonusMalus: { value: 0.85, knowledge: 'KNOWN' },
      claimsCount: { value: 0, knowledge: 'KNOWN' },
      responsibleClaimsCount: { value: null, knowledge: 'DECLARED_UNKNOWN' },
      nonResponsibleClaimsCount: { value: null, knowledge: 'UNKNOWN' },
      wasTerminated: false,
      terminatedByInsurer: false,
      terminationReason: null,
      terminationDate: null,
    },
    ...overrides,
  };
}

describe('canonical-path-bridge — synchronisation des deux catalogues existants (vrai code src/)', () => {
  describe('toAngularCanonicalPath', () => {
    it("traduit l'adresse imbriquée de l'extension vers le format à plat d'Angular", () => {
      assert.equal(toAngularCanonicalPath('client.address.street'), 'client.address');
      assert.equal(toAngularCanonicalPath('client.address.postalCode'), 'client.postalCode');
      assert.equal(toAngularCanonicalPath('client.address.city'), 'client.city');
      assert.equal(toAngularCanonicalPath('client.address.country'), 'client.country');
    });

    it('laisse identiques les chemins communs aux deux catalogues', () => {
      assert.equal(toAngularCanonicalPath('vehicle.brand'), 'vehicle.brand');
      assert.equal(toAngularCanonicalPath('vehicle.parkingType'), 'vehicle.parkingType');
      assert.equal(toAngularCanonicalPath('driver.licenseDate'), 'driver.licenseDate');
    });

    it("renvoie null pour un chemin que le modèle Angular ne connaît pas encore (jamais transmis)", () => {
      assert.equal(toAngularCanonicalPath('vehicle.purchaseDate'), null);
      assert.equal(toAngularCanonicalPath('driver.licenseType'), null);
      assert.equal(toAngularCanonicalPath('insuranceHistory.currentlyInsured'), null);
    });
  });

  describe('toExtensionCanonicalQuoteRequest', () => {
    it("reconstruit l'adresse imbriquée attendue par le pipeline existant", () => {
      const result = toExtensionCanonicalQuoteRequest(buildAngularQuoteRequest());
      assert.deepEqual(result.client.address, {
        street: '12 rue de la paix',
        postalCode: '75001',
        city: 'Paris',
        country: 'France',
      });
    });

    it('préserve les champs KnowledgeField (KNOWN, UNKNOWN, DECLARED_UNKNOWN) sans les réinterpréter', () => {
      const result = toExtensionCanonicalQuoteRequest(buildAngularQuoteRequest());
      assert.deepEqual(result.insuranceHistory.claimsCount, { value: 0, knowledge: 'KNOWN' });
      assert.deepEqual(result.insuranceHistory.seniority, { value: null, knowledge: 'UNKNOWN' });
      assert.deepEqual(result.insuranceHistory.responsibleClaimsCount, { value: null, knowledge: 'DECLARED_UNKNOWN' });
    });

    it('un sinistre à 0 (KNOWN) ne devient jamais UNKNOWN à la traduction', () => {
      const result = toExtensionCanonicalQuoteRequest(buildAngularQuoteRequest());
      assert.equal(result.insuranceHistory.claimsCount.knowledge, 'KNOWN');
      assert.equal(result.insuranceHistory.claimsCount.value, 0);
    });

    it('transmet vehicle.parkingType, commun aux deux catalogues', () => {
      const result = toExtensionCanonicalQuoteRequest(buildAngularQuoteRequest());
      assert.equal(result.vehicle.parkingType, 'GARAGE_CLOS');
    });
  });
});
