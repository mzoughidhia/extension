import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { ExtranetLinkFormComponent } from './extranet-link-form.component';
import { ExtranetLinkInput } from '../../services/extranet-link.service';

describe('ExtranetLinkFormComponent', () => {
  let component: ExtranetLinkFormComponent;
  let fixture: ComponentFixture<ExtranetLinkFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExtranetLinkFormComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(ExtranetLinkFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('initialValue', null);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('refuse la soumission si la compagnie, le nom ou l\'URL manquent', () => {
    let emitted: ExtranetLinkInput | undefined;
    component.save.subscribe((v) => (emitted = v));

    component.onSubmit();

    expect(emitted).toBeUndefined();
    expect(component.form.invalid).toBeTrue();
  });

  it("refuse une URL invalide", () => {
    component.form.setValue({
      company: 'April',
      product: 'Moto',
      name: 'Devis Moto',
      url: 'pas-une-url',
      description: null,
      active: true,
    });

    let emitted: ExtranetLinkInput | undefined;
    component.save.subscribe((v) => (emitted = v));
    component.onSubmit();

    expect(emitted).toBeUndefined();
    // onSubmit() marque tous les champs comme touchés quand le formulaire est invalide.
    expect(component.getError('url', 'pattern')).toBeTrue();
  });

  it('émet save() avec les valeurs saisies quand le formulaire est valide', () => {
    component.form.setValue({
      company: 'April',
      product: 'Moto',
      name: 'Devis Moto',
      url: 'https://www.april-on.fr/devis-moto',
      description: 'Formulaire particulier moto',
      active: true,
    });

    let emitted: ExtranetLinkInput | undefined;
    component.save.subscribe((v) => (emitted = v));
    component.onSubmit();

    expect(emitted).toEqual({
      company: 'April',
      product: 'Moto',
      name: 'Devis Moto',
      url: 'https://www.april-on.fr/devis-moto',
      description: 'Formulaire particulier moto',
      active: true,
    });
  });

  it("n'accepte jamais de champ mot de passe, cookie ou token dans le formulaire", () => {
    const controlNames = Object.keys(component.form.controls);
    expect(controlNames).not.toContain('password');
    expect(controlNames).not.toContain('token');
    expect(controlNames).not.toContain('cookie');
    expect(controlNames).not.toContain('credential');
  });

  it('pré-remplit le formulaire avec la valeur initiale en mode modification', () => {
    fixture = TestBed.createComponent(ExtranetLinkFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('initialValue', {
      company: 'AXA',
      product: 'Moto',
      name: 'Devis Moto',
      url: 'https://axa.fr/devis',
      active: false,
    });
    fixture.detectChanges();

    expect(component.form.getRawValue().company).toBe('AXA');
    expect(component.form.getRawValue().active).toBeFalse();
  });

  it('émet formCancel() au clic sur Annuler', () => {
    let cancelled = false;
    component.formCancel.subscribe(() => (cancelled = true));

    component.onCancel();

    expect(cancelled).toBeTrue();
  });
});
