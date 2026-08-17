import { ColorTheme, GeneralStyling, StylingThemeEnum } from '@karma-solutions-org/ngx-sg';

/**
 * Thème par défaut fourni au token `GENERAL_STYLING` de ngx-sg.
 *
 * Note : ngx-sg 7.0.0 n'exporte pas de constante `DEFAULT_GENERAL_STYLING`
 * (contrairement à ce que fait le projet de référence sous ngx-sg 2.x).
 * La valeur est donc définie ici, côté application.
 */
export const DEFAULT_COLOR_THEME: ColorTheme = {
  primaryColor: '#1a56db',
  oppositeColor: '#ffffff',
  secondaryColor: '#64748b',
};

export const DEFAULT_GENERAL_STYLING: GeneralStyling = {
  stylingTheme: StylingThemeEnum.modern,
  colorTheme: DEFAULT_COLOR_THEME,
};
