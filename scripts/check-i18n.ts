import caMessages from '../messages/ca.json';
import esMessages from '../messages/es.json';
import enMessages from '../messages/en.json';
import frMessages from '../messages/fr.json';

const allMessages: Record<string, any> = {
  ca: caMessages,
  es: esMessages,
  en: enMessages,
  fr: frMessages
};

const locales = Object.keys(allMessages);
const baseLocale = 'ca';

console.log('🔍 Checking i18n messages synchronization...');

function getAllKeys(obj: any, prefix = ''): string[] {
  return Object.keys(obj).reduce((res: string[], el) => {
    if (typeof obj[el] === 'object' && obj[el] !== null && !Array.isArray(obj[el])) {
      return [...res, ...getAllKeys(obj[el], prefix + el + '.')];
    }
    return [...res, prefix + el];
  }, []);
}

const baseKeys = getAllKeys(allMessages[baseLocale]);

let hasErrors = false;

locales.forEach(locale => {
  if (locale === baseLocale) return;

  const currentKeys = getAllKeys(allMessages[locale]);
  
  // Check for missing keys in current locale
  const missingKeys = baseKeys.filter(key => !currentKeys.includes(key));
  if (missingKeys.length > 0) {
    console.error(`❌ [${locale.toUpperCase()}] Missing keys from ${baseLocale}:`);
    missingKeys.forEach(key => console.error(`   - ${key}`));
    hasErrors = true;
  }

  // Check for extra keys in current locale
  const extraKeys = currentKeys.filter(key => !baseKeys.includes(key));
  if (extraKeys.length > 0) {
    console.warn(`⚠️ [${locale.toUpperCase()}] Extra keys not present in ${baseLocale}:`);
    extraKeys.forEach(key => console.warn(`   - ${key}`));
  }
});

if (!hasErrors) {
  console.log('✅ All i18n files are synchronized!');
} else {
  console.log('❌ Some i18n files are missing keys. Please update them.');
  process.exit(1);
}
