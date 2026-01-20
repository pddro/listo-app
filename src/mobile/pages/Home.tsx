import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { generateListId } from '@/lib/utils/generateId';
import { useAI, isCategorizedResult, ManipulatedItem } from '@/lib/hooks/useAI';
import { DictateButton } from '@/components/DictateButton';
import { API } from '@/lib/api';
import { useRecentLists, SavedList } from '@/lib/hooks/useRecentLists';
import { useHomeTheme } from '@/lib/hooks/useHomeTheme';
import { HomeThemeModal } from '@/mobile/components/HomeThemeModal';
import { ThemeColors } from '@/lib/gemini';

// Swipeable List Row Component
interface SwipeableListRowProps {
  list: SavedList;
  onNavigate: () => void;
  onDelete: () => void;
  onShare: () => void;
}

function SwipeableListRow({ list, onNavigate, onDelete, onShare }: SwipeableListRowProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const swipeDirection = useRef<'horizontal' | 'vertical' | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const ACTION_WIDTH = 75; // Width of each action button
  const TOTAL_ACTIONS_WIDTH = ACTION_WIDTH * 2; // Delete + Share
  const SNAP_THRESHOLD = ACTION_WIDTH / 2;

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
      <div className="absolute right-0 top-0 bottom-0 flex">
        <button
          onClick={() => { onShare(); closeSwipe(); }}
          className="flex items-center justify-center text-white font-medium"
          style={{ width: `${ACTION_WIDTH}px`, backgroundColor: '#007AFF' }}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        </button>
        <button
          onClick={() => { onDelete(); closeSwipe(); }}
          className="flex items-center justify-center text-white font-medium"
          style={{ width: `${ACTION_WIDTH}px`, backgroundColor: '#FF3B30' }}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
              {(list.itemCount || 0) - (list.completedCount || 0)}/{list.itemCount}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0" style={{ marginLeft: '14px' }}>
          <div
            className="font-medium truncate"
            style={{ color: 'var(--text-primary)', fontSize: '17px' }}
          >
            {list.title || 'Untitled List'}
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

type InputMode = 'single' | 'multiple' | 'ai';

// Normalize iOS smart punctuation to standard characters
function normalizeInput(text: string): string {
  return text
    .replace(/…/g, '...') // iOS ellipsis → three periods
    .replace(/–/g, '--')  // iOS en-dash → two dashes
    .replace(/—/g, '--'); // iOS em-dash → two dashes
}

const PLACEHOLDERS = [
  '...groceries for the week',
  'passport, tickets, charger',
  '...things to pack for camping',
  'lettuce, tomato, bacon',
  '...ingredients for taco night',
  'sunscreen, towel, book',
  '...gift ideas for mom',
  'eggs, milk, butter',
  '...what to bring to the potluck',
  '...packing list for a hike',
];

// Sparkles icon component
const SparklesIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0L13.5 8.5L22 10L13.5 11.5L12 20L10.5 11.5L2 10L10.5 8.5L12 0Z" />
    <path d="M18 14L18.75 17.25L22 18L18.75 18.75L18 22L17.25 18.75L14 18L17.25 17.25L18 14Z" opacity="0.7" />
    <path d="M6 14L6.5 16.5L9 17L6.5 17.5L6 20L5.5 17.5L3 17L5.5 16.5L6 14Z" opacity="0.5" />
  </svg>
);

export default function HomePage() {
  const [value, setValue] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isPlaceholderFading, setIsPlaceholderFading] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTipsModal, setShowTipsModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const navigate = useNavigate();
  const { generateItems } = useAI();
  const { lists: recentLists, archivedLists, addList, archiveList, restoreList, deleteList } = useRecentLists();
  const [showArchived, setShowArchived] = useState(false);
  const { theme: homeTheme, description: homeThemeDescription, setHomeTheme, clearHomeTheme } = useHomeTheme();

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
  useEffect(() => {
    applyThemeToRoot(homeTheme);
  }, [homeTheme, applyThemeToRoot]);

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
      } catch (err) {
        // User cancelled or share failed, ignore
        if ((err as Error).name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(url);
    }
  };

  // Rotate placeholders every 2.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setIsPlaceholderFading(true);
      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
        setIsPlaceholderFading(false);
      }, 200);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  // Detect input mode based on content
  const { mode, displayText } = useMemo(() => {
    const normalized = normalizeInput(value);
    const trimmed = normalized.trim();

    if (trimmed.startsWith('...')) {
      const prompt = trimmed.slice(3).trim();
      return {
        mode: 'ai' as InputMode,
        displayText: prompt ? 'AI will generate items' : ''
      };
    }

    if (trimmed.includes(',')) {
      const items = trimmed.split(',').map(s => s.trim()).filter(Boolean);
      return {
        mode: 'multiple' as InputMode,
        displayText: `Adding ${items.length} items`
      };
    }

    return { mode: 'single' as InputMode, displayText: '' };
  }, [value]);

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
      await supabase.from('lists').insert({ id: listId, title: null });
      addList(listId);
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

      if (forceAI || inputWithoutTheme.startsWith('...')) {
        const prompt = inputWithoutTheme.startsWith('...') ? inputWithoutTheme.slice(3).trim() : inputWithoutTheme;
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
      }

      addList(listId);
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

      const { error: listError } = await supabase
        .from('lists')
        .insert({ id: listId, title: null });

      if (listError) throw listError;

      const result = await generateItems(transcription);

      if (isCategorizedResult(result)) {
        const idMapping: Record<string, string> = {};

        const headers = result.filter(item => !item.parent_id);
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

        const children = result.filter(item => item.parent_id);
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
      } else if (result.length > 0) {
        const itemInserts = result.map((content, index) => ({
          list_id: listId,
          content,
          position: index,
        }));

        await supabase.from('items').insert(itemInserts);
      }

      addList(listId);
      navigate(`/${listId}`);
    } catch (err) {
      console.error('Failed to create list from dictation:', err);
      setError(err instanceof Error ? err.message : 'Failed to create list');
      setIsCreating(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        backgroundColor: 'var(--bg-primary)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between" style={{ padding: '16px 20px 0 20px' }}>
        <div className="flex items-baseline gap-2">
          <h1 className="text-xl font-bold uppercase tracking-[0.15em]" style={{ color: 'var(--text-primary)' }}>
            Listo
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Create a list. Share the link.
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
            Tips
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '20px' }}>
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
                    absolute left-4 top-1/2 -translate-y-1/2
                    text-gray-400 pointer-events-none
                    transition-opacity duration-200
                    ${isPlaceholderFading ? 'opacity-0' : 'opacity-100'}
                  `}
                  style={{ fontSize: '17px' }}
                >
                  {PLACEHOLDERS[placeholderIndex]}
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
                'Create'
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
              AI is thinking...
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

        {/* Your Lists */}
        {recentLists.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <div
              className="font-semibold uppercase tracking-wide text-left"
              style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '8px' }}
            >
              Your Lists
            </div>
            {recentLists.map((list) => (
              <SwipeableListRow
                key={list.id}
                list={list}
                onNavigate={() => navigate(`/${list.id}`)}
                onDelete={() => deleteList(list.id)}
                onShare={() => handleShare(list.id, list.title)}
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
              Archived ({archivedLists.length})
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
                          {(list.itemCount || 0) - (list.completedCount || 0)}/{list.itemCount}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0" style={{ marginLeft: '14px' }}>
                      <div
                        className="font-medium truncate"
                        style={{ color: 'var(--text-primary)', fontSize: '17px', opacity: 0.5 }}
                      >
                        {list.title || 'Untitled List'}
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
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Privacy note - at the bottom, pushed by content */}
        <div className="text-center" style={{ marginTop: '48px', paddingBottom: '20px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.4' }}>
            All lists are public URLs.{' '}
            <button
              onClick={() => setShowPrivacyModal(true)}
              className="underline"
              style={{ color: 'var(--text-muted)' }}
            >
              Privacy Policy
            </button>
          </p>
        </div>
      </div>

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
          onClick={() => setShowPrivacyModal(false)}
        >
          <div
            className="bg-white w-full max-h-[85vh] overflow-y-auto"
            style={{
              padding: '24px',
              paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
              borderRadius: '20px 20px 0 0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="flex justify-center" style={{ marginBottom: '16px' }}>
              <div style={{ width: '36px', height: '5px', backgroundColor: '#e0e0e0', borderRadius: '3px' }} />
            </div>

            <h2 className="text-lg font-bold text-center" style={{ color: 'var(--text-primary)', marginBottom: '20px' }}>
              Privacy Policy
            </h2>

            <div className="space-y-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <section>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Public Use and Sharing</h3>
                <p>
                  LISTO checklists are inherently public. Once you create a list and share its link, anyone with access to that link can view and edit the list.
                </p>
              </section>

              <section>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Data Collection and Use</h3>
                <p>
                  LISTO does not require user registration. All lists are created anonymously.
                </p>
              </section>

              <section>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Contact Information</h3>
                <p>
                  Questions? Reach out at{' '}
                  <a href="mailto:hello@listo.to" className="underline" style={{ color: 'var(--primary)' }}>hello@listo.to</a>.
                </p>
              </section>
            </div>

            <button
              onClick={() => setShowPrivacyModal(false)}
              className="w-full text-white rounded-xl font-semibold"
              style={{ backgroundColor: 'var(--primary)', padding: '16px', marginTop: '24px', fontSize: '17px' }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Tips Modal */}
      {showTipsModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
          onClick={() => setShowTipsModal(false)}
        >
          <div
            className="bg-white w-full"
            style={{
              padding: '24px',
              paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
              borderRadius: '20px 20px 0 0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="flex justify-center" style={{ marginBottom: '16px' }}>
              <div style={{ width: '36px', height: '5px', backgroundColor: '#e0e0e0', borderRadius: '3px' }} />
            </div>

            <h2 className="text-lg font-bold text-center" style={{ color: 'var(--text-primary)', marginBottom: '20px' }}>
              Tips
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
                  <div className="font-medium" style={{ color: 'var(--text-primary)' }}>AI Generate</div>
                  <div className="text-sm" style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                    Start with <code className="font-semibold px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--primary-pale)', color: 'var(--primary)' }}>...</code> to generate items from a prompt
                  </div>
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
                  <div className="font-medium" style={{ color: 'var(--text-primary)' }}>Multiple Items</div>
                  <div className="text-sm" style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                    Use commas to add several items at once
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
                  <div className="font-medium" style={{ color: 'var(--text-primary)' }}>Custom Themes</div>
                  <div className="text-sm" style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                    Type <code className="font-semibold px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--primary-pale)', color: 'var(--primary)' }}>style: ocean</code> in a list to theme it
                  </div>
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
                  <div className="font-medium" style={{ color: 'var(--text-primary)' }}>AI Transform</div>
                  <div className="text-sm" style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                    Use <code className="font-semibold px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--primary-pale)', color: 'var(--primary)' }}>!</code> to reorganize or transform your list
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowTipsModal(false)}
              className="w-full text-white rounded-xl font-semibold"
              style={{ backgroundColor: 'var(--primary)', padding: '16px', marginTop: '24px', fontSize: '17px' }}
            >
              Got it
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
    </div>
  );
}
