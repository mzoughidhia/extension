import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { QuestionnaireComponent } from './questionnaire.component';
import { QuestionnaireQuestion } from '../../models/questionnaire.model';

function buildQuestion(overrides: Partial<QuestionnaireQuestion> = {}): QuestionnaireQuestion {
  return {
    id: 'q_vehicle.parkingType',
    canonicalPath: 'vehicle.parkingType',
    label: 'Où votre moto est-elle habituellement stationnée ?',
    type: 'choice',
    required: true,
    currentValue: null,
    source: 'missing',
    choices: [
      { value: 'GARAGE_CLOS', label: 'Garage individuel fermé' },
      { value: 'VOIE_PUBLIQUE', label: 'Voie publique' },
    ],
    ...overrides,
  };
}

describe('QuestionnaireComponent', () => {
  let component: QuestionnaireComponent;
  let fixture: ComponentFixture<QuestionnaireComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuestionnaireComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(QuestionnaireComponent);
    component = fixture.componentInstance;
  });

  function setInputs(question: QuestionnaireQuestion, remainingCount = 1): void {
    fixture.componentRef.setInput('question', question);
    fixture.componentRef.setInput('remainingCount', remainingCount);
    fixture.detectChanges();
  }

  it('should create', () => {
    setInputs(buildQuestion());
    expect(component).toBeTruthy();
  });

  it('émet la valeur choisie au clic sur un choix', () => {
    setInputs(buildQuestion());
    const emitted: unknown[] = [];
    component.answer.subscribe((v) => emitted.push(v));

    component.onChoice('GARAGE_CLOS');

    expect(emitted).toEqual(['GARAGE_CLOS']);
  });

  it('émet true/false pour une question booléenne', () => {
    setInputs(buildQuestion({ type: 'boolean', choices: undefined }));
    const emitted: unknown[] = [];
    component.answer.subscribe((v) => emitted.push(v));

    component.onBoolean(true);

    expect(emitted).toEqual([true]);
  });

  it('émet une réponse texte, convertie en nombre pour une question de type number', () => {
    setInputs(buildQuestion({ type: 'number', choices: undefined, canonicalPath: 'vehicle.fiscalPower' }));
    const emitted: unknown[] = [];
    component.answer.subscribe((v) => emitted.push(v));

    component.textValue.set('7');
    component.submitTextValue();

    expect(emitted).toEqual([7]);
  });

  it('émet une réponse texte telle quelle pour une question de type text', () => {
    setInputs(buildQuestion({ type: 'text', choices: undefined, canonicalPath: 'vehicle.brand' }));
    const emitted: unknown[] = [];
    component.answer.subscribe((v) => emitted.push(v));

    component.textValue.set('Yamaha');
    component.submitTextValue();

    expect(emitted).toEqual(['Yamaha']);
  });

  it('émet une réponse date telle quelle', () => {
    setInputs(buildQuestion({ type: 'date', choices: undefined, canonicalPath: 'driver.birthDate' }));
    const emitted: unknown[] = [];
    component.answer.subscribe((v) => emitted.push(v));

    component.textValue.set('1998-05-15');
    component.submitTextValue();

    expect(emitted).toEqual(['1998-05-15']);
  });

  it("n'émet rien pour une réponse texte vide", () => {
    setInputs(buildQuestion({ type: 'text', choices: undefined }));
    const emitted: unknown[] = [];
    component.answer.subscribe((v) => emitted.push(v));

    component.textValue.set('   ');
    component.submitTextValue();

    expect(emitted.length).toBe(0);
  });

  it('affiche le nombre de questions restantes', () => {
    setInputs(buildQuestion(), 3);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('3 questions restantes');
  });

  it('affiche "Dernière question" quand il ne reste qu\'une question', () => {
    setInputs(buildQuestion(), 1);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Dernière question');
  });

  it('aucun terme technique (chemin canonique) affiché dans le texte visible', () => {
    setInputs(buildQuestion());
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('vehicle.parkingType');
    expect(text).not.toContain('canonicalPath');
  });
});
