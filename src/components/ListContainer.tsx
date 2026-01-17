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
  largeMode?: boolean;
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
}

// Flattened item with depth for rendering
interface FlattenedItem {
  item: ItemWithChildren;
  depth: number;
  parentHeaderId: string | null; // ID of the header this item belongs to (if any)
}

// Group structure for rendering categories with their children
interface ItemGroup {
  headerId: string | null; // null for root-level items without a header
  items: FlattenedItem[];
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

// Group flattened items by their parent header for visual grouping
function groupItemsByCategory(flattenedItems: FlattenedItem[]): ItemGroup[] {
  const groups: ItemGroup[] = [];
  let currentGroup: ItemGroup | null = null;

  flattenedItems.forEach(flatItem => {
    const isHeader = flatItem.item.content.startsWith('#');

    if (isHeader) {
      // Start a new group for this header
      currentGroup = { headerId: flatItem.item.id, items: [flatItem] };
      groups.push(currentGroup);
    } else if (flatItem.parentHeaderId) {
      // This item belongs to a header
      // Find or create the group for this header
      const existingGroup = groups.find(g => g.headerId === flatItem.parentHeaderId);
      if (existingGroup) {
        existingGroup.items.push(flatItem);
      } else {
        // Header group should exist, but just in case
        currentGroup = { headerId: flatItem.parentHeaderId, items: [flatItem] };
        groups.push(currentGroup);
      }
    } else {
      // Root-level item without a header
      // Each root item is its own "group" (no container outline needed)
      groups.push({ headerId: null, items: [flatItem] });
    }
  });

  return groups;
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
  largeMode,
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

  // Group items by category for visual grouping with outline
  const itemGroups = groupItemsByCategory(flattenedItems);

  return (
    <div className="space-y-1" style={{ paddingBottom: '80px' }}>
      {/* New item input at TOP */}
      <NewItemInput
        onAdd={(content) => onAddItem(content)}
        onBulkAdd={(contents) => onAddItems(contents)}
        onAIGenerate={generateItems}
        onAICategorizedGenerate={onCategorizedGenerate}
        onAIManipulate={onManipulateList}
        onThemeGenerate={onThemeGenerate}
        onThemeReset={onThemeReset}
        onCompleteAll={onCompleteAll}
        onUncompleteAll={onUncompleteAll}
        onSetLargeMode={onSetLargeMode}
        onClearCompleted={onClearCompleted}
        onSort={onSort}
        onUngroupAll={onUngroupAll}
        onToggleEmojify={onToggleEmojify}
        onNuke={onNuke}
        onGenerateTitle={onGenerateTitle}
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
          {itemGroups.map((group) => {
            const isGroupHighlighted = group.headerId === highlightedCategoryId && highlightedCategoryId !== null;

            // If this is a category group (has a header), wrap in a container with outline
            if (group.headerId) {
              return (
                <div
                  key={`group-${group.headerId}`}
                  className={`
                    rounded-lg transition-all duration-200
                    ${isGroupHighlighted ? 'ring-2 ring-[var(--primary)] ring-opacity-50 bg-[var(--primary-pale)]' : ''}
                  `}
                >
                  {group.items.map(({ item, depth }) => (
                    <ListItem
                      key={item.id}
                      item={item}
                      depth={depth}
                      isNew={item.id === newItemId || newItemIds.includes(item.id)}
                      isCompleting={completingItemIds.has(item.id)}
                      isDropTarget={false}
                      largeMode={largeMode}
                      onToggle={onToggle}
                      onUpdate={onUpdate}
                      onDelete={onDelete}
                      onIndent={onIndent}
                      onOutdent={onOutdent}
                      onAddItem={onAddItem}
                    />
                  ))}
                </div>
              );
            }

            // Root-level items without a header - render directly
            return group.items.map(({ item, depth }) => (
              <ListItem
                key={item.id}
                item={item}
                depth={depth}
                isNew={item.id === newItemId || newItemIds.includes(item.id)}
                isCompleting={completingItemIds.has(item.id)}
                isDropTarget={false}
                largeMode={largeMode}
                onToggle={onToggle}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onIndent={onIndent}
                onOutdent={onOutdent}
                onAddItem={onAddItem}
              />
            ));
          })}
        </SortableContext>
      </DndContext>
    </div>
  );
}
