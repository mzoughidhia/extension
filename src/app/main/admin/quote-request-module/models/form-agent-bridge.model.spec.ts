import { FormAgentRequiredField, toRequiredFields } from './form-agent-bridge.model';

describe('form-agent-bridge.model — toRequiredFields', () => {
  it("convertit un champ reçu de l'extension en RequiredField reconnu par le questionnaire", () => {
    const fields: FormAgentRequiredField[] = [
      { canonicalPath: 'vehicle.brand', label: 'Marque', type: 'text', required: true },
    ];

    const result = toRequiredFields(fields);
    expect(result).toEqual([{ canonicalPath: 'vehicle.brand', label: 'Marque', type: 'text', choices: undefined, required: true }]);
  });

  it('filtre silencieusement un chemin canonique que le catalogue Angular ne connaît pas', () => {
    const fields: FormAgentRequiredField[] = [
      { canonicalPath: 'vehicle.purchaseDate', label: "Date d'achat", type: 'date', required: true },
      { canonicalPath: 'vehicle.brand', label: 'Marque', type: 'text', required: true },
    ];

    const result = toRequiredFields(fields);
    expect(result.length).toBe(1);
    expect(result[0].canonicalPath).toBe('vehicle.brand');
  });

  it('transmet les choix tels quels', () => {
    const fields: FormAgentRequiredField[] = [
      {
        canonicalPath: 'vehicle.parkingType',
        label: 'Stationnement',
        type: 'choice',
        required: true,
        choices: [{ value: 'GARAGE_CLOS', label: 'Garage fermé' }],
      },
    ];

    const result = toRequiredFields(fields);
    expect(result[0].choices).toEqual([{ value: 'GARAGE_CLOS', label: 'Garage fermé' }]);
  });

  it('renvoie une liste vide si aucun champ ne correspond au catalogue Angular', () => {
    const fields: FormAgentRequiredField[] = [
      { canonicalPath: 'driver.licenseType', label: 'Catégorie de permis', type: 'text', required: true },
    ];

    expect(toRequiredFields(fields)).toEqual([]);
  });
});
