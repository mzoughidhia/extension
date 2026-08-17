import { TestBed } from '@angular/core/testing';
import { AuthenticationProvider } from '@karma-solutions-org/ngx-sg';
import { EMPTY } from 'rxjs';

import { AuthenticationService } from './authentication.service';

describe('AuthenticationService', () => {
  let service: AuthenticationService;
  let provider: {
    authenticationStateChanges: jasmine.Spy;
    signInWithEmailAndPassword: jasmine.Spy;
    signOut: jasmine.Spy;
  };

  beforeEach(() => {
    provider = {
      authenticationStateChanges: jasmine
        .createSpy('authenticationStateChanges')
        .and.returnValue(EMPTY),
      signInWithEmailAndPassword: jasmine
        .createSpy('signInWithEmailAndPassword')
        .and.resolveTo(undefined),
      signOut: jasmine.createSpy('signOut').and.resolveTo(undefined),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: AuthenticationProvider, useValue: provider }],
    });

    service = TestBed.inject(AuthenticationService);
  });

  it('should delegate authenticationStateChanges to the provider', () => {
    service.authenticationStateChanges();

    expect(provider.authenticationStateChanges).toHaveBeenCalledTimes(1);
  });

  it('should delegate signInWithEmailAndPassword to the provider', async () => {
    await service.signInWithEmailAndPassword('a@b.c', 'secret123');

    expect(provider.signInWithEmailAndPassword).toHaveBeenCalledOnceWith('a@b.c', 'secret123');
  });

  it('should delegate signOut to the provider', async () => {
    await service.signOut();

    expect(provider.signOut).toHaveBeenCalledTimes(1);
  });
});
