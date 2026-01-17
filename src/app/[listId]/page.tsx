'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { useList } from '@/lib/hooks/useList';
import { useAI, ManipulatedItem } from '@/lib/hooks/useAI';
import { supabase } from '@/lib/supabase';
import { ListTitle } from '@/components/ListTitle';
import { ListContainer } from '@/components/ListContainer';
import { DictateButton } from '@/components/DictateButton';
import { isCategorizedResult } from '@/lib/hooks/useAI';
import { ThemeColors } from '@/lib/gemini';

export default function ListPage() {
  const params = useParams();
  const listId = params.listId as string;
  const [copied, setCopied] = useState(false);

  const {
    list,
    items,
    itemTree,
    loading,
    error,
    newItemId,
    newItemIds,
    completingItemIds,
    createList,
    updateTitle,
    updateTheme,
    updateLargeMode,
    addItem,
    addItems,
    updateItem,
    toggleItem,
    deleteItem,
    reorderItems,
    moveToGroup,
    moveToRoot,
    indentItem,
    outdentItem,
    completeAll,
    uncompleteAll,
    clearCompleted,
    sortItems,
    ungroupAll,
    nukeItems,
    toggleEmojifyMode,
  } = useList(listId);

  const { manipulateList, generateItems } = useAI();

  // Create list if it doesn't exist (for direct URL access)
  useEffect(() => {
    if (!loading && !list && !error) {
      createList();
    }
  }, [loading, list, error, createList]);

  // Apply theme from list data
  const applyTheme = useCallback((theme: ThemeColors | null) => {
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
      // Reset to defaults
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

  // Apply theme when list loads
  useEffect(() => {
    if (list) {
      applyTheme(list.theme);
    }
    // Cleanup: reset theme when leaving the page
    return () => {
      applyTheme(null);
    };
  }, [list, applyTheme]);

  // Handle theme generation
  const handleThemeGenerate = async (description: string) => {
    const response = await fetch('/api/theme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Theme generation failed');
    }

    const { theme } = await response.json();

    // Apply theme immediately
    applyTheme(theme);

    // Save to database
    await updateTheme(theme);
  };

  // Handle theme reset
  const handleThemeReset = async () => {
    applyTheme(null);
    await updateTheme(null);
  };

  // Helper to emojify text
  const emojifyText = async (text: string): Promise<string> => {
    try {
      const response = await fetch('/api/emojify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (response.ok) {
        const { emoji } = await response.json();
        return `${emoji} ${text}`;
      }
    } catch (err) {
      console.error('Emojify failed:', err);
    }
    return text; // Return original if emojify fails
  };

  // Wrapper for addItem that handles emojify
  const handleAddItem = async (content: string, parentId?: string | null) => {
    let finalContent = content;
    // Only emojify regular items (not headers starting with #)
    if (list?.emojify_mode && !content.startsWith('#') && !content.startsWith('--')) {
      finalContent = await emojifyText(content);
    }
    await addItem(finalContent, parentId);
  };

  // Wrapper for addItems that handles emojify
  const handleAddItems = async (contents: string[], parentId?: string | null) => {
    let finalContents = contents;
    if (list?.emojify_mode) {
      // Emojify all items in parallel
      finalContents = await Promise.all(
        contents.map(async (content) => {
          if (!content.startsWith('#') && !content.startsWith('--')) {
            return await emojifyText(content);
          }
          return content;
        })
      );
    }
    return await addItems(finalContents, parentId);
  };

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate title from items
  const handleGenerateTitle = async () => {
    const itemContents = items
      .filter(item => !item.completed && !item.content.startsWith('#'))
      .map(item => item.content);

    if (itemContents.length === 0) return;

    try {
      const response = await fetch('/api/title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemContents }),
      });

      if (response.ok) {
        const { title } = await response.json();
        await updateTitle(title);
      }
    } catch (err) {
      console.error('Title generation failed:', err);
    }
  };

  const handleManipulateList = async (instruction: string) => {
    // Get only incomplete items for manipulation
    const incompleteItems = items.filter(item => !item.completed);

    if (incompleteItems.length === 0) {
      throw new Error('No items to reorganize');
    }

    // Send to AI for manipulation
    const manipulatedItems = await manipulateList(incompleteItems, instruction);

    // Separate new items (headers) from existing items
    const newItems = manipulatedItems.filter(item => item.id.startsWith('new_'));
    const existingItems = manipulatedItems.filter(item => !item.id.startsWith('new_'));

    // Create a mapping from placeholder IDs to real IDs
    const idMapping: Record<string, string> = {};

    // Create new header items in database
    for (const newItem of newItems) {
      const { data, error } = await supabase
        .from('items')
        .insert({
          list_id: listId,
          content: newItem.content,
          completed: false,
          parent_id: null,
          position: newItem.position,
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        idMapping[newItem.id] = data.id;
      }
    }

    // Update existing items with new positions and parent_ids
    for (const manipulatedItem of existingItems) {
      // Translate parent_id from placeholder to real ID
      let realParentId = manipulatedItem.parent_id;
      if (realParentId && idMapping[realParentId]) {
        realParentId = idMapping[realParentId];
      }

      await updateItem(manipulatedItem.id, {
        content: manipulatedItem.content,
        position: manipulatedItem.position,
        parent_id: realParentId,
      });
    }
  };

  // Handle dictation transcription - send to Gemini for list generation
  const handleDictation = async (transcription: string) => {
    if (!transcription.trim()) return;

    try {
      const result = await generateItems(transcription);

      if (result.length > 0) {
        if (isCategorizedResult(result)) {
          await handleCategorizedGenerate(result);
        } else {
          // Simple string array - use bulk add
          await addItems(result);
        }
      }
    } catch (err) {
      console.error('Failed to process dictation:', err);
    }
  };

  // Handle AI-generated categorized items (all items are new)
  const handleCategorizedGenerate = async (generatedItems: ManipulatedItem[]) => {
    if (generatedItems.length === 0) return;

    // Create a mapping from placeholder IDs to real IDs
    const idMapping: Record<string, string> = {};

    // First pass: create all headers (items without parent_id)
    const headers = generatedItems.filter(item => !item.parent_id);
    for (const header of headers) {
      const { data, error } = await supabase
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

      if (error) throw error;
      if (data) {
        idMapping[header.id] = data.id;
      }
    }

    // Second pass: create child items with translated parent_ids
    const children = generatedItems.filter(item => item.parent_id);
    for (const child of children) {
      // Translate parent_id from placeholder to real ID
      const realParentId = child.parent_id ? idMapping[child.parent_id] : null;

      const { data, error } = await supabase
        .from('items')
        .insert({
          list_id: listId,
          content: child.content,
          completed: false,
          parent_id: realParentId,
          position: child.position,
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        idMapping[child.id] = data.id;
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="text-[var(--primary)] animate-pulse">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div style={{ color: 'var(--error)' }}>{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Centered content container */}
      <div className="w-full max-w-lg pb-16" style={{ paddingTop: '32px', paddingLeft: '8px', paddingRight: '8px' }}>
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <ListTitle title={list?.title || null} onUpdate={updateTitle} />
          <button
            onClick={handleShare}
            className={`
              text-sm py-1.5 transition-all duration-200
              flex items-center gap-1.5
              ${copied
                ? 'bg-[var(--primary)] text-white'
                : 'hover:text-[var(--primary)] hover:bg-[var(--primary-pale)]'
              }
            `}
            style={{
              paddingLeft: '4px',
              paddingRight: '4px',
              borderRadius: '2px',
              color: copied ? undefined : 'var(--text-muted)'
            }}
          >
            {copied ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </>
            )}
          </button>
        </div>

        {/* List */}
        <ListContainer
          items={itemTree}
          newItemId={newItemId}
          newItemIds={newItemIds}
          completingItemIds={completingItemIds}
          largeMode={list?.large_mode || false}
          onToggle={toggleItem}
          onUpdate={async (id, content) => {
            await updateItem(id, { content });
          }}
          onDelete={deleteItem}
          onIndent={indentItem}
          onOutdent={outdentItem}
          onReorder={async (activeId, overId) => {
            await reorderItems(activeId, overId);
          }}
          onMoveToGroup={moveToGroup}
          onMoveToRoot={moveToRoot}
          onAddItem={handleAddItem}
          onAddItems={handleAddItems}
          onManipulateList={handleManipulateList}
          onCategorizedGenerate={handleCategorizedGenerate}
          onThemeGenerate={handleThemeGenerate}
          onThemeReset={list?.theme ? handleThemeReset : undefined}
          onCompleteAll={completeAll}
          onUncompleteAll={uncompleteAll}
          onSetLargeMode={updateLargeMode}
          onClearCompleted={clearCompleted}
          onSort={sortItems}
          onUngroupAll={ungroupAll}
          onToggleEmojify={toggleEmojifyMode}
          onNuke={nukeItems}
          onGenerateTitle={handleGenerateTitle}
        />

        {/* Commands reference section */}
        <div className="mt-8 mb-8">
          {/* Subtle divider */}
          <div
            className="mb-4"
            style={{
              height: '1px',
              backgroundColor: 'var(--border-light)',
              opacity: 0.5,
            }}
          />

          <div
            className="text-xs space-y-4"
            style={{ color: 'var(--text-placeholder)', opacity: 0.6 }}
          >
            {/* Header */}
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontWeight: 600, opacity: 0.8 }}>COMMANDS</div>
              <div>Quickly manipulate your list, all commands start with --</div>
            </div>

            {/* Active options */}
            {(list?.large_mode || list?.emojify_mode) && (
              <div className="space-y-1" style={{ marginTop: '16px' }}>
                <div style={{ fontWeight: 600, opacity: 0.8 }}>ACTIVE:</div>
                {list?.large_mode && (
                  <div>large mode · --normal to turn off</div>
                )}
                {list?.emojify_mode && (
                  <div>emojify · --emojify to toggle off</div>
                )}
              </div>
            )}

            {/* Commands reference */}
            <div className="space-y-1" style={{ marginTop: '16px', paddingBottom: '60px' }}>
              <div style={{ fontWeight: 600, opacity: 0.8 }}>
                {(list?.large_mode || list?.emojify_mode) ? 'OTHER COMMANDS:' : 'ALL COMMANDS:'}
              </div>
              <div>--complete · Complete all items</div>
              <div>--reset · Reset all items to incomplete</div>
              <div>--clean · Clean up all completed</div>
              <div>--large · Make everything 2x larger</div>
              <div>--emojify · Add a relevant emoji to new items</div>
              <div>--sort · Sort items inside groups alphabetically</div>
              <div>--sort all · Sort all items and groups</div>
              <div>--ungroup · Remove all groups, keeps items</div>
              <div>--title · Generate list title</div>
              <div style={{ marginTop: '8px' }}>--nuke · Deletes everything</div>
            </div>
          </div>
        </div>
      </div>

      {/* Dictate button */}
      <DictateButton onTranscription={handleDictation} />
    </div>
  );
}
