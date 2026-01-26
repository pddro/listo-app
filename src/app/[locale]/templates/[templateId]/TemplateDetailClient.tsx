'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { TemplateWithItems } from '@/types';
import { useRecentListsWeb } from '@/lib/hooks/useRecentListsWeb';

interface Props {
  template: TemplateWithItems;
}

export default function TemplateDetailClient({ template }: Props) {
  const t = useTranslations('templates');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [isUsing, setIsUsing] = useState(false);
  const { addList } = useRecentListsWeb();

  const handleUseTemplate = async () => {
    if (isUsing) return;

    setIsUsing(true);
    try {
      const response = await fetch(`/api/templates/${template.id}/use`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to use template');
      }

      // Save to local storage so it appears in recent lists
      addList(data.list_id, template.title, template.theme?.primary || null);

      router.push(`/${data.list_id}`);
    } catch (err) {
      console.error('Use template error:', err);
      setIsUsing(false);
    }
  };

  const primaryColor = template.theme?.primary || 'var(--primary)';
  const primaryPale = template.theme?.primaryPale || 'var(--primary-pale)';
  const bgSecondary = template.theme?.bgSecondary || primaryPale;

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
          href="/templates"
          className="inline-flex items-center text-sm hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-muted)', gap: '6px', marginBottom: '24px', display: 'inline-flex' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t('backToTemplates')}
        </Link>

        {/* Hero section with template info */}
        <div
          className="rounded-2xl"
          style={{ backgroundColor: primaryPale, padding: '24px', marginBottom: '32px' }}
        >
          {/* Title */}
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)', marginBottom: '12px' }}>
            {template.title}
          </h1>

          {/* Description */}
          {template.template_description && (
            <p className="text-base" style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
              {template.template_description}
            </p>
          )}

          {/* Meta tags - centered */}
          <div className="flex flex-wrap justify-center" style={{ gap: '8px', marginBottom: '20px' }}>
            <span
              className="rounded-full text-xs font-medium capitalize"
              style={{ backgroundColor: 'white', color: 'var(--text-secondary)', padding: '6px 12px' }}
            >
              {t(`categories.${template.template_category}`)}
            </span>
            <span
              className="rounded-full text-xs"
              style={{ backgroundColor: 'white', color: 'var(--text-muted)', padding: '6px 12px' }}
            >
              {template.use_count.toLocaleString()} {t('usedTimes')}
            </span>
            {template.is_official && (
              <span
                className="rounded-full text-xs font-medium"
                style={{ backgroundColor: primaryColor, color: 'white', padding: '6px 12px' }}
              >
                ✓ Official
              </span>
            )}
          </div>

          {/* Primary CTA button */}
          <button
            onClick={handleUseTemplate}
            disabled={isUsing}
            className="w-full rounded-xl font-medium text-white transition-all disabled:opacity-70 hover:opacity-90 active:scale-[0.98]"
            style={{ backgroundColor: primaryColor, padding: '12px 20px' }}
          >
            {isUsing ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {tCommon('loading')}
              </span>
            ) : (
              <span className="inline-flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t('useTemplate')}
              </span>
            )}
          </button>

          <p className="text-center text-sm" style={{ color: 'var(--text-muted)', marginTop: '12px' }}>
            A copy will be created for you to customize
          </p>
        </div>

        {/* Preview section */}
        <div>
          <div
            className="font-bold uppercase tracking-wide text-xs"
            style={{ color: 'var(--text-muted)', marginBottom: '16px' }}
          >
            {t('preview')}
          </div>
          <div
            className="rounded-2xl"
            style={{ backgroundColor: bgSecondary, padding: '16px' }}
          >
            {template.items.length === 0 ? (
              <p className="text-center" style={{ color: 'var(--text-muted)', padding: '32px 0' }}>
                No items
              </p>
            ) : (
              <div>
                {template.items.map((item) => {
                  const isHeader = item.content.startsWith('#');
                  const depth = item.parent_id ? 1 : 0;

                  if (isHeader) {
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 rounded-lg"
                        style={{
                          paddingLeft: `${depth * 24}px`,
                          paddingTop: '8px',
                          paddingBottom: '4px',
                          marginTop: '12px',
                        }}
                      >
                        <div
                          className="w-5 h-5 flex items-center justify-center font-bold text-sm"
                          style={{ color: 'var(--primary)' }}
                        >
                          #
                        </div>
                        <span
                          className="flex-1 font-semibold uppercase tracking-wide text-sm"
                          style={{ color: 'var(--primary)' }}
                        >
                          {item.content.slice(1).trim()}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-lg item-hover"
                      style={{
                        paddingLeft: `${depth * 24}px`,
                        paddingTop: '2px',
                        paddingBottom: '2px',
                      }}
                    >
                      <div
                        className="w-5 h-5 rounded-md border-2 flex-shrink-0"
                        style={{ borderColor: 'var(--border-medium)' }}
                      />
                      <span style={{ color: 'var(--text-primary)' }}>
                        {item.content}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
