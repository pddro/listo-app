'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { List, Item, ItemWithChildren } from '@/types';
import { ThemeColors } from '@/lib/gemini';

export function useList(listId: string) {
  const [list, setList] = useState<List | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track items that are animating (completing) - they stay in place during animation
  const [completingItemIds, setCompletingItemIds] = useState<Set<string>>(new Set());

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
            setList(payload.new as List);
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
            setItems(prev => [...prev, payload.new as Item]);
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
    return data;
  };

  // Update list title
  const updateTitle = async (title: string) => {
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
    const { data, error } = await supabase
      .from('items')
      .insert(newItems)
      .select();

    if (error) throw error;

    // Track these as new items for flash animation
    const ids = data?.map(d => d.id) || [];
    setNewItemIds(ids);
    setTimeout(() => setNewItemIds([]), 500);

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

    // Optimistically shift existing items
    setItems(prev => prev.map(item => {
      if (item.parent_id === targetParentId && !item.completed) {
        return { ...item, position: item.position + 1 };
      }
      return item;
    }));

    // Insert new item at position 0
    const { data, error } = await supabase
      .from('items')
      .insert({
        list_id: listId,
        content,
        parent_id: targetParentId,
        position: 0,
      })
      .select()
      .single();

    if (error) throw error;

    // Track this as new item for flash animation
    setNewItemId(data.id);
    setTimeout(() => setNewItemId(null), 500);

    // Update positions of existing siblings in database
    const updates = siblings.map(sibling =>
      supabase
        .from('items')
        .update({ position: sibling.position + 1 })
        .eq('id', sibling.id)
    );
    await Promise.all(updates);

    return data;
  };

  // Update item
  const updateItem = async (itemId: string, updates: Partial<Item>) => {
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

      // After animation delay, remove from completing set so it moves to bottom
      setTimeout(() => {
        setCompletingItemIds(prev => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
      }, 800); // 800ms delay for sparkle + fade animation
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
  };
}
