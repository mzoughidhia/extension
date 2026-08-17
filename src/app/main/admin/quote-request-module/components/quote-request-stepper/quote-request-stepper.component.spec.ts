import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideNativeDateAdapter } from '@angular/material/core';
import { AuthenticationProvider, DatabaseProvider } from '@karma-solutions-org/ngx-sg';
import { createMockDatabaseProvider } from '@karma-solutions-org/ngx-sg/testing';
import { of } from 'rxjs';

import { QuoteRequestStepperComponent } from './quote-request-stepper.component';
import { QuoteRequestStore } from '../../store/quote-request.store';
import { createEmptyClient } from '../../models/client.model';
import { createEmptyVehicle } from '../../models/vehicle.model';
import { createEmptyDriver } from '../../models/driver.model';
import { createEmptyInsuranceHistory } from '../../models/insurance-history.model';

describe('QuoteRequestStepperComponent', () => {
  let component: QuoteRequestStepperComponent;
  let fixture: ComponentFixture<QuoteRequestStepperComponent>;
  let store: InstanceType<typeof QuoteRequestStore>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuoteRequestStepperComponent, NoopAnimationsModule],
      providers: [
        provideNativeDateAdapter(),
        { provide: DatabaseProvider, useValue: createMockDatabaseProvider() },
        {
          provide: AuthenticationProvider,
          useValue: {
            authenticationStateChanges: jasmine.createSpy().and.returnValue(of(undefined)),
            signInWithEmailAndPassword: jasmine.createSpy(),
            signOut: jasmine.createSpy(),
          },
        },
      ],
    }).compileComponents();

    store = TestBed.inject(QuoteRequestStore);
    store.reset();

    fixture = TestBed.createComponent(QuoteRequestStepperComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should patch client and advance step on client submit', () => {
    const client = { ...createEmptyClient(), firstName: 'Marc', lastName: 'Lambert' };
    component.onClientSubmit(client);

    expect(store.draft().client.firstName).toBe('Marc');
    expect(component.selectedIndex()).toBe(1);
  });

  it('should patch vehicle and advance step on vehicle submit', () => {
    const vehicle = { ...createEmptyVehicle(), brand: 'Peugeot' };
    component.onVehicleSubmit(vehicle);

    expect(store.draft().vehicle.brand).toBe('Peugeot');
    expect(component.selectedIndex()).toBe(2);
  });

  it('should patch driver and advance step on driver submit', () => {
    const driver = { ...createEmptyDriver(), firstName: 'Luc' };
    component.onDriverSubmit(driver);

    expect(store.draft().driver.firstName).toBe('Luc');
    expect(component.selectedIndex()).toBe(3);
  });

  it('should patch insurance history and advance to summary on history submit', () => {
    const history = { ...createEmptyInsuranceHistory(), previousInsurer: 'Allianz' };
    component.onHistorySubmit(history);

    expect(store.draft().insuranceHistory.previousInsurer).toBe('Allianz');
    expect(component.selectedIndex()).toBe(4);
  });

  it('should call store.submitDraft on final submit', () => {
    component.onSubmit();
    expect(store.isSubmitted()).toBe(true);
    expect(store.successMessage()).toBe('Demande préparée avec succès.');
  });
});
