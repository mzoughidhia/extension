import { TestBed } from '@angular/core/testing';

import { QuoteRequestDraftService } from './quote-request-draft.service';
import { createEmptyClient } from '../models/client.model';
import { createEmptyVehicle, VehicleUsage } from '../models/vehicle.model';
import { createEmptyDriver } from '../models/driver.model';
import { createEmptyInsuranceHistory } from '../models/insurance-history.model';

describe('QuoteRequestDraftService', () => {
  let service: QuoteRequestDraftService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(QuoteRequestDraftService);
    service.reset();
  });

  it('should be created with initial empty quote request', () => {
    expect(service).toBeTruthy();
    expect(service.draft().client.firstName).toBe('');
    expect(service.draft().vehicle.brand).toBeNull();
  });

  it('should patch client', () => {
    const client = { ...createEmptyClient(), firstName: 'Alex', lastName: 'Bernard' };
    service.patchClient(client);

    expect(service.draft().client.firstName).toBe('Alex');
    expect(service.draft().client.lastName).toBe('Bernard');
  });

  it('should patch vehicle', () => {
    const vehicle = { ...createEmptyVehicle(), brand: 'Peugeot', usage: VehicleUsage.COMMUTE };
    service.patchVehicle(vehicle);

    expect(service.draft().vehicle.brand).toBe('Peugeot');
    expect(service.draft().vehicle.usage).toBe(VehicleUsage.COMMUTE);
  });

  it('should patch driver', () => {
    const driver = { ...createEmptyDriver(), firstName: 'Claire', sameAsClient: true };
    service.patchDriver(driver);

    expect(service.draft().driver.firstName).toBe('Claire');
    expect(service.draft().driver.sameAsClient).toBe(true);
  });

  it('should patch insurance history', () => {
    const history = { ...createEmptyInsuranceHistory(), previousInsurer: 'AXA' };
    service.patchInsuranceHistory(history);

    expect(service.draft().insuranceHistory.previousInsurer).toBe('AXA');
  });

  it('should reset draft to empty state', () => {
    service.patchClient({ ...createEmptyClient(), firstName: 'Alex' });
    service.reset();

    expect(service.draft().client.firstName).toBe('');
  });

  it('should return complete QuoteRequest object on build', () => {
    service.patchClient({ ...createEmptyClient(), firstName: 'Alex' });
    const built = service.build();

    expect(built.client.firstName).toBe('Alex');
  });
});
