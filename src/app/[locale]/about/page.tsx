import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import AboutClient from './client';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'About ListMango — The List Layer of the Internet',
    description:
      'ListMango turns any content into shareable checklists. No accounts, no downloads, no friction — just lists as easy as paper. Founded in 2026 by Pedro Wunderlich, creator of Apple\'s 2020 App of the Year.',
    openGraph: {
      title: 'About ListMango — The List Layer of the Internet',
      description:
        'ListMango turns any content into shareable checklists. No accounts, no downloads — just lists as easy as paper.',
      type: 'website',
      url: 'https://listmango.com/about',
    },
    robots: { index: true, follow: true },
    alternates: {
      canonical: 'https://listmango.com/about',
    },
  };
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <AboutClient />;
}
