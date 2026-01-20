import { useState } from 'react';

interface HomeThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (description: string) => Promise<void>;
  onReset?: () => void;
  hasTheme: boolean;
}

const EXAMPLE_CHIPS = [
  'Ocean sunset',
  'Forest morning',
  'Neon cyberpunk',
];

export function HomeThemeModal({
  isOpen,
  onClose,
  onGenerate,
  onReset,
  hasTheme,
}: HomeThemeModalProps) {
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

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
      className="fixed inset-0 z-50"
      style={{ backgroundColor: 'var(--bg-primary, #ffffff)' }}
    >
      {/* Top-anchored card */}
      <div
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
          paddingLeft: '16px',
          paddingRight: '16px',
        }}
      >
        <div
          className="rounded-2xl shadow-lg"
          style={{
            padding: '20px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-light)',
          }}
        >
          {/* Header with close button */}
          <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              Customize Homepage
            </h2>
            <button
              onClick={onClose}
              className="active:opacity-60"
              style={{
                color: 'var(--text-muted)',
                padding: '4px',
                marginRight: '-4px',
              }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
            Describe any vibe, color, or aesthetic
          </p>

          {/* Example chips */}
          <div className="flex flex-wrap gap-2" style={{ marginBottom: '12px' }}>
            {EXAMPLE_CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => handleChipTap(chip)}
                className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                style={{
                  backgroundColor: description === chip ? 'var(--primary)' : 'var(--primary-pale)',
                  color: description === chip ? 'white' : 'var(--primary)',
                }}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Text input */}
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your theme..."
            disabled={isGenerating}
            autoFocus
            className="w-full border rounded-xl outline-none transition-all duration-200 focus:border-[var(--primary)] focus:shadow-[0_0_0_3px_var(--primary-pale)]"
            style={{
              padding: '12px 14px',
              fontSize: '17px',
              borderColor: 'var(--border-light)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && description.trim()) {
                handleGenerate();
              }
            }}
          />

          {/* Buttons row */}
          <div className="flex gap-2" style={{ marginTop: '12px' }}>
            {/* Reset button (only shown if theme exists) */}
            {hasTheme && onReset && (
              <button
                onClick={handleReset}
                className="rounded-xl font-medium"
                style={{
                  color: 'var(--text-muted)',
                  padding: '12px 16px',
                  fontSize: '15px',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-primary)',
                }}
              >
                Reset
              </button>
            )}

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={!description.trim() || isGenerating}
              className="flex-1 text-white rounded-xl font-semibold disabled:opacity-50 transition-opacity"
              style={{
                backgroundColor: 'var(--primary)',
                padding: '12px 16px',
                fontSize: '15px',
              }}
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </span>
              ) : (
                'Generate'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
