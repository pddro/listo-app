'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { generateListId } from '@/lib/utils/generateId';
import { useAI, isCategorizedResult, ManipulatedItem } from '@/lib/hooks/useAI';
import { DictateButton } from '@/components/DictateButton';

type InputMode = 'single' | 'multiple' | 'ai';

const PLACEHOLDERS = [
  '...groceries for the week',
  'movies to watch together',
  '...things to pack for camping',
  'books everyone should read',
  '...ingredients for taco night',
  'songs for the road trip playlist',
  '...gift ideas for mom',
  'places to visit in Tokyo',
  '...what to bring to the potluck',
  'games for family game night',
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
  const [value, setValue] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isPlaceholderFading, setIsPlaceholderFading] = useState(false);
  const router = useRouter();
  const { generateItems } = useAI();

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
    const trimmed = value.trim();

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

  const handleCreate = async (forceAI = false) => {
    if (isCreating) return;

    const trimmed = value.trim();
    if (!trimmed) {
      // Create empty list
      setIsCreating(true);
      const listId = generateListId();
      await supabase.from('lists').insert({ id: listId, title: null });
      router.push(`/${listId}`);
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const listId = generateListId();

      // Create the list
      const { error: listError } = await supabase
        .from('lists')
        .insert({ id: listId, title: null });

      if (listError) throw listError;

      let itemsToAdd: string[] = [];
      let categorizedItems: ManipulatedItem[] | null = null;

      // AI mode: ... prefix or Ctrl+Enter
      if (forceAI || trimmed.startsWith('...')) {
        const prompt = trimmed.startsWith('...') ? trimmed.slice(3).trim() : trimmed;
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
      else if (trimmed.includes(',')) {
        itemsToAdd = trimmed.split(',').map(s => s.trim()).filter(Boolean);
      }
      // Single mode
      else {
        itemsToAdd = [trimmed];
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

      // Navigate to the new list
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
      router.push(`/${listId}`);
    } catch (err) {
      console.error('Failed to create list from dictation:', err);
      setError(err instanceof Error ? err.message : 'Failed to create list');
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        {/* Logo/Title */}
        <div className="space-y-3" style={{ marginBottom: '16px' }}>
          <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-[0.2em]">
            Listo
          </h1>
          <p className="text-gray-400 text-sm">Create and share lists instantly</p>
        </div>

        {/* Input */}
        <div className="relative" style={{ marginBottom: '16px' }}>
          <div className="relative">
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
                w-full text-lg
                border
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
                padding: '8px',
                paddingRight: value.trim() ? '36px' : '8px',
                borderRadius: '4px'
              }}
            />
            {/* Animated placeholder */}
            {!value && (
              <div
                className={`
                  absolute left-2 top-1/2 -translate-y-1/2
                  text-lg text-gray-400 pointer-events-none
                  transition-opacity duration-200
                  ${isPlaceholderFading ? 'opacity-0' : 'opacity-100'}
                `}
              >
                {PLACEHOLDERS[placeholderIndex]}
              </div>
            )}
            {/* Submit arrow */}
            {value.trim() && !isCreating && (
              <button
                onClick={() => handleCreate(false)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--primary)] hover:text-[#3B8FE3] transition-colors"
                aria-label="Create list"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            )}
            {/* Loading spinner */}
            {isCreating && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <span className="inline-block w-5 h-5 border-2 border-[var(--primary)]/30 border-t-[var(--primary)] rounded-full animate-spin" />
              </div>
            )}
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
              AI is thinking...
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

        {/* Hint */}
        <p className="text-sm text-gray-400">
          <span className="font-medium text-[var(--primary)]">...</span> for AI magic • <span className="font-medium text-[var(--primary)]">commas</span> for many • <span className="font-medium text-[var(--primary)]">Enter</span> to create
        </p>

        {/* Dictate button */}
        <div style={{ marginTop: '16px' }}>
          <DictateButton
            onTranscription={handleDictation}
            disabled={isCreating}
            position="inline"
          />
        </div>
      </div>
    </div>
  );
}
