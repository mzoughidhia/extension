import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom, map, of } from 'rxjs';

import {
  DatabaseProvider,
  DatabaseQueryBuilder,
  FilterOperator,
  OrderByDirection,
} from '@karma-solutions-org/ngx-sg';

import { AuthStore } from '../../../commons/authentication-module/store/auth.store';
import { ExtranetLinkModel, extranetLinkEntity } from '../models/extranet-link.model';

export interface ExtranetLinkInput {
  company: string;
  product: string;
  name: string;
  url: string;
  description?: string;
  active: boolean;
}

/**
 * Persistance des extranets enregistrés par le courtier ("Mes extranets") via
 * l'abstraction `DatabaseProvider` — aucun accès Firestore direct ailleurs
 * dans le code métier (cf. `QuoteFileService`, même principe).
 *
 * Toujours scopé au courtier connecté (`ownerUid`). Si aucun utilisateur
 * n'est authentifié, les écritures sont silencieusement ignorées.
 */
@Injectable({ providedIn: 'root' })
export class ExtranetLinkService {
  private readonly databaseProvider = inject(DatabaseProvider);
  private readonly authStore = inject(AuthStore);

  /** Crée un nouvel extranet. Retourne `null` si aucun courtier n'est connecté. */
  async create(input: ExtranetLinkInput): Promise<ExtranetLinkModel | null> {
    const ownerUid = this.authStore.uid();
    if (!ownerUid) return null;

    return this.databaseProvider.add(extranetLinkEntity, {
      ownerUid,
      ...input,
    });
  }

  /** Met à jour un extranet existant (le courtier ne peut modifier que les siens). */
  async update(id: string, input: ExtranetLinkInput): Promise<void> {
    if (!this.authStore.uid()) return;
    await this.databaseProvider.update(extranetLinkEntity, id, { ...input });
  }

  /** Active ou désactive un extranet sans toucher au reste de ses informations. */
  async setActive(id: string, active: boolean): Promise<void> {
    if (!this.authStore.uid()) return;
    await this.databaseProvider.update(extranetLinkEntity, id, { active });
  }

  /** Supprime un extranet enregistré. */
  async delete(id: string): Promise<void> {
    if (!this.authStore.uid()) return;
    await this.databaseProvider.deleteById(extranetLinkEntity, id);
  }

  /** Récupère un extranet par son id (pour le formulaire de modification). */
  getById(id: string): Promise<ExtranetLinkModel | undefined> {
    return firstValueFrom(this.databaseProvider.getById(extranetLinkEntity, id));
  }

  /** Flux temps réel de tous les extranets du courtier connecté ("Mes extranets"). */
  listMine(): Observable<ExtranetLinkModel[]> {
    const ownerUid = this.authStore.uid();
    if (!ownerUid) return of([]);

    const query = new DatabaseQueryBuilder()
      .where('ownerUid', FilterOperator.isEqualTo, ownerUid)
      .orderBy('company', OrderByDirection.asc)
      .build();

    return this.databaseProvider.list(extranetLinkEntity, query);
  }

  /** Flux temps réel des extranets actifs du courtier — utilisé dans la page dossier. */
  listActiveMine(): Observable<ExtranetLinkModel[]> {
    return this.listMine().pipe(map((links) => links.filter((link) => link.active)));
  }
}
