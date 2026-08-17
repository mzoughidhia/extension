import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { AuthenticationProvider } from '@karma-solutions-org/ngx-sg';
import { of } from 'rxjs';

import { HomeContainerComponent } from './home-container.component';
import { AuthStore } from '../../../../commons/authentication-module/store/auth.store';

class AuthenticationProviderStub {
  authenticationStateChanges = jasmine
    .createSpy('authenticationStateChanges')
    .and.returnValue(of(undefined));
  signInWithEmailAndPassword = jasmine
    .createSpy('signInWithEmailAndPassword')
    .and.resolveTo(undefined);
  signOut = jasmine.createSpy('signOut').and.resolveTo(undefined);
}

describe('HomeContainerComponent', () => {
  let fixture: ComponentFixture<HomeContainerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeContainerComponent, NoopAnimationsModule],
      providers: [
        { provide: AuthenticationProvider, useClass: AuthenticationProviderStub },
        { provide: Router, useValue: { navigateByUrl: jasmine.createSpy('navigateByUrl') } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeContainerComponent);
    fixture.detectChanges();
  });

  it('should render the dumb home component', () => {
    expect(fixture.nativeElement.querySelector('app-home')).toBeTruthy();
  });

  it('should delegate signout to the store', () => {
    const store = TestBed.inject(AuthStore);
    const spy = spyOn(store, 'signOut');

    fixture.componentInstance.onSignout();

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
