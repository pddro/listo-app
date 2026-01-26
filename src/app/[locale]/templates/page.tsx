'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { Template, TemplateCategory, TEMPLATE_CATEGORIES } from '@/types';

// Category icons - unique icon for each template category
function CategoryIcon({ category, className }: { category: TemplateCategory; className?: string }) {
  const props = { className: className || 'w-5 h-5 text-white', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' };

  switch (category) {
    case 'travel':
      // Airplane
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      );
    case 'shopping':
      // Shopping bag
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      );
    case 'productivity':
      // Lightning bolt
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case 'cooking':
      // Chef hat / cooking
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
    case 'events':
      // Calendar
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case 'health':
      // Heart
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      );
    case 'home':
      // House
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      );
    case 'work':
      // Briefcase
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    case 'education':
      // Academic cap
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
        </svg>
      );
    case 'other':
    default:
      // Grid/dots
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      );
  }
}

export default function TemplatesPage() {
  const t = useTranslations('templates');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | null>(null);

  // Fetch templates
  useEffect(() => {
    async function fetchTemplates() {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          language: locale,
          limit: '50',
        });

        if (selectedCategory) {
          params.set('category', selectedCategory);
        }

        const response = await fetch(`/api/templates?${params.toString()}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch templates');
        }

        setTemplates(data.templates || []);
      } catch (err) {
        console.error('Fetch templates error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load templates');
      } finally {
        setIsLoading(false);
      }
    }

    fetchTemplates();
  }, [locale, selectedCategory]);

  return (
    <div
      className="min-h-screen flex flex-col items-center bg-white"
      style={{
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
        paddingRight: 'max(16px, env(safe-area-inset-right))',
        paddingTop: 'max(24px, env(safe-area-inset-top, 24px))',
        paddingBottom: 'max(32px, env(safe-area-inset-bottom))',
      }}
    >
      <div className="w-full max-w-md md:max-w-[540px]">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm mb-8 hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-muted)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {tCommon('backToHome')}
        </Link>

        {/* Title section */}
        <div className="text-center" style={{ marginBottom: '24px' }}>
          <h1 className="text-2xl font-bold uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--text-primary)' }}>
            {t('title')}
          </h1>
          <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
            {t('pageDescription')}
          </p>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap justify-center" style={{ gap: '8px', marginBottom: '32px' }}>
          <button
            onClick={() => setSelectedCategory(null)}
            className="rounded-full text-xs font-medium transition-all hover:opacity-90"
            style={{
              backgroundColor: selectedCategory === null ? 'var(--primary)' : 'var(--bg-hover)',
              color: selectedCategory === null ? 'white' : 'var(--text-secondary)',
              padding: '6px 12px',
            }}
          >
            {t('allCategories')}
          </button>
          {TEMPLATE_CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className="rounded-full text-xs font-medium transition-all capitalize hover:opacity-90"
              style={{
                backgroundColor: selectedCategory === category ? 'var(--primary)' : 'var(--bg-hover)',
                color: selectedCategory === category ? 'white' : 'var(--text-secondary)',
                padding: '6px 12px',
              }}
            >
              {t(`categories.${category}`)}
            </button>
          ))}
        </div>

        {/* Templates list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }}
            />
          </div>
        ) : error ? (
          <div
            className="rounded-2xl text-center"
            style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--error)', padding: '24px' }}
          >
            {error}
          </div>
        ) : templates.length === 0 ? (
          <div
            className="text-center rounded-2xl"
            style={{ color: 'var(--text-muted)', padding: '48px 24px', backgroundColor: 'var(--bg-hover)' }}
          >
            <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {t('noTemplates')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {templates.map((template) => {
              const primaryColor = template.theme?.primary || 'var(--primary)';
              const primaryPale = template.theme?.primaryPale || 'var(--primary-pale)';
              return (
                <div
                  key={template.id}
                  onClick={() => router.push(`/templates/${template.id}`)}
                  className="flex items-center rounded-2xl cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
                  style={{
                    border: '1px solid var(--border-light)',
                    backgroundColor: 'white',
                    padding: '16px',
                    gap: '16px',
                  }}
                >
                  {/* Theme color badge with category icon */}
                  <div
                    className="flex-shrink-0 rounded-xl flex items-center justify-center"
                    style={{
                      width: '60px',
                      height: '60px',
                      backgroundColor: primaryPale,
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <CategoryIcon category={template.template_category} />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-base truncate" style={{ color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {template.title}
                    </div>
                    {template.template_description && (
                      <div className="text-sm truncate" style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>
                        {template.template_description}
                      </div>
                    )}
                    <div className="flex items-center" style={{ gap: '8px' }}>
                      <span
                        className="text-xs rounded-full font-medium capitalize"
                        style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', padding: '6px 12px' }}
                      >
                        {t(`categories.${template.template_category}`)}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {template.use_count.toLocaleString()} {t('usedTimes')}
                      </span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <svg className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
