import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import MakeAListClient from './client';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'ListMango — One Line of Code, Infinite Shareable Lists',
    description:
      'Add a "Make it a List" button to any website with one line of code. Readers share lists from your content — every list links back to your site.',
    robots: { index: true, follow: true },
  };
}

export default async function MakeAListPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <MakeAListClient />;
}
