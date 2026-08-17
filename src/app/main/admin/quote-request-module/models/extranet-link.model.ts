import { DatabaseEntity, DocumentFields, databaseEntity } from '@karma-solutions-org/ngx-sg';

/**
 * Un extranet enregistré par le courtier ("Mes extranets") : compagnie,
 * produit et URL du formulaire de devis. Sert de source unique pour
 * `extranetId`/`extranetUrl` dans tout le workflow de préparation/remplissage
 * — plus aucune compagnie n'est codée en dur.
 *
 * Conformément à ADR-008 : ne stocke JAMAIS de mot de passe, cookie, token ou
 * identifiant de connexion. Uniquement des informations publiques permettant
 * d'ouvrir le formulaire.
 */
export interface ExtranetLinkModel extends DatabaseEntity {
  /** UID du courtier propriétaire du lien (jamais partagé entre utilisateurs). */
  ownerUid: string;
  company: string;
  product: string;
  /** Nom du formulaire tel qu'affiché au courtier (ex : "Devis Moto"). */
  name: string;
  url: string;
  description?: string;
  active: boolean;
}

function extranetLinkFromMap(json: DocumentFields<ExtranetLinkModel>): ExtranetLinkModel {
  return {
    id: json['id'] as string | undefined,
    createdAt: json['createdAt'] as number | undefined,
    lastUpdatedAt: json['lastUpdatedAt'] as number | undefined,
    ownerUid: (json['ownerUid'] as string) ?? '',
    company: (json['company'] as string) ?? '',
    product: (json['product'] as string) ?? '',
    name: (json['name'] as string) ?? '',
    url: (json['url'] as string) ?? '',
    description: json['description'] as string | undefined,
    active: (json['active'] as boolean) ?? true,
  };
}

/** Descripteur de la collection `extranetLinks`, utilisé avec `DatabaseProvider`. */
export const extranetLinkEntity = databaseEntity('extranetLinks', extranetLinkFromMap);
