import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { locales, type Locale } from '@/i18n/config';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

// Map locale codes to OpenGraph locale format
const ogLocaleMap: Record<Locale, string> = {
  en: 'en_US',
  es: 'es_ES',
  fr: 'fr_FR',
  de: 'de_DE',
  pt: 'pt_BR',
  ja: 'ja_JP',
  'zh-Hans': 'zh_CN',
  'zh-Hant': 'zh_TW',
  ko: 'ko_KR',
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  if (!locales.includes(locale as Locale)) {
    return {};
  }

  const t = await getTranslations({ locale, namespace: 'templates.meta' });
  const baseUrl = 'https://listo.to';

  // Build language alternates
  const languages: Record<string, string> = {
    'x-default': `${baseUrl}/templates`,
  };
  for (const loc of locales) {
    languages[loc] = `${baseUrl}/${loc}/templates`;
  }

  return {
    title: t('title'),
    description: t('description'),
    openGraph: {
      type: 'website',
      locale: ogLocaleMap[locale as Locale] || 'en_US',
      alternateLocale: locales
        .filter((l) => l !== locale)
        .map((l) => ogLocaleMap[l]),
      url: `${baseUrl}/${locale}/templates`,
      siteName: 'Listo',
      title: t('ogTitle'),
      description: t('ogDescription'),
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: 'Listo Templates',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('ogTitle'),
      description: t('ogDescription'),
      images: ['/og-image.png'],
    },
    alternates: {
      canonical: `${baseUrl}/${locale}/templates`,
      languages,
    },
  };
}

export default function TemplatesLayout({ children }: Props) {
  return children;
}
