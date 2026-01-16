'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useList } from '@/lib/hooks/useList';
import { useAI, ManipulatedItem } from '@/lib/hooks/useAI';
import { supabase } from '@/lib/supabase';
import { ListTitle } from '@/components/ListTitle';
import { ListContainer } from '@/components/ListContainer';
import { DictateButton } from '@/components/DictateButton';
import { isCategorizedResult } from '@/lib/hooks/useAI';

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
  } = useList(listId);

  const { manipulateList, generateItems } = useAI();

  // Create list if it doesn't exist (for direct URL access)
  useEffect(() => {
    if (!loading && !list && !error) {
      createList();
    }
  }, [loading, list, error, createList]);

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-[var(--primary)] animate-pulse">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center">
      {/* Centered content container */}
      <div className="w-full max-w-lg pb-8" style={{ paddingTop: '32px', paddingLeft: '8px', paddingRight: '8px' }}>
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
                : 'text-gray-400 hover:text-[var(--primary)] hover:bg-[var(--primary-pale)]'
              }
            `}
            style={{ paddingLeft: '4px', paddingRight: '4px', borderRadius: '2px' }}
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
          onAddItem={addItem}
          onAddItems={addItems}
          onManipulateList={handleManipulateList}
          onCategorizedGenerate={handleCategorizedGenerate}
        />
      </div>

      {/* Dictate button */}
      <DictateButton onTranscription={handleDictation} />
    </div>
  );
}
