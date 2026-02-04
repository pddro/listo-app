'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { List, Item, ItemWithChildren } from '@/types';
import { ThemeColors } from '@/lib/gemini';
import { analytics } from '@/lib/analytics';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface UseListOptions {
  initialList?: List | null;
  initialItems?: Item[];
  onListChange?: (list: List) => void;
  onItemsChange?: (items: Item[]) => void;
}

// Broadcast event types for instant peer-to-peer sync
type BroadcastEvent =
  | { type: 'toggle'; itemId: string; completed: boolean }
  | { type: 'update'; itemId: string; changes: Partial<Item> }
  | { type: 'delete'; itemId: string }
  | { type: 'add'; item: Item }
  | { type: 'reorder'; items: Array<{ id: string; position: number }> };

export function useList(listId: string, options: UseListOptions = {}) {
  const { initialList, initialItems, onListChange, onItemsChange } = options;

  // If initial data is provided, start with it (no loading state)
  const hasInitialData = initialList !== undefined || (initialItems && initialItems.length > 0);

  const [list, setList] = useState<List | null>(initialList ?? null);
  const [items, setItems] = useState<Item[]>(initialItems ?? []);
  const [loading, setLoading] = useState(!hasInitialData);
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
      // Only show loading if we don't have initial data
      if (!hasInitialData) {
        setLoading(true);
      }
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
      if (listData && onListChange) {
        onListChange(listData);
      }

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
      if (itemsData && onItemsChange) {
        onItemsChange(itemsData);
      }
      setLoading(false);
    }

    fetchData();
  }, [listId, hasInitialData, onListChange, onItemsChange]);

  // Track broadcast channel for sending events
  const broadcastChannelRef = useRef<RealtimeChannel | null>(null);

  // Helper to broadcast an event to other clients
  const broadcast = useCallback((event: BroadcastEvent) => {
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'sync',
        payload: event,
      });
    }
  }, []);

  // Real-time subscriptions (postgres_changes + broadcast)
  useEffect(() => {
    const channel = supabase
      .channel(`list-${listId}`)
      // Broadcast channel for instant peer-to-peer sync
      .on('broadcast', { event: 'sync' }, ({ payload }) => {
        const event = payload as BroadcastEvent;

        switch (event.type) {
          case 'toggle':
            setItems(prev => prev.map(item =>
              item.id === event.itemId ? { ...item, completed: event.completed } : item
            ));
            break;
          case 'update':
            setItems(prev => prev.map(item =>
              item.id === event.itemId ? { ...item, ...event.changes } : item
            ));
            break;
          case 'delete':
            setItems(prev => prev.filter(item => item.id !== event.itemId));
            break;
          case 'add':
            setItems(prev => {
              const exists = prev.some(item => item.id === event.item.id);
              if (exists) return prev;
              return [event.item, ...prev];
            });
            break;
          case 'reorder':
            setItems(prev => {
              const positionMap = new Map(event.items.map(i => [i.id, i.position]));
              return prev.map(item => {
                const newPos = positionMap.get(item.id);
                return newPos !== undefined ? { ...item, position: newPos } : item;
              });
            });
            break;
        }
      })
      // Database changes for persistence confirmation and new client sync
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lists', filter: `id=eq.${listId}` },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
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
              // From another client - add if not already exists (broadcast may have added it)
              setItems(prev => {
                const exists = prev.some(item => item.id === newItem.id);
                if (exists) return prev;
                return [...prev, newItem];
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            // Only update if the item exists and has changed
            setItems(prev => prev.map(item =>
              item.id === (payload.new as Item).id ? { ...item, ...(payload.new as Item) } : item
            ));
          } else if (payload.eventType === 'DELETE') {
            setItems(prev => prev.filter(item => item.id !== (payload.old as Item).id));
          }
        }
      )
      .subscribe();

    broadcastChannelRef.current = channel;

    return () => {
      broadcastChannelRef.current = null;
      supabase.removeChannel(channel);
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
    analytics.listCreated('manual');
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

  // Add multiple items at once (bulk add) - uses atomic stored procedure
  const addItems = async (contents: string[], parentId?: string | null) => {
    if (contents.length === 0) return [];

    const targetParentId = parentId || null;
    const shiftAmount = contents.length;

    // Optimistically shift existing items and add placeholders
    const tempItems: Item[] = contents.map((content, index) => ({
      id: `temp_batch_${Date.now()}_${index}`,
      list_id: listId,
      content,
      completed: false,
      parent_id: targetParentId,
      position: index,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    setItems(prev => [
      ...tempItems,
      ...prev.map(item => {
        if (item.parent_id === targetParentId && !item.completed) {
          return { ...item, position: item.position + shiftAmount };
        }
        return item;
      })
    ]);

    // Use atomic stored procedure - shifts siblings AND inserts all items in one transaction
    const { data, error } = await supabase.rpc('add_items_batch_atomic', {
      p_list_id: listId,
      p_contents: contents,
      p_parent_id: targetParentId,
    });

    if (error) {
      console.error('[addItems] Insert error:', error);
      // Rollback optimistic update
      setItems(prev => prev.filter(item => !item.id.startsWith('temp_batch_')));
      throw error;
    }

    // Replace temp items with real items
    if (data && data.length > 0) {
      setItems(prev => {
        // Remove temp items
        const withoutTemp = prev.filter(item => !item.id.startsWith('temp_batch_'));
        // Add real items, avoiding duplicates
        const existingIds = new Set(withoutTemp.map(item => item.id));
        const newItemsToAdd = (data as Item[]).filter(item => !existingIds.has(item.id));
        return [...newItemsToAdd, ...withoutTemp];
      });

      // Broadcast to other clients
      (data as Item[]).forEach(item => broadcast({ type: 'add', item }));
    }

    // Track these as new items for flash animation
    const ids = (data as Item[])?.map(d => d.id) || [];
    setNewItemIds(ids);
    setTimeout(() => setNewItemIds([]), 500);

    return (data as Item[]) || [];
  };

  // Add item at the TOP of the list (position 0) - uses atomic stored procedure
  const addItem = async (content: string, parentId?: string | null) => {
    const targetParentId = parentId || null;

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

    // Register pending insert so realtime can correlate temp ID with real ID
    const pendingKey = `${content}|${targetParentId}|0`;
    pendingInsertsRef.current.set(pendingKey, tempId);

    // Use atomic stored procedure - shifts siblings AND inserts in one transaction
    supabase
      .rpc('add_item_atomic', {
        p_list_id: listId,
        p_content: content,
        p_parent_id: targetParentId,
      })
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to add item:', error);
          pendingInsertsRef.current.delete(pendingKey);
          // Rollback optimistic update on error
          setItems(prev => prev.filter(item => item.id !== tempId));
          return;
        }

        pendingInsertsRef.current.delete(pendingKey);

        // Replace temp item with real item
        if (data) {
          const realItem = data as Item;
          setItems(prev => {
            const hasTempItem = prev.some(item => item.id === tempId);
            const hasRealItem = prev.some(item => item.id === realItem.id);

            if (hasTempItem && !hasRealItem) {
              return prev.map(item => item.id === tempId ? realItem : item);
            } else if (hasTempItem && hasRealItem) {
              return prev.filter(item => item.id !== tempId);
            }
            return prev;
          });

          // Broadcast to other clients for instant sync
          broadcast({ type: 'add', item: realItem });
        }
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

  // Update item with broadcast for instant sync
  const updateItem = async (itemId: string, updates: Partial<Item>) => {
    // Optimistic update
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, ...updates } : item
    ));

    // Broadcast immediately for instant sync to other clients
    broadcast({ type: 'update', itemId, changes: updates });

    const { error } = await supabase
      .from('items')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', itemId);

    if (error) throw error;
  };

  // Toggle item completion (with optimistic update, broadcast, and animation delay)
  const toggleItem = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const newCompleted = !item.completed;

    // Optimistic update - show checkbox state immediately
    setItems(prev => prev.map(i =>
      i.id === itemId ? { ...i, completed: newCompleted } : i
    ));

    // Broadcast immediately for instant sync to other clients
    broadcast({ type: 'toggle', itemId, completed: newCompleted });

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

    // Sync to database (updateItem also broadcasts, but toggle is more specific)
    const { error } = await supabase
      .from('items')
      .update({ completed: newCompleted, updated_at: new Date().toISOString() })
      .eq('id', itemId);

    if (error) throw error;
  };

  // Delete item with broadcast and atomic gap closing
  const deleteItem = async (itemId: string) => {
    // Optimistic update
    setItems(prev => prev.filter(item => item.id !== itemId));

    // Broadcast immediately for instant sync
    broadcast({ type: 'delete', itemId });

    // Use atomic stored procedure to delete and close gap
    const { error } = await supabase.rpc('delete_item_atomic', {
      p_item_id: itemId,
    });

    if (error) throw error;
  };

  // Reorder items with atomic stored procedure and broadcast
  const reorderItems = async (activeId: string, overId: string) => {
    const activeItem = items.find(i => i.id === activeId);
    const overItem = items.find(i => i.id === overId);
    if (!activeItem || !overItem) return;

    // Get all siblings at the same level as active item
    const siblings = items
      .filter(i => i.parent_id === activeItem.parent_id)
      .sort((a, b) => a.position - b.position);

    const oldIndex = siblings.findIndex(i => i.id === activeId);
    const newIndex = siblings.findIndex(i => i.id === overId);

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    // Calculate new positions for optimistic update and broadcast
    const reorderedSiblings = [...siblings];
    const [movedItem] = reorderedSiblings.splice(oldIndex, 1);
    reorderedSiblings.splice(newIndex, 0, movedItem);

    const positionUpdates = reorderedSiblings.map((sibling, index) => ({
      id: sibling.id,
      position: index,
    }));

    // Optimistic update
    setItems(prev => {
      const positionMap = new Map(positionUpdates.map(u => [u.id, u.position]));
      return prev.map(item => {
        const newPos = positionMap.get(item.id);
        return newPos !== undefined ? { ...item, position: newPos } : item;
      });
    });

    // Broadcast immediately for instant sync
    broadcast({ type: 'reorder', items: positionUpdates });

    // Use atomic stored procedure
    const { error } = await supabase.rpc('reorder_item_atomic', {
      p_item_id: activeId,
      p_new_position: newIndex,
    });

    if (error) throw error;
  };

  // Move item to a new group (header) - uses atomic stored procedure
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

    // Broadcast for instant sync
    broadcast({ type: 'update', itemId, changes: { parent_id: headerId, position: newPosition } });

    // Use atomic stored procedure
    const { error } = await supabase.rpc('move_item_to_parent_atomic', {
      p_item_id: itemId,
      p_new_parent_id: headerId,
      p_new_position: null, // null = append to end
    });

    if (error) throw error;
  };

  // Move item out of a group to root level - uses atomic stored procedure
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

    // Broadcast for instant sync
    broadcast({ type: 'update', itemId, changes: { parent_id: null, position: newPosition } });

    // Use atomic stored procedure
    const { error } = await supabase.rpc('move_item_to_parent_atomic', {
      p_item_id: itemId,
      p_new_parent_id: null,
      p_new_position: newPosition,
    });

    if (error) throw error;
  };

  // Indent item (make it a child of previous sibling) - uses atomic stored procedure
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

    // Optimistic update
    setItems(prev => prev.map(i =>
      i.id === itemId ? { ...i, parent_id: newParent.id, position: newPosition } : i
    ));

    // Broadcast for instant sync
    broadcast({ type: 'update', itemId, changes: { parent_id: newParent.id, position: newPosition } });

    // Use atomic stored procedure
    const { error } = await supabase.rpc('move_item_to_parent_atomic', {
      p_item_id: itemId,
      p_new_parent_id: newParent.id,
      p_new_position: null, // append to end
    });

    if (error) throw error;
  };

  // Outdent item (move to parent's level) - uses atomic stored procedure
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

    // Optimistic update - shift siblings and move item
    setItems(prev => prev.map(i => {
      if (i.id === itemId) {
        return { ...i, parent_id: parent.parent_id, position: newPosition };
      }
      // Shift items at or after new position
      if (i.parent_id === parent.parent_id && i.position >= newPosition) {
        return { ...i, position: i.position + 1 };
      }
      return i;
    }));

    // Broadcast for instant sync
    broadcast({ type: 'update', itemId, changes: { parent_id: parent.parent_id, position: newPosition } });

    // Use atomic stored procedure
    const { error } = await supabase.rpc('move_item_to_parent_atomic', {
      p_item_id: itemId,
      p_new_parent_id: parent.parent_id,
      p_new_position: newPosition,
    });

    if (error) throw error;
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

  // Sort items alphabetically - uses atomic bulk update
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

    // Broadcast for instant sync
    broadcast({ type: 'reorder', items: updates });

    // Use atomic bulk update
    const { error } = await supabase.rpc('bulk_update_positions', {
      p_updates: JSON.stringify(updates),
    });

    if (error) throw error;
  };

  // Ungroup all - uses atomic stored procedure
  const ungroupAll = async () => {
    const categories = items.filter(item => item.content.startsWith('#'));
    const nonCategories = items.filter(item => !item.content.startsWith('#'));

    if (categories.length === 0 && !items.some(item => item.parent_id)) {
      // No categories and no nested items - nothing to do
      return;
    }

    // Optimistic update - remove categories and flatten
    const incompleteItems = nonCategories.filter(item => !item.completed);
    const completedItems = nonCategories.filter(item => item.completed);

    setItems([
      ...incompleteItems.map((item, index) => ({ ...item, position: index, parent_id: null })),
      ...completedItems.map((item, index) => ({ ...item, position: incompleteItems.length + index, parent_id: null })),
    ]);

    // Use atomic stored procedure
    const { error } = await supabase.rpc('ungroup_all_atomic', {
      p_list_id: listId,
    });

    if (error) throw error;
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
