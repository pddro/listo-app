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
          const themeResponse = await fetch('/api/theme', {
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
          <p className="text-gray-400 text-sm">Create and share checklists instantly.</p>
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

        {/* Dictate button */}
        <div style={{ marginTop: '16px' }}>
          <DictateButton
            onTranscription={handleDictation}
            disabled={isCreating}
            position="inline"
          />
        </div>

        {/* Shortcuts */}
        <div
          className="rounded-lg text-sm text-left"
          style={{
            marginTop: '32px',
            padding: '16px 20px',
            backgroundColor: 'var(--primary-pale)',
            color: 'var(--text-secondary)',
          }}
        >
          <div className="font-bold uppercase tracking-wide text-xs mb-3" style={{ color: 'var(--primary)' }}>
            Shortcuts
          </div>
          <div className="space-y-3">
            <div>
              <div>Start with <code className="font-semibold px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>...</code> and a prompt to auto generate items</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Example: ...packing list for hiking day trip</div>
            </div>
            <div style={{ marginTop: '16px' }}>
              <div>Create many items at once by separating them with a comma</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Example: cheese, bread, tomatoes, bacon, mayonnaise</div>
            </div>
          </div>
        </div>

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
            Infinite custom styles
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '4px', marginBottom: '16px' }}>
            Describe any style and it will be designed for you automatically
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
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>sunset</span>
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
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>ocean</span>
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
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>forest</span>
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
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>neon</span>
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
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>midnight</span>
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
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>rose</span>
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
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>matrix</span>
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
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>birthday</span>
            </div>
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
            Type <code className="font-semibold px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>style: ocean sunset</code> in your list to style it
          </div>
        </div>
      </div>
    </div>
  );
}
