import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  output,
  inject,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  InsuranceHistory,
} from '../../models/insurance-history.model';
import {
  FieldKnowledge,
  KnowledgeField,
  declaredUnknownField,
  knownField,
} from '../../models/field-knowledge.model';

@Component({
  selector: 'app-insurance-history-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  templateUrl: './insurance-history-form.component.html',
  styleUrl: './insurance-history-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsuranceHistoryFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly formSubmit = output<InsuranceHistory>();
  readonly prevStep = output<void>();

  form!: FormGroup;

  ngOnInit(): void {
    this.form = this.fb.group({
      previousInsurer: [null],
      previousContractStartDate: [null],
      previousContractEndDate: [null],

      // KnowledgeFields — paires (value + isDeclaredUnknown)
      seniorityValue: [null],
      seniorityUnknown: [false],
      bonusMalusValue: [null],
      bonusMalusUnknown: [false],
      claimsCountValue: [null],
      claimsCountUnknown: [false],
      responsibleClaimsValue: [null],
      responsibleClaimsUnknown: [false],
      nonResponsibleClaimsValue: [null],
      nonResponsibleClaimsUnknown: [false],

      // Résiliation
      wasTerminated: [false],
      terminatedByInsurer: [false],
      terminationReason: [null],
      terminationDate: [null],
    });

    this.bindUnknownToggle('seniorityUnknown', 'seniorityValue');
    this.bindUnknownToggle('bonusMalusUnknown', 'bonusMalusValue');
    this.bindUnknownToggle('claimsCountUnknown', 'claimsCountValue');
    this.bindUnknownToggle('responsibleClaimsUnknown', 'responsibleClaimsValue');
    this.bindUnknownToggle('nonResponsibleClaimsUnknown', 'nonResponsibleClaimsValue');
  }

  private bindUnknownToggle(unknownControlName: string, valueControlName: string): void {
    this.form.get(unknownControlName)?.valueChanges.subscribe((isUnknown: boolean) => {
      const valControl = this.form.get(valueControlName);
      if (isUnknown) {
        valControl?.disable();
      } else {
        valControl?.enable();
      }
    });
  }

  patchValue(history: InsuranceHistory): void {
    this.form.patchValue({
      previousInsurer: history.previousInsurer,
      previousContractStartDate: history.previousContractStartDate
        ? new Date(history.previousContractStartDate)
        : null,
      previousContractEndDate: history.previousContractEndDate
        ? new Date(history.previousContractEndDate)
        : null,
      seniorityValue: history.seniority.value,
      seniorityUnknown: history.seniority.knowledge === FieldKnowledge.DECLARED_UNKNOWN,
      bonusMalusValue: history.bonusMalus.value,
      bonusMalusUnknown: history.bonusMalus.knowledge === FieldKnowledge.DECLARED_UNKNOWN,
      claimsCountValue: history.claimsCount.value,
      claimsCountUnknown: history.claimsCount.knowledge === FieldKnowledge.DECLARED_UNKNOWN,
      responsibleClaimsValue: history.responsibleClaimsCount.value,
      responsibleClaimsUnknown:
        history.responsibleClaimsCount.knowledge === FieldKnowledge.DECLARED_UNKNOWN,
      nonResponsibleClaimsValue: history.nonResponsibleClaimsCount.value,
      nonResponsibleClaimsUnknown:
        history.nonResponsibleClaimsCount.knowledge === FieldKnowledge.DECLARED_UNKNOWN,
      wasTerminated: history.wasTerminated,
      terminatedByInsurer: history.terminatedByInsurer,
      terminationReason: history.terminationReason,
      terminationDate: history.terminationDate
        ? new Date(history.terminationDate)
        : null,
    });
  }

  get wasTerminated(): boolean {
    return !!this.form.get('wasTerminated')?.value;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();

    const history: InsuranceHistory = {
      previousInsurer: raw['previousInsurer'] ?? null,
      previousContractStartDate: raw['previousContractStartDate']
        ? (raw['previousContractStartDate'] as Date).toISOString().split('T')[0]
        : null,
      previousContractEndDate: raw['previousContractEndDate']
        ? (raw['previousContractEndDate'] as Date).toISOString().split('T')[0]
        : null,
      seniority: this.buildKnowledgeField<number>(
        raw['seniorityValue'],
        raw['seniorityUnknown']
      ),
      bonusMalus: this.buildKnowledgeField<number>(
        raw['bonusMalusValue'],
        raw['bonusMalusUnknown']
      ),
      claimsCount: this.buildKnowledgeField<number>(
        raw['claimsCountValue'],
        raw['claimsCountUnknown']
      ),
      responsibleClaimsCount: this.buildKnowledgeField<number>(
        raw['responsibleClaimsValue'],
        raw['responsibleClaimsUnknown']
      ),
      nonResponsibleClaimsCount: this.buildKnowledgeField<number>(
        raw['nonResponsibleClaimsValue'],
        raw['nonResponsibleClaimsUnknown']
      ),
      wasTerminated: raw['wasTerminated'] ?? false,
      terminatedByInsurer: raw['terminatedByInsurer'] ?? false,
      terminationReason: raw['terminationReason'] ?? null,
      terminationDate: raw['terminationDate']
        ? (raw['terminationDate'] as Date).toISOString().split('T')[0]
        : null,
    };
    this.formSubmit.emit(history);
  }

  onPrev(): void {
    this.prevStep.emit();
  }

  /**
   * Construit un KnowledgeField depuis les deux contrôles du formulaire.
   *
   * Priorité :
   *   1. Si "Je ne sais pas" est coché → DECLARED_UNKNOWN (valeur ignorée)
   *   2. Si une valeur est saisie       → KNOWN
   *   3. Sinon                          → UNKNOWN (non renseigné)
   */
  private buildKnowledgeField<T>(rawValue: unknown, isDeclaredUnknown: boolean): KnowledgeField<T> {
    if (isDeclaredUnknown) {
      return declaredUnknownField<T>();
    }
    if (rawValue !== null && rawValue !== '' && rawValue !== undefined) {
      return knownField<T>(Number(rawValue) as unknown as T);
    }
    return { value: null, knowledge: FieldKnowledge.UNKNOWN };
  }
}
