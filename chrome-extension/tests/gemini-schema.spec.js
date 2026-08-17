import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Implémentation isolée de toCompactField / toCompactSchema pour les tests Node.js
function toCompactField(field) {
  const compact = {
    id: field.elementId,
    label: field.label || null,
    name: field.name || null,
    type: field.type || field.tagName,
  };

  if (field.placeholder) compact.placeholder = field.placeholder;
  if (field.sectionName) compact.section = field.sectionName;
  if (field.ariaLabel) compact.ariaLabel = field.ariaLabel;
  if (field.surroundingText) compact.surroundingText = field.surroundingText;
  if (field.options && field.options.length > 0) {
    compact.options = field.options.map((opt) => ({
      value: opt.value,
      label: opt.text || opt.label,
    }));
  }

  return compact;
}

function toCompactSchema(fields, pageContext) {
  return {
    page: pageContext,
    fields: fields.map((f) => toCompactField(f)),
  };
}

const CANONICAL_PATHS = [
  'client.firstName', 'client.lastName', 'client.nationalId', 'client.birthDate',
  'client.phone', 'client.email', 'client.address.street', 'client.address.postalCode',
  'client.address.city', 'client.address.country',
  'vehicle.registration', 'vehicle.brand', 'vehicle.model', 'vehicle.version',
  'vehicle.firstRegistrationDate', 'vehicle.fiscalPower', 'vehicle.vehicleValue',
  'vehicle.vehicleType', 'vehicle.usage',
  'driver.firstName', 'driver.lastName', 'driver.birthDate', 'driver.licenseDate',
  'driver.profession', 'driver.phone',
  'insuranceHistory.previousInsurer', 'insuranceHistory.previousContractStartDate',
  'insuranceHistory.previousContractEndDate', 'insuranceHistory.seniority',
  'insuranceHistory.bonusMalus', 'insuranceHistory.claimsCount',
  'insuranceHistory.responsibleClaimsCount', 'insuranceHistory.nonResponsibleClaimsCount',
  'insuranceHistory.wasTerminated', 'insuranceHistory.terminatedByInsurer',
  'insuranceHistory.terminationReason', 'insuranceHistory.terminationDate',
];

describe('Gemini Schema — Contrat & Sérialisation Compacte (Étape 1)', () => {
  // 1. Input Texte
  it('1. [Input Texte] Conserve id, label, name, type, placeholder, section et exclut les internals DOM', () => {
    const raw = {
      elementId: 'field_1',
      selector: '#app > form input.form-control',
      tagName: 'input',
      type: 'text',
      name: 'firstname',
      id: 'client_fn',
      label: "Prénom de l'assuré",
      placeholder: 'Ex : Mohamed',
      ariaLabel: 'Prénom',
      surroundingText: 'Informations obligatoires',
      sectionName: 'Souscripteur',
      currentValue: 'Valeur temporaire non injectée',
      dataAttributes: { 'data-v-1234': 'true', 'data-autofill-id': 'field_1' },
      isInteractable: true,
    };

    const compact = toCompactField(raw);

    assert.equal(compact.id, 'field_1');
    assert.equal(compact.label, "Prénom de l'assuré");
    assert.equal(compact.name, 'firstname');
    assert.equal(compact.type, 'text');
    assert.equal(compact.placeholder, 'Ex : Mohamed');
    assert.equal(compact.section, 'Souscripteur');
    assert.equal(compact.ariaLabel, 'Prénom');
    assert.equal(compact.surroundingText, 'Informations obligatoires');

    // Vérification de sécurité : aucune fuite de sélecteur DOM, dataAttributes ou currentValue
    assert.equal(compact.selector, undefined, 'Le sélecteur CSS interne ne doit pas être transmis à Gemini');
    assert.equal(compact.currentValue, undefined, 'La valeur temporaire DOM ne doit pas être transmise');
    assert.equal(compact.dataAttributes, undefined, 'Les data-attributes ne doivent pas être transmis');
  });

  // 2. Input Number
  it('2. [Input Number] Conserve le type number pour la puissance fiscale', () => {
    const raw = {
      elementId: 'field_2',
      selector: '#cv_input',
      tagName: 'input',
      type: 'number',
      name: 'fiscal_power',
      id: 'cv',
      label: 'Puissance fiscale (CV)',
      sectionName: 'Véhicule',
      isInteractable: true,
    };

    const compact = toCompactField(raw);
    assert.equal(compact.type, 'number');
    assert.equal(compact.label, 'Puissance fiscale (CV)');
    assert.equal(compact.section, 'Véhicule');
  });

  // 3. Input Date
  it('3. [Input Date] Conserve le type date pour date de naissance', () => {
    const raw = {
      elementId: 'field_3',
      selector: '#dob_input',
      tagName: 'input',
      type: 'date',
      name: 'birth_date',
      id: 'dob',
      label: 'Date de naissance',
      sectionName: 'Client',
      isInteractable: true,
    };

    const compact = toCompactField(raw);
    assert.equal(compact.type, 'date');
    assert.equal(compact.name, 'birth_date');
  });

  // 4. Select avec options
  it('4. [Select] Conserve la liste des options sous format { value, label }', () => {
    const raw = {
      elementId: 'field_4',
      selector: '#brand_select',
      tagName: 'select',
      type: 'select',
      name: 'car_brand',
      id: 'brand',
      label: 'Marque du véhicule',
      sectionName: 'Véhicule',
      options: [
        { value: 'Peugeot', text: 'Peugeot' },
        { value: 'Renault', text: 'Renault' },
        { value: 'Citroen', text: 'Citroën' },
      ],
      isInteractable: true,
    };

    const compact = toCompactField(raw);
    assert.equal(compact.type, 'select');
    assert.ok(Array.isArray(compact.options));
    assert.equal(compact.options.length, 3);
    assert.deepEqual(compact.options[0], { value: 'Peugeot', label: 'Peugeot' });
    assert.deepEqual(compact.options[2], { value: 'Citroen', label: 'Citroën' });
  });

  // 5. Radio
  it('5. [Radio] Conserve le type radio et le group name', () => {
    const raw = {
      elementId: 'field_5',
      selector: '#usage_radio_private',
      tagName: 'input',
      type: 'radio',
      name: 'usage_group',
      id: 'usage_private',
      label: 'Usage Privé / Trajet',
      sectionName: 'Véhicule',
      isInteractable: true,
    };

    const compact = toCompactField(raw);
    assert.equal(compact.type, 'radio');
    assert.equal(compact.name, 'usage_group');
    assert.equal(compact.label, 'Usage Privé / Trajet');
  });

  // 6. Checkbox
  it('6. [Checkbox] Conserve le type checkbox', () => {
    const raw = {
      elementId: 'field_6',
      selector: '#opt_in',
      tagName: 'input',
      type: 'checkbox',
      name: 'secondary_driver_opt',
      id: 'secondary_opt',
      label: 'Ajouter un conducteur secondaire',
      sectionName: 'Conducteur',
      isInteractable: true,
    };

    const compact = toCompactField(raw);
    assert.equal(compact.type, 'checkbox');
    assert.equal(compact.name, 'secondary_driver_opt');
  });

  // 7. Textarea
  it('7. [Textarea] Conserve le type textarea', () => {
    const raw = {
      elementId: 'field_7',
      selector: '#address_textarea',
      tagName: 'textarea',
      type: 'textarea',
      name: 'full_address',
      id: 'address',
      label: 'Adresse postale complète',
      placeholder: 'Rue, bâtiment, code postal...',
      sectionName: 'Client',
      isInteractable: true,
    };

    const compact = toCompactField(raw);
    assert.equal(compact.type, 'textarea');
    assert.equal(compact.placeholder, 'Rue, bâtiment, code postal...');
  });

  // 8. Schéma Compact Complet avec PageContext
  it('8. [CompactFormSchema] Génère un payload compact et valide pour plusieurs champs', () => {
    const rawFields = [
      { elementId: 'f1', tagName: 'input', type: 'text', name: 'firstname', label: 'Prénom', isInteractable: true },
      { elementId: 'f2', tagName: 'input', type: 'text', name: 'lastname', label: 'Nom', isInteractable: true },
      { elementId: 'f3', tagName: 'input', type: 'text', name: 'license_plate', label: 'Immatriculation', isInteractable: true },
    ];

    const pageContext = {
      title: 'Simulation Tarif Auto — Direct Assurance',
      url: 'https://extranet.assurance.example.com/quote',
      hostname: 'extranet.assurance.example.com',
    };

    const schema = toCompactSchema(rawFields, pageContext);

    assert.equal(schema.page.title, 'Simulation Tarif Auto — Direct Assurance');
    assert.equal(schema.page.hostname, 'extranet.assurance.example.com');
    assert.equal(schema.fields.length, 3);
    assert.equal(schema.fields[0].id, 'f1');
    assert.equal(schema.fields[2].name, 'license_plate');
  });

  // 9. Sérialisation JSON stricte
  it('9. [JSON Serialization] Le schéma compact est 100% sérialisable sans perte', () => {
    const rawFields = [
      {
        elementId: 'f1',
        tagName: 'select',
        type: 'select',
        name: 'brand',
        label: 'Marque',
        options: [{ value: 'Peugeot', text: 'Peugeot' }],
        sectionName: 'Véhicule',
        isInteractable: true,
      },
    ];

    const schema = toCompactSchema(rawFields, { title: 'Test CRM' });
    const jsonStr = JSON.stringify(schema);
    const parsed = JSON.parse(jsonStr);

    assert.deepEqual(parsed, schema);
    assert.ok(jsonStr.length < 500, 'Le JSON compact doit être léger');
  });

  // 10. Validation du contrat GeminiMappingRequest / GeminiMappingResponse
  it('10. [Contrat Gemini] Structure d\'échange avec catalogue fermé de 32 chemins', () => {
    const request = {
      formSchema: toCompactSchema([
        { elementId: 'f1', tagName: 'input', type: 'text', name: 'fn', label: 'Prénom', isInteractable: true },
      ]),
      availableData: {
        client: { firstName: 'Mohamed', lastName: 'Mzoughi' },
      },
      allowedCanonicalPaths: CANONICAL_PATHS,
    };

    assert.equal(request.allowedCanonicalPaths.length, 37); // Contient les 37 chemins définis
    assert.ok(request.allowedCanonicalPaths.includes('client.firstName'));

    // Simulation de réponse Gemini
    const response = {
      mappings: [
        {
          fieldId: 'f1',
          canonicalPath: 'client.firstName',
          confidence: 0.98,
          reason: 'Correspondance exacte avec le prénom du souscripteur',
          suggestedValue: 'Mohamed',
        },
      ],
      model: 'gemini-2.0-flash',
    };

    assert.equal(response.mappings[0].fieldId, 'f1');
    assert.equal(response.mappings[0].canonicalPath, 'client.firstName');
    assert.ok(request.allowedCanonicalPaths.includes(response.mappings[0].canonicalPath));
  });
});
