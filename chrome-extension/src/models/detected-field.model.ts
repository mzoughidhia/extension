export interface SelectOption {
  value: string;
  text: string;
}

export interface DetectedField {
  /** Identifiant unique généré pour l'élément dans la session (ex: "field_1") */
  elementId: string;
  /** Sélecteur CSS stable pour retrouver l'élément dans le DOM */
  selector: string;
  /** Tag HTML ('input', 'select', 'textarea') */
  tagName: 'input' | 'select' | 'textarea';
  /** Type HTML (text, number, date, tel, email, checkbox, radio, etc.) */
  type: string;
  /** Attribut name de l'élément */
  name: string | null;
  /** Attribut id de l'élément */
  id: string | null;
  /** Label principal associé (via <label for>, parent <label>, aria-labelledby) */
  label: string | null;
  /** Placeholder */
  placeholder: string | null;
  /** aria-label ou title */
  ariaLabel: string | null;
  /** Texte environnant (titre de colonne de tableau, texte de paragraphe proche) */
  surroundingText: string | null;
  /** Nom de la section ou du fieldset parent */
  sectionName: string | null;
  /** Options disponibles si c'est un <select> */
  options?: SelectOption[];
  /** Valeur actuelle dans le champ */
  currentValue?: string;
  /** Attributs data-* utiles */
  dataAttributes?: Record<string, string>;
  /** L'élément est-il actuellement visible et actif (non disabled / non readonly) ? */
  isInteractable: boolean;
}
