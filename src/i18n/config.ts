// Supported locales
export const locales = ['en', 'es', 'fr', 'de', 'pt', 'ja', 'zh-Hans', 'zh-Hant', 'ko'] as const;
export type Locale = (typeof locales)[number];

// Default locale (fallback)
export const defaultLocale: Locale = 'en';

// RTL languages
export const rtlLocales: Locale[] = [];

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

// Helper to check if a locale is valid
export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}
