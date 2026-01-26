'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { supabase } from '@/lib/supabase';
import { generateListId } from '@/lib/utils/generateId';
import { useAI, isCategorizedResult, ManipulatedItem } from '@/lib/hooks/useAI';
import { DictateButton } from '@/components/DictateButton';
import { LanguageSwitcherCompact } from '@/components/LanguageSwitcher';
import { analytics } from '@/lib/analytics';
import { API } from '@/lib/api';
import { useRecentListsWeb } from '@/lib/hooks/useRecentListsWeb';
import { usePersonalTemplates, PersonalTemplate } from '@/lib/hooks/usePersonalTemplates';
import { EditTemplateModal } from '@/components/templates/EditTemplateModal';
import { TemplateCategory } from '@/types';

type InputMode = 'single' | 'multiple' | 'ai';

// Normalize iOS smart punctuation to standard characters
function normalizeInput(text: string): string {
  return text
    .replace(/…/g, '...') // iOS ellipsis → three periods
    .replace(/–/g, '--')  // iOS en-dash → two dashes
    .replace(/—/g, '--'); // iOS em-dash → two dashes
}

// Tutorial list theme (colors only - not translatable)
const TUTORIAL_THEME = {
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
};

// Build tutorial items from translations
function buildTutorialItems(tTutorial: ReturnType<typeof useTranslations>) {
  const sections = ['gettingStarted', 'aiMagic', 'proTips', 'ready'] as const;
  const items: { content: string; parent: string | null }[] = [];

  for (const section of sections) {
    const title = tTutorial(`${section}.title`);
    items.push({ content: title, parent: null });

    const sectionItems = tTutorial.raw(`${section}.items`) as string[];
    for (const item of sectionItems) {
      items.push({ content: item, parent: title });
    }
  }

  return items;
}

// Placeholders are now loaded from translations

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
  const tWelcome = useTranslations('welcome');
  const tTutorial = useTranslations('tutorial');
  const locale = useLocale();

  // Get translated placeholders
  const placeholders = useMemo(() => {
    const raw = t.raw('placeholders');
    return Array.isArray(raw) ? raw : [];
  }, [t]);

  // Get translated tutorial list
  const tutorialList = useMemo(() => ({
    title: tTutorial('listTitle'),
    theme: TUTORIAL_THEME,
    items: buildTutorialItems(tTutorial),
  }), [tTutorial]);

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
  const { generateItems, processDictation } = useAI();
  const { lists: recentLists, archivedLists, addList, updateList, archiveList, restoreList } = useRecentListsWeb();
  const { templates: personalTemplates, deleteTemplate, updateTemplate } = usePersonalTemplates();
  const [usingTemplateId, setUsingTemplateId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<PersonalTemplate | null>(null);
  const [communityTemplateCount, setCommunityTemplateCount] = useState<number>(0);

  // Track page visit
  useEffect(() => {
    analytics.pageVisit('/');
  }, []);

  // Fetch community template count for current language
  useEffect(() => {
    const fetchTemplateCount = async () => {
      try {
        const { count } = await supabase
          .from('lists')
          .select('*', { count: 'exact', head: true })
          .eq('is_template', true)
          .eq('status', 'approved')
          .eq('language', locale);

        if (count !== null) {
          setCommunityTemplateCount(count);
        }
      } catch (err) {
        console.error('Failed to fetch template count:', err);
      }
    };
    fetchTemplateCount();
  }, [locale]);

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
        title: tutorialList.title,
        theme: tutorialList.theme,
      });

      // Create items with proper parent relationships
      const idMapping: Record<string, string> = {};

      // First pass: create categories (headers)
      const headers = tutorialList.items.filter(item => item.content.startsWith('#'));
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
      for (const item of tutorialList.items) {
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
      addList(listId, tutorialList.title, tutorialList.theme.primary);
      router.push(`/${listId}`);
    } catch (err) {
      console.error('Failed to create tutorial list:', err);
      setError('Failed to create tutorial list');
      setIsCreating(false);
    }
  };

  // Use a personal template - create new list with copied items
  const usePersonalTemplate = async (template: PersonalTemplate) => {
    if (usingTemplateId) return;
    setUsingTemplateId(template.id);

    try {
      const newListId = generateListId();

      // Fetch items from the original list
      const { data: sourceItems, error: fetchError } = await supabase
        .from('items')
        .select('*')
        .eq('list_id', template.listId)
        .order('position', { ascending: true });

      if (fetchError) throw fetchError;

      // Create the new list with template's theme
      const { error: listError } = await supabase.from('lists').insert({
        id: newListId,
        title: template.title,
        theme: template.theme,
      });

      if (listError) throw listError;

      // Copy items to new list (all unchecked, preserving structure)
      if (sourceItems && sourceItems.length > 0) {
        const idMapping: Record<string, string> = {};

        // First pass: create headers (items without parent_id)
        const headers = sourceItems.filter(item => !item.parent_id);
        for (const header of headers) {
          const { data, error } = await supabase
            .from('items')
            .insert({
              list_id: newListId,
              content: header.content,
              completed: false,
              parent_id: null,
              position: header.position,
            })
            .select()
            .single();

          if (error) throw error;
          if (data) {
            idMapping[header.id] = data.id;
          }
        }

        // Second pass: create child items with mapped parent_ids
        const children = sourceItems.filter(item => item.parent_id);
        for (const child of children) {
          const newParentId = idMapping[child.parent_id] || null;
          await supabase
            .from('items')
            .insert({
              list_id: newListId,
              content: child.content,
              completed: false,
              parent_id: newParentId,
              position: child.position,
            });
        }
      }

      // Add to recent lists and navigate
      addList(newListId, template.title, template.themeColor);
      router.push(`/${newListId}`);
    } catch (err) {
      console.error('Failed to use template:', err);
      setError('Failed to create list from template');
      setUsingTemplateId(null);
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
    if (placeholders.length === 0) return;
    const interval = setInterval(() => {
      setIsPlaceholderFading(true);
      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
        setIsPlaceholderFading(false);
      }, 200); // Fade out duration
    }, 2500);

    return () => clearInterval(interval);
  }, [placeholders.length]);

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
        displayText: prompt ? tInput('modes.generate') : ''
      };
    }

    // Multiple mode: contains commas
    if (trimmed.includes(',')) {
      const items = trimmed.split(',').map(s => s.trim()).filter(Boolean);
      return {
        mode: 'multiple' as InputMode,
        itemCount: items.length,
        displayText: tInput('modes.addingItems', { count: items.length })
      };
    }

    // Single mode
    return { mode: 'single' as InputMode, itemCount: 0, displayText: '' };
  }, [value, tInput]);

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

  // Handle dictation - create list with AI-generated items and optional title
  const handleDictation = async (transcription: string) => {
    if (!transcription.trim() || isCreating) return;

    setIsCreating(true);
    setError(null);

    try {
      const listId = generateListId();

      // Process dictation to extract title and items
      const { title, items } = await processDictation(transcription);

      // Create the list with extracted title
      const { error: listError } = await supabase
        .from('lists')
        .insert({ id: listId, title: title || null });

      if (listError) throw listError;

      if (isCategorizedResult(items)) {
        // Handle categorized items
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
        // Handle simple string array
        const itemInserts = (items as string[]).map((content, index) => ({
          list_id: listId,
          content,
          position: index,
        }));

        await supabase.from('items').insert(itemInserts);
      }

      // Navigate to the new list
      addList(listId, title || null);
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
                  {isCreating ? tCommon('loading') : (placeholders[placeholderIndex] || '...')}
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


        {/* Your Lists */}
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
                    backgroundColor: tutorialList.theme.primary,
                    color: 'white',
                  }}
                >
                  0/{tutorialList.items.filter(i => !i.content.startsWith('#')).length}
                </div>
                <span className="flex-1 text-base text-left truncate font-medium" style={{ color: 'var(--text-primary)' }}>
                  {tutorialList.title}
                </span>
              </div>
            </div>
          )}

          {/* Actual lists */}
          {recentLists.length > 0 && (
            <div className="flex flex-col" style={{ gap: '8px' }}>
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

        {/* My Templates */}
        {personalTemplates.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <div className="font-bold uppercase tracking-wide text-xs mb-3 text-left" style={{ color: 'var(--text-muted)' }}>
              {t('templates.myTemplates')}
            </div>
            <div className="flex flex-col" style={{ gap: '8px' }}>
              {personalTemplates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center gap-4 py-4 px-4 rounded-xl cursor-pointer active:bg-gray-100 hover:bg-gray-50 transition-colors"
                  style={{
                    border: '1px solid var(--border-light)',
                    paddingRight: '8px',
                    opacity: usingTemplateId === template.id ? 0.6 : 1,
                  }}
                  onClick={() => usePersonalTemplate(template)}
                >
                  {/* Template icon - colored, no background */}
                  <div
                    className="flex-shrink-0 flex items-center justify-center"
                    style={{
                      width: '56px',
                      height: '56px',
                      color: template.themeColor || 'var(--primary)',
                    }}
                  >
                    {usingTemplateId === template.id ? (
                      <div
                        className="w-6 h-6 animate-spin rounded-full border-2"
                        style={{
                          borderColor: `${template.themeColor || 'var(--primary)'}30`,
                          borderTopColor: template.themeColor || 'var(--primary)',
                        }}
                      />
                    ) : (
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                      </svg>
                    )}
                  </div>
                  <span className="flex-1 text-base text-left truncate font-medium" style={{ color: 'var(--text-primary)' }}>
                    {template.title}
                  </span>
                  {/* Edit button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingTemplate(template);
                    }}
                    className="p-2 transition-colors duration-200 hover:text-[var(--primary)]"
                    style={{ color: 'var(--text-muted)' }}
                    title="Edit template"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTemplate(template.id);
                    }}
                    className="p-2 transition-colors duration-200 hover:text-[var(--error)]"
                    style={{ color: 'var(--text-muted)' }}
                    title="Delete template"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Browse Community Templates - prominent button */}
        <button
          onClick={() => router.push('/templates')}
          className="w-full flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 active:scale-[0.98] cursor-pointer"
          style={{
            marginTop: '24px',
            padding: '14px 20px',
            backgroundColor: 'var(--primary-pale)',
            color: 'var(--primary)',
            border: '1px solid var(--primary-light)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--primary)';
            e.currentTarget.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--primary-pale)';
            e.currentTarget.style.color = 'var(--primary)';
          }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
          </svg>
          {communityTemplateCount > 0
            ? t('templates.browseCommunityCount', { count: communityTemplateCount })
            : t('templates.browseCommunity')
          }
        </button>

        {/* Privacy note */}
        <div className="text-xs text-center" style={{ marginTop: '48px', color: 'var(--text-muted)' }}>
          {t('privacy.note')}{' '}
          <button
            onClick={() => setShowPrivacyModal(true)}
            className="underline hover:no-underline"
            style={{ color: 'var(--primary)' }}
          >
            {t('privacy.readPolicy')}
          </button>
        </div>

        {/* Language Switcher */}
        <div className="flex justify-center" style={{ marginTop: '24px' }}>
          <LanguageSwitcherCompact />
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
                {tWelcome('title')}
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {tWelcome('subtitle')}
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
                      {tWelcome('aiPowered.title')}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      <span dangerouslySetInnerHTML={{ __html: tWelcome('aiPowered.description').replace('<code>', '<code class="font-semibold px-1 py-0.5 rounded" style="background-color: white; color: var(--primary)">') }} />
                      <span style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                        {tWelcome('aiPowered.example')}
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
                      {tWelcome('instantSharing.title')}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {tWelcome('instantSharing.description')}
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
                {tWelcome('gotIt')}
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
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{t('privacy.title')}</h2>
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
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{t('privacy.sections.publicUse.title')}</h3>
                <p>{t('privacy.sections.publicUse.content')}</p>
              </section>

              <section>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{t('privacy.sections.dataCollection.title')}</h3>
                <p>{t('privacy.sections.dataCollection.content')}</p>
              </section>

              <section>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{t('privacy.sections.analytics.title')}</h3>
                <p>{t('privacy.sections.analytics.content')}</p>
              </section>

              <section>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{t('privacy.sections.contact.title')}</h3>
                <p>
                  {t('privacy.sections.contact.content')}{' '}
                  <a href="mailto:hello@listo.to" className="underline" style={{ color: 'var(--primary)' }}>hello@listo.to</a>.
                </p>
              </section>

              <section>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t('privacy.sections.changes')}
                </p>
              </section>
            </div>

            <div className="text-center" style={{ marginTop: '16px', marginBottom: '16px' }}>
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="text-white rounded font-medium"
                style={{ backgroundColor: 'var(--primary)', padding: '8px 16px' }}
              >
                {tWelcome('gotIt')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Template Modal */}
      {editingTemplate && (
        <EditTemplateModal
          template={editingTemplate}
          onSave={(updates) => {
            updateTemplate(editingTemplate.id, updates);
          }}
          onClose={() => setEditingTemplate(null)}
        />
      )}
    </div>
  );
}
