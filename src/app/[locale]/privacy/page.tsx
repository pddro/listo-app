'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function PrivacyPage() {
  const t = useTranslations('home');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 16px' }}>
      <div style={{ width: '100%', maxWidth: '672px' }}>
        {/* Card Container */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ backgroundColor: '#3B82F6', padding: '48px 40px', color: 'white' }}>
            <Link
              href="/"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.8)', marginBottom: '32px', fontSize: '14px', textDecoration: 'none' }}
            >
              <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Listo</span>
            </Link>
            <h1 style={{ fontSize: '30px', fontWeight: 'bold', marginBottom: '12px', letterSpacing: '-0.025em' }}>
              {t('privacy.title')}
            </h1>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>
              {t('privacy.lastUpdated')}
            </p>
          </div>

          {/* Content */}
          <div style={{ padding: '48px 40px' }}>
            {/* Introduction */}
            <div style={{ marginBottom: '48px' }}>
              <p style={{ lineHeight: '1.7', color: '#334155' }}>{t('privacy.content')}</p>
              <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '12px 16px', marginTop: '16px' }}>
                <p style={{ color: '#92400E', fontSize: '14px' }}>
                  {t('privacy.note')}
                </p>
              </div>
            </div>

            {/* Public Use Section */}
            <section style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#0F172A', marginBottom: '16px', letterSpacing: '-0.025em' }}>
                {t('privacy.sections.publicUse.title')}
              </h2>
              <p style={{ lineHeight: '1.7', color: '#475569' }}>
                {t('privacy.sections.publicUse.content')}
              </p>
            </section>

            {/* Data Collection Section */}
            <section style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#0F172A', marginBottom: '16px', letterSpacing: '-0.025em' }}>
                {t('privacy.sections.dataCollection.title')}
              </h2>
              <p style={{ lineHeight: '1.7', color: '#475569' }}>
                {t('privacy.sections.dataCollection.content')}
              </p>
            </section>

            {/* Analytics Section */}
            <section style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#0F172A', marginBottom: '16px', letterSpacing: '-0.025em' }}>
                {t('privacy.sections.analytics.title')}
              </h2>
              <p style={{ lineHeight: '1.7', color: '#475569' }}>
                {t('privacy.sections.analytics.content')}
              </p>
            </section>

            {/* Contact Section */}
            <section style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#0F172A', marginBottom: '16px', letterSpacing: '-0.025em' }}>
                {t('privacy.sections.contact.title')}
              </h2>
              <p style={{ lineHeight: '1.7', color: '#475569' }}>
                {t('privacy.sections.contact.content')}{' '}
                <a
                  href="mailto:hello@listmango.com"
                  style={{ color: '#3B82F6', fontWeight: '500' }}
                >
                  hello@listmango.com
                </a>
              </p>
            </section>

            {/* Changes Notice */}
            <section style={{ borderTop: '1px solid #E2E8F0', paddingTop: '32px' }}>
              <p style={{ fontSize: '14px', color: '#64748B', lineHeight: '1.7' }}>
                {t('privacy.sections.changes')}
              </p>
            </section>
          </div>

          {/* Footer */}
          <div style={{ padding: '32px 40px', backgroundColor: '#F8FAFC', borderTop: '1px solid #F1F5F9' }}>
            <Link
              href="/"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '12px 32px', backgroundColor: '#3B82F6', color: 'white', fontWeight: '500', borderRadius: '12px', textDecoration: 'none' }}
            >
              Back to Listo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
