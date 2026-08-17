/**
 * Protocole EXTERNE Angular ↔ Extension (`chrome.runtime.onMessageExternal`).
 *
 * Distinct du protocole interne (`ExtensionMessage` dans `messages.ts`, utilisé
 * entre content-script / service-worker / side panel) : ce fichier ne décrit
 * QUE ce qui traverse la frontière avec la page web Angular. Aucune donnée
 * technique interne (fingerprint, confidence, détails Gemini, tokens,
 * cookies, credentials) ne doit jamais y apparaître.
 */

export type ExternalFieldAnswerType = 'text' | 'number' | 'date' | 'boolean' | 'choice';

export interface ExternalFieldChoice {
  value: string;
  label: string;
}

/**
 * Un champ réellement demandé par l'extranet analysé — le strict nécessaire
 * pour qu'Angular construise son questionnaire. Le chemin canonique est une
 * chaîne (pas le type fermé `CanonicalPath` de l'extension) : c'est la
 * frontière de communication, traduite via `canonical-path-bridge.ts`.
 */
export interface ExternalRequiredField {
  canonicalPath: string;
  label: string;
  type: ExternalFieldAnswerType;
  choices?: ExternalFieldChoice[];
  required: boolean;
  /** Raison simple, humaine, optionnelle (ex : "Confirmation recommandée") — jamais un score. */
  reason?: string;
}

/**
 * Forme du `QuoteRequest` canonique tel qu'envoyé par Angular (voir
 * `quote-request.model.ts` côté Angular). Dupliquée ici uniquement comme
 * contrat de message (frontière réseau) — jamais réimportée comme "le"
 * catalogue canonique côté extension, qui reste `CanonicalQuoteRequest`.
 */
export interface AngularQuoteRequest {
  client: {
    firstName: string;
    lastName: string;
    nationalId: string | null;
    birthDate: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    postalCode: string | null;
    city: string | null;
    country: string | null;
  };
  vehicle: {
    registration: string | null;
    brand: string | null;
    model: string | null;
    version: string | null;
    firstRegistrationDate: string | null;
    fiscalPower: number | null;
    vehicleValue: number | null;
    vehicleType: string | null;
    usage: string | null;
    parkingType: string | null;
  };
  driver: {
    sameAsClient: boolean;
    firstName: string | null;
    lastName: string | null;
    birthDate: string | null;
    licenseDate: string | null;
    profession: string | null;
    phone: string | null;
  };
  insuranceHistory: {
    previousInsurer: string | null;
    previousContractStartDate: string | null;
    previousContractEndDate: string | null;
    seniority: { value: number | null; knowledge: string };
    bonusMalus: { value: number | null; knowledge: string };
    claimsCount: { value: number | null; knowledge: string };
    responsibleClaimsCount: { value: number | null; knowledge: string };
    nonResponsibleClaimsCount: { value: number | null; knowledge: string };
    wasTerminated: boolean;
    terminatedByInsurer: boolean;
    terminationReason: string | null;
    terminationDate: string | null;
  };
}

export interface PrepareExtranetQuoteMessage {
  type: 'PREPARE_EXTRANET_QUOTE';
  quoteFileId: string;
  extranetId: string;
  /** URL de l'extranet à analyser — l'extension retrouve ou ouvre l'onglet elle-même. */
  extranetUrl: string;
  quoteData: AngularQuoteRequest;
}

export interface ExtranetFormRequirementsMessage {
  type: 'EXTRANET_FORM_REQUIREMENTS';
  quoteFileId: string;
  extranetId: string;
  fields: ExternalRequiredField[];
}

export interface ExtranetAnalysisErrorMessage {
  type: 'EXTRANET_ANALYSIS_ERROR';
  quoteFileId: string;
  extranetId: string;
  error: string;
}

export interface FillExtranetQuoteMessage {
  type: 'FILL_EXTRANET_QUOTE';
  quoteFileId: string;
  extranetId: string;
  /** URL de l'extranet à remplir — l'extension retrouve ou ouvre l'onglet elle-même. */
  extranetUrl: string;
  quoteData: AngularQuoteRequest;
}

/**
 * `ready`            → toutes les informations demandées ont pu être remplies.
 * `partially_filled` → une partie a été remplie, il manque encore des informations.
 * `blocked`          → rien n'a pu être rempli (tout manque ou nécessite confirmation).
 */
export type FillExtranetStatus = 'ready' | 'partially_filled' | 'blocked';

export interface FillExtranetResultMessage {
  type: 'FILL_EXTRANET_RESULT';
  quoteFileId: string;
  extranetId: string;
  status: FillExtranetStatus;
  filledFieldsCount: number;
  /** Champs demandés par l'extranet que le dossier ne permettait pas de remplir. */
  missingFields: ExternalRequiredField[];
  /** Étape du parcours atteinte au moment du remplissage (voir `QuoteSession`), si détectable. */
  lastStepReached: number | null;
}

export interface FillExtranetErrorMessage {
  type: 'FILL_EXTRANET_ERROR';
  quoteFileId: string;
  extranetId: string;
  error: string;
}

export type ExternalRequestMessage = PrepareExtranetQuoteMessage | FillExtranetQuoteMessage;
export type ExternalResponseMessage =
  | ExtranetFormRequirementsMessage
  | ExtranetAnalysisErrorMessage
  | FillExtranetResultMessage
  | FillExtranetErrorMessage;
