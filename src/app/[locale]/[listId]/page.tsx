import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { supabase } from '@/lib/supabase';
import ListPageClient from './client';

type Props = {
  params: Promise<{ locale: string; listId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { listId } = await params;

  // Fetch list data
  const { data: list } = await supabase
    .from('lists')
    .select('title')
    .eq('id', listId)
    .single();

  // Fetch item count
  const { count } = await supabase
    .from('items')
    .select('*', { count: 'exact', head: true })
    .eq('list_id', listId);

  const title = list?.title || 'Untitled List';
  const itemCount = count || 0;

  return {
    title: `${title} - Listo`,
    description: `${itemCount} item${itemCount !== 1 ? 's' : ''} in this list. Listo: Create and share lists instantly with real-time collaboration. No signup required.`,
    openGraph: {
      title: `${title} - Listo`,
      description: `${itemCount} item${itemCount !== 1 ? 's' : ''} in this list. Create and share lists instantly.`,
    },
  };
}

export default async function ListPage({ params }: Props) {
  const { locale, listId } = await params;

  // Enable static rendering
  setRequestLocale(locale);

  return <ListPageClient listId={listId} />;
}
