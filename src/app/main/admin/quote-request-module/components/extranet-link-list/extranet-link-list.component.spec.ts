import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';

import { ExtranetLinkListComponent } from './extranet-link-list.component';
import { ExtranetLinkModel } from '../../models/extranet-link.model';

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

describe('ExtranetLinkListComponent', () => {
  let component: ExtranetLinkListComponent;
  let fixture: ComponentFixture<ExtranetLinkListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExtranetLinkListComponent, NoopAnimationsModule],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ExtranetLinkListComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.componentRef.setInput('links', []);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it("affiche un état vide sans jargon lorsqu'aucun extranet n'est enregistré", () => {
    fixture.componentRef.setInput('links', []);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Aucun extranet enregistré');
  });

  it('affiche une carte par extranet, avec sa compagnie et son statut', () => {
    const links = [buildLink({ id: 'link-1', company: 'April', active: true }), buildLink({ id: 'link-2', company: 'AXA', active: false })];
    fixture.componentRef.setInput('links', links);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('April');
    expect(text).toContain('AXA');
    expect(text).toContain('Actif');
    expect(text).toContain('Inactif');
  });

  it('émet toggleActive avec le lien concerné', () => {
    const link = buildLink();
    fixture.componentRef.setInput('links', [link]);
    fixture.detectChanges();

    let emitted: ExtranetLinkModel | undefined;
    component.toggleActive.subscribe((l) => (emitted = l));

    component.onToggleActive(link);

    expect(emitted).toEqual(link);
  });
});
