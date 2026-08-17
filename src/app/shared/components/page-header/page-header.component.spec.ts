import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PageHeaderComponent } from './page-header.component';

describe('PageHeaderComponent', () => {
  let fixture: ComponentFixture<PageHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PageHeaderComponent] }).compileComponents();
    fixture = TestBed.createComponent(PageHeaderComponent);
  });

  it('should render the heading', () => {
    fixture.componentRef.setInput('heading', 'Nouvelle demande de devis');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h1').textContent).toContain(
      'Nouvelle demande de devis'
    );
  });

  it('should not render a subheading paragraph when none is provided', () => {
    fixture.componentRef.setInput('heading', 'Accueil');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('p')).toBeNull();
  });

  it('should render the subheading when provided', () => {
    fixture.componentRef.setInput('heading', 'Accueil');
    fixture.componentRef.setInput('subheading', 'Espace administrateur');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('p').textContent).toContain('Espace administrateur');
  });
});
