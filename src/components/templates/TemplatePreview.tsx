'use client';

import { Item, ItemWithChildren } from '@/types';
import { ThemeColors } from '@/lib/gemini';

interface TemplatePreviewProps {
  items: Item[];
  theme: ThemeColors | null;
}

// Build tree structure from flat items
function buildTree(items: Item[]): ItemWithChildren[] {
  const itemMap = new Map<string, ItemWithChildren>();
  const roots: ItemWithChildren[] = [];

  // First pass: create all nodes
  items.forEach((item) => {
    itemMap.set(item.id, { ...item, children: [] });
  });

  // Second pass: build tree
  items.forEach((item) => {
    const node = itemMap.get(item.id)!;
    if (item.parent_id && itemMap.has(item.parent_id)) {
      itemMap.get(item.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Sort by position
  const sortByPosition = (a: ItemWithChildren, b: ItemWithChildren) =>
    a.position - b.position;

  roots.sort(sortByPosition);
  roots.forEach((root) => root.children.sort(sortByPosition));

  return roots;
}

export function TemplatePreview({ items, theme }: TemplatePreviewProps) {
  const tree = buildTree(items);

  // Default colors if no theme
  const colors = {
    primary: theme?.primary || '#3B82F6',
    bgPrimary: theme?.bgPrimary || '#FFFFFF',
    bgSecondary: theme?.bgSecondary || '#F9FAFB',
    textPrimary: theme?.textPrimary || '#1F2937',
    textSecondary: theme?.textSecondary || '#6B7280',
    borderLight: theme?.borderLight || '#E5E7EB',
  };

  const isCategory = (content: string) => content.startsWith('#');
  const formatContent = (content: string) =>
    content.startsWith('#') ? content.slice(1) : content;

  const renderItem = (item: ItemWithChildren, depth: number = 0) => {
    const isHeader = isCategory(item.content);

    return (
      <div key={item.id}>
        <div
          className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
            isHeader ? 'mt-3 first:mt-0' : ''
          }`}
          style={{
            marginLeft: depth > 0 ? '1.5rem' : 0,
            backgroundColor: isHeader ? colors.bgSecondary : 'transparent',
          }}
        >
          {!isHeader && (
            <div
              className="h-5 w-5 shrink-0 rounded border-2"
              style={{ borderColor: colors.primary }}
            />
          )}
          <span
            className={isHeader ? 'font-semibold' : ''}
            style={{
              color: isHeader ? colors.textPrimary : colors.textSecondary,
            }}
          >
            {formatContent(item.content)}
          </span>
        </div>
        {item.children.map((child) => renderItem(child, depth + 1))}
      </div>
    );
  };

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        backgroundColor: colors.bgPrimary,
        borderColor: colors.borderLight,
      }}
    >
      {tree.length === 0 ? (
        <p className="text-center text-gray-500">No items</p>
      ) : (
        <div className="space-y-1">
          {tree.map((item) => renderItem(item))}
        </div>
      )}
    </div>
  );
}
