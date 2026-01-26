import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase-server';
import { locales, type Locale } from '@/i18n/config';
import { TemplateWithItems } from '@/types';
import TemplateDetailClient from './TemplateDetailClient';

const baseUrl = 'https://listo.to';

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

type Props = {
  params: Promise<{ locale: string; templateId: string }>;
};

// Fetch template with items
async function getTemplate(templateId: string): Promise<TemplateWithItems | null> {
  const { data: template, error: templateError } = await supabaseServer
    .from('lists')
    .select('*')
    .eq('id', templateId)
    .eq('is_template', true)
    .eq('status', 'approved')
    .single();

  if (templateError || !template) {
    return null;
  }

  const { data: items } = await supabaseServer
    .from('items')
    .select('*')
    .eq('list_id', templateId)
    .order('position', { ascending: true });

  return {
    id: template.id,
    title: template.title,
    template_description: template.template_description,
    template_category: template.template_category,
    language: template.language,
    translation_group_id: template.translation_group_id,
    theme: template.theme,
    use_count: template.use_count || 0,
    is_official: template.is_official,
    status: template.status,
    created_at: template.created_at,
    updated_at: template.updated_at,
    is_template: true as const,
    large_mode: template.large_mode,
    emojify_mode: template.emojify_mode,
    items: items || [],
  };
}

// Get all translations of a template for hreflang
async function getTranslationAlternates(
  translationGroupId: string | null | undefined,
  currentTemplateId: string,
  currentLocale: string
): Promise<Record<string, string>> {
  const languages: Record<string, string> = {
    'x-default': `${baseUrl}/en/templates/${currentTemplateId}`,
    [currentLocale]: `${baseUrl}/${currentLocale}/templates/${currentTemplateId}`,
  };

  if (!translationGroupId) {
    return languages;
  }

  // Fetch all templates in the same translation group
  const { data: translations } = await supabaseServer
    .from('lists')
    .select('id, language')
    .eq('translation_group_id', translationGroupId)
    .eq('is_template', true)
    .eq('status', 'approved');

  if (translations) {
    for (const t of translations) {
      languages[t.language] = `${baseUrl}/${t.language}/templates/${t.id}`;
      if (t.language === 'en') {
        languages['x-default'] = `${baseUrl}/en/templates/${t.id}`;
      }
    }
  }

  return languages;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, templateId } = await params;

  if (!locales.includes(locale as Locale)) {
    return {};
  }

  const template = await getTemplate(templateId);

  if (!template) {
    return {
      title: 'Template Not Found | Listo',
      robots: { index: false },
    };
  }

  const title = `${template.title} | Free Template | Listo`;
  const description =
    template.template_description ||
    `Use this free ${template.template_category} checklist template. ${template.items.length} items to help you stay organized.`;

  // Get language alternates
  const languages = await getTranslationAlternates(
    template.translation_group_id,
    template.id,
    locale
  );

  return {
    title,
    description,
    keywords: [
      template.title,
      'checklist',
      'template',
      template.template_category,
      'free template',
      'listo',
    ],
    openGraph: {
      type: 'article',
      locale: ogLocaleMap[locale as Locale] || 'en_US',
      alternateLocale: locales
        .filter((l) => l !== locale)
        .map((l) => ogLocaleMap[l]),
      url: `${baseUrl}/${locale}/templates/${templateId}`,
      siteName: 'Listo',
      title: template.title,
      description,
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: template.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: template.title,
      description,
      images: ['/og-image.png'],
    },
    alternates: {
      canonical: `${baseUrl}/${locale}/templates/${templateId}`,
      languages,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
      },
    },
  };
}

// Generate JSON-LD structured data for the template
function generateJsonLd(template: TemplateWithItems, locale: string) {
  // Filter out category headers for the HowTo steps
  const steps = template.items
    .filter((item) => !item.content.startsWith('#'))
    .map((item, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      text: item.content,
    }));

  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: template.title,
    description:
      template.template_description ||
      `A ${template.template_category} checklist template with ${template.items.length} items.`,
    step: steps,
    totalTime: `PT${Math.ceil(template.items.length * 2)}M`, // Estimate 2 min per item
    inLanguage: locale,
    isAccessibleForFree: true,
    author: {
      '@type': 'Organization',
      name: 'Listo',
      url: baseUrl,
    },
    aggregateRating:
      template.use_count > 10
        ? {
            '@type': 'AggregateRating',
            ratingValue: '4.8',
            reviewCount: template.use_count,
          }
        : undefined,
  };
}

export default async function TemplateDetailPage({ params }: Props) {
  const { locale, templateId } = await params;

  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  const template = await getTemplate(templateId);

  if (!template) {
    notFound();
  }

  const jsonLd = generateJsonLd(template, locale);

  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Client component for interactivity */}
      <TemplateDetailClient template={template} />
    </>
  );
}
