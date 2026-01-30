import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Device } from '@capacitor/device';
import { Preferences } from '@capacitor/preferences';
import { supabase } from '@/lib/supabase';
import { generateListId } from '@/lib/utils/generateId';
import { useAI, isCategorizedResult, ManipulatedItem } from '@/lib/hooks/useAI';
import { DictateButton } from '@/components/DictateButton';
import { API } from '@/lib/api';
import { useRecentLists, SavedList } from '@/lib/hooks/useRecentLists';
import { useHomeTheme } from '@/lib/hooks/useHomeTheme';
import { HomeThemeModal } from '@/mobile/components/HomeThemeModal';
import { SaveAsTemplateModal } from '@/mobile/components/SaveAsTemplateModal';
import { OnboardingWalkthrough } from '@/mobile/components/OnboardingWalkthrough';
import { useOnboardingState } from '@/mobile/hooks/useOnboardingState';
import { ThemeColors } from '@/lib/gemini';
import { useAppState } from '@/mobile/context/AppStateContext';
import { usePersonalTemplates, PersonalTemplate } from '@/mobile/hooks/usePersonalTemplates';
import { TemplateCategory } from '@/types';
import { analytics } from '@/lib/analytics';

const TUTORIAL_COMPLETED_KEY = 'listo_tutorial_completed';

// Category icons for templates
function CategoryIcon({ category, style }: { category: TemplateCategory; style?: React.CSSProperties }) {
  const props = { style: style || { width: '20px', height: '20px' }, fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' };

  switch (category) {
    case 'travel':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      );
    case 'shopping':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      );
    case 'productivity':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case 'cooking':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
    case 'events':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case 'health':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      );
    case 'home':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      );
    case 'work':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    case 'education':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      );
  }
}

// Tutorial list theme (same as web)
const TUTORIAL_THEME: ThemeColors = {
  primary: "#8B5CF6",
  primaryDark: "#7C3AED",
  primaryLight: "#A78BFA",
  primaryPale: "#EDE9FE",
  primaryGlow: "rgba(139, 92, 246, 0.3)",
  textPrimary: "#1F2937",
  textSecondary: "#4B5563",
  textMuted: "#6B7280",
  textPlaceholder: "#9CA3AF",
  bgPrimary: "#FDFCFF",
  bgSecondary: "#F5F3FF",
  bgHover: "#EDE9FE",
  borderLight: "#E9E5FF",
  borderMedium: "#DDD6FE",
  error: "#EF4444",
};

// Build tutorial items from translations
type TFunction = (key: string, options?: { returnObjects?: boolean }) => string | string[];

function buildTutorialItems(t: TFunction): { content: string; parent: string | null }[] {
  const sections = ['gettingStarted', 'aiMagic', 'proTips', 'ready'] as const;
  const items: { content: string; parent: string | null }[] = [];

  for (const section of sections) {
    const title = t(`tutorial.${section}.title`) as string;
    items.push({ content: title, parent: null });

    const sectionItems = t(`tutorial.${section}.items`, { returnObjects: true }) as string[];
    if (Array.isArray(sectionItems)) {
      for (const item of sectionItems) {
        items.push({ content: item, parent: title });
      }
    }
  }

  return items;
}

// Swipeable List Row Component
interface SwipeableListRowProps {
  list: SavedList;
  onNavigate: () => void;
  onDelete: () => void;
  onShare: () => void;
  onDuplicate: () => void;
  onSaveAsTemplate: () => void;
  untitledLabel: string;
}

function SwipeableListRow({ list, onNavigate, onDelete, onShare, onDuplicate, onSaveAsTemplate, untitledLabel }: SwipeableListRowProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const swipeDirection = useRef<'horizontal' | 'vertical' | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const ACTION_WIDTH = 56; // Width of each action button
  const TOTAL_ACTIONS_WIDTH = ACTION_WIDTH * 4; // Template + Duplicate + Share + Delete
  const SNAP_THRESHOLD = ACTION_WIDTH / 2;

  // Get theme color for icons (use list's theme or default primary)
  const iconColor = list.themeTextColor || 'var(--primary)';

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
    if (swipeDirection.current === null && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
      swipeDirection.current = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
    }

    if (swipeDirection.current !== 'horizontal') return;

    e.preventDefault();

    // Calculate new offset (negative = swipe left to reveal)
    let newOffset = swipeOffset + deltaX;

    // Limit swipe: can't swipe right past 0, can't swipe left past actions width + some resistance
    newOffset = Math.min(0, Math.max(-TOTAL_ACTIONS_WIDTH - 20, newOffset));

    // Add resistance when over-swiping
    if (newOffset < -TOTAL_ACTIONS_WIDTH) {
      const overSwipe = -TOTAL_ACTIONS_WIDTH - newOffset;
      newOffset = -TOTAL_ACTIONS_WIDTH - (overSwipe * 0.3);
    }

    setSwipeOffset(newOffset);
    touchStartX.current = touch.clientX;
  };

  const handleTouchEnd = () => {
    setIsSwipeActive(false);
    swipeDirection.current = null;

    // Snap to open or closed
    if (swipeOffset < -SNAP_THRESHOLD) {
      setSwipeOffset(-TOTAL_ACTIONS_WIDTH);
    } else {
      setSwipeOffset(0);
    }
  };

  const handleClick = () => {
    if (swipeOffset < -10) {
      // If swiped open, close it
      setSwipeOffset(0);
    } else {
      onNavigate();
    }
  };

  const closeSwipe = () => setSwipeOffset(0);

  return (
    <div className="relative overflow-hidden">
      {/* Action buttons (behind the row) */}
      <div className="absolute right-0 top-0 bottom-0 flex items-center">
        {/* Template */}
        <button
          onClick={() => { onSaveAsTemplate(); closeSwipe(); }}
          className="flex items-center justify-center active:opacity-60"
          style={{ width: `${ACTION_WIDTH}px`, height: '100%', color: iconColor }}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
          </svg>
        </button>
        {/* Duplicate */}
        <button
          onClick={() => { onDuplicate(); closeSwipe(); }}
          className="flex items-center justify-center active:opacity-60"
          style={{ width: `${ACTION_WIDTH}px`, height: '100%', color: iconColor }}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
        {/* Share */}
        <button
          onClick={() => { onShare(); closeSwipe(); }}
          className="flex items-center justify-center active:opacity-60"
          style={{ width: `${ACTION_WIDTH}px`, height: '100%', color: iconColor }}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </button>
        {/* Delete */}
        <button
          onClick={() => { onDelete(); closeSwipe(); }}
          className="flex items-center justify-center active:opacity-60"
          style={{ width: `${ACTION_WIDTH}px`, height: '100%', color: '#FF3B30' }}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Main row content */}
      <div
        ref={rowRef}
        className="flex items-center active:bg-gray-100 transition-colors relative"
        style={{
          padding: '12px 0',
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwipeActive ? 'none' : 'transform 0.25s ease-out',
          backgroundColor: 'var(--bg-primary)',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
      >
        <div
          className="rounded-lg flex-shrink-0 flex items-center justify-center"
          style={{
            width: '44px',
            height: '44px',
            backgroundColor: list.themeColor || 'var(--bg-secondary)',
            border: '1px solid var(--border-light)',
          }}
        >
          {list.itemCount !== undefined && list.itemCount > 0 && (
            <span
              className="font-semibold"
              style={{
                fontSize: '12px',
                color: list.themeTextColor || 'var(--primary)',
              }}
            >
              {list.completedCount || 0}/{list.itemCount}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0" style={{ marginLeft: '14px' }}>
          <div
            className="font-medium truncate"
            style={{ color: 'var(--text-primary)', fontSize: '17px' }}
          >
            {list.title || untitledLabel}
          </div>
        </div>
        <svg
          className="flex-shrink-0"
          style={{ width: '20px', height: '20px', color: '#c7c7cc', marginLeft: '8px' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}

// Swipeable Template Row Component
interface SwipeableTemplateRowProps {
  template: PersonalTemplate;
  onUse: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

function SwipeableTemplateRow({ template, onUse, onEdit, onDelete, onDuplicate }: SwipeableTemplateRowProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const swipeDirection = useRef<'horizontal' | 'vertical' | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const ACTION_WIDTH = 56;
  const TOTAL_ACTIONS_WIDTH = ACTION_WIDTH * 3; // Edit + Duplicate + Delete
  const SNAP_THRESHOLD = ACTION_WIDTH / 2;

  const primaryColor = template.theme?.primary || 'var(--primary)';
  const bgColor = template.theme?.primaryPale || 'var(--primary-pale)';

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

    if (swipeDirection.current === null && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
      swipeDirection.current = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
    }

    if (swipeDirection.current !== 'horizontal') return;

    e.preventDefault();

    let newOffset = swipeOffset + deltaX;
    newOffset = Math.min(0, Math.max(-TOTAL_ACTIONS_WIDTH - 20, newOffset));

    if (newOffset < -TOTAL_ACTIONS_WIDTH) {
      const overSwipe = -TOTAL_ACTIONS_WIDTH - newOffset;
      newOffset = -TOTAL_ACTIONS_WIDTH - (overSwipe * 0.3);
    }

    setSwipeOffset(newOffset);
    touchStartX.current = touch.clientX;
  };

  const handleTouchEnd = () => {
    setIsSwipeActive(false);
    swipeDirection.current = null;

    if (swipeOffset < -SNAP_THRESHOLD) {
      setSwipeOffset(-TOTAL_ACTIONS_WIDTH);
    } else {
      setSwipeOffset(0);
    }
  };

  const handleClick = () => {
    if (swipeOffset < -10) {
      setSwipeOffset(0);
    } else {
      onUse();
    }
  };

  const closeSwipe = () => setSwipeOffset(0);

  return (
    <div className="relative overflow-hidden">
      {/* Action buttons (behind the row) */}
      <div className="absolute right-0 top-0 bottom-0 flex items-center">
        {/* Edit */}
        <button
          onClick={() => { onEdit(); closeSwipe(); }}
          className="flex items-center justify-center active:opacity-60"
          style={{ width: `${ACTION_WIDTH}px`, height: '100%', color: primaryColor }}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        {/* Duplicate */}
        <button
          onClick={() => { onDuplicate(); closeSwipe(); }}
          className="flex items-center justify-center active:opacity-60"
          style={{ width: `${ACTION_WIDTH}px`, height: '100%', color: primaryColor }}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
        {/* Delete */}
        <button
          onClick={() => { onDelete(); closeSwipe(); }}
          className="flex items-center justify-center active:opacity-60"
          style={{ width: `${ACTION_WIDTH}px`, height: '100%', color: '#FF3B30' }}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Main row content */}
      <div
        ref={rowRef}
        className="flex items-center active:opacity-70 transition-opacity relative"
        style={{
          padding: '12px 0',
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwipeActive ? 'none' : 'transform 0.25s ease-out',
          backgroundColor: 'var(--bg-primary)',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
      >
        {/* Category icon badge */}
        <div
          className="flex-shrink-0 rounded-lg flex items-center justify-center"
          style={{
            width: '44px',
            height: '44px',
            backgroundColor: bgColor,
            border: '1px solid var(--border-light)',
            color: primaryColor,
          }}
        >
          <CategoryIcon category={template.category} style={{ width: '20px', height: '20px' }} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0" style={{ marginLeft: '14px' }}>
          <div
            className="font-medium truncate"
            style={{ color: 'var(--text-primary)', fontSize: '17px' }}
          >
            {template.title}
          </div>
        </div>

        {/* Plus icon - indicates creating a new list */}
        <svg
          className="flex-shrink-0"
          style={{ width: '22px', height: '22px', color: 'var(--primary)', marginLeft: '8px' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </div>
    </div>
  );
}

type InputMode = 'single' | 'multiple' | 'ai';

// Normalize iOS smart punctuation to standard characters
function normalizeInput(text: string): string {
  return text
    .replace(/…/g, '...') // iOS ellipsis → three periods
    .replace(/–/g, '--')  // iOS en-dash → two dashes
    .replace(/—/g, '--'); // iOS em-dash → two dashes
}

// Sparkles icon component
const SparklesIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0L13.5 8.5L22 10L13.5 11.5L12 20L10.5 11.5L2 10L10.5 8.5L12 0Z" />
    <path d="M18 14L18.75 17.25L22 18L18.75 18.75L18 22L17.25 18.75L14 18L17.25 17.25L18 14Z" opacity="0.7" />
    <path d="M6 14L6.5 16.5L9 17L6.5 17.5L6 20L5.5 17.5L3 17L5.5 16.5L6 14Z" opacity="0.5" />
  </svg>
);

export default function HomePage() {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isPlaceholderFading, setIsPlaceholderFading] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTipsModal, setShowTipsModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [deleteConfirmList, setDeleteConfirmList] = useState<SavedList | null>(null);
  const [duplicateConfirmList, setDuplicateConfirmList] = useState<SavedList | null>(null);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'web'>('web');
  const navigate = useNavigate();
  const { generateItems, processDictation } = useAI();
  const { lists: recentLists, archivedLists, addList, archiveList, restoreList, deleteList } = useRecentLists();
  const [showArchived, setShowArchived] = useState(false);
  const { theme: homeTheme, description: homeThemeDescription, setHomeTheme, clearHomeTheme, isLoading: isHomeThemeLoading } = useHomeTheme();
  const { preloadList, getCachedList, setHomeTheme: setAppHomeTheme } = useAppState();
  const [isCreatingTutorial, setIsCreatingTutorial] = useState(false);
  const [tutorialCompleted, setTutorialCompleted] = useState(true); // Default to true to hide until loaded
  const [templateModalList, setTemplateModalList] = useState<SavedList | null>(null);
  const { templates: personalTemplates, addTemplate, removeTemplate, updateTemplate, isLoading: isTemplatesLoading } = usePersonalTemplates();
  const { hasCompletedOnboarding, completeOnboarding } = useOnboardingState();

  // Template action states
  const [useTemplateConfirm, setUseTemplateConfirm] = useState<PersonalTemplate | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<PersonalTemplate | null>(null);
  const [deleteTemplateConfirm, setDeleteTemplateConfirm] = useState<PersonalTemplate | null>(null);

  // Sync home theme with AppStateContext for synchronous access from List page
  useEffect(() => {
    setAppHomeTheme(homeTheme);
  }, [homeTheme, setAppHomeTheme]);

  // Detect platform for safe-area handling
  useEffect(() => {
    Device.getInfo().then(info => {
      setPlatform(info.platform as 'ios' | 'android' | 'web');
    });
  }, []);

  // Load tutorial completed state from Preferences
  useEffect(() => {
    Preferences.get({ key: TUTORIAL_COMPLETED_KEY }).then(({ value }) => {
      setTutorialCompleted(value === 'true');
    });
  }, []);

  // Preload visible lists for instant navigation
  useEffect(() => {
    // Preload first 5 lists immediately
    const listsToPreload = recentLists.slice(0, 5);
    listsToPreload.forEach(list => {
      // Only preload if not already cached
      if (!getCachedList(list.id)) {
        preloadList(list.id);
      }
    });
  }, [recentLists, preloadList, getCachedList]);

  // Get translated placeholders
  const placeholders = t('mobile.placeholders', { returnObjects: true }) as string[];

  // Build tutorial list data from translations
  const tutorialList = useMemo(() => {
    const title = t('tutorial.listTitle') as string;
    const items = buildTutorialItems(t);
    return { title, items, theme: TUTORIAL_THEME };
  }, [t]);

  // Check if tutorial has been completed (persisted in Preferences)
  const hasTutorialList = tutorialCompleted;

  // Create tutorial list in Supabase when clicked
  const createTutorialList = async () => {
    if (isCreatingTutorial) return;
    setIsCreatingTutorial(true);

    try {
      const listId = generateListId();

      // Create the list with tutorial theme
      const { error: listError } = await supabase
        .from('lists')
        .insert({
          id: listId,
          title: tutorialList.title,
          theme: tutorialList.theme,
        });

      if (listError) throw listError;

      // Create ID mapping for parent references
      const idMapping: Record<string, string> = {};

      // Insert items - headers first, then children
      let position = 0;
      for (const item of tutorialList.items) {
        if (item.parent === null) {
          // This is a header/category
          const { data } = await supabase
            .from('items')
            .insert({
              list_id: listId,
              content: item.content,
              completed: false,
              parent_id: null,
              position: position++,
            })
            .select()
            .single();

          if (data) {
            idMapping[item.content] = data.id;
          }
        }
      }

      // Now insert children with parent references
      for (const item of tutorialList.items) {
        if (item.parent !== null) {
          const parentId = idMapping[item.parent];
          await supabase
            .from('items')
            .insert({
              list_id: listId,
              content: item.content,
              completed: false,
              parent_id: parentId || null,
              position: position++,
            });
        }
      }

      // Mark tutorial as completed in Preferences
      await Preferences.set({ key: TUTORIAL_COMPLETED_KEY, value: 'true' });
      setTutorialCompleted(true);

      // Add to recent lists
      addList(listId, tutorialList.title, tutorialList.theme.bgSecondary);

      // Track analytics
      analytics.listCreated('tutorial');

      // Navigate to the new list
      navigate(`/${listId}`);
    } catch (err) {
      console.error('Failed to create tutorial list:', err);
      setIsCreatingTutorial(false);
    }
  };

  // Apply theme to CSS variables
  const applyThemeToRoot = useCallback((theme: ThemeColors | null) => {
    const root = document.documentElement;
    if (theme) {
      root.style.setProperty('--primary', theme.primary);
      root.style.setProperty('--primary-dark', theme.primaryDark);
      root.style.setProperty('--primary-light', theme.primaryLight);
      root.style.setProperty('--primary-pale', theme.primaryPale);
      root.style.setProperty('--primary-glow', theme.primaryGlow);
      root.style.setProperty('--text-primary', theme.textPrimary);
      root.style.setProperty('--text-secondary', theme.textSecondary);
      root.style.setProperty('--text-muted', theme.textMuted);
      root.style.setProperty('--text-placeholder', theme.textPlaceholder);
      root.style.setProperty('--bg-primary', theme.bgPrimary);
      root.style.setProperty('--bg-secondary', theme.bgSecondary);
      root.style.setProperty('--bg-hover', theme.bgHover);
      root.style.setProperty('--border-light', theme.borderLight);
      root.style.setProperty('--border-medium', theme.borderMedium);
      root.style.setProperty('--error', theme.error);
    } else {
      root.style.removeProperty('--primary');
      root.style.removeProperty('--primary-dark');
      root.style.removeProperty('--primary-light');
      root.style.removeProperty('--primary-pale');
      root.style.removeProperty('--primary-glow');
      root.style.removeProperty('--text-primary');
      root.style.removeProperty('--text-secondary');
      root.style.removeProperty('--text-muted');
      root.style.removeProperty('--text-placeholder');
      root.style.removeProperty('--bg-primary');
      root.style.removeProperty('--bg-secondary');
      root.style.removeProperty('--bg-hover');
      root.style.removeProperty('--border-light');
      root.style.removeProperty('--border-medium');
      root.style.removeProperty('--error');
    }
  }, []);

  // Apply home theme on mount and when theme changes
  // IMPORTANT: Don't apply theme while still loading from storage
  // This preserves any theme applied before navigation (e.g., from List.tsx handleBack)
  useEffect(() => {
    if (isHomeThemeLoading) return;
    applyThemeToRoot(homeTheme);
  }, [homeTheme, isHomeThemeLoading, applyThemeToRoot]);

  // Handle theme generation
  const handleHomeThemeGenerate = async (description: string) => {
    const response = await fetch(API.theme, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Theme generation failed');
    }

    const { theme } = await response.json();
    applyThemeToRoot(theme);
    await setHomeTheme(theme, description);
  };

  // Handle theme reset
  const handleHomeThemeReset = async () => {
    applyThemeToRoot(null);
    await clearHomeTheme();
  };

  // Share a list using native share sheet
  const handleShare = async (listId: string, title: string | null) => {
    const url = `https://listo.to/${listId}`;
    const shareTitle = title || 'My List';

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: `Check out my list: ${shareTitle}`,
          url: url,
        });
        analytics.listShared('native_share');
      } catch (err) {
        // User cancelled or share failed, ignore
        if ((err as Error).name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(url);
      analytics.listShared('copy_link');
    }
  };

  // Duplicate a list with all items (unchecked)
  const handleDuplicate = async (sourceListId: string, sourceTitle: string | null, sourceThemeColor: string | null) => {
    try {
      // Generate new list ID
      const newListId = generateListId();
      const newTitle = sourceTitle ? `${sourceTitle} (Copy)` : 'Untitled List (Copy)';

      // Fetch source list to get theme
      const { data: sourceList } = await supabase
        .from('lists')
        .select('theme')
        .eq('id', sourceListId)
        .single();

      // Create the new list with theme
      const { error: listError } = await supabase
        .from('lists')
        .insert({
          id: newListId,
          title: newTitle,
          theme: sourceList?.theme || null,
        });

      if (listError) throw listError;

      // Fetch all items from source list
      const { data: sourceItems, error: fetchError } = await supabase
        .from('items')
        .select('*')
        .eq('list_id', sourceListId)
        .order('position', { ascending: true });

      if (fetchError) throw fetchError;

      if (sourceItems && sourceItems.length > 0) {
        // Create a mapping from old IDs to new IDs for parent relationships
        const idMapping: Record<string, string> = {};

        // First pass: create ID mappings
        sourceItems.forEach((item) => {
          idMapping[item.id] = crypto.randomUUID();
        });

        // Second pass: insert items with new IDs and mapped parent_ids
        const newItems = sourceItems.map((item) => ({
          id: idMapping[item.id],
          list_id: newListId,
          content: item.content,
          completed: false, // All items start unchecked
          parent_id: item.parent_id ? idMapping[item.parent_id] : null,
          position: item.position,
        }));

        const { error: itemsError } = await supabase
          .from('items')
          .insert(newItems);

        if (itemsError) throw itemsError;
      }

      // Add to recent lists
      addList(newListId, newTitle, sourceThemeColor);

      // Navigate to new list
      navigate(`/${newListId}`);
    } catch (err) {
      console.error('Duplicate failed:', err);
    }
  };

  // Save list as template
  const handleSaveAsTemplate = async (
    list: SavedList,
    data: { title: string; description: string; category: TemplateCategory; shareWithCommunity: boolean }
  ) => {
    // Fetch item count from Supabase
    const { count } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('list_id', list.id);

    // Fetch full theme from Supabase if list has a theme color
    let theme: ThemeColors | null = null;
    if (list.themeColor) {
      const { data: listData } = await supabase
        .from('lists')
        .select('theme')
        .eq('id', list.id)
        .single();
      theme = listData?.theme || null;
    }

    // Save to personal templates locally
    await addTemplate({
      title: data.title,
      description: data.description,
      category: data.category,
      listId: list.id,
      theme: theme,
      itemCount: count || 0,
    });

    // If sharing with community, also submit to the review queue
    if (data.shareWithCommunity) {
      try {
        const response = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            list_id: list.id,
            title: data.title,
            description: data.description,
            category: data.category,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to submit template');
        }
      } catch (error) {
        console.error('Failed to submit template to community:', error);
        // Still saved locally, so don't throw
      }
    }

    analytics.templateCreated(data.shareWithCommunity ? 'community' : 'personal');
    setTemplateModalList(null);
  };

  // Use template - create a new list from template
  const handleUseTemplate = async (template: PersonalTemplate) => {
    try {
      const newListId = generateListId();

      // Create the new list (empty title so user can name it)
      const { error: listError } = await supabase
        .from('lists')
        .insert({
          id: newListId,
          title: '',
          theme: template.theme || null,
        });

      if (listError) throw listError;

      // Fetch all items from source list
      const { data: sourceItems, error: fetchError } = await supabase
        .from('items')
        .select('*')
        .eq('list_id', template.listId)
        .order('position', { ascending: true });

      if (fetchError) throw fetchError;

      if (sourceItems && sourceItems.length > 0) {
        const idMapping: Record<string, string> = {};
        sourceItems.forEach((item) => {
          idMapping[item.id] = crypto.randomUUID();
        });

        const newItems = sourceItems.map((item) => ({
          id: idMapping[item.id],
          list_id: newListId,
          content: item.content,
          completed: false,
          parent_id: item.parent_id ? idMapping[item.parent_id] : null,
          position: item.position,
        }));

        const { error: itemsError } = await supabase
          .from('items')
          .insert(newItems);

        if (itemsError) throw itemsError;
      }

      // Add to recent lists
      const themeColor = template.theme?.primaryPale || null;
      addList(newListId, '', themeColor);

      // Navigate to new list
      navigate(`/${newListId}`);
    } catch (err) {
      console.error('Use template failed:', err);
    }
    setUseTemplateConfirm(null);
  };

  // Edit template - update template details
  const handleEditTemplate = async (
    template: PersonalTemplate,
    data: { title: string; description: string; category: TemplateCategory; shareWithCommunity: boolean }
  ) => {
    await updateTemplate(template.id, {
      title: data.title,
      description: data.description,
      category: data.category,
    });

    // If sharing with community, submit to review queue
    if (data.shareWithCommunity) {
      try {
        const response = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            list_id: template.listId,
            title: data.title,
            description: data.description,
            category: data.category,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to submit template');
        }
      } catch (error) {
        console.error('Failed to submit template to community:', error);
      }
    }

    setEditingTemplate(null);
  };

  // Duplicate template - create a copy of the template
  const handleDuplicateTemplate = async (template: PersonalTemplate) => {
    await addTemplate({
      title: `${template.title} (Copy)`,
      description: template.description,
      category: template.category,
      listId: template.listId,
      theme: template.theme,
      itemCount: template.itemCount,
    });
  };

  // Rotate placeholders every 2.5 seconds
  useEffect(() => {
    if (!placeholders || placeholders.length === 0) return;
    const interval = setInterval(() => {
      setIsPlaceholderFading(true);
      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
        setIsPlaceholderFading(false);
      }, 200);
    }, 2500);

    return () => clearInterval(interval);
  }, [placeholders]);

  // Detect input mode based on content
  const { mode, displayText } = useMemo(() => {
    const normalized = normalizeInput(value);
    const trimmed = normalized.trim();

    // AI mode: . (single period) or ... (ellipsis)
    if (trimmed.startsWith('...') || (trimmed.startsWith('.') && !trimmed.startsWith('..'))) {
      const prompt = trimmed.startsWith('...') ? trimmed.slice(3).trim() : trimmed.slice(1).trim();
      return {
        mode: 'ai' as InputMode,
        displayText: prompt ? t('input.modes.generate') : ''
      };
    }

    if (trimmed.includes(',')) {
      const items = trimmed.split(',').map(s => s.trim()).filter(Boolean);
      return {
        mode: 'multiple' as InputMode,
        displayText: t('input.modes.addingItems', { count: items.length })
      };
    }

    return { mode: 'single' as InputMode, displayText: '' };
  }, [value, t]);

  const parseThemeFromInput = (input: string): { content: string; themeDescription: string | null } => {
    const themePatterns = [
      /\s*~\s*(.+)$/i,
      /\s*theme:\s*(.+)$/i,
      /\s*style:\s*(.+)$/i,
    ];

    for (const pattern of themePatterns) {
      const match = input.match(pattern);
      if (match) {
        const themeDescription = match[1].trim();
        const content = input.replace(pattern, '').trim();
        return { content, themeDescription };
      }
    }

    return { content: input, themeDescription: null };
  };

  const handleCreate = async (forceAI = false) => {
    if (isCreating) return;

    const normalized = normalizeInput(value);
    const trimmed = normalized.trim();
    if (!trimmed) {
      setIsCreating(true);
      const listId = generateListId();
      await supabase.from('lists').insert({ id: listId, title: null, theme: homeTheme || null });
      addList(listId);
      analytics.listCreated('manual');
      navigate(`/${listId}`);
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const { content: inputWithoutTheme, themeDescription } = parseThemeFromInput(trimmed);

      const listId = generateListId();

      const { error: listError } = await supabase
        .from('lists')
        .insert({ id: listId, title: null });

      if (listError) throw listError;

      let itemsToAdd: string[] = [];
      let categorizedItems: ManipulatedItem[] | null = null;

      const isAIPrefix = inputWithoutTheme.startsWith('...') || (inputWithoutTheme.startsWith('.') && !inputWithoutTheme.startsWith('..'));
      if (forceAI || isAIPrefix) {
        const prompt = inputWithoutTheme.startsWith('...')
          ? inputWithoutTheme.slice(3).trim()
          : inputWithoutTheme.startsWith('.')
            ? inputWithoutTheme.slice(1).trim()
            : inputWithoutTheme;
        if (prompt) {
          const result = await generateItems(prompt);
          if (isCategorizedResult(result)) {
            categorizedItems = result;
          } else {
            itemsToAdd = result;
          }
        }
      } else if (inputWithoutTheme.includes(',')) {
        itemsToAdd = inputWithoutTheme.split(',').map(s => s.trim()).filter(Boolean);
      } else if (inputWithoutTheme) {
        itemsToAdd = [inputWithoutTheme];
      }

      if (categorizedItems && categorizedItems.length > 0) {
        const idMapping: Record<string, string> = {};

        const headers = categorizedItems.filter(item => !item.parent_id);
        for (const header of headers) {
          const { data } = await supabase
            .from('items')
            .insert({
              list_id: listId,
              content: header.content,
              completed: false,
              parent_id: null,
              position: header.position,
            })
            .select()
            .single();

          if (data) {
            idMapping[header.id] = data.id;
          }
        }

        const children = categorizedItems.filter(item => item.parent_id);
        for (const child of children) {
          const realParentId = child.parent_id ? idMapping[child.parent_id] : null;

          await supabase
            .from('items')
            .insert({
              list_id: listId,
              content: child.content,
              completed: false,
              parent_id: realParentId,
              position: child.position,
            });
        }
      } else if (itemsToAdd.length > 0) {
        const itemInserts = itemsToAdd.map((content, index) => ({
          list_id: listId,
          content,
          position: index,
        }));

        await supabase.from('items').insert(itemInserts);
      }

      if (themeDescription) {
        try {
          const themeResponse = await fetch(API.theme, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: themeDescription }),
          });

          if (themeResponse.ok) {
            const { theme } = await themeResponse.json();
            await supabase
              .from('lists')
              .update({ theme })
              .eq('id', listId);
          }
        } catch (themeErr) {
          console.error('Theme generation failed:', themeErr);
        }
      } else if (homeTheme) {
        // Inherit home theme if no explicit theme was requested
        await supabase
          .from('lists')
          .update({ theme: homeTheme })
          .eq('id', listId);
      }

      addList(listId);
      // Track with appropriate method
      const method = (forceAI || isAIPrefix) ? 'ai' : 'manual';
      analytics.listCreated(method);
      navigate(`/${listId}`);
    } catch (err) {
      console.error('Failed to create list:', err);
      setError(err instanceof Error ? err.message : 'Failed to create list');
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const forceAI = e.ctrlKey || e.metaKey;
      handleCreate(forceAI);
    }
  };

  const handleDictation = async (transcription: string) => {
    if (!transcription.trim() || isCreating) return;

    setIsCreating(true);
    setError(null);

    try {
      const listId = generateListId();

      // Process dictation to extract title and items
      const { title, items } = await processDictation(transcription);

      // Create list with extracted title (if any)
      const { error: listError } = await supabase
        .from('lists')
        .insert({ id: listId, title: title || null, theme: homeTheme || null });

      if (listError) throw listError;

      if (isCategorizedResult(items)) {
        const idMapping: Record<string, string> = {};

        const headers = items.filter(item => !item.parent_id);
        for (const header of headers) {
          const { data } = await supabase
            .from('items')
            .insert({
              list_id: listId,
              content: header.content,
              completed: false,
              parent_id: null,
              position: header.position,
            })
            .select()
            .single();

          if (data) {
            idMapping[header.id] = data.id;
          }
        }

        const children = items.filter(item => item.parent_id);
        for (const child of children) {
          const realParentId = child.parent_id ? idMapping[child.parent_id] : null;

          await supabase
            .from('items')
            .insert({
              list_id: listId,
              content: child.content,
              completed: false,
              parent_id: realParentId,
              position: child.position,
            });
        }
      } else if (items.length > 0) {
        const itemInserts = (items as string[]).map((content, index) => ({
          list_id: listId,
          content,
          position: index,
        }));

        await supabase.from('items').insert(itemInserts);
      }

      // Save to recent lists with title
      addList(listId, title || null, homeTheme?.bgPrimary || null, homeTheme?.primary || null);
      analytics.listCreated('dictation');
      navigate(`/${listId}`);
    } catch (err) {
      console.error('Failed to create list from dictation:', err);
      setError(err instanceof Error ? err.message : 'Failed to create list');
      setIsCreating(false);
    }
  };

  // Safe area padding - Android doesn't support env(safe-area-inset-*) in WebView
  const safeAreaTop = platform === 'android' ? '36px' : 'env(safe-area-inset-top, 0px)';
  const safeAreaBottom = platform === 'android' ? '24px' : 'env(safe-area-inset-bottom, 0px)';

  return (
    <div
      className="flex flex-col"
      style={{
        backgroundColor: 'var(--bg-primary)',
        paddingTop: safeAreaTop,
        height: '100dvh',
        minHeight: '100vh',
      }}
    >
      {/* Fixed Header Section */}
      <div className="flex-shrink-0" style={{ backgroundColor: 'var(--bg-primary)' }}>
        {/* Header */}
        <div className="flex items-center justify-between" style={{ padding: '16px 20px 0 20px' }}>
          <div className="flex items-baseline gap-2">
            <h1 className="text-xl font-bold uppercase tracking-[0.15em]" style={{ color: 'var(--text-primary)' }}>
              {t('home.title')}
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('mobile.taglineShort')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowThemeModal(true)}
              className="active:opacity-60"
              style={{ color: 'var(--primary)' }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.61-.23-1.2-.64-1.67-.08-.1-.13-.21-.13-.33 0-.28.22-.5.5-.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 8 6.5 8 8 8.67 8 9.5 7.33 11 6.5 11zm3-4C8.67 7 8 6.33 8 5.5S8.67 4 9.5 4s1.5.67 1.5 1.5S10.33 7 9.5 7zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 4 14.5 4s1.5.67 1.5 1.5S15.33 7 14.5 7zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 8 17.5 8s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
              </svg>
            </button>
            <button
              onClick={() => setShowTipsModal(true)}
              className="font-medium"
              style={{ color: 'var(--primary)', fontSize: '15px' }}
            >
              {t('mobile.tips.title')}
            </button>
          </div>
        </div>

        {/* Create List Input */}
        <div style={{ padding: '20px 20px 0 20px' }}>
          {/* Create List Input */}
        <div className="relative">
          <div className="flex">
            <div className="relative flex-1">
              <input
                type="text"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(null);
                }}
                onKeyDown={handleKeyDown}
                disabled={isCreating}
                className={`
                  w-full text-base
                  border border-r-0
                  focus:border-[var(--primary)] focus:shadow-[0_0_0_3px_var(--primary-pale)]
                  outline-none transition-all duration-200
                  disabled:opacity-50
                  ${mode === 'ai' && value.trim().length > 3
                    ? 'border-[var(--primary-light)]'
                    : 'border-gray-200'
                  }
                `}
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px 0 0 12px',
                  fontSize: '17px',
                }}
              />
              {!value && (
                <div
                  className={`
                    absolute left-4 top-0 bottom-0
                    text-gray-400 pointer-events-none
                    transition-opacity duration-200 flex items-center
                    ${isPlaceholderFading ? 'opacity-0' : 'opacity-100'}
                  `}
                  style={{ fontSize: '17px', lineHeight: '1' }}
                >
                  {placeholders[placeholderIndex] || '...'}
                </div>
              )}
            </div>
            <button
              onClick={() => handleCreate(false)}
              disabled={isCreating}
              className="text-white font-semibold transition-all duration-200 disabled:opacity-70"
              style={{
                backgroundColor: 'var(--primary)',
                borderRadius: '0 12px 12px 0',
                padding: '14px 20px',
                fontSize: '17px',
              }}
            >
              {isCreating ? (
                <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                t('home.buttons.create')
              )}
            </button>
          </div>

          {displayText && !isCreating && (
            <div
              className="absolute left-0 flex items-center gap-1 text-xs text-white bg-[var(--primary)] px-2 py-0.5 rounded-sm"
              style={{ top: 'calc(100% + 4px)' }}
            >
              <SparklesIcon />
              {displayText}
            </div>
          )}

          {isCreating && mode === 'ai' && (
            <div
              className="absolute left-0 flex items-center gap-1.5 text-xs text-white bg-[var(--primary)] px-2 py-0.5 rounded-sm"
              style={{ top: 'calc(100% + 4px)' }}
            >
              <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {t('input.processing.thinking')}
            </div>
          )}

          {error && (
            <div
              className="absolute left-0 text-xs text-white bg-red-500 px-2 py-0.5 rounded-sm"
              style={{ top: 'calc(100% + 4px)' }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Dictate button */}
        <div style={{ marginTop: '20px' }}>
          <DictateButton
            onTranscription={handleDictation}
            disabled={isCreating}
            position="inline"
          />
        </div>

        {/* Your Lists Title */}
        {recentLists.length > 0 && (
          <div
            className="font-semibold uppercase tracking-wide text-left"
            style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '24px', marginBottom: '8px' }}
          >
            {t('home.recentLists')}
          </div>
        )}
        </div>
      </div>

      {/* Scrollable Lists Section */}
      <div
        className="flex-1 min-h-0"
        style={{
          paddingLeft: '20px',
          paddingRight: '20px',
          paddingBottom: `calc(100px + ${safeAreaBottom})`,
          overflowY: 'scroll',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Tutorial List Card - visible until user creates it */}
        {!hasTutorialList && (
          <div style={{ marginTop: '8px' }}>
            {recentLists.length === 0 && (
            <div
              className="font-semibold uppercase tracking-wide text-left"
              style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '8px' }}
            >
              {t('home.recentLists')}
            </div>
          )}
          <button
              onClick={createTutorialList}
              disabled={isCreatingTutorial}
              className="w-full flex items-center active:opacity-80 transition-opacity"
              style={{ padding: '12px 0' }}
            >
              <div
                className="rounded-lg flex-shrink-0 flex items-center justify-center"
                style={{
                  width: '44px',
                  height: '44px',
                  backgroundColor: TUTORIAL_THEME.bgSecondary,
                  border: `1px solid ${TUTORIAL_THEME.borderLight}`,
                }}
              >
                <span style={{ fontSize: '18px' }}>✨</span>
              </div>
              <div className="flex-1 min-w-0 text-left" style={{ marginLeft: '14px' }}>
                <div
                  className="font-medium truncate"
                  style={{ color: 'var(--text-primary)', fontSize: '17px' }}
                >
                  {tutorialList.title}
                </div>
                <div
                  className="text-sm truncate"
                  style={{ color: 'var(--text-muted)', marginTop: '2px' }}
                >
                  {t('welcome.subtitle')}
                </div>
              </div>
              {isCreatingTutorial ? (
                <span
                  className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin flex-shrink-0"
                  style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent', marginLeft: '8px' }}
                />
              ) : (
                <svg
                  className="flex-shrink-0"
                  style={{ width: '20px', height: '20px', color: '#c7c7cc', marginLeft: '8px' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          </div>
        )}

        {/* Your Lists */}
        {recentLists.length > 0 && (
          <div>
            {recentLists.map((list) => (
              <SwipeableListRow
                key={list.id}
                list={list}
                onNavigate={() => navigate(`/${list.id}`)}
                onDelete={() => setDeleteConfirmList(list)}
                onShare={() => handleShare(list.id, list.title)}
                onDuplicate={() => setDuplicateConfirmList(list)}
                onSaveAsTemplate={() => setTemplateModalList(list)}
                untitledLabel={t('home.untitledList')}
              />
            ))}
          </div>
        )}

        {/* Archived Lists */}
        {archivedLists.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-2 uppercase tracking-wide"
              style={{ color: 'var(--text-muted)', fontSize: '13px', paddingLeft: '4px' }}
            >
              <svg
                className={`transition-transform ${showArchived ? 'rotate-90' : ''}`}
                style={{ width: '12px', height: '12px' }}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              {t('home.buttons.archived')} ({archivedLists.length})
            </button>
            {showArchived && (
              <div style={{ marginTop: '8px' }}>
                {archivedLists.map((list) => (
                  <div
                    key={list.id}
                    className="flex items-center active:bg-gray-100 transition-colors"
                    style={{ padding: '12px 0' }}
                    onClick={() => navigate(`/${list.id}`)}
                  >
                    <div
                      className="rounded-lg flex-shrink-0 flex items-center justify-center"
                      style={{
                        width: '44px',
                        height: '44px',
                        backgroundColor: list.themeColor || 'var(--bg-secondary)',
                        border: '1px solid var(--border-light)',
                        opacity: 0.5,
                      }}
                    >
                      {list.itemCount !== undefined && list.itemCount > 0 && (
                        <span
                          className="font-semibold"
                          style={{
                            fontSize: '12px',
                            color: list.themeTextColor || 'var(--primary)',
                          }}
                        >
                          {list.completedCount || 0}/{list.itemCount}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0" style={{ marginLeft: '14px' }}>
                      <div
                        className="font-medium truncate"
                        style={{ color: 'var(--text-primary)', fontSize: '17px', opacity: 0.5 }}
                      >
                        {list.title || t('home.untitledList')}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        restoreList(list.id);
                      }}
                      className="text-sm font-medium"
                      style={{ color: 'var(--primary)', marginLeft: '8px' }}
                    >
                      {t('home.buttons.restore')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* My Templates Section */}
        {personalTemplates.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <div
              className="font-semibold uppercase tracking-wide text-left"
              style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '8px' }}
            >
              {t('mobile.myTemplates')}
            </div>
            <div>
              {personalTemplates.map((template) => (
                <SwipeableTemplateRow
                  key={template.id}
                  template={template}
                  onUse={() => setUseTemplateConfirm(template)}
                  onEdit={() => setEditingTemplate(template)}
                  onDelete={() => setDeleteTemplateConfirm(template)}
                  onDuplicate={() => handleDuplicateTemplate(template)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Community Templates Section */}
        <div style={{ marginTop: '32px' }}>
          <div
            className="font-semibold uppercase tracking-wide text-left"
            style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '12px' }}
          >
            {t('templates.communityTemplates')}
          </div>
          <button
            onClick={() => navigate('/templates')}
            className="w-full flex items-center justify-center gap-2 rounded-xl font-medium transition-all active:scale-[0.98]"
            style={{
              padding: '14px 20px',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--primary)',
              border: '1px solid var(--border-light)',
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            {t('home.templates.browseCommunity')}
          </button>
        </div>

        {/* Privacy note - at the bottom, pushed by content */}
        <div className="text-center" style={{ marginTop: '48px', paddingBottom: '20px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.4' }}>
            {t('mobile.privacyNote')}{' '}
            <button
              onClick={() => setShowPrivacyModal(true)}
              className="underline"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('home.privacy.title')}
            </button>
          </p>
        </div>
      </div>

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onClick={() => setShowPrivacyModal(false)}
        >
          <div
            className="w-full max-h-[85vh] overflow-y-auto"
            style={{
              padding: '24px',
              paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
              borderRadius: '20px 20px 0 0',
              backgroundColor: 'var(--bg-primary)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="flex justify-center" style={{ marginBottom: '16px' }}>
              <div style={{ width: '36px', height: '5px', backgroundColor: '#e0e0e0', borderRadius: '3px' }} />
            </div>

            <h2 className="text-lg font-bold text-center" style={{ color: 'var(--text-primary)', marginBottom: '20px' }}>
              {t('home.privacy.title')}
            </h2>

            <div className="space-y-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <section>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{t('home.privacy.sections.publicUse.title')}</h3>
                <p>
                  {t('home.privacy.sections.publicUse.content')}
                </p>
              </section>

              <section>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{t('home.privacy.sections.dataCollection.title')}</h3>
                <p>
                  {t('home.privacy.sections.dataCollection.content')}
                </p>
              </section>

              <section>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{t('home.privacy.sections.contact.title')}</h3>
                <p>
                  {t('home.privacy.sections.contact.content')}{' '}
                  <a href="mailto:hello@listo.to" className="underline" style={{ color: 'var(--primary)' }}>hello@listo.to</a>.
                </p>
              </section>
            </div>

            <button
              onClick={() => setShowPrivacyModal(false)}
              className="w-full text-white rounded-xl font-semibold"
              style={{ backgroundColor: 'var(--primary)', padding: '16px', marginTop: '24px', fontSize: '17px' }}
            >
              {t('mobile.done')}
            </button>
          </div>
        </div>
      )}

      {/* Tips Modal */}
      {showTipsModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onClick={() => setShowTipsModal(false)}
        >
          <div
            className="w-full"
            style={{
              padding: '24px',
              paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
              borderRadius: '20px 20px 0 0',
              backgroundColor: 'var(--bg-primary)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="flex justify-center" style={{ marginBottom: '16px' }}>
              <div style={{ width: '36px', height: '5px', backgroundColor: '#e0e0e0', borderRadius: '3px' }} />
            </div>

            <h2 className="text-lg font-bold text-center" style={{ color: 'var(--text-primary)', marginBottom: '20px' }}>
              {t('mobile.tips.title')}
            </h2>

            <div className="space-y-4" style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
              <div className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'var(--primary-pale)' }}
                >
                  <SparklesIcon />
                </div>
                <div>
                  <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{t('mobile.tips.aiGenerate.title')}</div>
                  <div className="text-sm" style={{ color: 'var(--text-muted)', marginTop: '2px' }} dangerouslySetInnerHTML={{ __html: t('mobile.tips.aiGenerate.description').replace('<code>', '<code class="font-semibold px-1 py-0.5 rounded" style="background-color: var(--primary-pale); color: var(--primary)">') }} />
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'var(--primary-pale)', color: 'var(--primary)' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{t('mobile.tips.multipleItems.title')}</div>
                  <div className="text-sm" style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                    {t('mobile.tips.multipleItems.description')}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'var(--primary-pale)', color: 'var(--primary)' }}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.61-.23-1.2-.64-1.67-.08-.1-.13-.21-.13-.33 0-.28.22-.5.5-.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 8 6.5 8 8 8.67 8 9.5 7.33 11 6.5 11zm3-4C8.67 7 8 6.33 8 5.5S8.67 4 9.5 4s1.5.67 1.5 1.5S10.33 7 9.5 7zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 4 14.5 4s1.5.67 1.5 1.5S15.33 7 14.5 7zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 8 17.5 8s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{t('mobile.tips.customThemes.title')}</div>
                  <div className="text-sm" style={{ color: 'var(--text-muted)', marginTop: '2px' }} dangerouslySetInnerHTML={{ __html: t('mobile.tips.customThemes.description').replace('<code>', '<code class="font-semibold px-1 py-0.5 rounded" style="background-color: var(--primary-pale); color: var(--primary)">') }} />
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'var(--primary-pale)', color: 'var(--primary)' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{t('mobile.tips.aiTransform.title')}</div>
                  <div className="text-sm" style={{ color: 'var(--text-muted)', marginTop: '2px' }} dangerouslySetInnerHTML={{ __html: t('mobile.tips.aiTransform.description').replace('<code>', '<code class="font-semibold px-1 py-0.5 rounded" style="background-color: var(--primary-pale); color: var(--primary)">') }} />
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowTipsModal(false)}
              className="w-full text-white rounded-xl font-semibold"
              style={{ backgroundColor: 'var(--primary)', padding: '16px', marginTop: '24px', fontSize: '17px' }}
            >
              {t('mobile.gotIt')}
            </button>
          </div>
        </div>
      )}

      {/* Home Theme Modal */}
      <HomeThemeModal
        isOpen={showThemeModal}
        onClose={() => setShowThemeModal(false)}
        onGenerate={handleHomeThemeGenerate}
        onReset={homeTheme ? handleHomeThemeReset : undefined}
        hasTheme={!!homeTheme}
      />

      {/* Save as Template Modal */}
      {templateModalList && (
        <SaveAsTemplateModal
          isOpen={true}
          onClose={() => setTemplateModalList(null)}
          onSave={(data) => handleSaveAsTemplate(templateModalList, data)}
          listTitle={templateModalList.title || ''}
          theme={null}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmList && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onClick={() => setDeleteConfirmList(null)}
        >
          <div
            className="rounded-2xl mx-6 overflow-hidden"
            style={{ maxWidth: '300px', width: '100%', backgroundColor: 'var(--bg-primary)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '24px 24px 20px' }}>
              <h3 className="text-lg font-semibold text-center" style={{ color: 'var(--text-primary)' }}>
                {t('mobile.deleteList.title')}
              </h3>
              <p className="text-center" style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>
                {t('mobile.deleteList.message', { title: deleteConfirmList.title || t('home.untitledList') })}
              </p>
            </div>
            <div style={{ borderTop: '1px solid var(--border-light)' }} className="flex">
              <button
                onClick={() => setDeleteConfirmList(null)}
                className="flex-1 font-medium active:opacity-60"
                style={{ color: 'var(--primary)', borderRight: '1px solid var(--border-light)', padding: '16px' }}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => {
                  deleteList(deleteConfirmList.id);
                  setDeleteConfirmList(null);
                }}
                className="flex-1 font-medium active:opacity-60"
                style={{ color: '#FF3B30', padding: '16px' }}
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Confirmation Modal */}
      {duplicateConfirmList && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onClick={() => setDuplicateConfirmList(null)}
        >
          <div
            className="rounded-2xl mx-6 overflow-hidden"
            style={{ maxWidth: '300px', width: '100%', backgroundColor: 'var(--bg-primary)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '24px 24px 20px' }}>
              <h3 className="text-lg font-semibold text-center" style={{ color: 'var(--text-primary)' }}>
                {t('mobile.duplicateList.title')}
              </h3>
              <p className="text-center" style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>
                {t('mobile.duplicateList.message', { title: duplicateConfirmList.title || t('home.untitledList') })}
              </p>
            </div>
            <div style={{ borderTop: '1px solid var(--border-light)' }} className="flex">
              <button
                onClick={() => setDuplicateConfirmList(null)}
                className="flex-1 font-medium active:opacity-60"
                style={{ color: 'var(--text-muted)', borderRight: '1px solid var(--border-light)', padding: '16px' }}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => {
                  handleDuplicate(duplicateConfirmList.id, duplicateConfirmList.title, duplicateConfirmList.themeColor);
                  setDuplicateConfirmList(null);
                }}
                className="flex-1 font-medium active:opacity-60"
                style={{ color: 'var(--primary)', padding: '16px' }}
              >
                {t('mobile.duplicate')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Use Template Confirmation Modal */}
      {useTemplateConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onClick={() => setUseTemplateConfirm(null)}
        >
          <div
            className="rounded-2xl mx-6 overflow-hidden"
            style={{ maxWidth: '300px', width: '100%', backgroundColor: 'var(--bg-primary)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '24px 24px 20px' }}>
              <h3 className="text-lg font-semibold text-center" style={{ color: 'var(--text-primary)' }}>
                {t('mobile.useTemplate.title')}
              </h3>
              <p className="text-center" style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>
                {t('mobile.useTemplate.message')}
              </p>
            </div>
            <div style={{ borderTop: '1px solid var(--border-light)' }} className="flex">
              <button
                onClick={() => setUseTemplateConfirm(null)}
                className="flex-1 font-medium active:opacity-60"
                style={{ color: 'var(--text-muted)', padding: '16px', borderRight: '1px solid var(--border-light)' }}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleUseTemplate(useTemplateConfirm)}
                className="flex-1 font-medium active:opacity-60"
                style={{ color: 'var(--primary)', padding: '16px' }}
              >
                {t('mobile.useTemplate.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Template Modal */}
      {editingTemplate && (
        <SaveAsTemplateModal
          isOpen={true}
          onClose={() => setEditingTemplate(null)}
          onSave={(data) => handleEditTemplate(editingTemplate, data)}
          listTitle={editingTemplate.title}
          listDescription={editingTemplate.description}
          listCategory={editingTemplate.category}
          theme={editingTemplate.theme}
        />
      )}

      {/* Delete Template Confirmation Modal */}
      {deleteTemplateConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onClick={() => setDeleteTemplateConfirm(null)}
        >
          <div
            className="rounded-2xl mx-6 overflow-hidden"
            style={{ maxWidth: '300px', width: '100%', backgroundColor: 'var(--bg-primary)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '24px 24px 20px' }}>
              <h3 className="text-lg font-semibold text-center" style={{ color: 'var(--text-primary)' }}>
                {t('mobile.deleteTemplate.title')}
              </h3>
              <p className="text-center" style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>
                {t('mobile.deleteTemplate.message', { title: deleteTemplateConfirm.title })}
              </p>
            </div>
            <div style={{ borderTop: '1px solid var(--border-light)' }} className="flex">
              <button
                onClick={() => setDeleteTemplateConfirm(null)}
                className="flex-1 font-medium active:opacity-60"
                style={{ color: 'var(--text-muted)', padding: '16px', borderRight: '1px solid var(--border-light)' }}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => {
                  removeTemplate(deleteTemplateConfirm.id);
                  setDeleteTemplateConfirm(null);
                }}
                className="flex-1 font-medium active:opacity-60"
                style={{ color: '#FF3B30', padding: '16px' }}
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding walkthrough - shows on first launch */}
      {hasCompletedOnboarding === false && (
        <OnboardingWalkthrough onComplete={completeOnboarding} />
      )}
    </div>
  );
}
