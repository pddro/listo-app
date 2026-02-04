'use client';

import { useEffect, useState } from 'react';
import './CollaborationModal.css';

interface CollaborationModalTranslations {
  shareTitle: string;
  shareDescription: string;
  featureRealtime: string;
  featureViewers: string;
  featureNoAccount: string;
  shareButton: string;
  activeTitle: string;
  activeDescription: (count: number) => string;
  featureSync: string;
  featureCheckTogether: string;
  featureSameList: string;
  tryIt: string;
  gotIt: string;
}

interface CollaborationModalProps {
  isOpen: boolean;
  onClose: () => void;
  presenceCount: number;
  themeColor?: string;
  onShare?: () => void;
  translations?: CollaborationModalTranslations;
}

const defaultTranslations: CollaborationModalTranslations = {
  shareTitle: 'Share the magic!',
  shareDescription: 'This list syncs instantly with anyone you share it with. No sign-ups needed. They click the link, they\'re in.',
  featureRealtime: 'Changes appear in real-time',
  featureViewers: 'See who\'s viewing with you',
  featureNoAccount: 'No accounts required',
  shareButton: 'Share this list',
  activeTitle: 'You\'re collaborating!',
  activeDescription: (count: number) => `${count} ${count === 1 ? 'person is' : 'people are'} viewing this list with you right now.`,
  featureSync: 'Every change syncs instantly',
  featureCheckTogether: 'Check items off together',
  featureSameList: 'Everyone sees the same list',
  tryIt: 'Try checking an item — watch it update for everyone instantly!',
  gotIt: 'Got it!',
};

// Helper to convert hex to rgba
function hexToRgba(hex: string, alpha: number): string {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function CollaborationModal({
  isOpen,
  onClose,
  presenceCount,
  themeColor,
  onShare,
  translations,
}: CollaborationModalProps) {
  const t = translations || defaultTranslations;
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(onClose, 200);
  };

  if (!isOpen && !isAnimating) return null;

  const color = themeColor || '#E75F3E';
  const safeColor = color.startsWith('#') ? color : '#E75F3E';
  const glowColor = hexToRgba(safeColor, 0.3);

  const isAlone = presenceCount === 0;

  return (
    <div
      className={`collab-modal-overlay ${isOpen ? 'open' : 'closing'}`}
      onClick={handleClose}
    >
      <div
        className={`collab-modal ${isOpen ? 'open' : 'closing'}`}
        onClick={(e) => e.stopPropagation()}
        style={{ '--theme-color': color, '--theme-glow': glowColor } as React.CSSProperties}
      >
        {/* Animated header icon */}
        <div className="collab-modal-icon">
          <div className="collab-pulse-ring" style={{ borderColor: color }} />
          <div className="collab-pulse-ring delay-1" style={{ borderColor: color }} />
          <div className="collab-pulse-ring delay-2" style={{ borderColor: color }} />
          <div className="collab-center-dot" style={{ backgroundColor: color }}>
            {isAlone ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            )}
          </div>
        </div>

        {/* Content */}
        {isAlone ? (
          <>
            <h2 className="collab-modal-title">{t.shareTitle}</h2>
            <p className="collab-modal-text">{t.shareDescription}</p>
            <div className="collab-features">
              <div className="collab-feature">
                <span className="collab-feature-icon">⚡</span>
                <span>{t.featureRealtime}</span>
              </div>
              <div className="collab-feature">
                <span className="collab-feature-icon">👥</span>
                <span>{t.featureViewers}</span>
              </div>
              <div className="collab-feature">
                <span className="collab-feature-icon">✨</span>
                <span>{t.featureNoAccount}</span>
              </div>
            </div>
            <button
              className="collab-modal-button"
              style={{ backgroundColor: color }}
              onClick={() => {
                onShare?.();
                handleClose();
              }}
            >
              {t.shareButton}
            </button>
          </>
        ) : (
          <>
            <h2 className="collab-modal-title">{t.activeTitle}</h2>
            <p className="collab-modal-text">{t.activeDescription(presenceCount)}</p>
            <div className="collab-features">
              <div className="collab-feature">
                <span className="collab-feature-icon">🔄</span>
                <span>{t.featureSync}</span>
              </div>
              <div className="collab-feature">
                <span className="collab-feature-icon">✓</span>
                <span>{t.featureCheckTogether}</span>
              </div>
              <div className="collab-feature">
                <span className="collab-feature-icon">🎯</span>
                <span>{t.featureSameList}</span>
              </div>
            </div>
            <p className="collab-modal-subtext">{t.tryIt}</p>
            <button
              className="collab-modal-button secondary"
              style={{ color, borderColor: color }}
              onClick={handleClose}
            >
              {t.gotIt}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
