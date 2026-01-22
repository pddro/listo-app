import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import { locales, type Locale, rtlLocales } from '@/i18n/config';
import type { Metadata } from 'next';
import '../globals.css';

// Map our locale codes to OpenGraph locale format
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

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

// Generate metadata with hreflang alternates and localized content
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  if (!locales.includes(locale as Locale)) {
    return {};
  }

  const t = await getTranslations({ locale, namespace: 'metadata' });
  const baseUrl = 'https://listo.to';

  // Build language alternates including x-default
  const languages: Record<string, string> = {
    'x-default': baseUrl, // Default for language negotiation
  };

  for (const loc of locales) {
    languages[loc] = `${baseUrl}/${loc}`;
  }

  return {
    metadataBase: new URL(baseUrl),
    title: t('title'),
    description: t('description'),
    keywords: [
      'shareable list',
      'collaborative checklist',
      'shared grocery list',
      'real-time todo list',
      'no signup list app',
      'instant list maker',
      'AI list generator',
      'shared shopping list',
      'collaborative task list',
      'free online checklist',
    ],
    authors: [{ name: 'Listo' }],
    creator: 'Listo',
    publisher: 'Listo',
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    openGraph: {
      type: 'website',
      locale: ogLocaleMap[locale as Locale] || 'en_US',
      alternateLocale: locales
        .filter((l) => l !== locale)
        .map((l) => ogLocaleMap[l]),
      url: `${baseUrl}/${locale}`,
      siteName: 'Listo',
      title: t('ogTitle'),
      description: t('ogDescription'),
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: 'Listo - Instant Shareable Lists',
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
      canonical: `${baseUrl}/${locale}`,
      languages,
    },
    category: 'Productivity',
  };
}

const GA_MEASUREMENT_ID = 'G-3N0JE969VW';

// JSON-LD structured data for rich search results
function getJsonLd(locale: Locale) {
  const localizedNames: Record<Locale, string> = {
    en: 'Listo - Instant Shareable Lists',
    es: 'Listo - Listas Compartibles al Instante',
    fr: 'Listo - Listes Partageables Instantanées',
    de: 'Listo - Sofort Teilbare Listen',
    pt: 'Listo - Listas Compartilháveis Instantâneas',
    ja: 'Listo - 瞬時に共有できるリスト',
    'zh-Hans': 'Listo - 即时可分享的清单',
    'zh-Hant': 'Listo - 即時可分享的清單',
    ko: 'Listo - 즉시 공유 가능한 리스트',
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: localizedNames[locale] || 'Listo',
    description:
      'Create and share lists in seconds. No signup, no app needed. Real-time collaboration, AI-powered item generation, and custom themes.',
    url: `https://listo.to/${locale}`,
    inLanguage: locale,
    applicationCategory: 'ProductivityApplication',
    operatingSystem: 'Any',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList: [
      'No signup required',
      'Real-time collaboration',
      'AI-powered list generation',
      'Voice dictation',
      'Custom AI-generated themes',
      'Instant URL sharing',
    ],
    screenshot: 'https://listo.to/og-image.png',
    availableLanguage: locales.map((loc) => ({
      '@type': 'Language',
      name: loc,
    })),
  };
}

// Font fallback - Google Fonts may be blocked in build environment
const inter = {
  className: 'font-sans',
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  // Validate that the locale is supported
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  // Get messages for the locale
  const messages = await getMessages();

  // Determine text direction
  const dir = rtlLocales.includes(locale as Locale) ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(getJsonLd(locale as Locale)),
          }}
        />
      </head>
      <body className={`${inter.className} antialiased`}>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
