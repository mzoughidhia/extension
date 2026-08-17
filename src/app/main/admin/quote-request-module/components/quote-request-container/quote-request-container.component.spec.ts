import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideRouter } from '@angular/router';
import { AuthenticationProvider, DatabaseProvider } from '@karma-solutions-org/ngx-sg';
import { createMockDatabaseProvider } from '@karma-solutions-org/ngx-sg/testing';
import { of } from 'rxjs';

import { QuoteRequestContainerComponent } from './quote-request-container.component';

describe('QuoteRequestContainerComponent', () => {
  let component: QuoteRequestContainerComponent;
  let fixture: ComponentFixture<QuoteRequestContainerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuoteRequestContainerComponent, NoopAnimationsModule],
      providers: [
        provideNativeDateAdapter(),
        provideRouter([]),
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

    fixture = TestBed.createComponent(QuoteRequestContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
