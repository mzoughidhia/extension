import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
  });

  it('should display the email it receives', () => {
    fixture.componentRef.setInput('email', 'courtier@example.com');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('courtier@example.com');
  });

  it('should fall back to a placeholder when the email is unknown', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('utilisateur inconnu');
  });

  it('should emit signout on button click', () => {
    const spy = jasmine.createSpy('signout');
    fixture.componentInstance.signout.subscribe(spy);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button').click();

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
