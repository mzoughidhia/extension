import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadRealModule } from './helpers/load-module.js';

const { computeFormFingerprint, computeFieldKey, buildFieldStructure } = await loadRealModule(
  'src/content/form-fingerprint.ts'
);

function field(overrides = {}) {
  return {
    elementId: 'field_1',
    selector: '#f1',
    tagName: 'input',
    type: 'text',
    name: 'firstname',
    id: 'f_fn',
    label: 'Prénom',
    placeholder: null,
    ariaLabel: null,
    surroundingText: null,
    sectionName: 'Conducteur',
    isInteractable: true,
    currentValue: '',
    ...overrides,
  };
}

describe('form-fingerprint — empreinte structurelle déterministe (Étape 1, vrai code src/)', () => {
  it('1. Deux formulaires structurellement identiques produisent la même empreinte', () => {
    const formA = [field({ elementId: 'a1' }), field({ elementId: 'a2', name: 'lastname', label: 'Nom' })];
    const formB = [field({ elementId: 'b1' }), field({ elementId: 'b2', name: 'lastname', label: 'Nom' })];

    assert.equal(computeFormFingerprint(formA), computeFormFingerprint(formB));
  });

  it('2. Un champ en plus produit une empreinte différente', () => {
    const formA = [field()];
    const formB = [field(), field({ elementId: 'x2', name: 'lastname', label: 'Nom' })];

    assert.notEqual(computeFormFingerprint(formA), computeFormFingerprint(formB));
  });

  it('3. Un changement de type produit une empreinte différente', () => {
    const formA = [field({ type: 'text' })];
    const formB = [field({ type: 'number' })];

    assert.notEqual(computeFormFingerprint(formA), computeFormFingerprint(formB));
  });

  it('4. Un changement de label produit une empreinte différente', () => {
    const formA = [field({ label: 'Prénom' })];
    const formB = [field({ label: 'Nom' })];

    assert.notEqual(computeFormFingerprint(formA), computeFormFingerprint(formB));
  });

  it('5. Un changement d\'option (select) produit une empreinte différente', () => {
    const formA = [field({ tagName: 'select', type: 'select', options: [{ value: 'a', text: 'Garage' }] })];
    const formB = [field({ tagName: 'select', type: 'select', options: [{ value: 'a', text: 'Voie publique' }] })];

    assert.notEqual(computeFormFingerprint(formA), computeFormFingerprint(formB));
  });

  it("6. Un changement d'ordre des champs produit une empreinte différente", () => {
    const first = field({ elementId: 'p1', name: 'firstname', label: 'Prénom' });
    const second = field({ elementId: 'p2', name: 'lastname', label: 'Nom' });

    assert.notEqual(computeFormFingerprint([first, second]), computeFormFingerprint([second, first]));
  });

  it('7. La valeur actuelle du champ (currentValue) est ignorée par l\'empreinte', () => {
    const formA = [field({ currentValue: 'Mohamed' })];
    const formB = [field({ currentValue: 'Jean' })];

    assert.equal(computeFormFingerprint(formA), computeFormFingerprint(formB));
  });

  it('8. L\'empreinte est déterministe (calculs répétés → même résultat)', () => {
    const form = [field(), field({ elementId: 'z2', name: 'cv', label: 'Puissance' })];

    const fp1 = computeFormFingerprint(form);
    const fp2 = computeFormFingerprint(form);
    const fp3 = computeFormFingerprint(form);

    assert.equal(fp1, fp2);
    assert.equal(fp2, fp3);
  });

  it('9. computeFieldKey reste stable pour un champ structurellement identique à la même position', () => {
    const fieldA = field({ elementId: 'session_a_field_3' });
    const fieldB = field({ elementId: 'session_b_field_9' }); // elementId différent (nouvelle session)

    assert.equal(computeFieldKey(fieldA, 2), computeFieldKey(fieldB, 2));
  });

  it("10. computeFieldKey change si la position du champ dans le formulaire change", () => {
    const f = field();
    assert.notEqual(computeFieldKey(f, 0), computeFieldKey(f, 1));
  });

  it('11. buildFieldStructure ne contient aucune valeur de champ ni donnée personnelle', () => {
    const form = [field({ currentValue: 'Mohamed Mzoughi', name: 'lastname', label: 'Nom' })];
    const structure = buildFieldStructure(form);

    assert.equal(structure.length, 1);
    assert.ok(!('currentValue' in structure[0]));
    assert.ok(!('value' in structure[0]));
    assert.deepEqual(Object.keys(structure[0]).sort(), ['fieldKey', 'label', 'name', 'order', 'section', 'type'].sort());
  });
});
