import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { generateListId } from '@/lib/utils/generateId';
import { useAI, isCategorizedResult, ManipulatedItem } from '@/lib/hooks/useAI';
import { DictateButton } from '@/components/DictateButton';
import { API } from '@/lib/api';

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

export default function HomePage() {
  const [value, setValue] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isPlaceholderFading, setIsPlaceholderFading] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const navigate = useNavigate();
  const { generateItems } = useAI();

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
  const { mode, itemCount, displayText } = useMemo(() => {
    const normalized = normalizeInput(value);
    const trimmed = normalized.trim();

    if (trimmed.startsWith('...')) {
      const prompt = trimmed.slice(3).trim();
      return {
        mode: 'ai' as InputMode,
        itemCount: 0,
        displayText: prompt ? 'AI will generate items' : ''
      };
    }

    if (trimmed.includes(',')) {
      const items = trimmed.split(',').map(s => s.trim()).filter(Boolean);
      return {
        mode: 'multiple' as InputMode,
        itemCount: items.length,
        displayText: `Adding ${items.length} items`
      };
    }

    return { mode: 'single' as InputMode, itemCount: 0, displayText: '' };
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

      navigate(`/${listId}`);
    } catch (err) {
      console.error('Failed to create list from dictation:', err);
      setError(err instanceof Error ? err.message : 'Failed to create list');
      setIsCreating(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-white"
      style={{
        paddingLeft: '20px',
        paddingRight: '20px',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="w-full max-w-md text-center">
        {/* Logo/Title */}
        <div className="space-y-3" style={{ marginBottom: '24px' }}>
          <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-[0.2em]">
            Listo
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Create a list. Share the link. Collaborate in real-time.
          </p>
          <div className="flex items-center justify-center gap-4 text-xs" style={{ color: 'var(--text-muted)', marginTop: '12px' }}>
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" style={{ color: 'var(--primary)' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              No signup
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" style={{ color: 'var(--primary)' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Real-time sharing
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" style={{ color: 'var(--primary)' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              AI-powered
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
              {!value && (
                <div
                  className={`
                    absolute left-3 top-1/2 -translate-y-1/2
                    text-base text-gray-400 pointer-events-none
                    transition-opacity duration-200
                    ${isPlaceholderFading ? 'opacity-0' : 'opacity-100'}
                  `}
                >
                  {PLACEHOLDERS[placeholderIndex]}
                </div>
              )}
            </div>
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
        <div style={{ marginTop: '16px' }}>
          <DictateButton
            onTranscription={handleDictation}
            disabled={isCreating}
            position="inline"
          />
        </div>

        {/* Shortcuts */}
        <div
          className="rounded-lg text-xs text-left"
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
                  LISTO checklists are inherently public. Once you create a listo and share its link, anyone with access to that link can view and edit the listo.
                </p>
              </section>

              <section>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Data Collection and Use</h3>
                <p>
                  LISTO does not require user registration. All listos are created anonymously.
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
