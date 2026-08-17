import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';

import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES, DocumentType } from '../../models/document-ref.model';

export interface DocumentUploadRequest {
  type: DocumentType;
  file: File;
}

/**
 * Composant DUMB — sélection d'un type de document + d'un fichier.
 * Une seule action principale : "Ajouter le document".
 */
@Component({
  selector: 'app-document-upload',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatSelectModule, FormsModule],
  templateUrl: './document-upload.component.html',
  styleUrl: './document-upload.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentUploadComponent {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  readonly documentTypes = DOCUMENT_TYPES;
  readonly documentTypeLabels = DOCUMENT_TYPE_LABELS;

  readonly isOpen = signal(false);
  readonly selectedType = signal<DocumentType>('carte_grise');
  readonly selectedFileName = signal<string | null>(null);
  private selectedFile: File | null = null;

  readonly addDocument = output<DocumentUploadRequest>();

  open(): void {
    this.isOpen.set(true);
  }

  cancel(): void {
    this.isOpen.set(false);
    this.selectedFile = null;
    this.selectedFileName.set(null);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedFile = file;
    this.selectedFileName.set(file?.name ?? null);
  }

  triggerFilePicker(): void {
    this.fileInput.nativeElement.click();
  }

  submit(): void {
    if (!this.selectedFile) return;

    this.addDocument.emit({ type: this.selectedType(), file: this.selectedFile });
    this.cancel();
  }
}
