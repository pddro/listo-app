'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { ManipulatedItem, GenerateResult, isCategorizedResult } from '@/lib/hooks/useAI';

interface NewItemInputProps {
  onAdd: (content: string) => Promise<void>;
  onBulkAdd?: (contents: string[]) => Promise<unknown[]>;
  onAIGenerate: (prompt: string) => Promise<GenerateResult>;
  onAICategorizedGenerate?: (items: ManipulatedItem[]) => Promise<void>;
  onAIManipulate?: (instruction: string) => Promise<void>;
  placeholder?: string;
  autoFocus?: boolean;
}

type InputMode = 'single' | 'multiple' | 'ai' | 'manipulate';

export function NewItemInput({
  onAdd,
  onBulkAdd,
  onAIGenerate,
  onAICategorizedGenerate,
  onAIManipulate,
  placeholder = 'Add items...',
  autoFocus = false
}: NewItemInputProps) {
  const [value, setValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('AI is thinking...');
  const [aiError, setAiError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Detect input mode based on content
  const { mode, displayText } = useMemo(() => {
    const trimmed = value.trim();

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
      e.preventDefault();
      const forceAI = e.ctrlKey || e.metaKey;
      handleSubmit(forceAI);
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

  const isAIMode = mode === 'ai' || mode === 'manipulate';

  return (
    <div className="relative" style={{ marginBottom: '16px' }}>
      <div
        className={`
          border rounded-sm
          transition-all duration-200
          ${isProcessing
            ? 'border-[var(--primary)] bg-[var(--primary-pale)]'
            : 'border-gray-100 focus-within:border-gray-200'
          }
          ${isAIMode && value.trim().length > 1 ? 'border-[var(--primary-light)]' : ''}
        `}
        style={{
          paddingTop: '4px',
          paddingBottom: '4px',
          paddingLeft: '4px',
          paddingRight: '4px'
        }}
      >
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
            text-gray-900 placeholder-gray-300
            transition-colors
            ${isProcessing ? 'opacity-50' : ''}
          `}
        />
      </div>

      {/* Mode indicator badge */}
      {displayText && !isProcessing && (
        <div
          className="absolute left-0 flex items-center gap-1 text-xs text-white bg-[var(--primary)] px-2 py-0.5 rounded-sm"
          style={{ top: 'calc(100% + 4px)' }}
        >
          {mode === 'manipulate' ? <WandIcon /> : <SparklesIcon />}
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
          className="absolute left-0 text-xs text-white bg-red-500 px-2 py-0.5 rounded-sm"
          style={{ top: 'calc(100% + 4px)' }}
        >
          {aiError}
        </div>
      )}
    </div>
  );
}
