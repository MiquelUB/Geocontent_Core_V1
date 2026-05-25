type SupportedLocale = 'ca' | 'es' | 'en' | 'fr';

/**
 * Extreu el camp localitzat d'un objecte de la BD.
 * Estratègia prioritària (segons skill): columnes separades (ex: title_ca, title_es).
 * Estratègia secundària: objecte JSONB (ex: title_translations).
 * Fallback: Català ('ca') o camp base.
 */
export function getLocalizedContent(row: any, field: string, locale: string): string {
  if (!row) return '';

  const getField = (f: string) => {
    // 1. Intentar columna específica per idioma (ex: title_ca)
    const columnLocalized = row[`${f}_${locale}`];
    if (columnLocalized !== undefined && columnLocalized !== null && columnLocalized !== '') return columnLocalized;

    // 2. Intentar objecte JSONB de traduccions (ex: titleTranslations)
    const translations = row[`${f}_translations`] || row[`${f}Translations`] || row[`${f}Translation` ];
    if (translations && typeof translations === 'object') {
      const jsonLocalized = translations[locale];
      if (jsonLocalized) return jsonLocalized;
      
      const jsonFallback = translations['ca'];
      if (jsonFallback) return jsonFallback;
    }

    // 3. Fallback a la columna de l'idioma base (Català)
    const columnFallback = row[`${f}_ca`];
    if (columnFallback !== undefined && columnFallback !== null && columnFallback !== '') return columnFallback;

    // 4. Fallback final al camp base sense sufix
    return row[f] || '';
  };

  let result = getField(field);

  // Fallback entre camps comuns (title <-> name)
  if (!result || result === '') {
    if (field === 'title') result = getField('name');
    else if (field === 'name') result = getField('title');
    else if (field === 'location') result = getField('location_name');
  }

  return result || '';
}

/**
 * Extreu un camp traduït d'un objecte JSONB de traduccions (legacy/helper).
 */
export function getTranslation(translations: any, locale: string, fallbackLocale: string = 'ca'): string {
  if (!translations || typeof translations !== 'object') return '';
  return translations[locale] || translations[fallbackLocale] || Object.values(translations)[0] || '';
}
