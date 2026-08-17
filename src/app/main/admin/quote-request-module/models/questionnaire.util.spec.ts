import { QuoteFileModel } from './quote-file.model';
import { createEmptyQuoteRequest } from './quote-request.model';
import { RequiredField } from './questionnaire.model';
import {
  getMissingQuestions,
  isQuoteFileCompleteForExtranet,
  applyQuestionAnswer,
} from './questionnaire.util';

function buildQuoteFile(overrides: Partial<QuoteFileModel> = {}): QuoteFileModel {
  return {
    id: 'file-1',
    ownerUid: 'uid-1',
    status: 'draft',
    quote: createEmptyQuoteRequest(),
    history: [],
    documents: [],
    pendingConfirmations: [],
    extranetQuestionnaires: {},
    extranetResults: {},
    ...overrides,
  };
}

const REGISTRATION_FIELD: RequiredField = {
  canonicalPath: 'vehicle.registration',
  label: 'Immatriculation',
  type: 'text',
  required: true,
};

const BRAND_FIELD: RequiredField = {
  canonicalPath: 'vehicle.brand',
  label: 'Marque',
  type: 'text',
  required: true,
};

const PARKING_FIELD: RequiredField = {
  canonicalPath: 'vehicle.parkingType',
  label: 'Où votre moto est-elle habituellement stationnée ?',
  type: 'choice',
  required: true,
  choices: [
    { value: 'GARAGE_CLOS', label: 'Garage individuel fermé' },
    { value: 'VOIE_PUBLIQUE', label: 'Voie publique' },
  ],
};

describe('questionnaire.util', () => {
  describe('getMissingQuestions', () => {
    it('1. aucune question si toutes les données requises sont déjà connues', () => {
      const quoteFile = buildQuoteFile({
        quote: {
          ...createEmptyQuoteRequest(),
          vehicle: { ...createEmptyQuoteRequest().vehicle, registration: '123 TUN 456' },
        },
      });

      const questions = getMissingQuestions([REGISTRATION_FIELD], quoteFile);
      expect(questions).toEqual([]);
    });

    it('2. une question si un champ obligatoire manque', () => {
      const quoteFile = buildQuoteFile();
      const questions = getMissingQuestions([REGISTRATION_FIELD], quoteFile);

      expect(questions.length).toBe(1);
      expect(questions[0].canonicalPath).toBe('vehicle.registration');
      expect(questions[0].source).toBe('missing');
    });

    it('3. plusieurs questions si plusieurs champs obligatoires manquent', () => {
      const quoteFile = buildQuoteFile();
      const questions = getMissingQuestions(
        [REGISTRATION_FIELD, BRAND_FIELD, PARKING_FIELD],
        quoteFile
      );

      expect(questions.length).toBe(3);
    });

    it('4. un champ déjà répondu (donc connu) ne redevient jamais une question', () => {
      let quoteFile = buildQuoteFile();
      const before = getMissingQuestions([REGISTRATION_FIELD], quoteFile);
      expect(before.length).toBe(1);

      const { quote } = applyQuestionAnswer(quoteFile, before[0], '123 TUN 456');
      quoteFile = buildQuoteFile({ quote });

      const after = getMissingQuestions([REGISTRATION_FIELD], quoteFile);
      expect(after.length).toBe(0);
    });

    it('5. un champ en attente de confirmation OCR devient une question de confirmation, même si connu', () => {
      const quoteFile = buildQuoteFile({
        quote: {
          ...createEmptyQuoteRequest(),
          vehicle: { ...createEmptyQuoteRequest().vehicle, brand: 'Peugeot' },
        },
        pendingConfirmations: [
          {
            id: 'conf-1',
            documentId: 'doc-1',
            canonicalPath: 'vehicle.brand',
            label: 'Marque',
            currentValue: 'Peugeot',
            currentIsKnown: true,
            ocrValue: 'Yamaha',
            ocrConfidence: 'high',
            createdAt: Date.now(),
          },
        ],
      });

      const questions = getMissingQuestions([BRAND_FIELD], quoteFile);
      expect(questions.length).toBe(1);
      expect(questions[0].source).toBe('needs_confirmation');
    });

    it('6. les choix proposés proviennent exactement de ceux fournis par le formulaire extranet', () => {
      const quoteFile = buildQuoteFile();
      const questions = getMissingQuestions([PARKING_FIELD], quoteFile);

      expect(questions[0].choices).toEqual(PARKING_FIELD.choices);
    });

    it("un champ non obligatoire et inconnu n'est jamais posé en question", () => {
      const optionalField: RequiredField = { ...BRAND_FIELD, required: false };
      const quoteFile = buildQuoteFile();

      expect(getMissingQuestions([optionalField], quoteFile)).toEqual([]);
    });

    it('11. le questionnaire est spécifique à un extranet : seuls ses champs requis sont comparés', () => {
      const quoteFile = buildQuoteFile({
        quote: {
          ...createEmptyQuoteRequest(),
          vehicle: { ...createEmptyQuoteRequest().vehicle, registration: '123 TUN 456' },
        },
      });

      // "Extranet A" ne demande que l'immatriculation → aucune question.
      expect(getMissingQuestions([REGISTRATION_FIELD], quoteFile).length).toBe(0);
      // "Extranet B" demande aussi la marque, inconnue → une question, uniquement sur la marque.
      const forExtranetB = getMissingQuestions([REGISTRATION_FIELD, BRAND_FIELD], quoteFile);
      expect(forExtranetB.length).toBe(1);
      expect(forExtranetB[0].canonicalPath).toBe('vehicle.brand');
    });

    it('12. le même dossier est réutilisable pour un autre extranet : une réponse déjà donnée compte pour les deux', () => {
      let quoteFile = buildQuoteFile();

      const aprilQuestions = getMissingQuestions([REGISTRATION_FIELD], quoteFile);
      const { quote } = applyQuestionAnswer(quoteFile, aprilQuestions[0], '123 TUN 456');
      quoteFile = buildQuoteFile({ quote });

      // Un deuxième extranet demandant aussi l'immatriculation ne repose pas la question.
      const axaQuestions = getMissingQuestions([REGISTRATION_FIELD, BRAND_FIELD], quoteFile);
      expect(axaQuestions.length).toBe(1);
      expect(axaQuestions[0].canonicalPath).toBe('vehicle.brand');
    });
  });

  describe('isQuoteFileCompleteForExtranet', () => {
    it('14. le dossier est complet quand toutes les questions requises ont une réponse', () => {
      const quoteFile = buildQuoteFile({
        quote: {
          ...createEmptyQuoteRequest(),
          vehicle: {
            ...createEmptyQuoteRequest().vehicle,
            registration: '123 TUN 456',
            brand: 'Yamaha',
          },
        },
      });

      expect(
        isQuoteFileCompleteForExtranet([REGISTRATION_FIELD, BRAND_FIELD], quoteFile)
      ).toBeTrue();
    });

    it("15. le dossier est incomplet tant qu'il manque au moins une information requise", () => {
      const quoteFile = buildQuoteFile({
        quote: {
          ...createEmptyQuoteRequest(),
          vehicle: { ...createEmptyQuoteRequest().vehicle, registration: '123 TUN 456' },
        },
      });

      expect(
        isQuoteFileCompleteForExtranet([REGISTRATION_FIELD, BRAND_FIELD], quoteFile)
      ).toBeFalse();
    });
  });

  describe('applyQuestionAnswer', () => {
    it('7. une réponse texte est écrite directement dans le modèle canonique du dossier', () => {
      const quoteFile = buildQuoteFile();
      const question = getMissingQuestions([REGISTRATION_FIELD], quoteFile)[0];

      const { quote } = applyQuestionAnswer(quoteFile, question, '123 TUN 456');
      expect(quote.vehicle.registration).toBe('123 TUN 456');
    });

    it('8. une réponse date est écrite telle quelle (format ISO)', () => {
      const dateField: RequiredField = {
        canonicalPath: 'driver.birthDate',
        label: 'Date de naissance',
        type: 'date',
        required: true,
      };
      const quoteFile = buildQuoteFile();
      const question = getMissingQuestions([dateField], quoteFile)[0];

      const { quote } = applyQuestionAnswer(quoteFile, question, '1998-05-15');
      expect(quote.driver.birthDate).toBe('1998-05-15');
    });

    it('9. une réponse numérique est écrite en tant que nombre', () => {
      const numberField: RequiredField = {
        canonicalPath: 'vehicle.fiscalPower',
        label: 'Puissance fiscale',
        type: 'number',
        required: true,
      };
      const quoteFile = buildQuoteFile();
      const question = getMissingQuestions([numberField], quoteFile)[0];

      const { quote } = applyQuestionAnswer(quoteFile, question, 7);
      expect(quote.vehicle.fiscalPower).toBe(7);
    });

    it("retire la confirmation en attente correspondante lorsqu'elle est résolue par une réponse", () => {
      const quoteFile = buildQuoteFile({
        pendingConfirmations: [
          {
            id: 'conf-1',
            documentId: 'doc-1',
            canonicalPath: 'vehicle.brand',
            label: 'Marque',
            currentValue: null,
            currentIsKnown: false,
            ocrValue: 'Yamaha',
            ocrConfidence: 'low',
            createdAt: Date.now(),
          },
        ],
      });
      const question = getMissingQuestions([BRAND_FIELD], quoteFile)[0];

      const { pendingConfirmations } = applyQuestionAnswer(quoteFile, question, 'Yamaha');
      expect(pendingConfirmations).toEqual([]);
    });
  });
});
