'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { List, Item, ItemWithChildren } from '@/types';
import { ThemeColors } from '@/lib/gemini';
import { analytics } from '@/lib/analytics';

export function useList(listId: string) {
  const [list, setList] = useState<List | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track pending inserts to correlate temp IDs with real IDs from realtime
  // Key: composite of content|parent_id|position, Value: tempId
  const pendingInsertsRef = useRef<Map<string, string>>(new Map());

  // Track items that are animating (completing) - they stay in place during animation
  const [completingItemIds, setCompletingItemIds] = useState<Set<string>>(new Set());

  // Debounce timer for batch-moving completed items to bottom
  const completionDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Organize items into tree structure
  // Sort: incomplete items first (by position), then completed items (by position)
  // Items in "completing" state stay in their original position during animation
  const organizeItems = useCallback((flatItems: Item[], completingIds: Set<string>): ItemWithChildren[] => {
    const itemMap = new Map<string, ItemWithChildren>();
    const rootItems: ItemWithChildren[] = [];

    // Create ItemWithChildren for each item
    flatItems.forEach(item => {
      itemMap.set(item.id, { ...item, children: [] });
    });

    // Build tree structure
    flatItems.forEach(item => {
      const itemWithChildren = itemMap.get(item.id)!;
      if (item.parent_id && itemMap.has(item.parent_id)) {
        itemMap.get(item.parent_id)!.children.push(itemWithChildren);
      } else {
        rootItems.push(itemWithChildren);
      }
    });

    // Sort: incomplete first (by position), then completed (by position)
    // BUT items that are "completing" (animating) stay in place
    const sortItems = (a: ItemWithChildren, b: ItemWithChildren) => {
      const aIsCompleting = completingIds.has(a.id);
      const bIsCompleting = completingIds.has(b.id);

      // Treat completing items as incomplete for sorting (keeps them in place)
      const aCompleted = a.completed && !aIsCompleting;
      const bCompleted = b.completed && !bIsCompleting;

      if (aCompleted !== bCompleted) {
        return aCompleted ? 1 : -1; // Incomplete items first
      }
      return a.position - b.position;
    };
    rootItems.sort(sortItems);
    itemMap.forEach(item => item.children.sort(sortItems));

    return rootItems;
  }, []);

  const itemTree = organizeItems(items, completingItemIds);

  // Fetch list and items
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      // Fetch list
      const { data: listData, error: listError } = await supabase
        .from('lists')
        .select('*')
        .eq('id', listId)
        .single();

      if (listError && listError.code !== 'PGRST116') {
        setError('Failed to load list');
        setLoading(false);
        return;
      }

      setList(listData);

      // Fetch items
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .eq('list_id', listId)
        .order('position');

      if (itemsError) {
        setError('Failed to load items');
        setLoading(false);
        return;
      }

      setItems(itemsData || []);
      setLoading(false);
    }

    fetchData();
  }, [listId]);

  // Real-time subscriptions
  useEffect(() => {
    const listChannel = supabase
      .channel(`list-${listId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lists', filter: `id=eq.${listId}` },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            // Merge with existing state to preserve fields not in payload
            setList(prev => prev ? { ...prev, ...(payload.new as List) } : payload.new as List);
          } else if (payload.eventType === 'DELETE') {
            setList(null);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items', filter: `list_id=eq.${listId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newItem = payload.new as Item;

            // Check if this matches a pending optimistic insert
            const pendingKey = `${newItem.content}|${newItem.parent_id}|${newItem.position}`;
            const tempId = pendingInsertsRef.current.get(pendingKey);

            if (tempId) {
              // This is our optimistic item coming back - replace temp with real
              pendingInsertsRef.current.delete(pendingKey);
              setItems(prev => prev.map(item =>
                item.id === tempId ? newItem : item
              ));
            } else {
              // This is from another client or source - add if not already exists
              setItems(prev => {
                const exists = prev.some(item => item.id === newItem.id);
                if (exists) return prev;
                return [...prev, newItem];
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            setItems(prev => prev.map(item =>
              item.id === (payload.new as Item).id ? payload.new as Item : item
            ));
          } else if (payload.eventType === 'DELETE') {
            setItems(prev => prev.filter(item => item.id !== (payload.old as Item).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(listChannel);
    };
  }, [listId]);

  // Create list if it doesn't exist
  const createList = async (title?: string) => {
    const { data, error } = await supabase
      .from('lists')
      .insert({ id: listId, title: title || null })
      .select()
      .single();

    if (error) throw error;
    setList(data);
    analytics.listCreated(listId);
    return data;
  };

  // Update list title
  const updateTitle = async (title: string) => {
    // Optimistic update
    setList(prev => prev ? { ...prev, title } : prev);

    const { error } = await supabase
      .from('lists')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', listId);

    if (error) throw error;
  };

  // Track newly added item IDs for flash animation
  const [newItemId, setNewItemId] = useState<string | null>(null);
  const [newItemIds, setNewItemIds] = useState<string[]>([]);

  // Add multiple items at once (bulk add) - avoids race conditions
  const addItems = async (contents: string[], parentId?: string | null) => {
    console.log('[addItems] Called with:', { contents, parentId, listId });
    if (contents.length === 0) return [];

    const targetParentId = parentId || null;

    // Get current siblings at this level
    const siblings = items.filter(i => i.parent_id === targetParentId && !i.completed);
    const shiftAmount = contents.length;

    // Optimistically shift existing items
    setItems(prev => prev.map(item => {
      if (item.parent_id === targetParentId && !item.completed) {
        return { ...item, position: item.position + shiftAmount };
      }
      return item;
    }));

    // Prepare new items with positions 0, 1, 2, ... (first item at top)
    const newItems = contents.map((content, index) => ({
      list_id: listId,
      content,
      parent_id: targetParentId,
      position: index,
    }));

    // Insert all new items in one batch
    console.log('[addItems] Inserting items:', newItems);
    const { data, error } = await supabase
      .from('items')
      .insert(newItems)
      .select();

    console.log('[addItems] Insert result:', { data, error });
    if (error) {
      console.error('[addItems] Insert error:', error);
      throw error;
    }

    // Optimistically add the new items to state immediately
    // (don't rely solely on real-time subscription which may not work in all environments)
    if (data && data.length > 0) {
      setItems(prev => {
        // Add new items, avoiding duplicates (in case real-time already added them)
        const existingIds = new Set(prev.map(item => item.id));
        const newItemsToAdd = data.filter(item => !existingIds.has(item.id));
        return [...newItemsToAdd, ...prev];
      });
    }

    // Track these as new items for flash animation
    const ids = data?.map(d => d.id) || [];
    setNewItemIds(ids);
    setTimeout(() => setNewItemIds([]), 500);

    // Track item creations
    contents.forEach(() => analytics.itemCreated(listId));

    // Update positions of existing siblings in database
    const updates = siblings.map(sibling =>
      supabase
        .from('items')
        .update({ position: sibling.position + shiftAmount })
        .eq('id', sibling.id)
    );
    await Promise.all(updates);

    return data || [];
  };

  // Add item at the TOP of the list (position 0)
  const addItem = async (content: string, parentId?: string | null) => {
    const targetParentId = parentId || null;

    // Get siblings and shift their positions up by 1
    const siblings = items.filter(i => i.parent_id === targetParentId && !i.completed);

    // Create temporary ID for optimistic update
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Optimistically add new item AND shift existing items - all in one state update
    const optimisticItem: Item = {
      id: tempId,
      list_id: listId,
      content,
      completed: false,
      parent_id: targetParentId,
      position: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setItems(prev => [
      optimisticItem,
      ...prev.map(item => {
        if (item.parent_id === targetParentId && !item.completed) {
          return { ...item, position: item.position + 1 };
        }
        return item;
      })
    ]);

    // Track this as new item for flash animation (using temp ID)
    setNewItemId(tempId);
    setTimeout(() => setNewItemId(null), 500);

    // Track item creation
    analytics.itemCreated(listId);

    // Register pending insert so realtime can correlate temp ID with real ID
    const pendingKey = `${content}|${targetParentId}|0`;
    pendingInsertsRef.current.set(pendingKey, tempId);

    // Insert new item in database (don't await - fire and forget for speed)
    supabase
      .from('items')
      .insert({
        list_id: listId,
        content,
        parent_id: targetParentId,
        position: 0,
      })
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to add item:', error);
          // Clean up pending tracking
          pendingInsertsRef.current.delete(pendingKey);
          // Rollback optimistic update on error
          setItems(prev => prev.filter(item => item.id !== tempId));
          return;
        }

        // Clean up pending tracking (realtime may have already handled this)
        pendingInsertsRef.current.delete(pendingKey);

        // Ensure temp item is replaced with real item
        // (realtime usually handles this, but this is a safety net)
        setItems(prev => {
          const hasTempItem = prev.some(item => item.id === tempId);
          const hasRealItem = prev.some(item => item.id === data.id);

          if (hasTempItem && !hasRealItem) {
            // Realtime hasn't fired yet - replace temp with real
            return prev.map(item => item.id === tempId ? data : item);
          } else if (hasTempItem && hasRealItem) {
            // Both exist (race condition) - remove temp
            return prev.filter(item => item.id !== tempId);
          }
          // Realtime already handled it, no change needed
          return prev;
        });
      });

    // Update positions of existing siblings in database (fire and forget)
    siblings.forEach(sibling => {
      supabase
        .from('items')
        .update({ position: sibling.position + 1 })
        .eq('id', sibling.id);
    });

    return optimisticItem;
  };

  // Insert item with specific data (for manipulation scenarios)
  const insertItem = async (itemData: { content: string; parent_id: string | null; position: number; completed?: boolean }) => {
    const { data, error } = await supabase
      .from('items')
      .insert({
        list_id: listId,
        content: itemData.content,
        parent_id: itemData.parent_id,
        position: itemData.position,
        completed: itemData.completed ?? false,
      })
      .select()
      .single();

    if (error) throw error;

    // Optimistically add to state
    if (data) {
      setItems(prev => {
        const exists = prev.some(item => item.id === data.id);
        if (exists) return prev;
        return [...prev, data];
      });
    }

    return data;
  };

  // Update item
  const updateItem = async (itemId: string, updates: Partial<Item>) => {
    // Optimistic update
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, ...updates } : item
    ));

    const { error } = await supabase
      .from('items')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', itemId);

    if (error) throw error;
  };

  // Toggle item completion (with optimistic update and animation delay)
  const toggleItem = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const newCompleted = !item.completed;

    // Optimistic update - show checkbox state immediately
    setItems(prev => prev.map(i =>
      i.id === itemId ? { ...i, completed: newCompleted } : i
    ));

    // If completing (not uncompleting), add to completing set to delay the move
    if (newCompleted) {
      setCompletingItemIds(prev => new Set(prev).add(itemId));

      // Track task completion
      analytics.taskCompleted(listId);

      // Clear any existing debounce timer
      if (completionDebounceRef.current) {
        clearTimeout(completionDebounceRef.current);
      }

      // Debounce: wait 2 seconds of inactivity before moving ALL completed items to bottom
      completionDebounceRef.current = setTimeout(() => {
        setCompletingItemIds(new Set()); // Clear all at once
        completionDebounceRef.current = null;
      }, 2000);
    }

    // Sync to database
    await updateItem(itemId, { completed: newCompleted });
  };

  // Delete item
  const deleteItem = async (itemId: string) => {
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', itemId);

    if (error) throw error;
  };

  // Reorder items (with optimistic update)
  const reorderItems = async (activeId: string, overId: string) => {
    const activeItem = items.find(i => i.id === activeId);
    const overItem = items.find(i => i.id === overId);
    if (!activeItem || !overItem) return;

    // For now, only handle reordering within the same parent level
    // Get all siblings at the same level as active item
    const siblings = items
      .filter(i => i.parent_id === activeItem.parent_id)
      .sort((a, b) => a.position - b.position);

    const oldIndex = siblings.findIndex(i => i.id === activeId);
    const newIndex = siblings.findIndex(i => i.id === overId);

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    // Optimistic update: reorder the array and reassign positions
    setItems(prev => {
      const updated = prev.map(item => ({ ...item }));
      const levelSiblings = updated
        .filter(i => i.parent_id === activeItem.parent_id)
        .sort((a, b) => a.position - b.position);

      // Remove from old position and insert at new position
      const [movedItem] = levelSiblings.splice(oldIndex, 1);
      levelSiblings.splice(newIndex, 0, movedItem);

      // Reassign positions sequentially
      levelSiblings.forEach((sibling, index) => {
        const itemInUpdated = updated.find(i => i.id === sibling.id);
        if (itemInUpdated) itemInUpdated.position = index;
      });

      return updated;
    });

    // Sync to database
    const reorderedSiblings = [...siblings];
    const [movedItem] = reorderedSiblings.splice(oldIndex, 1);
    reorderedSiblings.splice(newIndex, 0, movedItem);

    const updates = reorderedSiblings.map((sibling, index) =>
      updateItem(sibling.id, { position: index })
    );

    await Promise.all(updates);
  };

  // Move item to a new group (header) - optimistic
  const moveToGroup = async (itemId: string, headerId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    // Find the maximum position among the header's current children
    const headerChildren = items.filter(i => i.parent_id === headerId);
    const newPosition = headerChildren.length;

    // Optimistic update
    setItems(prev => prev.map(i =>
      i.id === itemId
        ? { ...i, parent_id: headerId, position: newPosition }
        : i
    ));

    // Sync to database
    await updateItem(itemId, { parent_id: headerId, position: newPosition });
  };

  // Move item out of a group to root level - optimistic
  const moveToRoot = async (itemId: string, targetPosition?: number) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    // Find root-level items (no parent) to determine position
    const rootItems = items
      .filter(i => i.parent_id === null && !i.completed)
      .sort((a, b) => a.position - b.position);
    const newPosition = targetPosition ?? rootItems.length;

    // Optimistic update - shift items at and after target position
    setItems(prev => prev.map(i => {
      if (i.id === itemId) {
        return { ...i, parent_id: null, position: newPosition };
      }
      // Shift root-level incomplete items at or after target position
      if (i.parent_id === null && !i.completed && i.position >= newPosition) {
        return { ...i, position: i.position + 1 };
      }
      return i;
    }));

    // Sync to database - shift existing items first
    const itemsToShift = rootItems.filter(i => i.position >= newPosition);
    const shiftUpdates = itemsToShift.map(i =>
      updateItem(i.id, { position: i.position + 1 })
    );
    await Promise.all(shiftUpdates);

    // Then update the moved item
    await updateItem(itemId, { parent_id: null, position: newPosition });
  };

  // Indent item (make it a child of previous sibling)
  const indentItem = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const siblings = items
      .filter(i => i.parent_id === item.parent_id)
      .sort((a, b) => a.position - b.position);

    const itemIndex = siblings.findIndex(i => i.id === itemId);
    if (itemIndex <= 0) return; // Can't indent first item

    const newParent = siblings[itemIndex - 1];
    const newSiblings = items.filter(i => i.parent_id === newParent.id);
    const newPosition = newSiblings.length;

    await updateItem(itemId, { parent_id: newParent.id, position: newPosition });
  };

  // Outdent item (move to parent's level)
  const outdentItem = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item || !item.parent_id) return; // Can't outdent root items

    const parent = items.find(i => i.id === item.parent_id);
    if (!parent) return;

    const newSiblings = items
      .filter(i => i.parent_id === parent.parent_id)
      .sort((a, b) => a.position - b.position);

    const parentIndex = newSiblings.findIndex(i => i.id === parent.id);
    const newPosition = parentIndex + 1;

    // Shift siblings after new position
    const updates: Promise<void>[] = [];
    newSiblings.forEach((sibling, index) => {
      if (index >= newPosition) {
        updates.push(updateItem(sibling.id, { position: index + 1 }));
      }
    });

    updates.push(updateItem(itemId, { parent_id: parent.parent_id, position: newPosition }));

    await Promise.all(updates);
  };

  // Update list theme
  const updateTheme = async (theme: ThemeColors | null) => {
    const { error } = await supabase
      .from('lists')
      .update({ theme, updated_at: new Date().toISOString() })
      .eq('id', listId);

    if (error) throw error;
  };

  // Complete all items
  const completeAll = async () => {
    const incompleteItems = items.filter(item => !item.completed);
    if (incompleteItems.length === 0) return;

    // Optimistic update
    setItems(prev => prev.map(item => ({ ...item, completed: true })));

    // Update in database
    const { error } = await supabase
      .from('items')
      .update({ completed: true, updated_at: new Date().toISOString() })
      .eq('list_id', listId)
      .eq('completed', false);

    if (error) throw error;
  };

  // Uncomplete all items (reset)
  const uncompleteAll = async () => {
    const completedItems = items.filter(item => item.completed);
    if (completedItems.length === 0) return;

    // Optimistic update
    setItems(prev => prev.map(item => ({ ...item, completed: false })));

    // Update in database
    const { error } = await supabase
      .from('items')
      .update({ completed: false, updated_at: new Date().toISOString() })
      .eq('list_id', listId)
      .eq('completed', true);

    if (error) throw error;
  };

  // Clear (delete) all completed items
  const clearCompleted = async () => {
    const completedItems = items.filter(item => item.completed);
    if (completedItems.length === 0) return;

    // Optimistic update - remove completed items
    setItems(prev => prev.filter(item => !item.completed));

    // Delete from database
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('list_id', listId)
      .eq('completed', true);

    if (error) throw error;
  };

  // Sort items alphabetically
  // sortAll=false: Sort items within each category (and root items among themselves)
  // sortAll=true: Also sort categories/root items, then sort within each category
  const sortItems = async (sortAll: boolean) => {
    const incompleteItems = items.filter(item => !item.completed);
    if (incompleteItems.length === 0) return;

    // Group items by parent_id
    const groups = new Map<string | null, Item[]>();
    incompleteItems.forEach(item => {
      const key = item.parent_id;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    });

    // Build the new positions
    const updates: { id: string; position: number }[] = [];

    // Get root-level items (parent_id is null)
    const rootItems = groups.get(null) || [];

    if (sortAll) {
      // Sort root items alphabetically
      rootItems.sort((a, b) => a.content.toLowerCase().localeCompare(b.content.toLowerCase()));
    }

    // Assign positions to root items
    rootItems.forEach((item, index) => {
      updates.push({ id: item.id, position: index });
    });

    // Sort items within each category
    groups.forEach((groupItems, parentId) => {
      if (parentId === null) return; // Already handled root items

      // Sort alphabetically within category
      groupItems.sort((a, b) => a.content.toLowerCase().localeCompare(b.content.toLowerCase()));

      // Assign positions
      groupItems.forEach((item, index) => {
        updates.push({ id: item.id, position: index });
      });
    });

    // Optimistic update
    setItems(prev => {
      const updatesMap = new Map(updates.map(u => [u.id, u.position]));
      return prev.map(item => {
        const newPosition = updatesMap.get(item.id);
        if (newPosition !== undefined) {
          return { ...item, position: newPosition };
        }
        return item;
      });
    });

    // Update database
    const dbUpdates = updates.map(({ id, position }) =>
      supabase
        .from('items')
        .update({ position, updated_at: new Date().toISOString() })
        .eq('id', id)
    );

    await Promise.all(dbUpdates);
  };

  // Ungroup all - remove categories and flatten all items to root level
  const ungroupAll = async () => {
    const categories = items.filter(item => item.content.startsWith('#'));
    const nonCategories = items.filter(item => !item.content.startsWith('#'));

    if (categories.length === 0 && !items.some(item => item.parent_id)) {
      // No categories and no nested items - nothing to do
      return;
    }

    // Sort non-category items: incomplete first by position, then completed
    const incompleteItems = nonCategories.filter(item => !item.completed);
    const completedItems = nonCategories.filter(item => item.completed);

    // Assign new positions - all items become root level
    const updates: { id: string; position: number; parent_id: null }[] = [];
    incompleteItems.forEach((item, index) => {
      updates.push({ id: item.id, position: index, parent_id: null });
    });
    completedItems.forEach((item, index) => {
      updates.push({ id: item.id, position: incompleteItems.length + index, parent_id: null });
    });

    // Optimistic update - remove categories and flatten
    setItems(nonCategories.map(item => {
      const update = updates.find(u => u.id === item.id);
      return update ? { ...item, position: update.position, parent_id: null } : item;
    }));

    // Delete categories from database
    if (categories.length > 0) {
      const categoryIds = categories.map(c => c.id);
      await supabase
        .from('items')
        .delete()
        .in('id', categoryIds);
    }

    // Update remaining items - set parent_id to null and new positions
    const dbUpdates = updates.map(({ id, position }) =>
      supabase
        .from('items')
        .update({ parent_id: null, position, updated_at: new Date().toISOString() })
        .eq('id', id)
    );

    await Promise.all(dbUpdates);
  };

  // Update large mode
  const updateLargeMode = async (enabled: boolean) => {
    // Optimistic update
    setList(prev => prev ? { ...prev, large_mode: enabled } : prev);

    const { error } = await supabase
      .from('lists')
      .update({ large_mode: enabled, updated_at: new Date().toISOString() })
      .eq('id', listId);

    if (error) throw error;
  };

  // Nuke - delete ALL items
  const nukeItems = async () => {
    if (items.length === 0) return;

    // Optimistic update - remove all items
    setItems([]);

    // Delete from database
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('list_id', listId);

    if (error) throw error;
  };

  // Toggle emojify mode
  const toggleEmojifyMode = async () => {
    const newValue = !list?.emojify_mode;

    // Optimistic update
    setList(prev => prev ? { ...prev, emojify_mode: newValue } : prev);

    const { error } = await supabase
      .from('lists')
      .update({ emojify_mode: newValue, updated_at: new Date().toISOString() })
      .eq('id', listId);

    if (error) throw error;
  };

  return {
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
    insertItem,
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
  };
}
