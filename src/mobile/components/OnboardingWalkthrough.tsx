import { useState, useRef, useEffect, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Device } from '@capacitor/device';

interface OnboardingPageConfig {
  id: string;
  icon: ReactNode;
  titleKey: string;
  descriptionKey: string;
  exampleContent?: ReactNode;
}

// Page configurations - easily add/remove pages here
const ONBOARDING_PAGES: OnboardingPageConfig[] = [
  {
    id: 'shareable-links',
    icon: <LinkIcon />,
    titleKey: 'onboarding.shareableLinks.title',
    descriptionKey: 'onboarding.shareableLinks.description',
    exampleContent: <ShareableLinksVisual />,
  },
  {
    id: 'no-app-needed',
    icon: <GlobeIcon />,
    titleKey: 'onboarding.noAppNeeded.title',
    descriptionKey: 'onboarding.noAppNeeded.description',
    exampleContent: <MultiDeviceVisual />,
  },
  {
    id: 'dictation',
    icon: <MicrophoneIcon />,
    titleKey: 'onboarding.dictation.title',
    descriptionKey: 'onboarding.dictation.description',
    exampleContent: <DictationVisual />,
  },
  {
    id: 'ai-power',
    icon: <SparklesIcon />,
    titleKey: 'onboarding.aiPower.title',
    descriptionKey: 'onboarding.aiPower.description',
    exampleContent: <AICommandsVisual />,
  },
  {
    id: 'themes',
    icon: <PaletteIcon />,
    titleKey: 'onboarding.themes.title',
    descriptionKey: 'onboarding.themes.description',
    exampleContent: <ThemesVisual />,
  },
];

interface OnboardingWalkthroughProps {
  onComplete: () => void;
}

export function OnboardingWalkthrough({ onComplete }: OnboardingWalkthroughProps) {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'web'>('web');

  // Refs for touch tracking
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const swipeDirection = useRef<'horizontal' | 'vertical' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Gesture thresholds
  const DIRECTION_THRESHOLD = 5;
  const SWIPE_THRESHOLD = 0.25;

  // Platform detection for safe areas
  useEffect(() => {
    Device.getInfo().then(info => {
      setPlatform(info.platform as 'ios' | 'android' | 'web');
    });
  }, []);

  const safeAreaTop = platform === 'android' ? '36px' : 'env(safe-area-inset-top, 0px)';
  const safeAreaBottom = platform === 'android' ? '24px' : 'env(safe-area-inset-bottom, 0px)';

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    swipeDirection.current = null;
    setIsSwipeActive(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwipeActive) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;

    // Determine direction on first significant movement
    if (swipeDirection.current === null &&
        (Math.abs(deltaX) > DIRECTION_THRESHOLD || Math.abs(deltaY) > DIRECTION_THRESHOLD)) {
      swipeDirection.current = Math.abs(deltaX) >= Math.abs(deltaY) ? 'horizontal' : 'vertical';
    }

    if (swipeDirection.current !== 'horizontal') return;
    e.preventDefault();

    // Calculate offset with resistance at edges
    let offset = deltaX;
    const isAtStart = currentPage === 0 && deltaX > 0;
    const isAtEnd = currentPage === ONBOARDING_PAGES.length - 1 && deltaX < 0;

    if (isAtStart || isAtEnd) {
      offset = deltaX * 0.3; // Rubber-band resistance
    }

    setSwipeOffset(offset);
  };

  const handleTouchEnd = () => {
    setIsSwipeActive(false);
    swipeDirection.current = null;

    const screenWidth = window.innerWidth;
    const swipeRatio = Math.abs(swipeOffset) / screenWidth;

    if (swipeRatio > SWIPE_THRESHOLD) {
      if (swipeOffset < 0 && currentPage < ONBOARDING_PAGES.length - 1) {
        setCurrentPage(prev => prev + 1);
      } else if (swipeOffset > 0 && currentPage > 0) {
        setCurrentPage(prev => prev - 1);
      }
    }

    setSwipeOffset(0);
  };

  const handleComplete = () => {
    onComplete();
  };

  const isLastPage = currentPage === ONBOARDING_PAGES.length - 1;

  // Calculate transform for pages
  const pageTransform = `translateX(calc(-${currentPage * 100}% + ${swipeOffset}px))`;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* Pages container */}
      <div
        ref={containerRef}
        className="flex h-full"
        style={{
          transform: pageTransform,
          transition: isSwipeActive ? 'none' : 'transform 0.3s ease-out',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {ONBOARDING_PAGES.map((page, index) => (
          <div
            key={page.id}
            className="flex-shrink-0 w-full h-full flex flex-col items-center justify-center px-8"
            style={{
              paddingTop: `calc(${safeAreaTop} + 40px)`,
              paddingBottom: `calc(${safeAreaBottom} + 140px)`,
            }}
          >
            {/* Icon */}
            <div
              className="mb-6"
              style={{
                color: 'var(--primary)',
              }}
            >
              {page.icon}
            </div>

            {/* Title */}
            <h2
              className="text-center font-bold mb-4"
              style={{
                fontSize: '24px',
                color: 'var(--text-primary)',
                lineHeight: 1.3,
              }}
            >
              {t(page.titleKey)}
            </h2>

            {/* Description */}
            <p
              className="text-center max-w-xs"
              style={{
                fontSize: '16px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              {t(page.descriptionKey)}
            </p>

            {/* Example content - 16px spacing from description */}
            {page.exampleContent && (
              <div className="w-full max-w-xs" style={{ marginTop: '16px' }}>
                {page.exampleContent}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bottom section: indicators + button */}
      <div
        className="absolute bottom-0 left-0 right-0 flex flex-col items-center"
        style={{
          paddingBottom: `calc(${safeAreaBottom} + 32px)`,
        }}
      >
        {/* Page indicators - raised higher to clear Get Started button */}
        <div className="flex gap-2" style={{ marginBottom: isLastPage ? '20px' : '16px' }}>
          {ONBOARDING_PAGES.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentPage(index)}
              className="p-1"
              aria-label={`Go to page ${index + 1}`}
            >
              <div
                className="rounded-full transition-all duration-200"
                style={{
                  width: currentPage === index ? '24px' : '8px',
                  height: '8px',
                  backgroundColor: currentPage === index
                    ? 'var(--primary)'
                    : 'var(--border-medium)',
                  opacity: currentPage === index ? 1 : 0.5,
                }}
              />
            </button>
          ))}
        </div>

        {/* Get Started button - only on last page */}
        {isLastPage && (
          <button
            onClick={handleComplete}
            className="active:opacity-60 transition-opacity"
            style={{
              minWidth: '200px',
              minHeight: '44px',
              padding: '16px 32px',
              borderRadius: '14px',
              backgroundColor: 'var(--primary)',
              color: 'white',
              fontSize: '17px',
              fontWeight: '600',
              border: 'none',
              animation: 'onboarding-button-fade-in 0.3s ease-out forwards',
            }}
          >
            {t('onboarding.getStarted')}
          </button>
        )}

        {/* Swipe hint on non-last pages */}
        {!isLastPage && (
          <p
            className="text-center"
            style={{
              fontSize: '14px',
              color: 'var(--text-muted)',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {t('onboarding.swipeHint')}
          </p>
        )}
      </div>
    </div>
  );
}

// ============ Icon Components ============

function LinkIcon() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="36" fill="currentColor" fillOpacity="0.1" />
      <path
        d="M45.5 34.5L34.5 45.5M32 42L28.5 45.5C26.0147 48.0147 26.0147 51.9853 28.5 54.5C30.9853 57.0147 34.9853 57.0147 37.5 54.5L41 51M39 29L42.5 25.5C45.0147 22.9853 48.9853 22.9853 51.5 25.5C54.0147 28.0147 54.0147 31.9853 51.5 34.5L48 38"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="36" fill="currentColor" fillOpacity="0.1" />
      <circle cx="40" cy="40" r="16" stroke="currentColor" strokeWidth="3" />
      <path d="M40 24C40 24 32 32 32 40C32 48 40 56 40 56" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M40 24C40 24 48 32 48 40C48 48 40 56 40 56" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 40H56" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function MicrophoneIcon() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="36" fill="currentColor" fillOpacity="0.1" />
      <rect x="34" y="26" width="12" height="20" rx="6" stroke="currentColor" strokeWidth="3" />
      <path d="M28 40C28 46.6274 33.3726 52 40 52C46.6274 52 52 46.6274 52 40" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M40 52V58M36 58H44" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="36" fill="currentColor" fillOpacity="0.1" />
      <path
        d="M40 24L43.5 35.5L55 39L43.5 42.5L40 54L36.5 42.5L25 39L36.5 35.5L40 24Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M54 28L55.5 32L59 33.5L55.5 35L54 39L52.5 35L49 33.5L52.5 32L54 28Z"
        fill="currentColor"
      />
      <path
        d="M26 45L27.5 49L31 50.5L27.5 52L26 56L24.5 52L21 50.5L24.5 49L26 45Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PaletteIcon() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="36" fill="currentColor" fillOpacity="0.1" />
      <path
        d="M40 24C31.2 24 24 31.2 24 40C24 48.8 31.2 56 40 56C41.6 56 43.2 55.2 43.2 53.6C43.2 52.8 42.8 52.4 42.4 51.6C42 51.2 41.6 50.4 41.6 49.6C41.6 48 43.2 46.4 44.8 46.4H48C52.4 46.4 56 42.8 56 38.4C56 30.4 48.8 24 40 24Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="38" r="3" fill="currentColor" />
      <circle cx="38" cy="32" r="3" fill="currentColor" />
      <circle cx="46" cy="32" r="3" fill="currentColor" />
      <circle cx="50" cy="38" r="3" fill="currentColor" />
    </svg>
  );
}

// ============ Visual Example Components ============

function ShareableLinksVisual() {
  return (
    <div
      className="rounded-xl"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-light)',
        padding: '20px 16px',
      }}
    >
      <div className="flex items-center justify-between relative" style={{ height: '40px' }}>
        {/* You avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center z-10"
          style={{ backgroundColor: 'var(--primary)', color: 'white', fontSize: '11px', fontWeight: '600' }}
        >
          You
        </div>

        {/* Floating checkmarks */}
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          {/* Checkmark going right (you → others) */}
          <div
            className="absolute"
            style={{
              animation: 'floatRight 2.5s ease-in-out infinite',
              color: 'var(--primary)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          {/* Checkmark going left (others → you) */}
          <div
            className="absolute"
            style={{
              animation: 'floatLeft 2.5s ease-in-out infinite 1.25s',
              color: 'var(--primary)',
              opacity: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>

        {/* Others avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center z-10"
          style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
      </div>
      <p className="text-center text-xs" style={{ color: 'var(--text-muted)', marginTop: '12px' }}>
        Real-time collaboration
      </p>

      {/* Inline keyframes for floating checkmarks */}
      <style>{`
        @keyframes floatRight {
          0% { transform: translateX(-60px); opacity: 0; }
          10% { opacity: 1; }
          45% { transform: translateX(60px); opacity: 1; }
          55% { transform: translateX(60px); opacity: 0; }
          100% { transform: translateX(60px); opacity: 0; }
        }
        @keyframes floatLeft {
          0% { transform: translateX(60px); opacity: 0; }
          10% { opacity: 1; }
          45% { transform: translateX(-60px); opacity: 1; }
          55% { transform: translateX(-60px); opacity: 0; }
          100% { transform: translateX(-60px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function MultiDeviceVisual() {
  return (
    <div className="flex justify-center gap-4">
      {/* Phone */}
      <div
        className="w-12 h-20 rounded-lg flex items-center justify-center"
        style={{ border: '2px solid var(--border-medium)' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      </div>
      {/* Tablet */}
      <div
        className="w-16 h-20 rounded-lg flex items-center justify-center"
        style={{ border: '2px solid var(--border-medium)' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      </div>
      {/* Desktop */}
      <div
        className="w-20 h-16 rounded-lg flex items-center justify-center"
        style={{ border: '2px solid var(--border-medium)' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      </div>
    </div>
  );
}

function DictationVisual() {
  return (
    <div className="flex flex-col items-center">
      <div className="flex gap-1 items-end h-8">
        {[0.3, 0.6, 1, 0.8, 0.5, 0.9, 0.4, 0.7, 0.5].map((height, i) => (
          <div
            key={i}
            className="w-1 rounded-full animate-pulse"
            style={{
              height: `${height * 24}px`,
              backgroundColor: 'var(--primary)',
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>
      <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
        "Milk, eggs, bread..."
      </p>
    </div>
  );
}

function AICommandsVisual() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div
        className="rounded-lg"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          padding: '12px 16px',
        }}
      >
        <code
          className="text-sm font-mono"
          style={{ color: 'var(--primary)' }}
        >
          .hiking essentials
        </code>
        <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
          Generate items
        </p>
      </div>
      <div
        className="rounded-lg"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          padding: '12px 16px',
        }}
      >
        <code
          className="text-sm font-mono"
          style={{ color: 'var(--primary)' }}
        >
          !categorize by aisle
        </code>
        <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
          Organize list
        </p>
      </div>
    </div>
  );
}

function ThemesVisual() {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];

  return (
    <div className="flex flex-col items-center">
      <div className="flex gap-2">
        {colors.map((color, i) => (
          <div
            key={i}
            className="w-8 h-8 rounded-full"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <code
        className="text-sm font-mono rounded-lg"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          color: 'var(--primary)',
          padding: '10px 16px',
          marginTop: '12px',
        }}
      >
        style: summer vibes
      </code>
    </div>
  );
}
