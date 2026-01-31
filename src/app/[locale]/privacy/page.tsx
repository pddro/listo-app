'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function PrivacyPage() {
  const t = useTranslations('home');

  return (
    <div className="min-h-screen bg-[var(--bg-primary,#FAFAFA)]">
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[var(--text-secondary,#6B7280)] hover:text-[var(--text-primary,#1F2937)] transition-colors mb-6"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Listo</span>
          </Link>
          <h1 className="text-3xl font-bold text-[var(--text-primary,#1F2937)] mb-2">
            {t('privacy.title')}
          </h1>
          <p className="text-sm text-[var(--text-secondary,#6B7280)]">
            {t('privacy.lastUpdated')}
          </p>
        </div>

        {/* Content */}
        <div className="space-y-8 text-[var(--text-primary,#1F2937)]">
          {/* Introduction */}
          <div className="space-y-4">
            <p className="leading-relaxed">{t('privacy.content')}</p>
            <p className="text-[var(--text-secondary,#6B7280)] italic">
              {t('privacy.note')}
            </p>
          </div>

          {/* Public Use Section */}
          <section>
            <h2 className="text-xl font-semibold mb-3">
              {t('privacy.sections.publicUse.title')}
            </h2>
            <p className="leading-relaxed text-[var(--text-secondary,#374151)]">
              {t('privacy.sections.publicUse.content')}
            </p>
          </section>

          {/* Data Collection Section */}
          <section>
            <h2 className="text-xl font-semibold mb-3">
              {t('privacy.sections.dataCollection.title')}
            </h2>
            <p className="leading-relaxed text-[var(--text-secondary,#374151)]">
              {t('privacy.sections.dataCollection.content')}
            </p>
          </section>

          {/* Analytics Section */}
          <section>
            <h2 className="text-xl font-semibold mb-3">
              {t('privacy.sections.analytics.title')}
            </h2>
            <p className="leading-relaxed text-[var(--text-secondary,#374151)]">
              {t('privacy.sections.analytics.content')}
            </p>
          </section>

          {/* Contact Section */}
          <section>
            <h2 className="text-xl font-semibold mb-3">
              {t('privacy.sections.contact.title')}
            </h2>
            <p className="leading-relaxed text-[var(--text-secondary,#374151)]">
              {t('privacy.sections.contact.content')}{' '}
              <a
                href="mailto:pedro@listo.to"
                className="text-[var(--primary,#3B82F6)] hover:underline"
              >
                pedro@listo.to
              </a>
            </p>
          </section>

          {/* Changes Notice */}
          <section className="border-t border-[var(--border-light,#E5E7EB)] pt-6">
            <p className="text-sm text-[var(--text-secondary,#6B7280)] leading-relaxed">
              {t('privacy.sections.changes')}
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-[var(--border-light,#E5E7EB)]">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 bg-[var(--primary,#3B82F6)] text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            Back to Listo
          </Link>
        </div>
      </div>
    </div>
  );
}
