import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import WordPressClient from './client';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'ListMango for WordPress — Turn Readers Into Sharers',
    description:
      'Free WordPress plugin that adds a "Make it a List" button to your posts. Readers share lists from your content — every list links back to your site.',
    robots: { index: true, follow: true },
  };
}

export default async function WordPressPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <WordPressClient />;
}
