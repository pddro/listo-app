'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { locales, localeNames, type Locale } from '@/i18n/config';

interface LanguageSwitcherProps {
  className?: string;
}

export function LanguageSwitcher({ className = '' }: LanguageSwitcherProps) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (newLocale: Locale) => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      {locales.map((loc) => (
        <button
          key={loc}
          onClick={() => handleChange(loc)}
          className={`
            text-xs px-2 py-1 rounded transition-all duration-200
            ${locale === loc
              ? 'font-medium'
              : 'opacity-60 hover:opacity-100'
            }
          `}
          style={{
            color: locale === loc ? 'var(--primary)' : 'var(--text-muted)',
            backgroundColor: locale === loc ? 'var(--primary-pale)' : 'transparent',
          }}
          title={localeNames[loc].name}
        >
          {localeNames[loc].flag} {loc.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// Compact version - just shows current language with dropdown
export function LanguageSwitcherCompact({ className = '' }: LanguageSwitcherProps) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.replace(pathname, { locale: e.target.value as Locale });
  };

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <span className="text-sm">{localeNames[locale].flag}</span>
      <select
        value={locale}
        onChange={handleChange}
        className="text-xs bg-transparent border-none outline-none cursor-pointer appearance-none pr-4"
        style={{ color: 'var(--text-muted)' }}
      >
        {locales.map((loc) => (
          <option key={loc} value={loc}>
            {localeNames[loc].nativeName}
          </option>
        ))}
      </select>
      <svg
        className="w-3 h-3 -ml-3 pointer-events-none"
        style={{ color: 'var(--text-muted)' }}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}
