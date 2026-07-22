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
    // 1. Columnes específiques per idioma (ex: description_fr, title_es)
    const columnLocalized = row[`${f}_${locale}`];
    if (columnLocalized !== undefined && columnLocalized !== null && String(columnLocalized).trim() !== '') {
      return String(columnLocalized);
    }

    // 2. Objecte JSONB de traduccions (ex: descriptionTranslations, nameTranslations)
    let translations = row[`${f}_translations`] || row[`${f}Translations`] || row[`${f}Translation` ];
    
    if (!translations && (f === 'title' || f === 'name')) {
      translations = row.titleTranslations || row.title_translations || row.nameTranslations || row.name_translations;
    }
    if (!translations && (f === 'description' || f === 'textContent' || f === 'text_content')) {
      translations = row.descriptionTranslations || row.description_translations || row.textContentTranslations || row.text_content_translations;
    }
    if (!translations && (f === 'audio' || f === 'audioUrl' || f === 'audio_url')) {
      translations = row.audioTranslations || row.audio_translations || row.audioUrlTranslations || row.audio_url_translations;
    }

    if (translations) {
      if (typeof translations === 'string') {
        try { translations = JSON.parse(translations); } catch (e) {}
      }
      if (typeof translations === 'object' && translations !== null) {
        const jsonLocalized = translations[locale];
        if (jsonLocalized && typeof jsonLocalized === 'string' && jsonLocalized.trim() !== '') {
          return jsonLocalized;
        }
        const jsonCa = translations['ca'];
        if (jsonCa && typeof jsonCa === 'string' && jsonCa.trim() !== '') {
          return jsonCa;
        }
      }
    }

    // 3. Fallback a la columna de l'idioma base (Català)
    const columnFallback = row[`${f}_ca` ];
    if (columnFallback !== undefined && columnFallback !== null && String(columnFallback).trim() !== '') {
      return String(columnFallback);
    }

    // 4. Fallback final al camp base directament (ex: row.description o row.name)
    if (f === 'audio' || f === 'audioUrl' || f === 'audio_url') {
      return row.audioUrl || row.audio || row.audio_url || '';
    }

    if (row[f] !== undefined && row[f] !== null && String(row[f]).trim() !== '') {
      return String(row[f]);
    }

    return '';
  };

  let result = getField(field);

  // Fallback secundari només si el camp requerit està completament buit
  if (!result || result === '') {
    if (field === 'title') result = getField('name');
    else if (field === 'name') result = getField('title');
    else if (field === 'location') result = getField('location_name');
    else if (field === 'description') result = getField('textContent') || getField('text_content') || getField('summary') || '';
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
