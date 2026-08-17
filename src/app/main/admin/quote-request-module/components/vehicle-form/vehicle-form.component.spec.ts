import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideNativeDateAdapter } from '@angular/material/core';

import { VehicleFormComponent } from './vehicle-form.component';
import { VehicleUsage } from '../../models/vehicle.model';

describe('VehicleFormComponent', () => {
  let component: VehicleFormComponent;
  let fixture: ComponentFixture<VehicleFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VehicleFormComponent, NoopAnimationsModule],
      providers: [provideNativeDateAdapter()],
    }).compileComponents();

    fixture = TestBed.createComponent(VehicleFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should validate fiscal power range (min 1, max 99)', () => {
    component.form.get('fiscalPower')?.setValue(0);
    expect(component.form.get('fiscalPower')?.hasError('min')).toBe(true);

    component.form.get('fiscalPower')?.setValue(100);
    expect(component.form.get('fiscalPower')?.hasError('max')).toBe(true);

    component.form.get('fiscalPower')?.setValue(7);
    expect(component.form.get('fiscalPower')?.errors).toBeNull();
  });

  it('should emit Vehicle on submit', () => {
    let emitted: unknown;
    component.formSubmit.subscribe((v) => (emitted = v));

    component.form.patchValue({
      registration: 'AB-123-CD',
      brand: 'Renault',
      model: 'Clio',
      usage: VehicleUsage.PRIVATE,
    });
    component.onSubmit();

    expect(emitted).toBeTruthy();
    expect((emitted as { brand: string }).brand).toBe('Renault');
    expect((emitted as { usage: VehicleUsage }).usage).toBe(VehicleUsage.PRIVATE);
  });

  it('should emit prevStep event when onPrev is called', () => {
    let prevEmitted = false;
    component.prevStep.subscribe(() => (prevEmitted = true));

    component.onPrev();
    expect(prevEmitted).toBe(true);
  });
});
