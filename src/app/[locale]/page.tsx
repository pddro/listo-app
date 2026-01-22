'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase';
import { generateListId } from '@/lib/utils/generateId';
import { useAI, isCategorizedResult, ManipulatedItem } from '@/lib/hooks/useAI';
import { DictateButton } from '@/components/DictateButton';
import { analytics } from '@/lib/analytics';
import { API } from '@/lib/api';
import { useRecentListsWeb } from '@/lib/hooks/useRecentListsWeb';

type InputMode = 'single' | 'multiple' | 'ai';

// Normalize iOS smart punctuation to standard characters
function normalizeInput(text: string): string {
  return text
    .replace(/…/g, '...') // iOS ellipsis → three periods
    .replace(/–/g, '--')  // iOS en-dash → two dashes
    .replace(/—/g, '--'); // iOS em-dash → two dashes
}

// Tutorial list for new users
const TUTORIAL_LIST = {
  title: "Welcome to Listo! ✨",
  theme: {
    primary: "#8B5CF6",
    primaryDark: "#7C3AED",
    primaryLight: "#A78BFA",
    primaryPale: "#EDE9FE",
    primaryGlow: "rgba(139, 92, 246, 0.3)",
    textPrimary: "#1F2937",
    textSecondary: "#4B5563",
    textMuted: "#9CA3AF",
    textPlaceholder: "#D1D5DB",
    bgPrimary: "#FAF5FF",
    bgSecondary: "#F3E8FF",
    bgHover: "#EDE9FE",
    borderLight: "#E9D5FF",
    borderMedium: "#DDD6FE",
    error: "#EF4444",
  },
  items: [
    // Getting Started category
    { content: "#Getting Started", parent: null },
    { content: "Tap any item to check it off — try it now!", parent: "#Getting Started" },
    { content: "Hold and drag any item to reorder it anywhere in your list", parent: "#Getting Started" },
    { content: "Share this list by tapping Share above — anyone with the link can collaborate!", parent: "#Getting Started" },

    // AI Magic category
    { content: "#AI Magic ✨", parent: null },
    { content: "Type ...grocery list for tacos and AI generates items instantly", parent: "#AI Magic ✨" },
    { content: "Type !sort by aisle to reorganize your entire list with AI", parent: "#AI Magic ✨" },
    { content: "Type !group by category to auto-organize items into sections", parent: "#AI Magic ✨" },
    { content: "Tap the microphone button and speak to add items hands-free", parent: "#AI Magic ✨" },

    // Pro Tips category
    { content: "#Pro Tips 🚀", parent: null },
    { content: "Type milk, eggs, bread to add multiple items at once", parent: "#Pro Tips 🚀" },
    { content: "Start any item with # to create a new category", parent: "#Pro Tips 🚀" },
    { content: "Type style: ocean sunset to give your list a custom theme", parent: "#Pro Tips 🚀" },
    { content: "Tap the ⚡ bolt icon to see all available commands", parent: "#Pro Tips 🚀" },

    // You're Ready category
    { content: "#You're Ready! 🎉", parent: null },
    { content: "Delete this list and create your first real one", parent: "#You're Ready! 🎉" },
    { content: "Or keep checking these off as you learn — it's your list now!", parent: "#You're Ready! 🎉" },
  ],
};

const PLACEHOLDERS = [
  '...groceries for the week',
  'passport, tickets, charger, headphones',
  '...things to pack for camping',
  'lettuce, tomato, bacon, mayo, bread',
  '...ingredients for taco night',
  'sunscreen, towel, sunglasses, book',
  '...gift ideas for mom',
  'eggs, milk, butter, flour, sugar',
  '...what to bring to the potluck',
  '...packing list for hiking day trip',
];

// Sparkles icon component
const SparklesIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0L13.5 8.5L22 10L13.5 11.5L12 20L10.5 11.5L2 10L10.5 8.5L12 0Z" />
    <path d="M18 14L18.75 17.25L22 18L18.75 18.75L18 22L17.25 18.75L14 18L17.25 17.25L18 14Z" opacity="0.7" />
    <path d="M6 14L6.5 16.5L9 17L6.5 17.5L6 20L5.5 17.5L3 17L5.5 16.5L6 14Z" opacity="0.5" />
  </svg>
);

export default function Home() {
  const t = useTranslations('home');
  const tCommon = useTranslations('common');
  const tInput = useTranslations('input');

  const [value, setValue] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isPlaceholderFading, setIsPlaceholderFading] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [copiedListId, setCopiedListId] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeAnimating, setWelcomeAnimating] = useState(false);
  const router = useRouter();
  const { generateItems } = useAI();
  const { lists: recentLists, archivedLists, addList, updateList, archiveList, restoreList } = useRecentListsWeb();

  // Track page visit
  useEffect(() => {
    analytics.pageVisit('/');
  }, []);

  // Show welcome popup for first-time visitors
  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('listo_has_seen_welcome');
    if (!hasSeenWelcome) {
      // Small delay for smoother experience
      setTimeout(() => {
        setShowWelcome(true);
        setTimeout(() => setWelcomeAnimating(true), 50);
      }, 500);
    }
  }, []);

  const dismissWelcome = () => {
    setWelcomeAnimating(false);
    setTimeout(() => {
      setShowWelcome(false);
      localStorage.setItem('listo_has_seen_welcome', 'true');
    }, 300);
  };

  // Create tutorial list for new users
  const createTutorialList = async () => {
    if (isCreating) return;
    setIsCreating(true);

    try {
      const listId = generateListId();

      // Create the list with theme
      await supabase.from('lists').insert({
        id: listId,
        title: TUTORIAL_LIST.title,
        theme: TUTORIAL_LIST.theme,
      });

      // Create items with proper parent relationships
      const idMapping: Record<string, string> = {};

      // First pass: create categories (headers)
      const headers = TUTORIAL_LIST.items.filter(item => item.content.startsWith('#'));
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        const { data } = await supabase
          .from('items')
          .insert({
            list_id: listId,
            content: header.content,
            completed: false,
            parent_id: null,
            position: i * 100, // Space out positions for headers
          })
          .select()
          .single();

        if (data) {
          idMapping[header.content] = data.id;
        }
      }

      // Second pass: create child items
      let position = 0;
      for (const item of TUTORIAL_LIST.items) {
        if (!item.content.startsWith('#')) {
          const parentId = item.parent ? idMapping[item.parent] : null;
          await supabase.from('items').insert({
            list_id: listId,
            content: item.content,
            completed: false,
            parent_id: parentId,
            position: position++,
          });
        }
      }

      // Add to recent lists and navigate
      addList(listId, TUTORIAL_LIST.title, TUTORIAL_LIST.theme.primary);
      router.push(`/${listId}`);
    } catch (err) {
      console.error('Failed to create tutorial list:', err);
      setError('Failed to create tutorial list');
      setIsCreating(false);
    }
  };

  // Sync list data from database on mount
  useEffect(() => {
    const syncListData = async () => {
      if (recentLists.length === 0) return;

      const listIds = recentLists.map(list => list.id);

      // Fetch list metadata
      const { data: listsData } = await supabase
        .from('lists')
        .select('id, title, theme')
        .in('id', listIds);

      // Fetch item counts for each list
      const { data: itemsData } = await supabase
        .from('items')
        .select('list_id, completed')
        .in('list_id', listIds);

      // Calculate counts per list
      const countsByList: Record<string, { total: number; completed: number }> = {};
      if (itemsData) {
        itemsData.forEach(item => {
          if (!countsByList[item.list_id]) {
            countsByList[item.list_id] = { total: 0, completed: 0 };
          }
          countsByList[item.list_id].total++;
          if (item.completed) {
            countsByList[item.list_id].completed++;
          }
        });
      }

      if (listsData) {
        listsData.forEach(dbList => {
          const localList = recentLists.find(l => l.id === dbList.id);
          const counts = countsByList[dbList.id] || { total: 0, completed: 0 };
          const needsUpdate = localList && (
            localList.title !== dbList.title ||
            localList.themeColor !== dbList.theme?.primary ||
            localList.themeTextColor !== dbList.theme?.textPrimary ||
            localList.totalCount !== counts.total ||
            localList.completedCount !== counts.completed
          );

          if (needsUpdate) {
            updateList(dbList.id, {
              title: dbList.title,
              themeColor: dbList.theme?.primary || null,
              themeTextColor: dbList.theme?.textPrimary || null,
              totalCount: counts.total,
              completedCount: counts.completed,
            });
          }
        });
      }
    };

    syncListData();
  }, [recentLists.length]); // Only re-run when list count changes

  // Rotate placeholders every 2.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setIsPlaceholderFading(true);
      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
        setIsPlaceholderFading(false);
      }, 200); // Fade out duration
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  // Detect input mode based on content
  const { mode, itemCount, displayText } = useMemo(() => {
    // Normalize iOS smart punctuation before processing
    const normalized = normalizeInput(value);
    const trimmed = normalized.trim();

    // AI mode: starts with ...
    if (trimmed.startsWith('...')) {
      const prompt = trimmed.slice(3).trim();
      return {
        mode: 'ai' as InputMode,
        itemCount: 0,
        displayText: prompt ? 'AI will generate items' : ''
      };
    }

    // Multiple mode: contains commas
    if (trimmed.includes(',')) {
      const items = trimmed.split(',').map(s => s.trim()).filter(Boolean);
      return {
        mode: 'multiple' as InputMode,
        itemCount: items.length,
        displayText: `Adding ${items.length} items`
      };
    }

    // Single mode
    return { mode: 'single' as InputMode, itemCount: 0, displayText: '' };
  }, [value]);

  // Parse theme from input (supports ~theme, theme:theme, style:theme)
  const parseThemeFromInput = (input: string): { content: string; themeDescription: string | null } => {
    // Match patterns: ~description, theme:description, style:description
    const themePatterns = [
      /\s*~\s*(.+)$/i,           // ~beach sunset
      /\s*theme:\s*(.+)$/i,      // theme: beach sunset
      /\s*style:\s*(.+)$/i,      // style: beach sunset
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

    // Normalize iOS smart punctuation before processing
    const normalized = normalizeInput(value);
    const trimmed = normalized.trim();
    if (!trimmed) {
      // Create empty list
      setIsCreating(true);
      const listId = generateListId();
      await supabase.from('lists').insert({ id: listId, title: null });
      addList(listId);
      router.push(`/${listId}`);
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // Parse out theme instruction if present
      const { content: inputWithoutTheme, themeDescription } = parseThemeFromInput(trimmed);

      const listId = generateListId();

      // Create the list
      const { error: listError } = await supabase
        .from('lists')
        .insert({ id: listId, title: null });

      if (listError) throw listError;

      let itemsToAdd: string[] = [];
      let categorizedItems: ManipulatedItem[] | null = null;

      // AI mode: ... prefix or Ctrl+Enter
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
      }
      // Multiple mode: comma-separated
      else if (inputWithoutTheme.includes(',')) {
        itemsToAdd = inputWithoutTheme.split(',').map(s => s.trim()).filter(Boolean);
      }
      // Single mode
      else if (inputWithoutTheme) {
        itemsToAdd = [inputWithoutTheme];
      }

      // Handle categorized items (with headers and parent_ids)
      if (categorizedItems && categorizedItems.length > 0) {
        const idMapping: Record<string, string> = {};

        // First pass: create all headers (items without parent_id)
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

        // Second pass: create child items with translated parent_ids
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
      }
      // Handle simple string array
      else if (itemsToAdd.length > 0) {
        const itemInserts = itemsToAdd.map((content, index) => ({
          list_id: listId,
          content,
          position: index,
        }));

        await supabase.from('items').insert(itemInserts);
      }

      // Apply theme if specified (do this after items are created)
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
          // Theme generation failed, but continue - list is still created
          console.error('Theme generation failed:', themeErr);
        }
      }

      // Navigate to the new list
      addList(listId);
      router.push(`/${listId}`);
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

  // Handle dictation - create list with AI-generated items
  const handleDictation = async (transcription: string) => {
    if (!transcription.trim() || isCreating) return;

    setIsCreating(true);
    setError(null);

    try {
      const listId = generateListId();

      // Create the list
      const { error: listError } = await supabase
        .from('lists')
        .insert({ id: listId, title: null });

      if (listError) throw listError;

      // Generate items from transcription using AI
      const result = await generateItems(transcription);

      if (isCategorizedResult(result)) {
        // Handle categorized items
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
        // Handle simple string array
        const itemInserts = result.map((content, index) => ({
          list_id: listId,
          content,
          position: index,
        }));

        await supabase.from('items').insert(itemInserts);
      }

      // Navigate to the new list
      addList(listId);
      router.push(`/${listId}`);
    } catch (err) {
      console.error('Failed to create list from dictation:', err);
      setError(err instanceof Error ? err.message : 'Failed to create list');
      setIsCreating(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center bg-white"
      style={{
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
        paddingRight: 'max(16px, env(safe-area-inset-right))',
        paddingTop: 'max(48px, env(safe-area-inset-top, 48px))',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
      }}
    >
      <div className="w-full max-w-md md:max-w-[540px] text-center" style={{ marginTop: 'auto', marginBottom: 'auto' }}>
        {/* Logo/Title */}
        <div className="space-y-3" style={{ marginBottom: '24px' }}>
          <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-[0.2em]">
            {t('title')}
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('tagline')}
          </p>
          {/* Hero benefit strip */}
          <div className="flex items-center justify-center gap-4 text-xs" style={{ color: 'var(--text-muted)', marginTop: '12px' }}>
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" style={{ color: 'var(--primary)' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {t('benefits.noSignup')}
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" style={{ color: 'var(--primary)' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {t('benefits.realtime')}
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" style={{ color: 'var(--primary)' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {t('benefits.aiPowered')}
            </span>
          </div>
        </div>

        {/* Input */}
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
                autoFocus
                className={`
                  w-full text-base
                  border border-r-0
                  hover:border-[var(--primary)] hover:shadow-[0_0_0_3px_var(--primary-pale)]
                  focus:border-[var(--primary)] focus:shadow-[0_0_0_3px_var(--primary-pale)]
                  outline-none transition-all duration-200
                  disabled:opacity-50
                  ${mode === 'ai' && value.trim().length > 3
                    ? 'border-[var(--primary-light)]'
                    : 'border-gray-200'
                  }
                `}
                style={{
                  padding: '8px 12px',
                  borderRadius: '4px 0 0 4px'
                }}
              />
              {/* Animated placeholder or loading state */}
              {!value && (
                <div
                  className={`
                    absolute left-3 top-1/2 -translate-y-1/2
                    text-base pointer-events-none
                    transition-opacity duration-200
                    ${isPlaceholderFading && !isCreating ? 'opacity-0' : 'opacity-100'}
                  `}
                  style={{ color: isCreating ? 'var(--primary)' : '#9CA3AF' }}
                >
                  {isCreating ? tCommon('loading') : PLACEHOLDERS[placeholderIndex]}
                </div>
              )}
            </div>
            {/* Create button */}
            <button
              onClick={() => handleCreate(false)}
              disabled={isCreating}
              className="text-white font-medium transition-all duration-200 disabled:opacity-70"
              style={{
                backgroundColor: 'var(--primary)',
                borderRadius: '0 4px 4px 0',
                padding: '8px 16px',
              }}
              onMouseEnter={(e) => !isCreating && (e.currentTarget.style.backgroundColor = 'var(--primary-dark)')}
              onMouseLeave={(e) => !isCreating && (e.currentTarget.style.backgroundColor = 'var(--primary)')}
            >
              {isCreating ? (
                <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                t('buttons.create')
              )}
            </button>
          </div>

          {/* Mode indicator badge */}
          {displayText && !isCreating && (
            <div
              className="absolute left-0 flex items-center gap-1 text-xs text-white bg-[var(--primary)] px-2 py-0.5 rounded-sm"
              style={{ top: 'calc(100% + 4px)' }}
            >
              <SparklesIcon />
              {displayText}
            </div>
          )}

          {/* Processing indicator */}
          {isCreating && mode === 'ai' && (
            <div
              className="absolute left-0 flex items-center gap-1.5 text-xs text-white bg-[var(--primary)] px-2 py-0.5 rounded-sm"
              style={{ top: 'calc(100% + 4px)' }}
            >
              <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {tInput('processing.thinking')}
            </div>
          )}

          {/* Error indicator */}
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
        <div style={{ marginTop: '16px' }}>
          <DictateButton
            onTranscription={handleDictation}
            disabled={isCreating}
            position="inline"
          />
        </div>


        {/* Recent Lists */}
        <div style={{ marginTop: '32px' }}>
          <div className="font-bold uppercase tracking-wide text-xs mb-3 text-left" style={{ color: 'var(--text-muted)' }}>
            {t('recentLists')}
          </div>

          {/* Tutorial List for New Users - styled exactly like a regular list */}
          {recentLists.length === 0 && !isCreating && (
            <div className="space-y-2">
              <div
                className="flex items-center gap-4 py-4 px-4 rounded-xl cursor-pointer active:bg-gray-100 hover:bg-gray-50 transition-colors"
                style={{ border: '1px solid var(--border-light)', paddingRight: '16px' }}
                onClick={createTutorialList}
              >
                {/* Progress badge */}
                <div
                  className="flex-shrink-0 rounded-lg font-semibold text-sm flex items-center justify-center"
                  style={{
                    width: '56px',
                    height: '56px',
                    backgroundColor: TUTORIAL_LIST.theme.primary,
                    color: 'white',
                  }}
                >
                  0/{TUTORIAL_LIST.items.filter(i => !i.content.startsWith('#')).length}
                </div>
                <span className="flex-1 text-base text-left truncate font-medium" style={{ color: 'var(--text-primary)' }}>
                  {TUTORIAL_LIST.title}
                </span>
              </div>
            </div>
          )}

          {/* Actual lists */}
          {recentLists.length > 0 && (
            <div className="space-y-2">
              {recentLists.map((list) => (
                <div
                  key={list.id}
                  className="flex items-center gap-4 py-4 px-4 rounded-xl cursor-pointer active:bg-gray-100 hover:bg-gray-50 transition-colors"
                  style={{ border: '1px solid var(--border-light)', paddingRight: '8px' }}
                  onClick={() => router.push(`/${list.id}`)}
                >
                  {/* Progress badge */}
                  <div
                    className="flex-shrink-0 rounded-lg font-semibold text-sm flex items-center justify-center"
                    style={{
                      width: '56px',
                      height: '56px',
                      backgroundColor: list.themeColor || 'var(--primary)',
                      color: list.themeTextColor || 'white',
                    }}
                  >
                    {list.totalCount > 0 ? `${list.completedCount}/${list.totalCount}` : '0'}
                  </div>
                  <span className="flex-1 text-base text-left truncate font-medium" style={{ color: 'var(--text-primary)' }}>
                    {list.title || t('untitledList')}
                  </span>
                  {/* Copy link button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(`${window.location.origin}/${list.id}`);
                      setCopiedListId(list.id);
                      setTimeout(() => setCopiedListId(null), 1500);
                    }}
                    className="p-2 transition-colors duration-200 hover:text-[var(--primary)]"
                    style={{ color: copiedListId === list.id ? 'var(--primary)' : 'var(--text-muted)' }}
                    title="Copy link"
                  >
                    {copiedListId === list.id ? (
                      <svg className="w-5 h-5 transition-transform duration-200 scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    )}
                  </button>
                  {/* Archive button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      archiveList(list.id);
                    }}
                    className="p-2 transition-colors duration-200 hover:text-[var(--primary)]"
                    style={{ color: 'var(--text-muted)' }}
                    title="Archive"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Archived Lists */}
        {archivedLists.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-2 text-xs uppercase tracking-wide"
              style={{ color: 'var(--text-muted)' }}
            >
              <svg
                className={`w-3 h-3 transition-transform ${showArchived ? 'rotate-90' : ''}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              {t('buttons.archived')} ({archivedLists.length})
            </button>
            {showArchived && (
              <div className="space-y-2 mt-2">
                {archivedLists.map((list) => (
                  <div
                    key={list.id}
                    className="flex items-center gap-4 py-3 px-4 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors group opacity-60"
                    style={{ border: '1px solid var(--border-light)' }}
                    onClick={() => router.push(`/${list.id}`)}
                  >
                    {/* Progress badge */}
                    <div
                      className="flex-shrink-0 rounded-lg font-semibold text-xs flex items-center justify-center"
                      style={{
                        width: '44px',
                        height: '44px',
                        backgroundColor: list.themeColor || 'var(--primary)',
                        color: list.themeTextColor || 'white',
                      }}
                    >
                      {list.totalCount > 0 ? `${list.completedCount}/${list.totalCount}` : '0'}
                    </div>
                    <span className="flex-1 text-sm text-left truncate" style={{ color: 'var(--text-primary)' }}>
                      {list.title || t('untitledList')}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        restoreList(list.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-xs px-2 py-1 hover:bg-gray-200 rounded transition-opacity"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {t('buttons.restore')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Infinite Custom Styles */}
        <div
          className="rounded-lg"
          style={{
            marginTop: '32px',
            padding: '16px 20px',
            border: '1px solid #E5E7EB',
          }}
        >
          <div className="font-bold uppercase tracking-wide text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('customStyles.title')}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '4px', marginBottom: '16px' }}>
            {t('customStyles.description')}
          </div>
          <div className="grid grid-cols-4 gap-3">
            {/* Sunset */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-14 h-14 rounded-lg flex items-center gap-1.5 justify-center"
                style={{ backgroundColor: '#FFF7ED', border: '1px solid #FDBA74' }}
              >
                <div
                  className="w-4 h-4 rounded border-2 flex items-center justify-center"
                  style={{ borderColor: '#F97316', backgroundColor: '#F97316' }}
                >
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="w-6 h-1 rounded" style={{ backgroundColor: '#EA580C' }} />
              </div>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>sunset</span>
            </div>

            {/* Ocean */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-14 h-14 rounded-lg flex items-center gap-1.5 justify-center"
                style={{ backgroundColor: '#F0FDFA', border: '1px solid #5EEAD4' }}
              >
                <div
                  className="w-4 h-4 rounded border-2 flex items-center justify-center"
                  style={{ borderColor: '#14B8A6', backgroundColor: '#14B8A6' }}
                >
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="w-6 h-1 rounded" style={{ backgroundColor: '#0D9488' }} />
              </div>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>ocean</span>
            </div>

            {/* Forest */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-14 h-14 rounded-lg flex items-center gap-1.5 justify-center"
                style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC' }}
              >
                <div
                  className="w-4 h-4 rounded border-2 flex items-center justify-center"
                  style={{ borderColor: '#22C55E', backgroundColor: '#22C55E' }}
                >
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="w-6 h-1 rounded" style={{ backgroundColor: '#16A34A' }} />
              </div>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>forest</span>
            </div>

            {/* Neon */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-14 h-14 rounded-lg flex items-center gap-1.5 justify-center"
                style={{ backgroundColor: '#1A1A2E', border: '1px solid #FF006E' }}
              >
                <div
                  className="w-4 h-4 rounded border-2 flex items-center justify-center"
                  style={{ borderColor: '#FF006E', backgroundColor: '#FF006E' }}
                >
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="w-6 h-1 rounded" style={{ backgroundColor: '#00F5FF' }} />
              </div>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>neon</span>
            </div>

            {/* Midnight */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-14 h-14 rounded-lg flex items-center gap-1.5 justify-center"
                style={{ backgroundColor: '#1E1B4B', border: '1px solid #6366F1' }}
              >
                <div
                  className="w-4 h-4 rounded border-2 flex items-center justify-center"
                  style={{ borderColor: '#818CF8', backgroundColor: '#818CF8' }}
                >
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="w-6 h-1 rounded" style={{ backgroundColor: '#A5B4FC' }} />
              </div>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>midnight</span>
            </div>

            {/* Rose */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-14 h-14 rounded-lg flex items-center gap-1.5 justify-center"
                style={{ backgroundColor: '#FFF1F2', border: '1px solid #FDA4AF' }}
              >
                <div
                  className="w-4 h-4 rounded border-2 flex items-center justify-center"
                  style={{ borderColor: '#F43F5E', backgroundColor: '#F43F5E' }}
                >
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="w-6 h-1 rounded" style={{ backgroundColor: '#E11D48' }} />
              </div>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>rose</span>
            </div>

            {/* Matrix */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-14 h-14 rounded-lg flex items-center gap-1.5 justify-center"
                style={{ backgroundColor: '#022C22', border: '1px solid #10B981' }}
              >
                <div
                  className="w-4 h-4 rounded border-2 flex items-center justify-center"
                  style={{ borderColor: '#10B981', backgroundColor: '#10B981' }}
                >
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="w-6 h-1 rounded" style={{ backgroundColor: '#34D399' }} />
              </div>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>matrix</span>
            </div>

            {/* Birthday */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-14 h-14 rounded-lg flex items-center gap-1.5 justify-center"
                style={{ backgroundColor: '#FDF4FF', border: '1px solid #E879F9' }}
              >
                <div
                  className="w-4 h-4 rounded border-2 flex items-center justify-center"
                  style={{ borderColor: '#D946EF', backgroundColor: '#D946EF' }}
                >
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="w-6 h-1 rounded" style={{ backgroundColor: '#C026D3' }} />
              </div>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>birthday</span>
            </div>
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
            Type <code className="font-semibold px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>style: ocean sunset</code> in your list to style it
          </div>
        </div>

        {/* Privacy note */}
        <div className="text-xs text-center" style={{ marginTop: '48px', color: 'var(--text-muted)' }}>
          Note: All listos are public URLs. Never share personal information in a list.{' '}
          <button
            onClick={() => setShowPrivacyModal(true)}
            className="underline hover:no-underline"
            style={{ color: 'var(--primary)' }}
          >
            Read our privacy policy
          </button>
        </div>
      </div>

      {/* Welcome Popup */}
      {showWelcome && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            backgroundColor: welcomeAnimating ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0)',
            transition: 'background-color 0.3s ease-out',
          }}
          onClick={dismissWelcome}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm overflow-hidden"
            style={{
              transform: welcomeAnimating ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(20px)',
              opacity: welcomeAnimating ? 1 : 0,
              transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease-out',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with icon */}
            <div
              className="text-center"
              style={{ padding: '32px 24px 24px 24px' }}
            >
              {/* Animated checkmark icon */}
              <div
                className="mx-auto flex items-center justify-center rounded-full"
                style={{
                  width: '64px',
                  height: '64px',
                  backgroundColor: 'var(--primary-pale)',
                  marginBottom: '20px',
                }}
              >
                <svg
                  className="w-8 h-8"
                  style={{ color: 'var(--primary)' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 13l4 4L19 7"
                    style={{
                      strokeDasharray: 24,
                      strokeDashoffset: welcomeAnimating ? 0 : 24,
                      transition: 'stroke-dashoffset 0.5s ease-out 0.2s',
                    }}
                  />
                </svg>
              </div>

              <h2
                className="text-xl font-bold"
                style={{ color: 'var(--text-primary)', marginBottom: '8px' }}
              >
                Welcome to Listo!
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                The simplest way to create and share lists
              </p>
            </div>

            {/* Content */}
            <div style={{ padding: '0 24px 24px 24px' }}>
              {/* Tip 1 */}
              <div
                className="rounded-xl"
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--primary-pale)',
                  marginBottom: '12px',
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
                    style={{ backgroundColor: 'var(--primary)', color: 'white' }}
                  >
                    ...
                  </div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)', marginBottom: '4px' }}>
                      AI-Powered Lists
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      Start with <code className="font-semibold px-1 py-0.5 rounded" style={{ backgroundColor: 'white', color: 'var(--primary)' }}>...</code> and describe what you need.
                      <span style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                        Try: ...packing list for beach vacation
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tip 2 */}
              <div
                className="rounded-xl"
                style={{
                  padding: '16px',
                  backgroundColor: '#F8FAFC',
                  marginBottom: '20px',
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: '#E2E8F0' }}
                  >
                    <svg className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)', marginBottom: '4px' }}>
                      Instant Sharing
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      Every list has a unique URL. Share it with anyone on mobile or desktop — they can view and edit in real-time. No signup needed.
                    </div>
                  </div>
                </div>
              </div>

              {/* CTA Button */}
              <button
                onClick={dismissWelcome}
                className="w-full font-semibold text-white rounded-xl transition-all duration-200 active:scale-[0.98]"
                style={{
                  backgroundColor: 'var(--primary)',
                  padding: '14px 24px',
                  fontSize: '15px',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-dark)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--primary)'}
              >
                Got it, let&apos;s go!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setShowPrivacyModal(false)}
        >
          <div
            className="bg-white rounded-lg max-w-lg w-full max-h-[80vh] overflow-y-auto"
            style={{ padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Privacy Policy</h2>
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
                style={{ color: 'var(--text-muted)' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <section>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Public Use and Sharing</h3>
                <p>
                  LISTO checklists (hereafter referred to as &quot;listos&quot;) are inherently public. Once you create a listo and share its link, anyone with access to that link can view and edit the listo. Since listos are designed to be shared freely, we strongly advise against using LISTO to store or transmit sensitive, confidential, or any personal information that you do not wish to make public.
                </p>
              </section>

              <section>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Data Collection and Use</h3>
                <p>
                  As of now, LISTO does not require user registration, which means we do not collect personal data such as names, email addresses, or any other contact information. All listos are created anonymously.
                </p>
              </section>

              <section>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Analytics</h3>
                <p>
                  We utilize Google Analytics to analyze the performance of LISTO, which helps us understand traffic patterns and user engagement in an anonymous form. Google Analytics may collect non-personally identifiable information such as your device type, browser type, and the way you interact with LISTO. This data is used strictly for the purpose of enhancing user experience and improving our service.
                </p>
              </section>

              <section>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Contact Information</h3>
                <p>
                  Should you have any questions about this privacy policy or LISTO&apos;s practices, please feel free to reach out to us at{' '}
                  <a href="mailto:hello@listo.to" className="underline" style={{ color: 'var(--primary)' }}>hello@listo.to</a>.
                </p>
              </section>

              <section>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Please be aware that our Privacy Policy may change from time to time. We will not reduce your rights under this Privacy Policy without providing notice, and we expect most such changes will be minor.
                </p>
              </section>
            </div>

            <div className="text-center" style={{ marginTop: '16px', marginBottom: '16px' }}>
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="text-white rounded font-medium"
                style={{ backgroundColor: 'var(--primary)', padding: '8px 16px' }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
