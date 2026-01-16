'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ItemWithChildren } from '@/types';

interface ListItemProps {
  item: ItemWithChildren;
  depth?: number;
  isNew?: boolean;
  isCompleting?: boolean;
  isDropTarget?: boolean;
  onToggle: (id: string) => Promise<void>;
  onUpdate: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onIndent: (id: string) => Promise<void>;
  onOutdent: (id: string) => Promise<void>;
  onAddItem: (content: string, parentId: string | null) => Promise<void>;
}

// Create sparkle particles
function createSparkles(container: HTMLElement) {
  const rect = container.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;

  // Create 8 sparkle particles
  for (let i = 0; i < 8; i++) {
    const particle = document.createElement('div');
    particle.className = 'sparkle-particle';

    // Calculate random direction
    const angle = (i / 8) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const distance = 20 + Math.random() * 15;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance - 10; // Slight upward bias

    particle.style.left = `${centerX}px`;
    particle.style.top = `${centerY}px`;
    particle.style.setProperty('--tx', `${tx}px`);
    particle.style.setProperty('--ty', `${ty}px`);

    container.appendChild(particle);

    // Remove particle after animation
    setTimeout(() => particle.remove(), 600);
  }
}

export function ListItem({
  item,
  depth = 0,
  isNew = false,
  isCompleting = false,
  isDropTarget = false,
  onToggle,
  onUpdate,
  onDelete,
  onIndent,
  onOutdent,
  onAddItem,
}: ListItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(item.content);
  const inputRef = useRef<HTMLInputElement>(null);
  const checkboxRef = useRef<HTMLButtonElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  useEffect(() => {
    setValue(item.content);
  }, [item.content]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSubmit = async () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== item.content) {
      await onUpdate(item.id, trimmed);
    } else if (!trimmed) {
      await onDelete(item.id);
    }
    setIsEditing(false);
  };

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await handleSubmit();
    } else if (e.key === 'Escape') {
      setValue(item.content);
      setIsEditing(false);
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      await onIndent(item.id);
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      await onOutdent(item.id);
    } else if (e.key === 'Backspace' && value === '') {
      e.preventDefault();
      await onDelete(item.id);
    }
  };

  const handleCheckboxClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Create sparkles only when completing (not uncompleting)
    if (!item.completed && checkboxRef.current) {
      createSparkles(checkboxRef.current);
    }

    await onToggle(item.id);
  }, [item.completed, item.id, onToggle]);

  // Check if this is a header item (starts with #)
  const isHeader = item.content.startsWith('#');
  const displayContent = isHeader ? item.content.slice(1).trim() : item.content;

  // Header items render differently
  if (isHeader) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`
          flex items-center gap-3 rounded-lg group
          transition-all duration-200
          ${isDragging ? 'item-dragging opacity-50 z-50' : ''}
          ${isNew ? 'item-new item-slide-in' : ''}
          ${isDropTarget ? 'bg-[var(--primary-pale)] ring-2 ring-[var(--primary)] ring-opacity-50' : ''}
        `}
      >
        <div
          className="flex items-center gap-3 flex-1"
          style={{
            paddingLeft: `${depth * 24}px`,
            paddingTop: '8px',
            paddingBottom: '4px',
            marginTop: depth === 0 ? '12px' : '0'
          }}
        >
          {/* Drag handle */}
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
            </svg>
          </div>

          {/* Header icon - hashtag */}
          <div className="w-5 h-5 flex items-center justify-center text-[var(--primary)] font-bold text-sm">
            #
          </div>

          {/* Header content */}
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={handleSubmit}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent border-none outline-none font-semibold"
              style={{ color: 'var(--text-primary)' }}
            />
          ) : (
            <span
              onClick={() => setIsEditing(true)}
              className="flex-1 cursor-pointer font-semibold text-[var(--primary)] uppercase text-sm tracking-wide"
            >
              {displayContent}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-3 rounded-lg group
        transition-all duration-200
        ${isDragging ? 'item-dragging opacity-50 z-50' : ''}
        ${isNew ? 'item-new item-slide-in' : ''}
        ${isCompleting ? 'item-completing' : ''}
        ${item.completed && !isCompleting ? 'item-completed' : ''}
        ${!item.completed ? 'item-hover' : ''}
        ${isDropTarget ? 'bg-[var(--primary-pale)]' : ''}
      `}
    >
      <div
        className="flex items-center gap-3 flex-1"
        style={{
          paddingLeft: `${depth * 24}px`,
          paddingTop: '2px',
          paddingBottom: '2px'
        }}
      >
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
          </svg>
        </div>

        {/* Checkbox with sparkles */}
        <button
          ref={checkboxRef}
          onClick={handleCheckboxClick}
          className={`
            relative w-5 h-5 rounded-md border-2 flex items-center justify-center
            checkbox transition-all duration-150
            ${item.completed
              ? 'checkbox-checked border-[var(--primary)] bg-[var(--primary)]'
              : 'hover:border-[var(--primary)]'
            }
          `}
          style={{ borderColor: item.completed ? undefined : 'var(--border-medium)' }}
        >
          {item.completed && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Content */}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={handleSubmit}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent border-none outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
        ) : (
          <span
            onClick={() => setIsEditing(true)}
            className={`
              flex-1 cursor-pointer item-text transition-colors duration-200
              ${item.completed ? 'line-through' : ''}
            `}
            style={{ color: item.completed ? 'var(--text-muted)' : 'var(--text-primary)' }}
          >
            {displayContent}
          </span>
        )}
      </div>
    </div>
  );
}
