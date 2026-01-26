'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { TemplateCategory, TEMPLATE_CATEGORIES } from '@/types';
import { PersonalTemplate } from '@/lib/hooks/usePersonalTemplates';

interface EditTemplateModalProps {
  template: PersonalTemplate;
  onSave: (updates: { title: string; description: string | null; category: TemplateCategory }) => void;
  onClose: () => void;
}

export function EditTemplateModal({
  template,
  onSave,
  onClose,
}: EditTemplateModalProps) {
  const t = useTranslations('templates.editTemplate');
  const tCategories = useTranslations('templates.categories');

  const [title, setTitle] = useState(template.title);
  const [description, setDescription] = useState(template.description || '');
  const [category, setCategory] = useState<TemplateCategory>(template.category);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    onSave({
      title: title.trim(),
      description: description.trim() || null,
      category,
    });
    onClose();
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
          backgroundColor: 'var(--bg-primary, #fff)',
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
                className="w-full rounded-xl outline-none transition-all"
                style={{
                  border: '1px solid var(--border-medium)',
                  padding: '12px 16px',
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-primary, #fff)',
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
                rows={2}
                className="w-full rounded-xl outline-none transition-all resize-none"
                style={{
                  border: '1px solid var(--border-medium)',
                  padding: '12px 16px',
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-primary, #fff)',
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
                  backgroundColor: 'var(--bg-primary, #fff)',
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

            {/* Submit button */}
            <button
              type="submit"
              disabled={!title.trim()}
              className="w-full rounded-xl font-medium text-white transition-all disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                backgroundColor: 'var(--primary)',
                padding: '14px 20px',
              }}
              onMouseEnter={(e) => {
                if (title.trim()) {
                  e.currentTarget.style.backgroundColor = 'var(--primary-dark)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--primary)';
              }}
            >
              {t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
