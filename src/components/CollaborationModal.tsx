'use client';

import { useEffect, useState } from 'react';
import './CollaborationModal.css';

interface CollaborationModalProps {
  isOpen: boolean;
  onClose: () => void;
  presenceCount: number;
  themeColor?: string;
  onShare?: () => void;
}

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
}: CollaborationModalProps) {
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
            <h2 className="collab-modal-title">Share the magic!</h2>
            <p className="collab-modal-text">
              This list syncs <strong>instantly</strong> with anyone you share it with.
              No sign-ups needed. They click the link, they're in.
            </p>
            <div className="collab-features">
              <div className="collab-feature">
                <span className="collab-feature-icon">⚡</span>
                <span>Changes appear in real-time</span>
              </div>
              <div className="collab-feature">
                <span className="collab-feature-icon">👥</span>
                <span>See who's viewing with you</span>
              </div>
              <div className="collab-feature">
                <span className="collab-feature-icon">✨</span>
                <span>No accounts required</span>
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
              Share this list
            </button>
          </>
        ) : (
          <>
            <h2 className="collab-modal-title">You're collaborating!</h2>
            <p className="collab-modal-text">
              <strong>{presenceCount} {presenceCount === 1 ? 'person is' : 'people are'}</strong> viewing this list with you right now.
            </p>
            <div className="collab-features">
              <div className="collab-feature">
                <span className="collab-feature-icon">🔄</span>
                <span>Every change syncs instantly</span>
              </div>
              <div className="collab-feature">
                <span className="collab-feature-icon">✓</span>
                <span>Check items off together</span>
              </div>
              <div className="collab-feature">
                <span className="collab-feature-icon">🎯</span>
                <span>Everyone sees the same list</span>
              </div>
            </div>
            <p className="collab-modal-subtext">
              Try checking an item — watch it update for everyone instantly!
            </p>
            <button
              className="collab-modal-button secondary"
              style={{ color, borderColor: color }}
              onClick={handleClose}
            >
              Got it!
            </button>
          </>
        )}
      </div>
    </div>
  );
}
