'use client';

import { useEffect, useState, useRef } from 'react';
import './PresenceIndicator.css';

interface PresenceIndicatorProps {
  count: number;
  themeColor?: string;
  onClick?: () => void;
}

// Helper to convert hex to rgba
function hexToRgba(hex: string, alpha: number): string {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function PresenceIndicator({ count, themeColor, onClick }: PresenceIndicatorProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [displayCount, setDisplayCount] = useState(count);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isEntrance, setIsEntrance] = useState(true);
  const soloTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasHadOthersRef = useRef(false);

  // Clear entrance animation after it plays
  useEffect(() => {
    if (isEntrance) {
      const timeout = setTimeout(() => setIsEntrance(false), 1000);
      return () => clearTimeout(timeout);
    }
  }, [isEntrance]);

  // Handle visibility and solo timeout
  useEffect(() => {
    // Clear any existing timeout
    if (soloTimeoutRef.current) {
      clearTimeout(soloTimeoutRef.current);
      soloTimeoutRef.current = null;
    }

    if (count > 0) {
      // Others are here - always show
      hasHadOthersRef.current = true;
      setIsVisible(true);
      if (count !== displayCount) {
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 300);
      }
      setDisplayCount(count);
    } else {
      // Alone
      setDisplayCount(0);

      if (hasHadOthersRef.current) {
        // Was with others, now alone - show for 5 seconds
        setIsVisible(true);
        soloTimeoutRef.current = setTimeout(() => {
          setIsVisible(false);
        }, 5000);
      } else {
        // Started alone - show for 30 seconds
        setIsVisible(true);
        soloTimeoutRef.current = setTimeout(() => {
          setIsVisible(false);
        }, 30000);
      }
    }

    return () => {
      if (soloTimeoutRef.current) {
        clearTimeout(soloTimeoutRef.current);
      }
    };
  }, [count, displayCount]);

  // Always show if others are present, otherwise respect visibility state
  if (!isVisible && count === 0) return null;

  // Default to primary orange if no theme color
  const color = themeColor || '#E75F3E';
  const safeColor = color.startsWith('#') ? color : '#E75F3E';
  const borderColor = hexToRgba(safeColor, 0.3);
  const glowColor = hexToRgba(safeColor, 0.5);

  const isAlone = displayCount === 0;

  return (
    <button
      className={`presence-indicator active ${isAnimating ? 'pop' : ''} ${isEntrance && isAlone ? 'entrance' : ''}`}
      style={{
        backgroundColor: '#FFFFFF',
        borderColor: borderColor,
        borderWidth: '1px',
        borderStyle: 'solid',
        cursor: 'pointer',
      }}
      onClick={onClick}
    >
      {/* Animated dots representing people */}
      <div className="presence-dots">
        {isAlone ? (
          <div
            className="presence-dot solo"
            style={{
              backgroundColor: color,
              boxShadow: `0 0 10px ${glowColor}`
            }}
          />
        ) : (
          <>
            {Array.from({ length: Math.min(displayCount, 3) }).map((_, i) => (
              <div
                key={i}
                className="presence-dot"
                style={{
                  animationDelay: `${i * 0.3}s`,
                  backgroundColor: color,
                  boxShadow: `0 0 10px ${glowColor}`
                }}
              />
            ))}
            {displayCount > 3 && (
              <div
                className="presence-dot-extra"
                style={{ backgroundColor: color }}
              >
                +{displayCount - 3}
              </div>
            )}
          </>
        )}
      </div>

      {/* Text label */}
      <span className="presence-text" style={{ color }}>
        {isAlone ? 'Just you' : displayCount === 1 ? '1 other here' : `${displayCount} others here`}
      </span>
    </button>
  );
}
