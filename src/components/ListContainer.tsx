'use client';

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ItemWithChildren } from '@/types';
import { ListItem } from './ListItem';
import { NewItemInput } from './NewItemInput';
import { useAI, ManipulatedItem } from '@/lib/hooks/useAI';

interface ListContainerProps {
  items: ItemWithChildren[];
  newItemId: string | null;
  newItemIds: string[];
  completingItemIds: Set<string>;
  onToggle: (id: string) => Promise<void>;
  onUpdate: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onIndent: (id: string) => Promise<void>;
  onOutdent: (id: string) => Promise<void>;
  onReorder: (activeId: string, overId: string) => Promise<void>;
  onMoveToGroup: (itemId: string, headerId: string) => Promise<void>;
  onMoveToRoot: (itemId: string, targetPosition?: number) => Promise<void>;
  onAddItem: (content: string, parentId?: string | null) => Promise<void>;
  onAddItems: (contents: string[], parentId?: string | null) => Promise<unknown[]>;
  onManipulateList: (instruction: string) => Promise<void>;
  onCategorizedGenerate: (items: ManipulatedItem[]) => Promise<void>;
}

// Flattened item with depth for rendering
interface FlattenedItem {
  item: ItemWithChildren;
  depth: number;
  parentHeaderId: string | null; // ID of the header this item belongs to (if any)
}

// Flatten items for rendering (items + depth + parent header tracking)
function flattenItemsForRender(
  items: ItemWithChildren[],
  depth = 0,
  parentHeaderId: string | null = null
): FlattenedItem[] {
  const result: FlattenedItem[] = [];
  items.forEach(item => {
    const isHeader = item.content.startsWith('#');
    // If this is a header, it's its own "parent" for highlight purposes
    const currentHeaderId = isHeader ? item.id : parentHeaderId;

    result.push({ item, depth, parentHeaderId: currentHeaderId });

    if (item.children.length > 0) {
      // Children inherit the header ID
      result.push(...flattenItemsForRender(item.children, depth + 1, isHeader ? item.id : parentHeaderId));
    }
  });
  return result;
}

// Find an item by ID in the tree
function findItemById(items: ItemWithChildren[], id: string): ItemWithChildren | null {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children.length > 0) {
      const found = findItemById(item.children, id);
      if (found) return found;
    }
  }
  return null;
}

// Find the parent header ID of an item (if it has one)
function findParentHeaderId(items: ItemWithChildren[], itemId: string): string | null {
  for (const item of items) {
    // Check if this item is a header and has the target as a child
    if (item.content.startsWith('#')) {
      for (const child of item.children) {
        if (child.id === itemId) {
          return item.id;
        }
      }
    }
    // Recurse into children
    if (item.children.length > 0) {
      const found = findParentHeaderId(item.children, itemId);
      if (found) return found;
    }
  }
  return null;
}

// Get the header ID that should be highlighted when hovering over an item
function getTargetHeaderId(items: ItemWithChildren[], overId: string): string | null {
  const overItem = findItemById(items, overId);
  if (!overItem) return null;

  // If hovering over a header, highlight that header
  if (overItem.content.startsWith('#')) {
    return overItem.id;
  }

  // If hovering over a child, find its parent header
  return findParentHeaderId(items, overId);
}

export function ListContainer({
  items,
  newItemId,
  newItemIds,
  completingItemIds,
  onToggle,
  onUpdate,
  onDelete,
  onIndent,
  onOutdent,
  onReorder,
  onMoveToGroup,
  onMoveToRoot,
  onAddItem,
  onAddItems,
  onManipulateList,
  onCategorizedGenerate,
}: ListContainerProps) {
  const { generateItems } = useAI();
  const [highlightedCategoryId, setHighlightedCategoryId] = useState<string | null>(null);
  const [isDraggingRegularItem, setIsDraggingRegularItem] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = event.active.id as string;
    const activeItem = findItemById(items, activeId);
    // Only track highlighting if dragging a regular item (not a header)
    setIsDraggingRegularItem(activeItem ? !activeItem.content.startsWith('#') : false);
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (!isDraggingRegularItem) {
      setHighlightedCategoryId(null);
      return;
    }

    const { over } = event;
    if (over) {
      const targetHeaderId = getTargetHeaderId(items, over.id as string);
      setHighlightedCategoryId(targetHeaderId);
    } else {
      setHighlightedCategoryId(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    // Clear highlight state
    setHighlightedCategoryId(null);
    setIsDraggingRegularItem(false);

    if (over && active.id !== over.id) {
      const overId = over.id as string;
      const activeId = active.id as string;

      // Check if we're dropping onto a header or its children
      const activeItem = findItemById(items, activeId);
      const targetHeaderId = getTargetHeaderId(items, overId);

      if (!activeItem || activeItem.content.startsWith('#')) {
        // Dragging a header - just reorder
        await onReorder(activeId, overId);
      } else if (targetHeaderId) {
        // Dropping a regular item onto a category - move it to that group
        await onMoveToGroup(activeId, targetHeaderId);
      } else if (activeItem.parent_id) {
        // Dropping onto root level, and the item is currently in a category
        // Move it out of the category to root level
        const overItem = findItemById(items, overId);
        const targetPosition = overItem?.position;
        await onMoveToRoot(activeId, targetPosition);
      } else {
        // Regular reorder at root level
        await onReorder(activeId, overId);
      }
    }
  };

  const handleDragCancel = () => {
    setHighlightedCategoryId(null);
    setIsDraggingRegularItem(false);
  };

  // Flatten the tree for rendering - all items become siblings with depth
  const flattenedItems = flattenItemsForRender(items);
  const itemIds = flattenedItems.map(f => f.item.id);

  return (
    <div className="space-y-1" style={{ paddingBottom: '80px' }}>
      {/* New item input at TOP */}
      <NewItemInput
        onAdd={(content) => onAddItem(content)}
        onBulkAdd={(contents) => onAddItems(contents)}
        onAIGenerate={generateItems}
        onAICategorizedGenerate={onCategorizedGenerate}
        onAIManipulate={onManipulateList}
        autoFocus
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          {flattenedItems.map(({ item, depth, parentHeaderId }) => (
            <ListItem
              key={item.id}
              item={item}
              depth={depth}
              isNew={item.id === newItemId || newItemIds.includes(item.id)}
              isCompleting={completingItemIds.has(item.id)}
              isDropTarget={parentHeaderId === highlightedCategoryId && highlightedCategoryId !== null}
              onToggle={onToggle}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onIndent={onIndent}
              onOutdent={onOutdent}
              onAddItem={onAddItem}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
