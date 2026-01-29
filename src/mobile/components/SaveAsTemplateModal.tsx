import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ThemeColors } from '@/lib/gemini';
import { TEMPLATE_CATEGORIES, TemplateCategory } from '@/types';

interface SaveAsTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { title: string; description: string; category: TemplateCategory; shareWithCommunity: boolean }) => Promise<void>;
  listTitle?: string;
  listDescription?: string;
  listCategory?: TemplateCategory;
  theme?: ThemeColors | null;
}

export function SaveAsTemplateModal({ isOpen, onClose, onSave, listTitle, listDescription, listCategory, theme }: SaveAsTemplateModalProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('other');
  const [shareWithCommunity, setShareWithCommunity] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle(listTitle || '');
      setDescription(listDescription || '');
      setCategory(listCategory || 'other');
      setShareWithCommunity(false);
      setIsSaving(false);
    }
  }, [isOpen, listTitle, listDescription, listCategory]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!title.trim()) return;

    setIsSaving(true);
    try {
      await onSave({ title: title.trim(), description: description.trim(), category, shareWithCommunity });
      onClose();
    } catch (error) {
      console.error('Failed to save template:', error);
      setIsSaving(false);
    }
  };

  // Theme colors with fallbacks
  const primaryColor = theme?.primary || 'var(--primary)';
  const primaryPale = theme?.primaryPale || 'var(--primary-pale)';
  const bgPrimary = theme?.bgPrimary || 'var(--bg-primary)';
  const bgSecondary = theme?.bgSecondary || 'var(--bg-secondary)';
  const textPrimary = theme?.textPrimary || 'var(--text-primary)';
  const textSecondary = theme?.textSecondary || 'var(--text-secondary)';
  const textMuted = theme?.textMuted || 'var(--text-muted)';
  const borderLight = theme?.borderLight || 'var(--border-light)';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg rounded-t-3xl animate-slide-up overflow-hidden"
        style={{ backgroundColor: bgPrimary, maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            paddingTop: '12px',
            paddingBottom: '8px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '4px',
              borderRadius: '2px',
              backgroundColor: borderLight,
            }}
          />
        </div>

        {/* Scrollable Content */}
        <div
          style={{
            overflowY: 'auto',
            maxHeight: 'calc(90vh - 24px)',
            paddingLeft: '24px',
            paddingRight: '24px',
            paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '8px',
              paddingBottom: '24px',
            }}
          >
            <h2
              style={{
                fontSize: '22px',
                fontWeight: '700',
                color: textPrimary,
                margin: 0,
              }}
            >
              {t('templates.saveAsTemplate.title')}
            </h2>
            <button
              onClick={onClose}
              style={{
                padding: '8px',
                marginRight: '-8px',
                color: textMuted,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Title Input */}
          <div style={{ marginBottom: '24px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: textSecondary,
                marginBottom: '10px',
              }}
            >
              {t('templates.saveAsTemplate.titleLabel')}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('templates.saveAsTemplate.titlePlaceholder')}
              style={{
                width: '100%',
                padding: '16px 18px',
                borderRadius: '14px',
                fontSize: '16px',
                backgroundColor: bgSecondary,
                color: textPrimary,
                border: `1px solid ${borderLight}`,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Description Input */}
          <div style={{ marginBottom: '24px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: textSecondary,
                marginBottom: '10px',
              }}
            >
              {t('templates.saveAsTemplate.descriptionLabel')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('templates.saveAsTemplate.descriptionPlaceholder')}
              rows={3}
              style={{
                width: '100%',
                padding: '16px 18px',
                borderRadius: '14px',
                fontSize: '16px',
                backgroundColor: bgSecondary,
                color: textPrimary,
                border: `1px solid ${borderLight}`,
                outline: 'none',
                resize: 'none',
                boxSizing: 'border-box',
                lineHeight: '1.5',
              }}
            />
          </div>

          {/* Category Select */}
          <div style={{ marginBottom: '28px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: textSecondary,
                marginBottom: '12px',
              }}
            >
              {t('templates.saveAsTemplate.categoryLabel')}
            </label>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              {TEMPLATE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '20px',
                    fontSize: '14px',
                    fontWeight: '500',
                    textTransform: 'capitalize',
                    backgroundColor: category === cat ? primaryColor : bgSecondary,
                    color: category === cat ? 'white' : textSecondary,
                    border: `1px solid ${category === cat ? primaryColor : borderLight}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {t(`templates.categories.${cat}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Share with Community Toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px',
              borderRadius: '16px',
              backgroundColor: primaryPale,
              marginBottom: '20px',
            }}
          >
            <div style={{ flex: 1, paddingRight: '16px' }}>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: textPrimary,
                  marginBottom: '6px',
                }}
              >
                {t('templates.saveAsTemplate.makePublic')}
              </div>
              <div
                style={{
                  fontSize: '14px',
                  color: textMuted,
                  lineHeight: '1.4',
                }}
              >
                {t('templates.saveAsTemplate.makePublicDescription')}
              </div>
            </div>
            <button
              onClick={() => setShareWithCommunity(!shareWithCommunity)}
              style={{
                position: 'relative',
                width: '52px',
                height: '32px',
                borderRadius: '16px',
                backgroundColor: shareWithCommunity ? primaryColor : borderLight,
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '4px',
                  width: '24px',
                  height: '24px',
                  borderRadius: '12px',
                  backgroundColor: 'white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                  transition: 'transform 0.2s ease',
                  transform: shareWithCommunity ? 'translateX(24px)' : 'translateX(4px)',
                }}
              />
            </button>
          </div>

          {/* Review hint (only show when sharing) */}
          {shareWithCommunity && (
            <p
              style={{
                fontSize: '13px',
                textAlign: 'center',
                color: textMuted,
                marginBottom: '20px',
                lineHeight: '1.5',
                padding: '0 12px',
              }}
            >
              {t('templates.saveAsTemplate.publishHint')}
            </p>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={!title.trim() || isSaving}
            style={{
              width: '100%',
              padding: '18px 24px',
              borderRadius: '14px',
              fontSize: '17px',
              fontWeight: '600',
              backgroundColor: primaryColor,
              color: 'white',
              border: 'none',
              cursor: !title.trim() || isSaving ? 'not-allowed' : 'pointer',
              opacity: !title.trim() || isSaving ? 0.5 : 1,
              transition: 'all 0.15s ease',
              marginTop: '8px',
            }}
          >
            {isSaving ? t('templates.saveAsTemplate.saving') : t('templates.saveAsTemplate.save')}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
