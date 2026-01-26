import { MetadataRoute } from 'next';
import { locales } from '@/i18n/config';
import { supabaseServer } from '@/lib/supabase-server';

const baseUrl = 'https://listo.to';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Generate language alternates for each locale
  const languageAlternates = locales.reduce(
    (acc, locale) => {
      acc[locale] = `${baseUrl}/${locale}`;
      return acc;
    },
    {} as Record<string, string>
  );

  // Generate templates language alternates
  const templatesAlternates = locales.reduce(
    (acc, locale) => {
      acc[locale] = `${baseUrl}/${locale}/templates`;
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

  // Templates page for each locale
  const templatesEntries = locales.map((locale) => ({
    url: `${baseUrl}/${locale}/templates`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.9,
    alternates: {
      languages: templatesAlternates,
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

  // Fetch all approved templates for individual pages
  const { data: templates } = await supabaseServer
    .from('lists')
    .select('id, language, translation_group_id, updated_at')
    .eq('is_template', true)
    .eq('status', 'approved');

  // Group templates by translation_group_id for alternates
  const translationGroups: Record<string, { id: string; language: string }[]> = {};
  const standaloneTemplates: { id: string; language: string; updated_at: string }[] = [];

  for (const t of templates || []) {
    if (t.translation_group_id) {
      if (!translationGroups[t.translation_group_id]) {
        translationGroups[t.translation_group_id] = [];
      }
      translationGroups[t.translation_group_id].push({ id: t.id, language: t.language });
    } else {
      standaloneTemplates.push({ id: t.id, language: t.language, updated_at: t.updated_at });
    }
  }

  // Create sitemap entries for each template
  const templatePageEntries: MetadataRoute.Sitemap = [];

  // Process grouped templates (with translations)
  for (const groupId of Object.keys(translationGroups)) {
    const group = translationGroups[groupId];

    // Build language alternates for this translation group
    const groupAlternates: Record<string, string> = {};
    for (const t of group) {
      groupAlternates[t.language] = `${baseUrl}/${t.language}/templates/${t.id}`;
      if (t.language === 'en') {
        groupAlternates['x-default'] = `${baseUrl}/en/templates/${t.id}`;
      }
    }

    // Add entry for each language version
    for (const t of group) {
      templatePageEntries.push({
        url: `${baseUrl}/${t.language}/templates/${t.id}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
        alternates: {
          languages: groupAlternates,
        },
      });
    }
  }

  // Process standalone templates (no translations)
  for (const t of standaloneTemplates) {
    templatePageEntries.push({
      url: `${baseUrl}/${t.language}/templates/${t.id}`,
      lastModified: new Date(t.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
      alternates: {
        languages: {
          [t.language]: `${baseUrl}/${t.language}/templates/${t.id}`,
          'x-default': `${baseUrl}/${t.language}/templates/${t.id}`,
        },
      },
    });
  }

  return [rootEntry, ...homepageEntries, ...templatesEntries, ...templatePageEntries];
}
