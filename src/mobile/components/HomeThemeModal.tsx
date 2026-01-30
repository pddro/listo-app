import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Device } from '@capacitor/device';

interface HomeThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (description: string) => Promise<void>;
  onReset?: () => void;
  hasTheme: boolean;
  title?: string;
}

export function HomeThemeModal({
  isOpen,
  onClose,
  onGenerate,
  onReset,
  hasTheme,
  title = 'Customize Theme',
}: HomeThemeModalProps) {
  const { t } = useTranslation();
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'web'>('web');

  // Platform detection for safe areas
  useEffect(() => {
    Device.getInfo().then(info => {
      setPlatform(info.platform as 'ios' | 'android' | 'web');
    });
  }, []);

  const safeAreaTop = platform === 'android' ? '36px' : 'env(safe-area-inset-top, 0px)';

  // Get all theme suggestions from translations
  const allSuggestions = t('themeSuggestions', { returnObjects: true }) as string[];
  const suggestions = Array.isArray(allSuggestions) ? allSuggestions : [];

  // Split into two rows
  const midpoint = Math.ceil(suggestions.length / 2);
  const row1 = suggestions.slice(0, midpoint);
  const row2 = suggestions.slice(midpoint);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!description.trim() || isGenerating) return;
    setIsGenerating(true);
    try {
      await onGenerate(description.trim());
      setDescription('');
      onClose();
    } catch (error) {
      console.error('Theme generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleChipTap = (chip: string) => {
    setDescription(chip);
  };

  const handleReset = () => {
    if (onReset) {
      onReset();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: 'var(--bg-primary, #ffffff)' }}
    >
      {/* Header area with input - stays at top */}
      <div
        style={{
          paddingTop: `calc(${safeAreaTop} + 12px)`,
          paddingLeft: '20px',
          paddingRight: '20px',
          backgroundColor: 'var(--bg-primary)',
        }}
      >
        {/* Header with close button */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="active:opacity-60"
            style={{
              color: 'var(--text-muted)',
              padding: '8px',
              marginRight: '-8px',
            }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Input row with Generate button */}
        <div className="flex gap-2" style={{ marginTop: '12px' }}>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your theme..."
            disabled={isGenerating}
            className="flex-1 border rounded-xl outline-none transition-all duration-200 focus:border-[var(--primary)] focus:shadow-[0_0_0_3px_var(--primary-pale)]"
            style={{
              padding: '12px 14px',
              fontSize: '17px',
              borderColor: 'var(--border-light)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && description.trim()) {
                handleGenerate();
              }
            }}
          />
          <button
            onClick={handleGenerate}
            disabled={!description.trim() || isGenerating}
            className="text-white rounded-xl font-semibold disabled:opacity-50 transition-opacity active:opacity-80"
            style={{
              backgroundColor: 'var(--primary)',
              padding: '12px 20px',
              fontSize: '15px',
            }}
          >
            {isGenerating ? (
              <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Go'
            )}
          </button>
        </div>

        {/* Label for suggestions */}
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '20px', marginBottom: '8px' }}>
          Or pick a style
        </p>
      </div>

      {/* Scrollable suggestion chips - 2 rows, edge to edge */}
      <div
        className="overflow-x-auto flex flex-col gap-2"
        style={{ paddingBottom: '20px' }}
      >
        {/* Row 1 */}
        <div className="flex gap-2" style={{ paddingLeft: '20px', paddingRight: '20px' }}>
          {row1.map((chip) => (
            <button
              key={chip}
              onClick={() => handleChipTap(chip)}
              className="rounded-full text-sm font-medium transition-colors active:opacity-70 whitespace-nowrap flex-shrink-0"
              style={{
                backgroundColor: description === chip ? 'var(--primary)' : 'var(--primary-pale)',
                color: description === chip ? 'white' : 'var(--primary)',
                padding: '10px 16px',
              }}
            >
              {chip}
            </button>
          ))}
        </div>
        {/* Row 2 */}
        <div className="flex gap-2" style={{ paddingLeft: '20px', paddingRight: '20px' }}>
          {row2.map((chip) => (
            <button
              key={chip}
              onClick={() => handleChipTap(chip)}
              className="rounded-full text-sm font-medium transition-colors active:opacity-70 whitespace-nowrap flex-shrink-0"
              style={{
                backgroundColor: description === chip ? 'var(--primary)' : 'var(--primary-pale)',
                color: description === chip ? 'white' : 'var(--primary)',
                padding: '10px 16px',
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Reset link at bottom - text only, subtle */}
      {hasTheme && onReset && (
        <div style={{ padding: '16px 20px', textAlign: 'center' }}>
          <button
            onClick={handleReset}
            className="active:opacity-60"
            style={{
              color: 'var(--text-muted)',
              fontSize: '14px',
              background: 'none',
              border: 'none',
              padding: '8px 16px',
            }}
          >
            Reset to default theme
          </button>
        </div>
      )}
    </div>
  );
}
