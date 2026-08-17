import { TestBed } from '@angular/core/testing';
import {
  AuthenticatedUserModel,
  AuthenticationProvider,
  DatabaseProvider,
} from '@karma-solutions-org/ngx-sg';
import { createMockDatabaseProvider } from '@karma-solutions-org/ngx-sg/testing';
import { BehaviorSubject, of } from 'rxjs';

import { ExtranetLinkModel, extranetLinkEntity } from '../models/extranet-link.model';
import { ExtranetLinkInput, ExtranetLinkService } from './extranet-link.service';

function buildUser(uid: string): AuthenticatedUserModel {
  return {
    uid,
    email: 'courtier@example.com',
    displayName: undefined,
    isEmailVerified: true,
    isNewUser: false,
    claims: {},
    authenticationSignInProviderUsersMap: {},
  } as AuthenticatedUserModel;
}

function buildInput(overrides: Partial<ExtranetLinkInput> = {}): ExtranetLinkInput {
  return {
    company: 'April',
    product: 'Moto',
    name: 'Devis Moto',
    url: 'https://www.april-on.fr/devis-moto',
    active: true,
    ...overrides,
  };
}

function buildLink(overrides: Partial<ExtranetLinkModel> = {}): ExtranetLinkModel {
  return {
    id: 'link-1',
    ownerUid: 'uid-42',
    ...buildInput(),
    ...overrides,
  };
}

describe('ExtranetLinkService', () => {
  let service: ExtranetLinkService;
  let databaseProvider: jasmine.SpyObj<DatabaseProvider>;
  let authState$: BehaviorSubject<AuthenticatedUserModel | undefined>;

  beforeEach(() => {
    databaseProvider = createMockDatabaseProvider();
    authState$ = new BehaviorSubject<AuthenticatedUserModel | undefined>(undefined);

    TestBed.configureTestingModule({
      providers: [
        { provide: DatabaseProvider, useValue: databaseProvider },
        {
          provide: AuthenticationProvider,
          useValue: {
            authenticationStateChanges: jasmine.createSpy().and.returnValue(authState$.asObservable()),
            signInWithEmailAndPassword: jasmine.createSpy(),
            signOut: jasmine.createSpy(),
          },
        },
      ],
    });

    service = TestBed.inject(ExtranetLinkService);
  });

  describe('sans courtier authentifié', () => {
    it('create() ne persiste rien et retourne null', async () => {
      const result = await service.create(buildInput());

      expect(result).toBeNull();
      expect(databaseProvider.add).not.toHaveBeenCalled();
    });

    it('update() ne persiste rien', async () => {
      await service.update('link-1', buildInput());

      expect(databaseProvider.update).not.toHaveBeenCalled();
    });

    it('delete() ne supprime rien', async () => {
      await service.delete('link-1');

      expect(databaseProvider.deleteById).not.toHaveBeenCalled();
    });

    it('listMine() renvoie un flux vide', (done) => {
      service.listMine().subscribe((links) => {
        expect(links).toEqual([]);
        done();
      });
    });
  });

  describe('avec un courtier authentifié', () => {
    beforeEach(() => {
      authState$.next(buildUser('uid-42'));
    });

    it("create() enregistre l'extranet avec ownerUid, sans credential", async () => {
      databaseProvider.add.and.callFake((_entity, data) => Promise.resolve({ ...data, id: 'link-1' }));

      const result = await service.create(buildInput());

      expect(databaseProvider.add).toHaveBeenCalledTimes(1);
      const [, payload] = databaseProvider.add.calls.mostRecent().args as unknown as [unknown, ExtranetLinkModel];
      expect(payload.ownerUid).toBe('uid-42');
      expect(payload.company).toBe('April');
      expect(payload.url).toBe('https://www.april-on.fr/devis-moto');
      expect(Object.keys(payload)).not.toContain('password');
      expect(Object.keys(payload)).not.toContain('token');
      expect(Object.keys(payload)).not.toContain('cookie');
      expect(result?.id).toBe('link-1');
    });

    it('update() met à jour les informations du lien', async () => {
      databaseProvider.update.and.resolveTo(undefined);

      await service.update('link-1', buildInput({ company: 'AXA' }));

      expect(databaseProvider.update).toHaveBeenCalledWith(
        extranetLinkEntity,
        'link-1',
        jasmine.objectContaining({ company: 'AXA' })
      );
    });

    it('setActive() active ou désactive un extranet sans toucher au reste', async () => {
      databaseProvider.update.and.resolveTo(undefined);

      await service.setActive('link-1', false);

      expect(databaseProvider.update).toHaveBeenCalledWith(
        extranetLinkEntity,
        'link-1',
        { active: false } as unknown as Parameters<DatabaseProvider['update']>[2]
      );
    });

    it('delete() supprime le lien', async () => {
      databaseProvider.deleteById.and.resolveTo(undefined);

      await service.delete('link-1');

      expect(databaseProvider.deleteById).toHaveBeenCalledWith(extranetLinkEntity, 'link-1');
    });

    it('getById() lit le lien via le provider', async () => {
      databaseProvider.getById.and.returnValue(of(buildLink()));

      const result = await service.getById('link-1');

      expect(result?.id).toBe('link-1');
      expect(databaseProvider.getById).toHaveBeenCalledWith(extranetLinkEntity, 'link-1');
    });

    it('listMine() interroge la collection filtrée par ownerUid', () => {
      databaseProvider.list.and.returnValue(of([]));

      service.listMine().subscribe();

      expect(databaseProvider.list).toHaveBeenCalledTimes(1);
      const [, query] = databaseProvider.list.calls.mostRecent().args;
      expect(query.wheres.some((w: { field: string }) => w.field === 'ownerUid')).toBeTrue();
    });

    it('listActiveMine() ne renvoie que les extranets actifs', (done) => {
      const links = [
        buildLink({ id: 'link-1', company: 'April', active: true }),
        buildLink({ id: 'link-2', company: 'AXA', active: false }),
      ];
      databaseProvider.list.and.returnValue(of(links));

      service.listActiveMine().subscribe((result) => {
        expect(result.length).toBe(1);
        expect(result[0].id).toBe('link-1');
        done();
      });
    });
  });
});
