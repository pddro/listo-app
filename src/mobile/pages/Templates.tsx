import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Device } from '@capacitor/device';
import { supabase } from '@/lib/supabase';
import { Template, TemplateCategory, TEMPLATE_CATEGORIES } from '@/types';
import { SwipeBackLayout } from '@/mobile/components/SwipeBackLayout';

// Category icons
function CategoryIcon({ category, className }: { category: TemplateCategory; className?: string }) {
  const props = { className: className || 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' };

  switch (category) {
    case 'travel':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      );
    case 'shopping':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      );
    case 'productivity':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case 'cooking':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
    case 'events':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case 'health':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      );
    case 'home':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      );
    case 'work':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    case 'education':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      );
  }
}

export default function TemplatesPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | null>(null);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'web'>('web');

  // Detect platform
  useEffect(() => {
    Device.getInfo().then(info => {
      setPlatform(info.platform as 'ios' | 'android' | 'web');
    });
  }, []);

  // Fetch community templates
  useEffect(() => {
    async function fetchTemplates() {
      setIsLoading(true);
      try {
        let query = supabase
          .from('lists')
          .select('*')
          .eq('is_template', true)
          .eq('status', 'approved')
          .eq('language', i18n.language)
          .order('use_count', { ascending: false })
          .limit(50);

        if (selectedCategory) {
          query = query.eq('template_category', selectedCategory);
        }

        const { data, error } = await query;

        if (error) throw error;

        setTemplates((data || []).map(row => ({
          id: row.id,
          title: row.title,
          template_description: row.template_description,
          template_category: row.template_category,
          language: row.language,
          translation_group_id: row.translation_group_id,
          theme: row.theme,
          use_count: row.use_count || 0,
          is_official: row.is_official,
          status: row.status,
          created_at: row.created_at,
          updated_at: row.updated_at,
          is_template: true,
          large_mode: row.large_mode,
          emojify_mode: row.emojify_mode,
        })));
      } catch (err) {
        console.error('Failed to fetch templates:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTemplates();
  }, [i18n.language, selectedCategory]);

  const safeAreaTop = platform === 'android' ? '36px' : 'env(safe-area-inset-top, 0px)';
  const safeAreaBottom = platform === 'android' ? '24px' : 'env(safe-area-inset-bottom, 0px)';

  return (
    <SwipeBackLayout>
      <div
        className="flex flex-col"
        style={{
          backgroundColor: 'var(--bg-primary)',
          paddingTop: safeAreaTop,
          height: '100dvh',
          minHeight: '100vh',
        }}
      >
        {/* Header */}
        <div className="flex-shrink-0" style={{ padding: '16px 20px 0 20px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1 active:opacity-60"
              style={{ color: 'var(--primary)' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {t('common.back')}
            </button>
          </div>

          <h1
            className="text-xl font-bold uppercase tracking-[0.15em]"
            style={{ color: 'var(--text-primary)', marginBottom: '8px' }}
          >
            {t('templates.title')}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginBottom: '20px' }}>
            {t('templates.pageDescription')}
          </p>

          {/* Category filter */}
          <div
            className="flex overflow-x-auto hide-scrollbar"
            style={{ gap: '8px', marginBottom: '16px', paddingBottom: '4px' }}
          >
            <button
              onClick={() => setSelectedCategory(null)}
              className="flex-shrink-0 rounded-full text-sm font-medium transition-all active:scale-95"
              style={{
                backgroundColor: selectedCategory === null ? 'var(--primary)' : 'var(--bg-hover)',
                color: selectedCategory === null ? 'white' : 'var(--text-secondary)',
                padding: '8px 16px',
              }}
            >
              {t('templates.allCategories')}
            </button>
            {TEMPLATE_CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className="flex-shrink-0 rounded-full text-sm font-medium capitalize transition-all active:scale-95"
                style={{
                  backgroundColor: selectedCategory === category ? 'var(--primary)' : 'var(--bg-hover)',
                  color: selectedCategory === category ? 'white' : 'var(--text-secondary)',
                  padding: '8px 16px',
                }}
              >
                {t(`templates.categories.${category}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Templates list */}
        <div
          className="flex-1 min-h-0"
          style={{
            paddingLeft: '20px',
            paddingRight: '20px',
            paddingBottom: `calc(40px + ${safeAreaBottom})`,
            overflowY: 'scroll',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center" style={{ paddingTop: '60px' }}>
              <div
                className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }}
              />
            </div>
          ) : templates.length === 0 ? (
            <div
              className="text-center rounded-2xl"
              style={{ color: 'var(--text-muted)', padding: '48px 24px', backgroundColor: 'var(--bg-hover)', marginTop: '20px' }}
            >
              {t('templates.noTemplates')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {templates.map((template) => {
                const primaryColor = template.theme?.primary || 'var(--primary)';
                const primaryPale = template.theme?.primaryPale || 'var(--primary-pale)';

                return (
                  <button
                    key={template.id}
                    onClick={() => navigate(`/templates/${template.id}`)}
                    className="flex items-center rounded-2xl transition-all active:scale-[0.98] text-left"
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
                        width: '56px',
                        height: '56px',
                        backgroundColor: primaryPale,
                      }}
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: primaryColor, color: 'white' }}
                      >
                        <CategoryIcon category={template.template_category} />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div
                        className="font-semibold truncate"
                        style={{ color: 'var(--text-primary)', fontSize: '17px', marginBottom: '4px' }}
                      >
                        {template.title}
                      </div>
                      {template.template_description && (
                        <div
                          className="text-sm truncate"
                          style={{ color: 'var(--text-muted)', marginBottom: '8px' }}
                        >
                          {template.template_description}
                        </div>
                      )}
                      <div className="flex items-center" style={{ gap: '8px' }}>
                        <span
                          className="text-xs rounded-full font-medium capitalize"
                          style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', padding: '4px 10px' }}
                        >
                          {t(`templates.categories.${template.template_category}`)}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {template.use_count.toLocaleString()} {t('templates.usedTimes')}
                        </span>
                      </div>
                    </div>

                    {/* Arrow */}
                    <svg
                      className="w-5 h-5 flex-shrink-0"
                      style={{ color: 'var(--text-muted)' }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SwipeBackLayout>
  );
}
