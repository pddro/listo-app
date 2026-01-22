import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Device } from '@capacitor/device';
import { App } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';

// Import all translation files
import en from '../../../messages/en.json';
import es from '../../../messages/es.json';
import fr from '../../../messages/fr.json';
import de from '../../../messages/de.json';
import pt from '../../../messages/pt.json';
import ja from '../../../messages/ja.json';
import zhHans from '../../../messages/zh-Hans.json';
import zhHant from '../../../messages/zh-Hant.json';
import ko from '../../../messages/ko.json';

// Supported locales (must match web config)
export const locales = ['en', 'es', 'fr', 'de', 'pt', 'ja', 'zh-Hans', 'zh-Hant', 'ko'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

// Language names for UI display
export const localeNames: Record<Locale, { name: string; nativeName: string; flag: string }> = {
  en: { name: 'English', nativeName: 'English', flag: '🇺🇸' },
  es: { name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  fr: { name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  de: { name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  pt: { name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷' },
  ja: { name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  'zh-Hans': { name: 'Chinese (Simplified)', nativeName: '简体中文', flag: '🇨🇳' },
  'zh-Hant': { name: 'Chinese (Traditional)', nativeName: '繁體中文', flag: '🇹🇼' },
  ko: { name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
};

// Resources object for i18next
const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  pt: { translation: pt },
  ja: { translation: ja },
  'zh-Hans': { translation: zhHans },
  'zh-Hant': { translation: zhHant },
  ko: { translation: ko },
};

// Map device language codes to our supported locales
function mapLanguageToLocale(languageCode: string): Locale {
  // Normalize the language code
  const normalized = languageCode.toLowerCase().replace('_', '-');

  // Direct matches
  if (locales.includes(normalized as Locale)) {
    return normalized as Locale;
  }

  // Handle Chinese variants
  if (normalized.startsWith('zh')) {
    // zh-hans, zh-cn, zh-sg -> Simplified
    if (normalized.includes('hans') || normalized.includes('cn') || normalized.includes('sg')) {
      return 'zh-Hans';
    }
    // zh-hant, zh-tw, zh-hk, zh-mo -> Traditional
    if (normalized.includes('hant') || normalized.includes('tw') || normalized.includes('hk') || normalized.includes('mo')) {
      return 'zh-Hant';
    }
    // Default Chinese to Simplified
    return 'zh-Hans';
  }

  // Get base language (e.g., 'en-US' -> 'en')
  const baseLang = normalized.split('-')[0];
  if (locales.includes(baseLang as Locale)) {
    return baseLang as Locale;
  }

  return defaultLocale;
}

// Get the device language using Capacitor Device API
async function getDeviceLanguage(): Promise<Locale> {
  try {
    const info = await Device.getLanguageCode();
    // info.value returns the language code (e.g., 'en', 'es', 'zh-Hans')
    return mapLanguageToLocale(info.value);
  } catch {
    // Fallback to navigator if Device API fails
    const browserLang = navigator.language || (navigator as { userLanguage?: string }).userLanguage || defaultLocale;
    return mapLanguageToLocale(browserLang);
  }
}

// Initialize i18next with default language first
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: defaultLocale, // Start with default, will update after device detection
    fallbackLng: defaultLocale,
    supportedLngs: locales as unknown as string[],

    interpolation: {
      escapeValue: false, // React already escapes
    },

    // Return key if translation is missing (for debugging)
    returnEmptyString: false,

    react: {
      useSuspense: false, // Disable suspense for mobile
    },
  });

// Detect and set the device language
async function detectAndSetLanguage(): Promise<void> {
  // First check if user has manually set a language preference
  try {
    const { value } = await Preferences.get({ key: 'listo_language_manual' });
    if (value && locales.includes(value as Locale)) {
      // User has manually chosen a language, use that
      await i18n.changeLanguage(value);
      return;
    }
  } catch {
    // Preferences not available
  }

  // Otherwise, detect from device
  const deviceLocale = await getDeviceLanguage();
  await i18n.changeLanguage(deviceLocale);
}

// Initial detection
detectAndSetLanguage();

// Listen for app resume to re-check language (user might have changed it in Settings)
App.addListener('resume', () => {
  detectAndSetLanguage();
});

// Function to manually set language (and persist the preference)
export async function setLanguage(locale: Locale): Promise<void> {
  await i18n.changeLanguage(locale);
  try {
    // Mark as manually set so we don't override on next detection
    await Preferences.set({ key: 'listo_language_manual', value: locale });
  } catch {
    localStorage.setItem('listo_language_manual', locale);
  }
}

// Function to clear manual language preference (follow system language)
export async function clearLanguagePreference(): Promise<void> {
  try {
    await Preferences.remove({ key: 'listo_language_manual' });
  } catch {
    localStorage.removeItem('listo_language_manual');
  }
  // Re-detect from device
  await detectAndSetLanguage();
}

// Function to get current language
export function getCurrentLanguage(): Locale {
  const lang = i18n.language;
  if (locales.includes(lang as Locale)) {
    return lang as Locale;
  }
  const baseLang = lang.split('-')[0];
  if (locales.includes(baseLang as Locale)) {
    return baseLang as Locale;
  }
  return defaultLocale;
}

export default i18n;
