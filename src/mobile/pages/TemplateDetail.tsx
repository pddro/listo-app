import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Device } from '@capacitor/device';
import { supabase } from '@/lib/supabase';
import { generateListId } from '@/lib/utils/generateId';
import { TemplateWithItems } from '@/types';
import { useRecentLists } from '@/lib/hooks/useRecentLists';
import { SwipeBackLayout } from '@/mobile/components/SwipeBackLayout';
import { analytics } from '@/lib/analytics';

export default function TemplateDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { templateId } = useParams<{ templateId: string }>();
  const [template, setTemplate] = useState<TemplateWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsing, setIsUsing] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'web'>('web');
  const { addList } = useRecentLists();

  // Detect platform
  useEffect(() => {
    Device.getInfo().then(info => {
      setPlatform(info.platform as 'ios' | 'android' | 'web');
    });
  }, []);

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

  const primaryColor = template.theme?.primary || 'var(--primary)';
  const primaryPale = template.theme?.primaryPale || 'var(--primary-pale)';
  const bgSecondary = template.theme?.bgSecondary || primaryPale;
  const textPrimary = template.theme?.textPrimary || 'var(--text-primary)';
  const textSecondary = template.theme?.textSecondary || 'var(--text-secondary)';
  const textMuted = template.theme?.textMuted || 'var(--text-muted)';
  const borderMedium = template.theme?.borderMedium || 'var(--border-medium)';

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
          {/* Hero section */}
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

          {/* Preview section */}
          <div>
            <div
              className="font-bold uppercase tracking-wide text-xs"
              style={{ color: textMuted, marginBottom: '12px' }}
            >
              {t('templates.preview')}
            </div>
            <div
              className="rounded-2xl"
              style={{ backgroundColor: bgSecondary, padding: '16px' }}
            >
              {template.items.length === 0 ? (
                <p className="text-center" style={{ color: textMuted, padding: '32px 0' }}>
                  {t('templates.noItems')}
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
                          className="flex items-center gap-3"
                          style={{
                            paddingLeft: `${depth * 24}px`,
                            paddingTop: '10px',
                            paddingBottom: '4px',
                            marginTop: '8px',
                          }}
                        >
                          <div
                            className="w-5 h-5 flex items-center justify-center font-bold text-sm"
                            style={{ color: primaryColor }}
                          >
                            #
                          </div>
                          <span
                            className="flex-1 font-semibold uppercase tracking-wide text-sm"
                            style={{ color: primaryColor }}
                          >
                            {item.content.slice(1).trim()}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3"
                        style={{
                          paddingLeft: `${depth * 24}px`,
                          paddingTop: '6px',
                          paddingBottom: '6px',
                        }}
                      >
                        <div
                          className="w-5 h-5 rounded-md border-2 flex-shrink-0"
                          style={{ borderColor: borderMedium }}
                        />
                        <span style={{ color: textPrimary, fontSize: '16px' }}>
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
    </SwipeBackLayout>
  );
}
