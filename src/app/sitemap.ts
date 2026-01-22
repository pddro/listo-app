import { MetadataRoute } from 'next';
import { locales } from '@/i18n/config';

const baseUrl = 'https://listo.to';

export default function sitemap(): MetadataRoute.Sitemap {
  // Generate language alternates for each locale
  const languageAlternates = locales.reduce(
    (acc, locale) => {
      acc[locale] = `${baseUrl}/${locale}`;
      return acc;
    },
    {} as Record<string, string>
  );

  // Homepage for each locale
  const homepageEntries = locales.map((locale) => ({
    url: `${baseUrl}/${locale}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 1,
    alternates: {
      languages: languageAlternates,
    },
  }));

  // Root URL (redirects to default locale)
  const rootEntry = {
    url: baseUrl,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 1,
    alternates: {
      languages: languageAlternates,
    },
  };

  return [rootEntry, ...homepageEntries];
}
