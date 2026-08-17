import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { AuthenticationProvider, DatabaseProvider } from '@karma-solutions-org/ngx-sg';
import { createMockDatabaseProvider } from '@karma-solutions-org/ngx-sg/testing';
import { of } from 'rxjs';

import { QuoteFileListContainerComponent } from './quote-file-list-container.component';
import { QuoteFileService } from '../../services/quote-file.service';
import { QuoteFileModel } from '../../models/quote-file.model';
import { createEmptyQuoteRequest } from '../../models/quote-request.model';

describe('QuoteFileListContainerComponent', () => {
  let component: QuoteFileListContainerComponent;
  let fixture: ComponentFixture<QuoteFileListContainerComponent>;
  let router: Router;
  let quoteFileServiceSpy: jasmine.SpyObj<QuoteFileService>;

  const files: QuoteFileModel[] = [
    {
      id: 'file-1',
      ownerUid: 'uid-1',
      status: 'draft',
      quote: createEmptyQuoteRequest(),
      history: [],
      documents: [],
      pendingConfirmations: [],
      extranetQuestionnaires: {},
      extranetResults: {},
    },
  ];

  beforeEach(async () => {
    quoteFileServiceSpy = jasmine.createSpyObj('QuoteFileService', ['listMine']);
    quoteFileServiceSpy.listMine.and.returnValue(of(files));

    await TestBed.configureTestingModule({
      imports: [QuoteFileListContainerComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: QuoteFileService, useValue: quoteFileServiceSpy },
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

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(QuoteFileListContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it("exposes the broker's quote files", () => {
    expect(component.files()).toEqual(files);
  });

  it('navigates to the wizard with the quoteFileId query param on resume', () => {
    const navigateSpy = spyOn(router, 'navigate');

    component.onResume(files[0]);

    expect(navigateSpy).toHaveBeenCalledWith(['/admin/quote-request'], {
      queryParams: { quoteFileId: 'file-1' },
    });
  });

  it('does nothing on resume when the file has no id', () => {
    const navigateSpy = spyOn(router, 'navigate');

    component.onResume({ ...files[0], id: undefined });

    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
