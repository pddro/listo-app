import { useEffect, useRef, useState, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface SwipeBackLayoutProps {
  children: ReactNode;
}

export function SwipeBackLayout({ children }: SwipeBackLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isEdgeSwipe = useRef(false);
  const swipeDirection = useRef<'horizontal' | 'vertical' | null>(null);
  const swipeProgressRef = useRef(0);

  // Only enable on list pages (not home)
  const isListPage = location.pathname !== '/';

  useEffect(() => {
    if (!isListPage) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartX.current = touch.clientX;
      touchStartY.current = touch.clientY;
      swipeDirection.current = null;

      // Edge swipe detection - within 70px of left edge (generous zone)
      isEdgeSwipe.current = touch.clientX <= 70;

      if (isEdgeSwipe.current) {
        setIsSwipeActive(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isEdgeSwipe.current) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartX.current;
      const deltaY = touch.clientY - touchStartY.current;

      // Determine swipe direction on first significant movement (reduced threshold for quicker detection)
      if (swipeDirection.current === null && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
        // More forgiving: horizontal if deltaX >= deltaY (not strictly greater)
        swipeDirection.current = Math.abs(deltaX) >= Math.abs(deltaY) ? 'horizontal' : 'vertical';
      }

      // Only process horizontal swipes
      if (swipeDirection.current !== 'horizontal') {
        isEdgeSwipe.current = false;
        setIsSwipeActive(false);
        setSwipeProgress(0);
        swipeProgressRef.current = 0;
        return;
      }

      // Prevent scrolling during swipe
      e.preventDefault();

      // Calculate progress (0 to 1)
      const screenWidth = window.innerWidth;
      const progress = Math.max(0, Math.min(1, deltaX / screenWidth));
      setSwipeProgress(progress);
      swipeProgressRef.current = progress;
    };

    const handleTouchEnd = () => {
      if (!isEdgeSwipe.current || swipeDirection.current !== 'horizontal') {
        setIsSwipeActive(false);
        setSwipeProgress(0);
        swipeProgressRef.current = 0;
        return;
      }

      const currentProgress = swipeProgressRef.current;

      // If swiped more than 25%, go back (more sensitive)
      if (currentProgress > 0.25) {
        // Animate to completion then navigate
        setSwipeProgress(1);
        setTimeout(() => {
          navigate('/');
          // Reset after navigation
          setTimeout(() => {
            setSwipeProgress(0);
            setIsSwipeActive(false);
            swipeProgressRef.current = 0;
          }, 50);
        }, 200);
      } else {
        // Snap back
        setSwipeProgress(0);
        setIsSwipeActive(false);
        swipeProgressRef.current = 0;
      }

      isEdgeSwipe.current = false;
      swipeDirection.current = null;
    };

    // Use document-level listeners with capture phase for reliable edge swipe detection
    document.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true, capture: true });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: true, capture: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart, { capture: true });
      document.removeEventListener('touchmove', handleTouchMove, { capture: true });
      document.removeEventListener('touchend', handleTouchEnd, { capture: true });
      document.removeEventListener('touchcancel', handleTouchEnd, { capture: true });
    };
  }, [isListPage, navigate]);

  // Calculate transform values for stacked cards effect
  const currentPageTranslate = swipeProgress * 100;
  const currentPageScale = 1 - (swipeProgress * 0.05);
  const shadowOpacity = 0.25 * (1 - swipeProgress);
  const previousPageTranslate = -30 + (swipeProgress * 30);
  const previousPageScale = 0.92 + (swipeProgress * 0.08);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden" style={{ touchAction: 'pan-y' }}>
      {/* Previous page (underneath) - only show during swipe */}
      {isSwipeActive && isListPage && (
        <div
          className="absolute inset-0"
          style={{
            transform: `translateX(${previousPageTranslate}%) scale(${previousPageScale})`,
            transition: swipeProgress === 0 || swipeProgress === 1 ? 'transform 0.25s ease-out' : 'none',
            zIndex: 1,
            backgroundColor: 'var(--bg-primary)',
          }}
        >
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center" style={{ color: 'var(--text-muted)' }}>
              <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="text-sm">Home</span>
            </div>
          </div>
        </div>
      )}

      {/* Current page */}
      <div
        className="relative w-full h-full"
        style={{
          backgroundColor: 'var(--bg-primary)',
          transform: isListPage && isSwipeActive
            ? `translateX(${currentPageTranslate}%) scale(${currentPageScale})`
            : 'none',
          transition: isSwipeActive && (swipeProgress === 0 || swipeProgress === 1)
            ? 'transform 0.25s ease-out'
            : 'none',
          zIndex: 2,
          boxShadow: isSwipeActive ? `-10px 0 30px rgba(0,0,0,${shadowOpacity})` : 'none',
          borderRadius: isSwipeActive && swipeProgress > 0 ? '12px 0 0 12px' : '0',
        }}
      >
        {children}
      </div>
    </div>
  );
}
