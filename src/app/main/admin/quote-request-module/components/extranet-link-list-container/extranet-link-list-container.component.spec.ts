import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ExtranetLinkListContainerComponent } from './extranet-link-list-container.component';
import { ExtranetLinkModel } from '../../models/extranet-link.model';
import { ExtranetLinkService } from '../../services/extranet-link.service';

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

describe('ExtranetLinkListContainerComponent', () => {
  let component: ExtranetLinkListContainerComponent;
  let fixture: ComponentFixture<ExtranetLinkListContainerComponent>;
  let extranetLinkServiceSpy: jasmine.SpyObj<ExtranetLinkService>;

  const links: ExtranetLinkModel[] = [buildLink({ id: 'link-1', company: 'April' }), buildLink({ id: 'link-2', company: 'AXA' })];

  beforeEach(async () => {
    extranetLinkServiceSpy = jasmine.createSpyObj('ExtranetLinkService', ['listMine', 'setActive']);
    extranetLinkServiceSpy.listMine.and.returnValue(of(links));
    extranetLinkServiceSpy.setActive.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [ExtranetLinkListContainerComponent, NoopAnimationsModule],
      providers: [provideRouter([]), { provide: ExtranetLinkService, useValue: extranetLinkServiceSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(ExtranetLinkListContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it("expose tous les extranets du courtier, quelle que soit la compagnie", () => {
    expect(component.links()).toEqual(links);
  });

  it('onToggleActive() inverse le statut actif du lien via le service', () => {
    component.onToggleActive(links[0]);

    expect(extranetLinkServiceSpy.setActive).toHaveBeenCalledWith('link-1', false);
  });

  it('onToggleActive() ne fait rien si le lien n\'a pas d\'id', () => {
    component.onToggleActive({ ...links[0], id: undefined });

    expect(extranetLinkServiceSpy.setActive).not.toHaveBeenCalled();
  });
});
