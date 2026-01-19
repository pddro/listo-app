'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  MouseSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  CollisionDetection,
  useDroppable,
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

// Invisible drop zone for moving items to root level
function RootDropZone({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  const { setNodeRef } = useDroppable({ id });

  if (!isActive) return null;

  return (
    <div
      ref={setNodeRef}
      style={{
        height: '60px',
        marginTop: '4px',
        marginBottom: '4px',
      }}
    />
  );
}

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
  hideBottomPadding?: boolean;
  prefillValue?: string;
  onPrefillConsumed?: () => void;
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
  hideBottomPadding,
  prefillValue,
  onPrefillConsumed,
}: ListContainerProps) {
  const { generateItems } = useAI();
  const [highlightedCategoryId, setHighlightedCategoryId] = useState<string | null>(null);
  const [isDraggingRegularItem, setIsDraggingRegularItem] = useState(false);
  const [isDraggingRootItem, setIsDraggingRootItem] = useState(false);
  const [isDraggingGroupedItem, setIsDraggingGroupedItem] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Check if there are any groups in the list (to show drop zones)
  const hasGroups = items.some(item => item.content.startsWith('#'));

  const sensors = useSensors(
    // Touch: short delay, once activated prevents scroll
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 8,
      },
    }),
    // Mouse: small distance threshold
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const draggedId = event.active.id as string;
    const activeItem = findItemById(items, draggedId);
    setActiveId(draggedId);
    // Only track highlighting if dragging a regular item (not a header)
    const isRegularItem = activeItem ? !activeItem.content.startsWith('#') : false;
    setIsDraggingRegularItem(isRegularItem);
    // Track if dragging a root item (no parent_id)
    setIsDraggingRootItem(isRegularItem && activeItem ? !activeItem.parent_id : false);
    // Track if dragging an item that's inside a group (has parent_id)
    setIsDraggingGroupedItem(isRegularItem && activeItem ? !!activeItem.parent_id : false);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;

    // Skip highlighting for root drop zones
    if (over?.id === 'root-drop-zone-top' || over?.id === 'root-drop-zone-bottom') {
      setHighlightedCategoryId(null);
      return;
    }

    if (!isDraggingRegularItem) {
      setHighlightedCategoryId(null);
      return;
    }

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
    setIsDraggingRootItem(false);
    setIsDraggingGroupedItem(false);
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const activeItem = findItemById(items, activeId);

    // Handle drops on root drop zones
    if (overId === 'root-drop-zone-top') {
      if (activeItem?.parent_id) {
        // Grouped item - move to root at the beginning
        await onMoveToRoot(activeId, 0);
      } else {
        // Already root item - reorder to beginning by finding first root item
        const firstRootItem = items.find(item => !item.content.startsWith('#') && !item.parent_id);
        if (firstRootItem && firstRootItem.id !== activeId) {
          await onReorder(activeId, firstRootItem.id);
        }
      }
      return;
    } else if (overId === 'root-drop-zone-bottom') {
      if (activeItem?.parent_id) {
        // Grouped item - move to root at the very end
        const maxRootPosition = items
          .filter(item => !item.parent_id)
          .reduce((max, item) => Math.max(max, item.position), -1);
        await onMoveToRoot(activeId, maxRootPosition + 1);
      } else {
        // Already root item - reorder to end by finding last root item/group
        const rootItems = items.filter(item => !item.parent_id);
        const lastRootItem = rootItems[rootItems.length - 1];
        if (lastRootItem && lastRootItem.id !== activeId) {
          await onReorder(activeId, lastRootItem.id);
        }
      }
      return;
    }

    if (active.id !== over.id) {
      // Check if we're dropping onto a header or its children
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
    setIsDraggingRootItem(false);
    setIsDraggingGroupedItem(false);
    setActiveId(null);
  };

  // Get IDs of all items that are children inside groups (have a parent_id and are not headers)
  const getGroupChildIds = useCallback((): Set<string> => {
    const childIds = new Set<string>();
    const collectChildIds = (itemList: ItemWithChildren[]) => {
      for (const item of itemList) {
        if (item.content.startsWith('#')) {
          // This is a header - collect all its children's IDs
          for (const child of item.children) {
            childIds.add(child.id);
            // Recursively collect nested children if any
            if (child.children.length > 0) {
              const collectNested = (nested: ItemWithChildren[]) => {
                for (const n of nested) {
                  childIds.add(n.id);
                  if (n.children.length > 0) collectNested(n.children);
                }
              };
              collectNested(child.children);
            }
          }
        }
        if (item.children.length > 0) {
          collectChildIds(item.children);
        }
      }
    };
    collectChildIds(items);
    return childIds;
  }, [items]);

  // Map child item IDs to their parent header IDs
  const getChildToHeaderMap = useCallback((): Map<string, string> => {
    const childToHeader = new Map<string, string>();
    const mapChildren = (itemList: ItemWithChildren[]) => {
      for (const item of itemList) {
        if (item.content.startsWith('#')) {
          // This is a header - map all its children to this header
          const mapChildrenToHeader = (children: ItemWithChildren[], headerId: string) => {
            for (const child of children) {
              childToHeader.set(child.id, headerId);
              if (child.children.length > 0) {
                mapChildrenToHeader(child.children, headerId);
              }
            }
          };
          mapChildrenToHeader(item.children, item.id);
        }
        if (item.children.length > 0) {
          mapChildren(item.children);
        }
      }
    };
    mapChildren(items);
    return childToHeader;
  }, [items]);

  // Custom collision detection that maps child collisions to their parent header when dragging a root item
  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    const { pointerCoordinates } = args;

    // Get drop zone containers
    const dropZoneContainers = args.droppableContainers.filter(
      container => (container.id as string).startsWith('root-drop-zone')
    );

    // Check drop zones first using rectIntersection
    if (dropZoneContainers.length > 0) {
      const dropZoneCollisions = rectIntersection({
        ...args,
        droppableContainers: dropZoneContainers,
      });

      if (dropZoneCollisions.length > 0) {
        return dropZoneCollisions;
      }

      // Also check if pointer is in drop zone area by Y coordinate
      if (pointerCoordinates) {
        const topZone = dropZoneContainers.find(c => c.id === 'root-drop-zone-top');
        const bottomZone = dropZoneContainers.find(c => c.id === 'root-drop-zone-bottom');

        // Get non-drop-zone containers to find first/last item positions
        const itemContainers = args.droppableContainers.filter(
          container => !(container.id as string).startsWith('root-drop-zone')
        );

        if (itemContainers.length > 0) {
          // Find the topmost item
          let minY = Infinity;
          let maxY = -Infinity;

          for (const container of itemContainers) {
            const rect = container.rect.current;
            if (rect) {
              if (rect.top < minY) minY = rect.top;
              if (rect.bottom > maxY) maxY = rect.bottom;
            }
          }

          // If pointer is above all items, return top drop zone
          if (topZone && pointerCoordinates.y < minY) {
            return [{
              id: 'root-drop-zone-top',
              data: { droppableContainer: topZone },
            }];
          }

          // If pointer is below all items, return bottom drop zone
          if (bottomZone && pointerCoordinates.y > maxY) {
            return [{
              id: 'root-drop-zone-bottom',
              data: { droppableContainer: bottomZone },
            }];
          }
        }
      }
    }

    // Normal collision detection for other items
    const collisions = closestCenter(args);

    if (!isDraggingRootItem || collisions.length === 0) {
      return collisions;
    }

    // Map any child collisions to their parent header
    const childToHeader = getChildToHeaderMap();

    return collisions.map(collision => {
      const parentHeaderId = childToHeader.get(collision.id as string);
      if (parentHeaderId) {
        // Find the header's droppable container
        const headerContainer = args.droppableContainers.find(c => c.id === parentHeaderId);
        if (headerContainer) {
          return {
            ...collision,
            id: parentHeaderId,
            data: { droppableContainer: headerContainer },
          };
        }
      }
      return collision;
    });
  }, [isDraggingRootItem, getChildToHeaderMap]);

  // Flatten the tree for rendering - all items become siblings with depth
  const flattenedItems = flattenItemsForRender(items);
  const itemIds = flattenedItems.map(f => f.item.id);

  // Group items by category for visual grouping with outline
  const itemGroups = groupItemsByCategory(flattenedItems);

  return (
    <div className="space-y-1" style={{ paddingBottom: hideBottomPadding ? '0' : '80px' }}>
      {/* New item input at TOP - Sticky */}
      <div
        style={{
          position: 'sticky',
          top: 'calc(env(safe-area-inset-top, 0px) + 48px)',
          zIndex: 10,
          backgroundColor: 'var(--bg-primary)',
          paddingTop: '8px',
          paddingBottom: '8px',
          marginLeft: '-8px',
          marginRight: '-8px',
          paddingLeft: '8px',
          paddingRight: '8px',
          marginTop: '-4px',
        }}
      >
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
          prefillValue={prefillValue}
          onPrefillConsumed={onPrefillConsumed}
          autoFocus
        />
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {/* Top drop zone for moving items to root level */}
        <RootDropZone
          id="root-drop-zone-top"
          isActive={isDraggingRegularItem && hasGroups}
        />

        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          {itemGroups.map((group) => {
            const isGroupHighlighted = group.headerId === highlightedCategoryId && highlightedCategoryId !== null;

            // If this is a category group (has a header), wrap in a container with outline
            if (group.headerId) {
              const isBeingDragged = activeId === group.headerId;
              return (
                <div
                  key={`group-${group.headerId}`}
                  className={`
                    rounded-lg transition-all duration-200
                    ${isGroupHighlighted ? 'ring-2 ring-[var(--primary)] ring-opacity-50 bg-[var(--primary-pale)]' : ''}
                  `}
                  style={isBeingDragged ? {
                    opacity: 0.4,
                    backgroundColor: 'var(--bg-primary)',
                  } : undefined}
                >
                  {group.items.map(({ item, depth }) => {
                    // Disable sorting for non-header items inside groups when dragging a root item
                    const isChildItem = !item.content.startsWith('#');
                    const shouldDisableSorting = isDraggingRootItem && isChildItem;
                    return (
                      <ListItem
                        key={item.id}
                        item={item}
                        depth={depth}
                        isNew={item.id === newItemId || newItemIds.includes(item.id)}
                        isCompleting={completingItemIds.has(item.id)}
                        isDropTarget={false}
                        largeMode={largeMode}
                        sortingDisabled={shouldDisableSorting}
                        onToggle={onToggle}
                        onUpdate={onUpdate}
                        onDelete={onDelete}
                        onIndent={onIndent}
                        onOutdent={onOutdent}
                        onAddItem={onAddItem}
                      />
                    );
                  })}
                </div>
              );
            }

            // Root-level items without a header - render directly
            return group.items.map(({ item, depth }) => (
              <div
                key={item.id}
                className="transition-all duration-200 rounded-lg"
                style={activeId === item.id ? {
                  opacity: 0.4,
                  backgroundColor: 'var(--bg-primary)',
                } : undefined}
              >
                <ListItem
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
              </div>
            ));
          })}
        </SortableContext>

        {/* Bottom drop zone for moving items to root level */}
        <RootDropZone
          id="root-drop-zone-bottom"
          isActive={isDraggingRegularItem && hasGroups}
        />

        {/* Custom drag overlay for categories - deck of cards effect */}
        <DragOverlay dropAnimation={null}>
          {activeId && (() => {
            const activeItem = findItemById(items, activeId);
            if (!activeItem) return null;

            const isHeader = activeItem.content.startsWith('#');
            const displayContent = isHeader ? activeItem.content.slice(1).trim() : activeItem.content;

            // For regular items, show a simple card
            if (!isHeader) {
              return (
                <div
                  className="bg-[var(--bg-primary)] rounded-lg px-4 py-2 shadow-xl"
                  style={{
                    boxShadow: '0 20px 40px rgba(0,0,0,0.15), 0 8px 16px rgba(0,0,0,0.1)',
                    maxWidth: '400px',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                        activeItem.completed ? 'border-[var(--primary)] bg-[var(--primary)]' : ''
                      }`}
                      style={{ borderColor: activeItem.completed ? undefined : 'var(--border-medium)' }}
                    >
                      {activeItem.completed && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span style={{ color: activeItem.completed ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                      {displayContent}
                    </span>
                  </div>
                </div>
              );
            }

            // For categories, show the deck of cards effect
            const childCount = activeItem.children.length;
            const maxVisibleCards = Math.min(childCount, 4);

            return (
              <div className="relative" style={{ minWidth: '320px' }}>
                {/* Stacked cards behind (children preview) */}
                {[...Array(maxVisibleCards)].map((_, index) => {
                  const offset = (maxVisibleCards - index) * 4;
                  const scale = 1 - (maxVisibleCards - index) * 0.015;
                  return (
                    <div
                      key={`card-${index}`}
                      className="absolute inset-0 rounded-xl"
                      style={{
                        backgroundColor: 'var(--bg-primary)',
                        border: '1px solid var(--border-light)',
                        transform: `translateY(${offset}px) scale(${scale})`,
                        transformOrigin: 'top center',
                        zIndex: index,
                      }}
                    />
                  );
                })}

                {/* Main header card (front) */}
                <div
                  className="relative rounded-xl px-6 py-6"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    boxShadow: '0 25px 50px rgba(0,0,0,0.2), 0 10px 20px rgba(0,0,0,0.1)',
                    zIndex: maxVisibleCards + 1,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 flex items-center justify-center text-[var(--primary)] font-bold">
                      #
                    </div>
                    <span className="font-semibold text-[var(--primary)] uppercase tracking-wide text-sm">
                      {displayContent}
                    </span>
                    {childCount > 0 && (
                      <span
                        className="ml-auto text-xs px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: 'var(--primary-pale)',
                          color: 'var(--primary)',
                        }}
                      >
                        {childCount} item{childCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
