'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { ManipulatedItem, GenerateResult, isCategorizedResult } from '@/lib/hooks/useAI';

interface NewItemInputProps {
  onAdd: (content: string) => Promise<void>;
  onBulkAdd?: (contents: string[]) => Promise<unknown[]>;
  onAIGenerate: (prompt: string) => Promise<GenerateResult>;
  onAICategorizedGenerate?: (items: ManipulatedItem[]) => Promise<void>;
  onAIManipulate?: (instruction: string) => Promise<void>;
  onThemeGenerate?: (description: string) => Promise<void>;
  onThemeReset?: () => Promise<void>;
  onCompleteAll?: () => Promise<void>;
  onUncompleteAll?: () => Promise<void>;
  onSetLargeMode?: (enabled: boolean) => Promise<void>;
  onClearCompleted?: () => Promise<void>;
  onSort?: (sortAll: boolean) => Promise<void>;
  onUngroupAll?: () => Promise<void>;
  onToggleEmojify?: () => Promise<void>;
  onNuke?: () => Promise<void>;
  onGenerateTitle?: () => Promise<void>;
  placeholder?: string;
  autoFocus?: boolean;
  prefillValue?: string;
  onPrefillConsumed?: () => void;
}

type InputMode = 'single' | 'multiple' | 'ai' | 'manipulate' | 'theme' | 'command' | 'note';

export function NewItemInput({
  onAdd,
  onBulkAdd,
  onAIGenerate,
  onAICategorizedGenerate,
  onAIManipulate,
  onThemeGenerate,
  onThemeReset,
  onCompleteAll,
  onUncompleteAll,
  onSetLargeMode,
  onClearCompleted,
  onSort,
  onUngroupAll,
  onToggleEmojify,
  onNuke,
  onGenerateTitle,
  placeholder = 'Add items...',
  autoFocus = false,
  prefillValue,
  onPrefillConsumed,
}: NewItemInputProps) {
  const [value, setValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('AI is thinking...');
  const [aiError, setAiError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Handle prefill value
  useEffect(() => {
    if (prefillValue) {
      setValue(prefillValue);
      // Focus the appropriate input element
      setTimeout(() => {
        if (prefillValue.toLowerCase().startsWith('note:')) {
          textareaRef.current?.focus();
        } else {
          inputRef.current?.focus();
        }
      }, 0);
      onPrefillConsumed?.();
    }
  }, [prefillValue, onPrefillConsumed]);

  // Detect input mode based on content
  const { mode, displayText } = useMemo(() => {
    const trimmed = value.trim();

    const lowerTrimmed = trimmed.toLowerCase();

    // Command mode: starts with --
    if (lowerTrimmed.startsWith('--')) {
      const command = lowerTrimmed.slice(2).trim();
      let displayText = '';
      if (command === 'complete all' || command === 'complete') {
        displayText = 'Complete all items';
      } else if (command === 'uncomplete all' || command === 'uncomplete' || command === 'reset') {
        displayText = 'Reset all items';
      } else if (command === 'large' || command === 'big') {
        displayText = 'Enable large mode';
      } else if (command === 'normal' || command === 'small' || command === 'default') {
        displayText = 'Disable large mode';
      } else if (command === 'clean' || command === 'clear' || command === 'clear completed') {
        displayText = 'Delete all completed items';
      } else if (command === 'sort') {
        displayText = 'Sort items alphabetically';
      } else if (command === 'sort all') {
        displayText = 'Sort everything alphabetically';
      } else if (command === 'ungroup' || command === 'ungroup all' || command === 'flatten') {
        displayText = 'Remove all categories';
      } else if (command === 'emojify') {
        displayText = 'Toggle emoji mode';
      } else if (command === 'nuke') {
        displayText = 'Delete ALL items';
      } else if (command === 'title') {
        displayText = 'Generate list title';
      }
      return {
        mode: 'command' as InputMode,
        displayText
      };
    }

    // Theme mode: starts with theme: or style:
    if (lowerTrimmed.startsWith('theme:') || lowerTrimmed.startsWith('style:')) {
      const prefix = lowerTrimmed.startsWith('theme:') ? 'theme:' : 'style:';
      const description = trimmed.slice(prefix.length).trim();
      return {
        mode: 'theme' as InputMode,
        displayText: description ? 'AI will generate theme' : ''
      };
    }

    // Manipulate mode: starts with !
    if (trimmed.startsWith('!')) {
      const instruction = trimmed.slice(1).trim();
      return {
        mode: 'manipulate' as InputMode,
        displayText: instruction ? 'AI will reorganize list' : ''
      };
    }

    // AI mode: starts with ...
    if (trimmed.startsWith('...')) {
      const prompt = trimmed.slice(3).trim();
      return {
        mode: 'ai' as InputMode,
        displayText: prompt ? 'AI will generate items' : ''
      };
    }

    // Note mode: starts with note:
    if (lowerTrimmed.startsWith('note:')) {
      const noteContent = trimmed.slice(5).trim();
      return {
        mode: 'note' as InputMode,
        displayText: noteContent ? 'Adding note' : 'Type your note...'
      };
    }

    // Multiple mode: contains commas
    if (trimmed.includes(',')) {
      const items = trimmed.split(',').map(s => s.trim()).filter(Boolean);
      return {
        mode: 'multiple' as InputMode,
        displayText: `Adding ${items.length} items`
      };
    }

    // Single mode
    return { mode: 'single' as InputMode, displayText: '' };
  }, [value]);

  // Track previous mode to detect switch to note mode
  const prevModeRef = useRef<InputMode>('single');

  // Focus textarea when switching to note mode and set cursor to end
  useEffect(() => {
    if (mode === 'note' && prevModeRef.current !== 'note' && textareaRef.current) {
      textareaRef.current.focus();
      // Set cursor to end of text
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
    prevModeRef.current = mode;
  }, [mode]);

  // Add items with staggered animation
  const addItemsWithCascade = async (items: string[]) => {
    const validItems = items.map(s => s.trim()).filter(Boolean);
    const reversed = [...validItems].reverse();

    for (let i = 0; i < reversed.length; i++) {
      await onAdd(reversed[i]);
      if (i < reversed.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  };

  const handleSubmit = async (forceAI = false) => {
    const trimmed = value.trim();
    if (!trimmed || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setAiError(null);

    const currentValue = value;
    setValue('');
    inputRef.current?.focus();

    try {
      const lowerTrimmed = trimmed.toLowerCase();

      // Command mode: -- prefix
      if (lowerTrimmed.startsWith('--')) {
        const command = lowerTrimmed.slice(2).trim();

        if (command === 'complete all' || command === 'complete') {
          if (onCompleteAll) {
            await onCompleteAll();
          }
          return;
        }

        if (command === 'uncomplete all' || command === 'uncomplete' || command === 'reset') {
          if (onUncompleteAll) {
            await onUncompleteAll();
          }
          return;
        }

        if (command === 'large' || command === 'big') {
          if (onSetLargeMode) {
            await onSetLargeMode(true);
          }
          return;
        }

        if (command === 'normal' || command === 'small' || command === 'default') {
          if (onSetLargeMode) {
            await onSetLargeMode(false);
          }
          return;
        }

        if (command === 'clean' || command === 'clear' || command === 'clear completed') {
          if (onClearCompleted) {
            await onClearCompleted();
          }
          return;
        }

        if (command === 'sort') {
          if (onSort) {
            await onSort(false);
          }
          return;
        }

        if (command === 'sort all') {
          if (onSort) {
            await onSort(true);
          }
          return;
        }

        if (command === 'ungroup' || command === 'ungroup all' || command === 'flatten') {
          if (onUngroupAll) {
            await onUngroupAll();
          }
          return;
        }

        if (command === 'emojify') {
          if (onToggleEmojify) {
            await onToggleEmojify();
          }
          return;
        }

        if (command === 'nuke') {
          if (onNuke) {
            await onNuke();
          }
          return;
        }

        if (command === 'title') {
          if (onGenerateTitle) {
            await onGenerateTitle();
          }
          return;
        }

        // Unknown command - restore input
        setValue(currentValue);
        setAiError('Unknown command');
        return;
      }

      // Theme mode: theme: or style: prefix
      if (lowerTrimmed.startsWith('theme:') || lowerTrimmed.startsWith('style:')) {
        const prefix = lowerTrimmed.startsWith('theme:') ? 'theme:' : 'style:';
        const description = trimmed.slice(prefix.length).trim();
        if (!description) {
          setValue(currentValue);
          return;
        }

        if (!onThemeGenerate) {
          setAiError('Theme generation not available');
          setValue(currentValue);
          return;
        }

        setIsProcessing(true);
        setProcessingMessage('Generating theme...');
        try {
          await onThemeGenerate(description);
        } catch (err) {
          setAiError(err instanceof Error ? err.message : 'Theme generation failed');
          setValue(currentValue);
        } finally {
          setIsProcessing(false);
        }
        return;
      }

      // Manipulate mode: ! prefix
      if (trimmed.startsWith('!')) {
        const instruction = trimmed.slice(1).trim();
        if (!instruction) {
          setValue(currentValue);
          return;
        }

        if (!onAIManipulate) {
          setAiError('List manipulation not available');
          setValue(currentValue);
          return;
        }

        setIsProcessing(true);
        setProcessingMessage('Reorganizing list...');
        try {
          await onAIManipulate(instruction);
        } catch (err) {
          setAiError(err instanceof Error ? err.message : 'List manipulation failed');
          setValue(currentValue);
        } finally {
          setIsProcessing(false);
        }
        return;
      }

      // AI mode: ... prefix or Ctrl+Enter
      if (forceAI || trimmed.startsWith('...')) {
        const prompt = trimmed.startsWith('...') ? trimmed.slice(3).trim() : trimmed;
        if (!prompt) {
          setValue(currentValue);
          return;
        }

        setIsProcessing(true);
        setProcessingMessage('AI is thinking...');
        try {
          const result = await onAIGenerate(prompt);
          if (result.length > 0) {
            // Check if the result is categorized (ManipulatedItem[])
            if (isCategorizedResult(result)) {
              if (onAICategorizedGenerate) {
                await onAICategorizedGenerate(result);
              } else {
                // Fallback: just add the items without categories
                const items = result.map(item => item.content).filter(c => !c.startsWith('#'));
                if (onBulkAdd && items.length > 1) {
                  await onBulkAdd(items);
                } else {
                  await addItemsWithCascade(items);
                }
              }
            } else {
              // Simple string array - use bulk add for multiple items
              if (onBulkAdd && result.length > 1) {
                await onBulkAdd(result);
              } else {
                await addItemsWithCascade(result);
              }
            }
          }
        } catch (err) {
          setAiError(err instanceof Error ? err.message : 'AI generation failed');
          setValue(currentValue);
        } finally {
          setIsProcessing(false);
        }
        return;
      }

      // Note mode: add with note: prefix intact (skip comma splitting)
      if (lowerTrimmed.startsWith('note:')) {
        await onAdd(trimmed);
        return;
      }

      // Multiple mode: comma-separated
      if (trimmed.includes(',')) {
        const items = trimmed.split(',').map(s => s.trim()).filter(Boolean);
        if (onBulkAdd && items.length > 1) {
          await onBulkAdd(items);
        } else {
          // Fallback to cascade if no bulk add
          await addItemsWithCascade(items);
        }
        return;
      }

      // Single mode: just add the item
      await onAdd(trimmed);
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      // In note mode, Shift+Enter adds newline (let it through)
      if (mode === 'note' && e.shiftKey) {
        return;
      }
      e.preventDefault();
      const forceAI = e.ctrlKey || e.metaKey;
      handleSubmit(forceAI);
    }
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Sparkles icon for generate mode
  const SparklesIcon = () => (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0L13.5 8.5L22 10L13.5 11.5L12 20L10.5 11.5L2 10L10.5 8.5L12 0Z" />
      <path d="M18 14L18.75 17.25L22 18L18.75 18.75L18 22L17.25 18.75L14 18L17.25 17.25L18 14Z" opacity="0.7" />
      <path d="M6 14L6.5 16.5L9 17L6.5 17.5L6 20L5.5 17.5L3 17L5.5 16.5L6 14Z" opacity="0.5" />
    </svg>
  );

  // Wand icon for manipulate mode
  const WandIcon = () => (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7.5 5.6L5 7L6.4 4.5L5 2L7.5 3.4L10 2L8.6 4.5L10 7L7.5 5.6Z" />
      <path d="M19 11.5L17.5 9L16 11.5L13.5 10L15 12.5L13.5 15L16 13.5L17.5 16L19 13.5L21.5 15L20 12.5L21.5 10L19 11.5Z" opacity="0.7" />
      <path d="M21.41 8.59L15.41 2.59C15.03 2.21 14.41 2.21 14.03 2.59L2.59 14.03C2.21 14.41 2.21 15.03 2.59 15.41L8.59 21.41C8.97 21.79 9.59 21.79 9.97 21.41L21.41 9.97C21.79 9.59 21.79 8.97 21.41 8.59Z" />
    </svg>
  );

  const isAIMode = mode === 'ai' || mode === 'manipulate' || mode === 'theme';
  const isCommandMode = mode === 'command';
  const isNoteMode = mode === 'note';

  // Terminal icon for command mode
  const TerminalIcon = () => (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8h16v10zm-2-1h-6v-2h6v2zM7.5 17l-1.41-1.41L8.67 13l-2.59-2.59L7.5 9l4 4-4 4z" />
    </svg>
  );

  // Palette icon for theme mode
  const PaletteIcon = () => (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.61-.23-1.2-.64-1.67-.08-.1-.13-.21-.13-.33 0-.28.22-.5.5-.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 8 6.5 8 8 8.67 8 9.5 7.33 11 6.5 11zm3-4C8.67 7 8 6.33 8 5.5S8.67 4 9.5 4s1.5.67 1.5 1.5S10.33 7 9.5 7zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 4 14.5 4s1.5.67 1.5 1.5S15.33 7 14.5 7zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 8 17.5 8s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
    </svg>
  );

  // Note icon for note mode
  const NoteIcon = () => (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    setAiError(null);
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  return (
    <div className="relative" style={{ marginBottom: '16px' }}>
      <div
        className={`
          rounded relative
          transition-all duration-200
          ${isProcessing
            ? 'border-[var(--primary)] bg-[var(--primary-pale)]'
            : ''
          }
          ${isAIMode && value.trim().length > 1 ? 'border-[var(--primary-light)]' : ''}
        `}
        style={{
          paddingTop: '4px',
          paddingBottom: '4px',
          paddingLeft: '4px',
          paddingRight: '4px',
          border: isProcessing ? undefined : `1px solid var(--border-light)`,
          ...(isAIMode && value.trim().length > 1 ? { borderColor: 'var(--primary-light)' } : {})
        }}
      >
        {isNoteMode ? (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleTextareaChange}
            onKeyDown={handleTextareaKeyDown}
            placeholder="note: Write your note here... (Shift+Enter for new line)"
            disabled={isProcessing}
            rows={1}
            className={`
              w-full bg-transparent border-none outline-none resize-none
              transition-colors
              ${isProcessing ? 'opacity-50' : ''}
            `}
            style={{
              color: 'var(--text-primary)',
              minHeight: '24px',
            }}
          />
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setAiError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isProcessing}
            className={`
              w-full bg-transparent border-none outline-none
              transition-colors
              ${isProcessing ? 'opacity-50' : ''}
            `}
            style={{
              color: 'var(--text-primary)',
            }}
          />
        )}
      </div>

      {/* Mode indicator badge */}
      {displayText && !isProcessing && (
        <div
          className="absolute left-0 flex items-center gap-1 text-xs text-white bg-[var(--primary)] px-2 py-0.5 rounded-sm"
          style={{ top: 'calc(100% + 4px)' }}
        >
          {mode === 'command' ? <TerminalIcon /> : mode === 'theme' ? <PaletteIcon /> : mode === 'manipulate' ? <WandIcon /> : mode === 'note' ? <NoteIcon /> : <SparklesIcon />}
          {displayText}
        </div>
      )}

      {/* Processing indicator */}
      {isProcessing && (
        <div
          className="absolute left-0 flex items-center gap-1.5 text-xs text-white bg-[var(--primary)] px-2 py-0.5 rounded-sm"
          style={{ top: 'calc(100% + 4px)' }}
        >
          <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          {processingMessage}
        </div>
      )}

      {/* Error indicator */}
      {aiError && (
        <div
          className="absolute left-0 text-xs text-white px-2 py-0.5 rounded-sm"
          style={{ top: 'calc(100% + 4px)', backgroundColor: 'var(--error)' }}
        >
          {aiError}
        </div>
      )}
    </div>
  );
}
