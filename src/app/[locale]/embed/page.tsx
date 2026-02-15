import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import EmbedClient from './client';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Embed List Mango - Turn Any Page Into a Shareable List',
    description:
      'Add a "Make a Mango" button to your website. Let readers convert your content into shareable, branded checklists.',
    robots: { index: true, follow: true },
  };
}

export default async function EmbedPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <EmbedClient />;
}
