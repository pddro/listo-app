'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { TemplateCategory, TEMPLATE_CATEGORIES } from '@/types';
import { ThemeColors } from '@/lib/gemini';
import { usePersonalTemplates } from '@/lib/hooks/usePersonalTemplates';

interface SaveAsTemplateModalProps {
  listId: string;
  listTitle: string | null;
  listTheme: ThemeColors | null;
  itemCount: number;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SaveAsTemplateModal({
  listId,
  listTitle,
  listTheme,
  itemCount,
  onClose,
  onSuccess,
}: SaveAsTemplateModalProps) {
  const t = useTranslations('templates.saveAsTemplate');
  const tCategories = useTranslations('templates.categories');
  const locale = useLocale();
  const { addTemplate, updateTemplate } = usePersonalTemplates();

  const [title, setTitle] = useState(listTitle || '');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('other');
  const [makePublic, setMakePublic] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Always save locally first
      const templateId = addTemplate({
        listId,
        title: title.trim(),
        description: description.trim() || null,
        category,
        themeColor: listTheme?.primary || null,
        theme: listTheme,
        itemCount,
      });

      // If making public, also submit to the API for review
      if (makePublic) {
        const response = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            list_id: listId,
            title: title.trim(),
            description: description.trim() || null,
            category,
            language: locale,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to submit for review');
        }

        // Update local template with public ID
        updateTemplate(templateId, {
          isPublic: true,
          publicTemplateId: data.template_id,
        });
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Save template error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ padding: '16px' }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-md rounded-2xl shadow-xl"
        style={{
          backgroundColor: 'var(--bg-primary)',
          padding: '24px',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{ marginBottom: '24px' }}
        >
          <h2
            className="text-xl font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('title')}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg transition-colors"
            style={{
              padding: '8px',
              color: 'var(--text-muted)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Title */}
            <div>
              <label
                className="block text-sm font-medium"
                style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}
              >
                {t('titleLabel')}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('titlePlaceholder')}
                className="w-full rounded-xl outline-none transition-all"
                style={{
                  border: '1px solid var(--border-medium)',
                  padding: '12px 16px',
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-primary)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px var(--primary-pale)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-medium)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                autoFocus
              />
            </div>

            {/* Description */}
            <div>
              <label
                className="block text-sm font-medium"
                style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}
              >
                {t('descriptionLabel')}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('descriptionPlaceholder')}
                rows={2}
                className="w-full rounded-xl outline-none transition-all resize-none"
                style={{
                  border: '1px solid var(--border-medium)',
                  padding: '12px 16px',
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-primary)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px var(--primary-pale)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-medium)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Category */}
            <div>
              <label
                className="block text-sm font-medium"
                style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}
              >
                {t('categoryLabel')}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TemplateCategory)}
                className="w-full rounded-xl outline-none transition-all cursor-pointer"
                style={{
                  border: '1px solid var(--border-medium)',
                  padding: '12px 16px',
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-primary)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px var(--primary-pale)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-medium)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {TEMPLATE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {tCategories(cat)}
                  </option>
                ))}
              </select>
            </div>

            {/* Make Public Toggle */}
            <div
              className="flex items-center justify-between rounded-xl"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                padding: '16px',
              }}
            >
              <div>
                <div
                  className="font-medium text-sm"
                  style={{ color: 'var(--text-primary)', marginBottom: '2px' }}
                >
                  {t('makePublic')}
                </div>
                <div
                  className="text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {t('makePublicDescription')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMakePublic(!makePublic)}
                className="relative flex-shrink-0 rounded-full transition-colors"
                style={{
                  width: '48px',
                  height: '28px',
                  backgroundColor: makePublic ? 'var(--primary)' : 'var(--border-medium)',
                }}
              >
                <span
                  className="absolute top-1 rounded-full bg-white shadow transition-transform"
                  style={{
                    width: '20px',
                    height: '20px',
                    left: makePublic ? '24px' : '4px',
                  }}
                />
              </button>
            </div>

            {/* Info text - only show when making public */}
            {makePublic && (
              <div
                className="rounded-xl text-sm"
                style={{
                  backgroundColor: 'var(--primary-pale)',
                  color: 'var(--primary)',
                  padding: '12px 16px',
                }}
              >
                {t('publishHint')}
              </div>
            )}

            {/* Error */}
            {error && (
              <div
                className="rounded-xl text-sm"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: 'var(--error)',
                  padding: '12px 16px',
                }}
              >
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSaving || !title.trim()}
              className="w-full rounded-xl font-medium text-white transition-all disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                backgroundColor: 'var(--primary)',
                padding: '14px 20px',
              }}
              onMouseEnter={(e) => {
                if (!isSaving && title.trim()) {
                  e.currentTarget.style.backgroundColor = 'var(--primary-dark)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--primary)';
              }}
            >
              {isSaving ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
