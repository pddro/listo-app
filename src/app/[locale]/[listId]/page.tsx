import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { supabase } from '@/lib/supabase';
import ListPageClient from './client';

type Props = {
  params: Promise<{ locale: string; listId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { listId } = await params;

  // Fetch list data including source info
  const { data: list } = await supabase
    .from('lists')
    .select('title, source_site_id, source_url')
    .eq('id', listId)
    .single();

  // Fetch item count
  const { count } = await supabase
    .from('items')
    .select('*', { count: 'exact', head: true })
    .eq('list_id', listId);

  const title = list?.title || 'Untitled List';
  const itemCount = count || 0;

  // Check if this is a branded list
  let siteName: string | null = null;
  if (list?.source_site_id) {
    const { data: site } = await supabase
      .from('embed_sites')
      .select('name')
      .eq('id', list.source_site_id)
      .single();
    siteName = site?.name || null;
  }

  const isBranded = !!siteName;
  const displayTitle = isBranded
    ? `${title} - from ${siteName} | List Mango`
    : `${title} - List Mango`;
  const description = isBranded
    ? `${itemCount} item${itemCount !== 1 ? 's' : ''} — ${title} from ${siteName}. Create and share lists instantly.`
    : `${itemCount} item${itemCount !== 1 ? 's' : ''} in this list. List Mango: Create and share lists instantly with real-time collaboration. No signup required.`;

  return {
    title: displayTitle,
    description,
    openGraph: {
      title: displayTitle,
      description,
    },
    robots: isBranded
      ? { index: true, follow: true, googleBot: { index: true, follow: true } }
      : {
          index: false,
          follow: false,
          googleBot: { index: false, follow: false },
        },
  };
}

export default async function ListPage({ params }: Props) {
  const { locale, listId } = await params;

  // Enable static rendering
  setRequestLocale(locale);

  return <ListPageClient listId={listId} />;
}
