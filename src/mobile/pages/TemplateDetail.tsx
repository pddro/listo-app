import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Device } from '@capacitor/device';
import { supabase } from '@/lib/supabase';
import { generateListId } from '@/lib/utils/generateId';
import { TemplateWithItems, Item } from '@/types';
import { useRecentLists } from '@/lib/hooks/useRecentLists';
import { SwipeBackLayout } from '@/mobile/components/SwipeBackLayout';
import { useAppState } from '@/mobile/context/AppStateContext';
import { analytics } from '@/lib/analytics';
import { ThemeColors } from '@/lib/gemini';

// Default theme values (matches globals.css)
const DEFAULT_THEME: ThemeColors = {
  primary: '#47A1FF',
  primaryDark: '#2B8AE8',
  primaryLight: '#7DBEFF',
  primaryPale: '#E8F4FF',
  primaryGlow: 'rgba(71, 161, 255, 0.3)',
  textPrimary: '#1F2937',
  textSecondary: '#4B5563',
  textMuted: '#6B7280',
  textPlaceholder: '#9CA3AF',
  bgPrimary: '#FFFFFF',
  bgSecondary: '#F9FAFB',
  bgHover: '#F3F4F6',
  borderLight: '#E5E7EB',
  borderMedium: '#D1D5DB',
  error: '#EF4444',
};

// Apply theme to CSS variables
function applyThemeToRoot(theme: ThemeColors) {
  const root = document.documentElement;
  root.style.setProperty('--primary', theme.primary);
  root.style.setProperty('--primary-dark', theme.primaryDark);
  root.style.setProperty('--primary-light', theme.primaryLight);
  root.style.setProperty('--primary-pale', theme.primaryPale);
  root.style.setProperty('--primary-glow', theme.primaryGlow);
  root.style.setProperty('--text-primary', theme.textPrimary);
  root.style.setProperty('--text-secondary', theme.textSecondary);
  root.style.setProperty('--text-muted', theme.textMuted);
  root.style.setProperty('--text-placeholder', theme.textPlaceholder);
  root.style.setProperty('--bg-primary', theme.bgPrimary);
  root.style.setProperty('--bg-secondary', theme.bgSecondary);
  root.style.setProperty('--bg-hover', theme.bgHover);
  root.style.setProperty('--border-light', theme.borderLight);
  root.style.setProperty('--border-medium', theme.borderMedium);
  root.style.setProperty('--error', theme.error);
}

// Read-only preview item component that matches ListItem styling exactly
// Mirrors the exact structure from src/components/ListItem.tsx
function PreviewItem({ item, depth, theme }: { item: Item; depth: number; theme: ThemeColors }) {
  // Strip numbered list prefix (e.g., "1. ", "12. ") if present
  const strippedContent = item.content.replace(/^\d+\.\s*/, '');

  const isHeader = strippedContent.startsWith('#');
  const isNote = strippedContent.toLowerCase().startsWith('note:');
  const displayContent = isHeader
    ? strippedContent.slice(1).trim()
    : isNote
      ? strippedContent.slice(5).trim()
      : strippedContent;

  // Header items - matches ListItem header rendering exactly
  if (isHeader) {
    return (
      <div className="flex items-center gap-3 rounded-lg">
        <div
          className="flex items-center gap-3 flex-1"
          style={{
            paddingLeft: `${depth * 24}px`,
            paddingTop: '12px',
            paddingBottom: '8px',
            marginTop: depth === 0 ? '12px' : '0',
          }}
        >
          {/* Header icon - hashtag */}
          <div
            className="w-7 h-7 text-base flex items-center justify-center font-bold"
            style={{ color: theme.primary }}
          >
            #
          </div>
          {/* Header content */}
          <span
            className="flex-1 font-semibold uppercase tracking-wide text-sm"
            style={{ color: theme.primary }}
          >
            {displayContent}
          </span>
        </div>
      </div>
    );
  }

  // Note items - matches ListItem note rendering exactly
  if (isNote) {
    return (
      <div className="flex items-center gap-3 rounded-lg">
        <div
          className="flex items-start gap-3 flex-1"
          style={{
            paddingLeft: `${depth * 24}px`,
            paddingTop: '10px',
            paddingBottom: '10px',
          }}
        >
          {/* Note icon */}
          <div
            className="w-7 h-7 flex items-center justify-center"
            style={{ color: theme.textMuted }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          {/* Note content */}
          <span
            className="flex-1 italic text-sm"
            style={{ color: theme.textSecondary, whiteSpace: 'pre-wrap' }}
          >
            {displayContent}
          </span>
        </div>
      </div>
    );
  }

  // Regular items - matches ListItem regular item rendering exactly
  return (
    <div className="flex items-center gap-3 rounded-lg">
      <div
        className="flex items-center gap-3 flex-1"
        style={{
          paddingLeft: `${depth * 24}px`,
          paddingTop: '8px',
          paddingBottom: '8px',
        }}
      >
        {/* Checkbox (unchecked, read-only) */}
        <div
          className="w-7 h-7 rounded-md border-2 flex-shrink-0 flex items-center justify-center"
          style={{ borderColor: theme.borderMedium }}
        />
        {/* Content */}
        <span
          className="flex-1"
          style={{ color: theme.textPrimary }}
        >
          {displayContent}
        </span>
      </div>
    </div>
  );
}

export default function TemplateDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { templateId } = useParams<{ templateId: string }>();
  const [template, setTemplate] = useState<TemplateWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsing, setIsUsing] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'web'>('web');
  const { addList } = useRecentLists();
  const { homeTheme } = useAppState();

  // Detect platform
  useEffect(() => {
    Device.getInfo().then(info => {
      setPlatform(info.platform as 'ios' | 'android' | 'web');
    });
  }, []);

  // Reset to default theme on mount, restore home theme on unmount
  useEffect(() => {
    applyThemeToRoot(DEFAULT_THEME);
    return () => {
      if (homeTheme) {
        applyThemeToRoot(homeTheme as ThemeColors);
      }
    };
  }, [homeTheme]);

  // Fetch template details
  useEffect(() => {
    async function fetchTemplate() {
      if (!templateId) return;

      setIsLoading(true);
      try {
        // Fetch template
        const { data: templateData, error: templateError } = await supabase
          .from('lists')
          .select('*')
          .eq('id', templateId)
          .eq('is_template', true)
          .eq('status', 'approved')
          .single();

        if (templateError || !templateData) {
          throw new Error('Template not found');
        }

        // Fetch items
        const { data: items, error: itemsError } = await supabase
          .from('items')
          .select('*')
          .eq('list_id', templateId)
          .order('position', { ascending: true });

        if (itemsError) throw itemsError;

        setTemplate({
          id: templateData.id,
          title: templateData.title,
          template_description: templateData.template_description,
          template_category: templateData.template_category,
          language: templateData.language,
          translation_group_id: templateData.translation_group_id,
          theme: templateData.theme,
          use_count: templateData.use_count || 0,
          is_official: templateData.is_official,
          status: templateData.status,
          created_at: templateData.created_at,
          updated_at: templateData.updated_at,
          is_template: true,
          large_mode: templateData.large_mode,
          emojify_mode: templateData.emojify_mode,
          items: items || [],
        });
      } catch (err) {
        console.error('Failed to fetch template:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTemplate();
  }, [templateId]);

  const handleUseTemplate = async () => {
    if (isUsing || !template) return;

    setIsUsing(true);
    try {
      const newListId = generateListId();

      // Create new list from template
      const { error: listError } = await supabase
        .from('lists')
        .insert({
          id: newListId,
          title: template.title,
          theme: template.theme,
        });

      if (listError) throw listError;

      // Copy items (all unchecked)
      if (template.items.length > 0) {
        const idMapping: Record<string, string> = {};

        // Create ID mappings
        template.items.forEach((item) => {
          idMapping[item.id] = crypto.randomUUID();
        });

        // Insert items with new IDs
        const newItems = template.items.map((item) => ({
          id: idMapping[item.id],
          list_id: newListId,
          content: item.content,
          completed: false,
          parent_id: item.parent_id ? idMapping[item.parent_id] : null,
          position: item.position,
        }));

        const { error: itemsError } = await supabase
          .from('items')
          .insert(newItems);

        if (itemsError) throw itemsError;
      }

      // Increment use count (silently fail if RPC doesn't exist)
      try {
        await supabase.rpc('increment_template_use_count', { template_id: template.id });
      } catch {
        // RPC might not exist
      }

      // Add to recent lists
      addList(newListId, template.title, template.theme?.bgPrimary || null, template.theme?.primary || null);

      // Track analytics
      analytics.templateUsed(template.id, template.template_category);

      // Navigate to new list
      navigate(`/${newListId}`);
    } catch (err) {
      console.error('Failed to use template:', err);
      setIsUsing(false);
    }
  };

  const safeAreaTop = platform === 'android' ? '36px' : 'env(safe-area-inset-top, 0px)';
  const safeAreaBottom = platform === 'android' ? '24px' : 'env(safe-area-inset-bottom, 0px)';

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: '100vh', backgroundColor: 'var(--bg-primary)' }}
      >
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  if (!template) {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{ height: '100vh', backgroundColor: 'var(--bg-primary)', padding: '20px' }}
      >
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)', marginBottom: '12px' }}>
          {t('templates.notFound')}
        </h1>
        <button
          onClick={() => navigate('/templates')}
          className="text-white rounded-xl font-medium"
          style={{ backgroundColor: 'var(--primary)', padding: '12px 24px' }}
        >
          {t('templates.backToTemplates')}
        </button>
      </div>
    );
  }

  // Use template theme or default
  const previewTheme: ThemeColors = template.theme || DEFAULT_THEME;
  const primaryColor = previewTheme.primary;
  const primaryPale = previewTheme.primaryPale;

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
          <button
            onClick={() => navigate('/templates')}
            className="flex items-center gap-1 active:opacity-60"
            style={{ color: 'var(--primary)', marginBottom: '20px' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('templates.backToTemplates')}
          </button>
        </div>

        {/* Content */}
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
          {/* Hero section - uses hardcoded dark colors for guaranteed contrast on pale backgrounds */}
          <div
            className="rounded-2xl"
            style={{ backgroundColor: primaryPale, padding: '24px', marginBottom: '24px' }}
          >
            <h1 className="text-2xl font-bold" style={{ color: '#1f2937', marginBottom: '12px' }}>
              {template.title}
            </h1>

            {template.template_description && (
              <p style={{ color: '#4b5563', fontSize: '16px', marginBottom: '20px' }}>
                {template.template_description}
              </p>
            )}

            {/* Meta tags */}
            <div className="flex flex-wrap" style={{ gap: '8px', marginBottom: '20px' }}>
              <span
                className="rounded-full text-xs font-medium capitalize"
                style={{ backgroundColor: 'white', color: '#4b5563', padding: '6px 12px' }}
              >
                {t(`templates.categories.${template.template_category}`)}
              </span>
              <span
                className="rounded-full text-xs"
                style={{ backgroundColor: 'white', color: '#6b7280', padding: '6px 12px' }}
              >
                {template.use_count.toLocaleString()} {t('templates.usedTimes')}
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

            {/* Use template button */}
            <button
              onClick={handleUseTemplate}
              disabled={isUsing}
              className="w-full rounded-xl font-semibold text-white transition-all disabled:opacity-70 active:scale-[0.98]"
              style={{ backgroundColor: primaryColor, padding: '16px', fontSize: '17px' }}
            >
              {isUsing ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('common.loading')}
                </span>
              ) : (
                <span className="inline-flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t('templates.useTemplate')}
                </span>
              )}
            </button>

            <p className="text-center text-sm" style={{ color: '#6b7280', marginTop: '12px' }}>
              {t('templates.copyNote')}
            </p>
          </div>

          {/* Preview section - uses template's full theme */}
          <div>
            <div
              className="font-bold uppercase tracking-wide text-xs"
              style={{ color: 'var(--text-muted)', marginBottom: '12px' }}
            >
              {t('templates.preview')}
            </div>
            <div
              className="rounded-2xl"
              style={{
                backgroundColor: previewTheme.bgPrimary,
                padding: '8px 16px',
                border: `1px solid ${previewTheme.borderLight}`,
              }}
            >
              {template.items.length === 0 ? (
                <p className="text-center" style={{ color: previewTheme.textMuted, padding: '32px 0' }}>
                  {t('templates.noItems')}
                </p>
              ) : (
                <div className="space-y-0" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {template.items.map((item) => {
                    const depth = item.parent_id ? 1 : 0;
                    return (
                      <PreviewItem
                        key={item.id}
                        item={item}
                        depth={depth}
                        theme={previewTheme}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </SwipeBackLayout>
  );
}
