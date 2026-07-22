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

    // 2. Intentar objecte JSONB de traduccions (ex: titleTranslations, audioTranslations)
    let translations = row[`${f}_translations`] || row[`${f}Translations`] || row[`${f}Translation` ];
    
    // Si el camp és de tipus àudio, obrir la cerca a les claus d'àudio habituals
    if (!translations && (f === 'audio' || f === 'audioUrl' || f === 'audio_url')) {
      translations = row.audioTranslations || row.audio_translations || row.audioUrlTranslations || row.audio_url_translations;
    }

    if (translations) {
      if (typeof translations === 'string') {
        try { translations = JSON.parse(translations); } catch (e) {}
      }
      if (typeof translations === 'object' && translations !== null) {
        const jsonLocalized = translations[locale];
        if (jsonLocalized) return jsonLocalized;
        
        const jsonFallback = translations['ca'];
        if (jsonFallback) return jsonFallback;
      }
    }

    // 3. Fallback a la columna de l'idioma base (Català)
    const columnFallback = row[`${f}_ca`];
    if (columnFallback !== undefined && columnFallback !== null && columnFallback !== '') return columnFallback;

    // 4. Fallback final al camp base sense sufix
    if (f === 'audio' || f === 'audioUrl' || f === 'audio_url') {
      return row.audioUrl || row.audio || row.audio_url || '';
    }

    return row[f] || '';
  };

  let result = getField(field);

  // Fallback entre camps comuns (title <-> name, location <-> location_name, audio <-> audioUrl)
  if (!result || result === '') {
    if (field === 'title') result = getField('name');
    else if (field === 'name') result = getField('title');
    else if (field === 'location') result = getField('location_name');
    else if (field === 'audio' || field === 'audioUrl' || field === 'audio_url') {
      result = getField('audio') || getField('audioUrl') || getField('audio_url') || row.audioUrl || row.audio || row.audio_url || '';
    }
  }

  return result || '';
}

/**
 * Extreu un camp traduït d'un objecte JSONB de traduccions (legacy/helper).
 */
export function getTranslation(translations: any, locale: string, fallbackLocale: string = 'ca'): string {
  if (!translations) return '';
  let trans = translations;
  if (typeof trans === 'string') {
    try { trans = JSON.parse(trans); } catch (e) {}
  }
  if (!trans || typeof trans !== 'object') return '';
  return trans[locale] || trans[fallbackLocale] || Object.values(trans)[0] || '';
}
