import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';

import { ExtranetLinkFormContainerComponent } from './extranet-link-form-container.component';
import { ExtranetLinkModel } from '../../models/extranet-link.model';
import { ExtranetLinkInput, ExtranetLinkService } from '../../services/extranet-link.service';

function buildLink(overrides: Partial<ExtranetLinkModel> = {}): ExtranetLinkModel {
  return {
    id: 'link-1',
    ownerUid: 'uid-1',
    company: 'April',
    product: 'Moto',
    name: 'Devis Moto',
    url: 'https://www.april-on.fr/devis-moto',
    active: true,
    ...overrides,
  };
}

function buildInput(): ExtranetLinkInput {
  return { company: 'AXA', product: 'Auto', name: 'Devis Auto', url: 'https://axa.fr/devis', active: true };
}

describe('ExtranetLinkFormContainerComponent — création', () => {
  let component: ExtranetLinkFormContainerComponent;
  let fixture: ComponentFixture<ExtranetLinkFormContainerComponent>;
  let extranetLinkServiceSpy: jasmine.SpyObj<ExtranetLinkService>;
  let router: Router;

  beforeEach(async () => {
    extranetLinkServiceSpy = jasmine.createSpyObj('ExtranetLinkService', ['create', 'update', 'getById']);
    extranetLinkServiceSpy.create.and.resolveTo(buildLink());

    await TestBed.configureTestingModule({
      imports: [ExtranetLinkFormContainerComponent],
      providers: [
        provideRouter([]),
        { provide: ExtranetLinkService, useValue: extranetLinkServiceSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(ExtranetLinkFormContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create, in creation mode (no existing link fetched)', () => {
    expect(component).toBeTruthy();
    expect(component.isEditMode).toBeFalse();
    expect(extranetLinkServiceSpy.getById).not.toHaveBeenCalled();
  });

  it('onSave() crée un nouvel extranet puis revient à la liste', fakeAsync(() => {
    const navigateSpy = spyOn(router, 'navigate');

    void component.onSave(buildInput());
    tick();

    expect(extranetLinkServiceSpy.create).toHaveBeenCalledWith(buildInput());
    expect(navigateSpy).toHaveBeenCalledWith(['/admin/mes-extranets']);
  }));
});

describe('ExtranetLinkFormContainerComponent — modification', () => {
  let component: ExtranetLinkFormContainerComponent;
  let fixture: ComponentFixture<ExtranetLinkFormContainerComponent>;
  let extranetLinkServiceSpy: jasmine.SpyObj<ExtranetLinkService>;
  let router: Router;

  beforeEach(async () => {
    extranetLinkServiceSpy = jasmine.createSpyObj('ExtranetLinkService', ['create', 'update', 'getById']);
    extranetLinkServiceSpy.getById.and.resolveTo(buildLink({ id: 'link-1', company: 'April' }));
    extranetLinkServiceSpy.update.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [ExtranetLinkFormContainerComponent],
      providers: [
        provideRouter([]),
        { provide: ExtranetLinkService, useValue: extranetLinkServiceSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ extranetLinkId: 'link-1' }) } } },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(ExtranetLinkFormContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('charge le lien existant en mode modification', fakeAsync(() => {
    tick();
    expect(component.isEditMode).toBeTrue();
    expect(extranetLinkServiceSpy.getById).toHaveBeenCalledWith('link-1');
    expect(component.existingLink()?.company).toBe('April');
  }));

  it('onSave() met à jour le lien existant puis revient à la liste', fakeAsync(() => {
    const navigateSpy = spyOn(router, 'navigate');
    tick();

    void component.onSave(buildInput());
    tick();

    expect(extranetLinkServiceSpy.update).toHaveBeenCalledWith('link-1', buildInput());
    expect(extranetLinkServiceSpy.create).not.toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/admin/mes-extranets']);
  }));

  it('onCancel() revient à la liste sans rien enregistrer', () => {
    const navigateSpy = spyOn(router, 'navigate');

    component.onCancel();

    expect(extranetLinkServiceSpy.update).not.toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/admin/mes-extranets']);
  });
});
