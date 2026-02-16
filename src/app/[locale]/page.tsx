'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
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
import BackupTransferModal from '@/components/BackupTransferModal';
import { BackupList, BackupTemplate } from '@/lib/backup';
import { OnboardingWalkthrough } from '@/components/OnboardingWalkthrough';

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
  const tOnboarding = useTranslations('onboarding');
  const tTutorial = useTranslations('tutorial');
  const tBackup = useTranslations('backup');
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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const router = useRouter();
  const { generateItems, processDictation } = useAI();
  const { lists: recentLists, archivedLists, isLoading: listsLoading, addList, updateList, archiveList, restoreList } = useRecentListsWeb();
  const { templates: personalTemplates, isLoading: templatesLoading, deleteTemplate, updateTemplate, addTemplate } = usePersonalTemplates();
  const [usingTemplateId, setUsingTemplateId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<PersonalTemplate | null>(null);
  const [communityTemplateCount, setCommunityTemplateCount] = useState<number>(0);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showAppDropdown, setShowAppDropdown] = useState(false);
  const [androidEmail, setAndroidEmail] = useState('');
  const [androidSignupState, setAndroidSignupState] = useState<'idle' | 'sending' | 'success' | 'already' | 'error'>('idle');
  const [androidTesterCount, setAndroidTesterCount] = useState<number>(0);
  const [sparkles, setSparkles] = useState<{ id: number; x: number; y: number; tx: number; ty: number; scale: number; delay: number }[]>([]);
  const prevModeRef = useRef<InputMode>('single');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const androidEmailRef = useRef<HTMLInputElement>(null);

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

  // Show inline differentiators for first-time visitors (instead of blocking modal)
  useEffect(() => {
    const isBot = /bot|crawl|spider|google|bing|yandex|baidu|duckduck/i.test(navigator.userAgent);
    const hasSeenOnboarding = localStorage.getItem('listo_has_seen_welcome');

    if (!hasSeenOnboarding && !isBot) {
      setIsFirstVisit(true);
    }
  }, []);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setIsFirstVisit(false);
    localStorage.setItem('listo_has_seen_welcome', 'true');
  };

  // Fetch Android tester count for social proof
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const { count } = await supabase
          .from('android_testers')
          .select('*', { count: 'exact', head: true });
        if (count !== null) setAndroidTesterCount(count);
      } catch {}
    };
    fetchCount();
  }, []);

  // Handle Android tester email signup
  const handleAndroidSignup = async (email: string, source: string) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return;

    setAndroidSignupState('sending');
    try {
      const { error } = await supabase
        .from('android_testers')
        .insert({ email: trimmed, source });

      if (error) {
        if (error.code === '23505') {
          setAndroidSignupState('already');
        } else {
          setAndroidSignupState('error');
        }
      } else {
        setAndroidSignupState('success');
        setAndroidTesterCount(prev => prev + 1);
        analytics.androidSignup(source as 'homepage_nav' | 'list_footer');
      }
    } catch {
      setAndroidSignupState('error');
    }
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

    // AI mode: starts with . or ... (single period is the new shorthand)
    if (trimmed.startsWith('.') && !trimmed.startsWith('..') || trimmed.startsWith('...')) {
      const prompt = trimmed.replace(/^\.+/, '').trim();
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

  // Sparkle burst when entering AI mode
  useEffect(() => {
    if (mode === 'ai' && prevModeRef.current !== 'ai' && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const newSparkles = Array.from({ length: 14 }, (_, i) => {
        const angle = ((i * 26) + (Math.random() * 15 - 7)) * (Math.PI / 180);
        const dist = 50 + Math.random() * 50;
        return {
          id: Date.now() + i,
          x: cx + (Math.random() * 20 - 10),
          y: cy + (Math.random() * 10 - 5),
          tx: Math.cos(angle) * dist,
          ty: Math.sin(angle) * dist,
          scale: 0.8 + Math.random() * 1.2,
          delay: Math.random() * 100,
        };
      });
      setSparkles(newSparkles);
      setTimeout(() => setSparkles([]), 1000);
    }
    prevModeRef.current = mode;
  }, [mode]);

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

  const handleCreate = async (forceAI = false, overrideValue?: string) => {
    if (isCreating) return;

    // Normalize iOS smart punctuation before processing
    const normalized = normalizeInput(overrideValue ?? value);
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

      // AI mode: . or ... prefix, or Ctrl+Enter
      const isAIPrefix = inputWithoutTheme.startsWith('...') || (inputWithoutTheme.startsWith('.') && !inputWithoutTheme.startsWith('..'));
      if (forceAI || isAIPrefix) {
        const prompt = isAIPrefix ? inputWithoutTheme.replace(/^\.+/, '').trim() : inputWithoutTheme;
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

      // Mark onboarding as seen on first list creation
      if (isFirstVisit) {
        localStorage.setItem('listo_has_seen_welcome', 'true');
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
      className="min-h-screen flex flex-col items-center"
      style={{
        backgroundColor: 'var(--bg-primary)',
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
        paddingRight: 'max(16px, env(safe-area-inset-right))',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
      }}
    >
      {/* Nav bar */}
      <nav className="w-full max-w-md md:max-w-[540px] mx-auto flex items-center justify-between" style={{ padding: '16px 0' }}>
        <a href="/" className="text-lg font-bold tracking-[0.02em]" style={{ color: 'var(--text-primary)' }}>
          {t('title')}
        </a>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/templates')}
            className="text-sm font-medium transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <span className="sm:hidden">Templates</span>
            <span className="hidden sm:inline">{t('templates.browse')}</span>
          </button>
          {/* Get the App dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowAppDropdown(!showAppDropdown)}
              className="text-sm font-medium flex items-center gap-1 transition-all rounded-full"
              style={{ color: 'var(--primary)', backgroundColor: 'var(--primary-pale)', padding: '6px 12px', border: '1px solid var(--primary-light)' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--primary)'; e.currentTarget.style.color = 'white'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--primary-pale)'; e.currentTarget.style.color = 'var(--primary)'; }}
            >
              {t('nav.getApp')}
              <svg className={`w-3 h-3 transition-transform ${showAppDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showAppDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowAppDropdown(false)} />
                <div
                  className="absolute right-0 z-50 rounded-xl shadow-lg"
                  style={{
                    marginTop: '8px',
                    width: '260px',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-light)',
                    padding: '8px',
                  }}
                >
                  <a
                    href="https://apps.apple.com/app/list-mango/id6758048013"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg transition-colors hover:bg-[var(--bg-hover)]"
                    style={{ padding: '10px 12px' }}
                    onClick={() => { analytics.appStoreClick('homepage_nav'); setShowAppDropdown(false); }}
                  >
                    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--text-primary)' }}>
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                    <div className="flex-1">
                      <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>iOS</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>App Store</div>
                    </div>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                  {/* Android early access signup */}
                  <div
                    className="rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                    style={{ padding: '10px 12px' }}
                    onMouseEnter={() => androidEmailRef.current?.focus()}
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#3DDC84' }}>
                        <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48A5.84 5.84 0 0012 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31A5.983 5.983 0 006 7h12c0-2.21-1.24-4.15-3.47-5.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z"/>
                      </svg>
                      <div className="flex-1">
                        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Android</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {androidSignupState === 'success'
                            ? t('nav.androidSuccess')
                            : androidSignupState === 'already'
                            ? t('nav.androidAlready')
                            : t('nav.androidEarlyAccess')
                          }
                        </div>
                      </div>
                    </div>
                    {androidSignupState !== 'success' && androidSignupState !== 'already' && (
                      <form
                        className="flex gap-1.5"
                        style={{ marginTop: '8px' }}
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleAndroidSignup(androidEmail, 'homepage_nav');
                        }}
                      >
                        <input
                          ref={androidEmailRef}
                          type="email"
                          value={androidEmail}
                          onChange={(e) => {
                            setAndroidEmail(e.target.value);
                            if (androidSignupState === 'error') setAndroidSignupState('idle');
                          }}
                          placeholder={t('nav.androidEmailPlaceholder')}
                          className="flex-1 text-xs rounded-md border outline-none transition-all focus:border-[var(--primary)] focus:shadow-[0_0_0_2px_var(--primary-pale)]"
                          style={{
                            padding: '6px 10px',
                            borderColor: androidSignupState === 'error' ? 'var(--error)' : 'var(--border-medium)',
                            backgroundColor: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                            minWidth: 0,
                          }}
                          disabled={androidSignupState === 'sending'}
                        />
                        <button
                          type="submit"
                          disabled={androidSignupState === 'sending' || !androidEmail.trim()}
                          className="text-xs font-medium text-white rounded-md transition-opacity disabled:opacity-50"
                          style={{ padding: '6px 10px', backgroundColor: 'var(--primary)', whiteSpace: 'nowrap' }}
                        >
                          {androidSignupState === 'sending' ? '...' : 'Go'}
                        </button>
                      </form>
                    )}
                    <div className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '6px', opacity: 0.8 }}>
                      {t('nav.androidSocialProof', { count: 167 + androidTesterCount })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="w-full max-w-md md:max-w-[540px] mx-auto text-center" style={{ marginTop: '24px', marginBottom: 'auto' }}>
        {/* Input hint */}
        <p className="text-xs text-left" style={{ color: 'var(--text-muted)', marginTop: '8px', marginBottom: '8px' }}>
          {t('inputHint')}
        </p>

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
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                data-form-type="other"
                className={`
                  w-full text-base
                  border border-r-0
                  hover:border-[var(--primary)] hover:shadow-[0_0_0_3px_var(--primary-pale)]
                  focus:border-[var(--primary)] focus:shadow-[0_0_0_3px_var(--primary-pale)]
                  outline-none transition-all duration-200
                  disabled:opacity-50
                  ${mode === 'ai'
                    ? 'border-[var(--primary-light)]'
                    : 'border-gray-200'
                  }
                `}
                style={{
                  padding: '14px 16px',
                  borderRadius: '8px 0 0 8px'
                }}
              />
              {/* Animated placeholder or loading state */}
              {!value && (
                <div
                  className={`
                    absolute left-4 top-1/2 -translate-y-1/2
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
              ref={buttonRef}
              onClick={() => handleCreate(false)}
              disabled={isCreating}
              className="text-white font-medium transition-all duration-200 disabled:opacity-70"
              style={{
                backgroundColor: 'var(--primary)',
                borderRadius: '0 8px 8px 0',
                padding: '14px 20px',
              }}
              onMouseEnter={(e) => !isCreating && (e.currentTarget.style.backgroundColor = 'var(--primary-dark)')}
              onMouseLeave={(e) => !isCreating && (e.currentTarget.style.backgroundColor = 'var(--primary)')}
            >
              {isCreating ? (
                <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : mode === 'ai' ? (
                <span className="flex items-center gap-1">
                  <SparklesIcon />
                  {t('buttons.generate')}
                </span>
              ) : mode === 'multiple' ? (
                t('buttons.addItems', { count: itemCount })
              ) : (
                t('buttons.go')
              )}
            </button>
          </div>

          {/* Shimmer bar while AI is working */}
          {isCreating && mode === 'ai' && (
            <div
              className="absolute left-0 right-0 overflow-hidden"
              style={{ bottom: 0, height: '3px', borderRadius: '0 0 8px 8px' }}
            >
              <div
                style={{
                  width: '200%',
                  height: '100%',
                  background: 'linear-gradient(90deg, transparent 0%, var(--primary) 25%, var(--primary-light) 50%, var(--primary) 75%, transparent 100%)',
                  animation: 'shimmer 1.5s ease-in-out infinite',
                }}
              />
              <style>{`
                @keyframes shimmer {
                  0% { transform: translateX(-50%); }
                  100% { transform: translateX(0%); }
                }
              `}</style>
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

        {/* AI mode sparkle burst */}
        {sparkles.length > 0 && (
          <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 100 }}>
            {sparkles.map((s) => (
              <div
                key={s.id}
                style={{
                  position: 'absolute',
                  left: s.x,
                  top: s.y,
                  ['--tx' as string]: `${s.tx}px`,
                  ['--ty' as string]: `${s.ty}px`,
                  animation: `sparkle-burst 800ms ease-out ${s.delay}ms forwards`,
                  opacity: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--primary)" style={{ transform: `scale(${s.scale})`, filter: 'drop-shadow(0 0 3px var(--primary))' }}>
                  <path d="M12 0L13.5 8.5L22 10L13.5 11.5L12 20L10.5 11.5L2 10L10.5 8.5L12 0Z" />
                </svg>
              </div>
            ))}
            <style>{`
              @keyframes sparkle-burst {
                0% { transform: translate(0, 0) scale(1.2); opacity: 1; }
                40% { opacity: 1; }
                100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
              }
            `}</style>
          </div>
        )}

        {/* Dictate button */}
        <div style={{ marginTop: '16px' }}>
          <DictateButton
            onTranscription={handleDictation}
            disabled={isCreating}
            position="inline"
          />
        </div>

        {/* Inline differentiators for first-time visitors */}
        {isFirstVisit && (
          <div
            className="grid grid-cols-2 gap-3 text-left"
            style={{ marginTop: '24px' }}
          >
            <div
              className="rounded-xl"
              style={{ padding: '12px 14px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
            >
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('differentiators.noAccount')}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                {t('differentiators.noAccountDesc')}
              </div>
            </div>
            <div
              className="rounded-xl"
              style={{ padding: '12px 14px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
            >
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('differentiators.shareLink')}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                {t('differentiators.shareLinkDesc')}
              </div>
            </div>
            <div
              className="rounded-xl"
              style={{ padding: '12px 14px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
            >
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('differentiators.everywhere')}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                {t('differentiators.everywhereDesc')}
              </div>
            </div>
            <div
              className="rounded-xl"
              style={{ padding: '12px 14px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
            >
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('differentiators.ai')}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                {t('differentiators.aiDesc')}
              </div>
            </div>
          </div>
        )}

        {/* Your Lists */}
        <div style={{ marginTop: '32px' }}>
          <div className="font-bold uppercase tracking-wide text-xs text-left" style={{ color: 'var(--text-muted)', paddingLeft: '4px', marginBottom: '4px' }}>
            {t('recentLists')}
          </div>

          {/* Quick-start chips for new users */}
          {!listsLoading && recentLists.length === 0 && !isCreating && (
            <div>
              <p className="text-sm text-left" style={{ color: 'var(--text-muted)', paddingLeft: '4px' }}>
                {t('quickStart.title')}
              </p>
              <div className="flex gap-2 flex-wrap" style={{ marginTop: '16px' }}>
                {[
                  { label: t('quickStart.grocery'), prompt: '.weekly grocery essentials', icon: '🛒' },
                  { label: t('quickStart.packing'), prompt: '.packing list for a weekend trip', icon: '🧳' },
                  { label: t('quickStart.todo'), prompt: '.things to do this week', icon: '✅' },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    onClick={() => {
                      setValue(chip.prompt);
                      handleCreate(true, chip.prompt);
                    }}
                    className="text-sm font-medium rounded-full transition-all duration-200 active:scale-95 cursor-pointer"
                    style={{
                      padding: '8px 16px',
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
                    {chip.icon} {chip.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actual lists */}
          {!listsLoading && recentLists.length > 0 && (
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
        {!templatesLoading && personalTemplates.length > 0 && (
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

        {/* Backup & Transfer section - always visible for importing */}
        <div style={{ marginTop: '24px' }}>
          <button
            onClick={() => setShowBackupModal(true)}
            className="w-full flex items-center justify-center gap-3 rounded-xl font-medium transition-all duration-200 hover:bg-[var(--bg-hover)] hover:border-[var(--border-medium)] active:scale-[0.98] cursor-pointer"
            style={{
              padding: '14px 20px',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-light)',
            }}
          >
            <svg className="w-5 h-5" style={{ color: 'var(--primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {recentLists.length === 0 ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              )}
            </svg>
            {recentLists.length === 0 ? tBackup('importFromDevice') : tBackup('backupAndTransfer')}
          </button>
          {recentLists.length > 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '8px', textAlign: 'center' }}>
              {tBackup('deviceNotice')}
            </p>
          )}
        </div>

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

        {/* Make it a List — for website owners */}
        <a
          href="/make-a-list"
          className="block w-full rounded-2xl overflow-hidden transition-all duration-200 active:scale-[0.98] cursor-pointer group"
          style={{
            marginTop: '24px',
            textDecoration: 'none',
            background: 'linear-gradient(135deg, #FF6B35 0%, #FF8F65 100%)',
            border: '1px solid rgba(255, 107, 53, 0.3)',
          }}
        >
          <div style={{ padding: '20px 24px' }}>
            <div className="flex items-center gap-3">
              <span style={{ fontSize: '28px' }}>{'\u{1F96D}'}</span>
              <div className="flex-1 text-left">
                <div className="text-sm font-bold text-white" style={{ letterSpacing: '-0.01em' }}>
                  Have a website?
                </div>
                <div className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.85)', marginTop: '2px' }}>
                  Add a &quot;Make it a List&quot; button — readers share your content as checklists
                </div>
              </div>
              <svg className="w-5 h-5 flex-shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" stroke="white" viewBox="0 0 24 24" style={{ opacity: 0.8 }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </a>

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
          {' '}&middot;{' '}
          <a
            href="/about"
            className="underline hover:no-underline"
            style={{ color: 'var(--primary)' }}
          >
            About
          </a>
        </div>

        {/* Language Switcher */}
        <div className="flex justify-center" style={{ marginTop: '24px' }}>
          <LanguageSwitcherCompact />
        </div>
      </div>

      {/* Onboarding Walkthrough - stashed, can be triggered manually or post-first-list-creation */}
      {showOnboarding && (
        <OnboardingWalkthrough
          onComplete={handleOnboardingComplete}
          t={(key: string) => tOnboarding(key)}
          platform="web"
        />
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
                  <a href="mailto:hello@listmango.com" className="underline" style={{ color: 'var(--primary)' }}>hello@listmango.com</a>.
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

      {/* Backup & Transfer Modal */}
      <BackupTransferModal
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        lists={recentLists.map((list) => ({
          id: list.id,
          title: list.title,
          themeColor: list.themeColor,
          themeTextColor: list.themeTextColor,
        }))}
        templates={personalTemplates.map((template) => ({
          id: template.id,
          listId: template.listId,
          title: template.title,
          description: template.description,
          category: template.category,
          theme: template.theme,
          itemCount: template.itemCount,
        }))}
        onImport={(listsToImport, templatesToImport) => {
          // Import lists
          for (const list of listsToImport) {
            addList(list.id, list.title, list.themeColor);
          }
          // Import templates
          for (const template of templatesToImport) {
            addTemplate({
              listId: template.listId,
              title: template.title,
              description: template.description,
              category: template.category,
              themeColor: template.theme?.primary || null,
              theme: template.theme,
              itemCount: template.itemCount,
            });
          }
        }}
        onClearAll={() => {
          // Clear all local storage
          localStorage.removeItem('listo_saved_lists');
          localStorage.removeItem('listo_personal_templates');
          window.location.reload();
        }}
        translations={{
          exportTab: tBackup('exportTab'),
          importTab: tBackup('importTab'),
          exportHeroTitle: tBackup('exportHeroTitle'),
          exportHeroSubtitle: tBackup('exportHeroSubtitle'),
          importHeroTitle: tBackup('importHeroTitle'),
          importHeroSubtitle: tBackup('importHeroSubtitle'),
          selectedCount: tBackup('selectedCount'),
          selectAll: tBackup('selectAll'),
          deselectAll: tBackup('deselectAll'),
          quickTransfer: tBackup('quickTransfer'),
          quickTransferDescription: tBackup('quickTransferDescription'),
          fullBackup: tBackup('fullBackup'),
          fullBackupDescription: tBackup('fullBackupDescription'),
          yourCode: tBackup('yourCode'),
          scanOrEnter: tBackup('scanOrEnter'),
          codePlaceholder: tBackup('codePlaceholder'),
          preview: tBackup('preview'),
          importing: tBackup('importing'),
          importSelected: tBackup('importSelected'),
          itemsToImport: tBackup('itemsToImport'),
          alreadyHave: tBackup('alreadyHave'),
          clearAllData: tBackup('clearAllData'),
          clearConfirm: tBackup('clearConfirm'),
          cleared: tBackup('cleared'),
          codeExpired: tBackup('codeExpired'),
          invalidBackup: tBackup('invalidBackup'),
          importSuccess: tBackup('importSuccess'),
          nothingToExport: tBackup('nothingToExport'),
          lists: tBackup('lists'),
          selectListsToShare: tBackup('selectListsToShare'),
          templates: tBackup('templates'),
          generating: tBackup('generating'),
          codeCopied: tBackup('codeCopied'),
          linkCopied: tBackup('linkCopied'),
          expiresIn: tBackup('expiresIn'),
          scanWithPhone: tBackup('scanWithPhone'),
          orEnterCode: tBackup('orEnterCode'),
          fetch: tBackup('fetch'),
          fetching: tBackup('fetching'),
          dangerZone: tBackup('dangerZone'),
          clearAllDataDescription: tBackup('clearAllDataDescription'),
          backupCreated: tBackup('backupCreated'),
          backupCreatedHint: tBackup('backupCreatedHint'),
          copyLink: tBackup('copyLink'),
          emailToSelf: tBackup('emailToSelf'),
          backupEmailSubject: tBackup('backupEmailSubject'),
          backupEmailBody: tBackup('backupEmailBody'),
        }}
      />
    </div>
  );
}
