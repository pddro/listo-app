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
  largeMode?: boolean;
  sortingDisabled?: boolean;
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
  largeMode = false,
  sortingDisabled = false,
  onToggle,
  onUpdate,
  onDelete,
  onIndent,
  onOutdent,
  onAddItem,
}: ListItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(item.content);
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const checkboxRef = useRef<HTMLButtonElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: sortingDisabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  useEffect(() => {
    setValue(item.content);
  }, [item.content]);

  // Check if this is a note early so we can use it in effects
  const isNote = item.content.toLowerCase().startsWith('note:');

  useEffect(() => {
    if (isEditing) {
      if (isNote && textareaRef.current) {
        textareaRef.current.focus();
        // Set cursor to end and auto-resize
        const len = textareaRef.current.value.length;
        textareaRef.current.setSelectionRange(len, len);
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
      } else if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [isEditing, isNote]);

  const handleSubmit = async () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== item.content) {
      await onUpdate(item.id, trimmed);
      setIsEditing(false);
    } else if (!trimmed) {
      setIsDeleting(true);
      await onDelete(item.id);
    } else {
      setIsEditing(false);
    }
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

  // Note-specific keydown: Enter adds newline, Cmd/Ctrl+Enter submits
  // If note is empty, Enter submits (which triggers delete)
  const handleNoteKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const noteContent = value.toLowerCase().startsWith('note:')
      ? value.slice(5).trim()
      : value.trim();

    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || noteContent === '')) {
      e.preventDefault();
      await handleSubmit();
    } else if (e.key === 'Escape') {
      setValue(item.content);
      setIsEditing(false);
    } else if (e.key === 'Backspace' && value === '') {
      e.preventDefault();
      await onDelete(item.id);
    }
  };

  // Auto-resize textarea for notes
  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  const handleCheckboxClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Create sparkles only when completing (not uncompleting)
    if (!item.completed && checkboxRef.current) {
      createSparkles(checkboxRef.current);
    }

    await onToggle(item.id);
  }, [item.completed, item.id, onToggle]);

  // Hide immediately when deleting (optimistic)
  if (isDeleting) {
    return null;
  }

  // Extract domain from URL
  const getDomain = (url: string) => {
    try {
      const urlObj = new URL(url);
      let domain = urlObj.hostname.replace(/^www\./, '');
      // Truncate very long domains
      if (domain.length > 25) {
        domain = domain.slice(0, 22) + '...';
      }
      return domain;
    } catch {
      return 'link';
    }
  };

  // Helper to render text with clickable URL chips
  const renderWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        // Reset regex lastIndex since we're reusing it
        urlRegex.lastIndex = 0;
        const domain = getDomain(part);
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            title={part}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium hover:opacity-80 transition-opacity"
            style={{
              backgroundColor: 'var(--primary-pale)',
              color: 'var(--primary)',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            {domain}
          </a>
        );
      }
      return part;
    });
  };

  // Check if this is a header item (starts with #)
  const isHeader = item.content.startsWith('#');
  const displayContent = isHeader
    ? item.content.slice(1).trim()
    : isNote
      ? item.content.slice(5).trim()
      : item.content;

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
          <div className={`${largeMode ? 'w-10 h-10 text-xl' : 'w-5 h-5 text-sm'} flex items-center justify-center text-[var(--primary)] font-bold`}>
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
              className={`flex-1 bg-transparent border-none outline-none font-semibold ${largeMode ? 'text-xl' : ''}`}
              style={{ color: 'var(--text-primary)' }}
            />
          ) : (
            <span
              onClick={() => setIsEditing(true)}
              className={`flex-1 cursor-pointer font-semibold text-[var(--primary)] uppercase tracking-wide ${largeMode ? 'text-xl' : 'text-sm'}`}
            >
              {displayContent}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Note items render without checkbox
  if (isNote) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`
          flex items-center gap-3 rounded-lg group
          transition-all duration-200
          ${isDragging ? 'item-dragging opacity-50 z-50' : ''}
          ${isNew ? 'item-new item-slide-in' : ''}
          item-hover
        `}
      >
        <div
          className="flex items-start gap-3 flex-1"
          style={{
            paddingLeft: `${depth * 24}px`,
            paddingTop: '4px',
            paddingBottom: '4px'
          }}
        >
          {/* Drag handle */}
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
            </svg>
          </div>

          {/* Note icon */}
          <div
            className={`flex items-center justify-center ${largeMode ? 'w-10 h-10 text-lg' : 'w-5 h-5 text-xs'}`}
            style={{ color: 'var(--text-muted)' }}
          >
            <svg className={`${largeMode ? 'w-5 h-5' : 'w-4 h-4'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>

          {/* Note content */}
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={value}
              onChange={handleNoteChange}
              onBlur={handleSubmit}
              onKeyDown={handleNoteKeyDown}
              rows={1}
              className={`flex-1 bg-transparent border-none outline-none italic resize-none ${largeMode ? 'text-xl' : 'text-sm'}`}
              style={{ color: 'var(--text-secondary)', minHeight: '20px' }}
            />
          ) : (
            <span
              onClick={() => setIsEditing(true)}
              className={`flex-1 cursor-pointer italic ${largeMode ? 'text-xl' : 'text-sm'}`}
              style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}
            >
              {renderWithLinks(displayContent)}
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
            relative rounded-md border-2 flex items-center justify-center
            checkbox transition-all duration-150
            ${largeMode ? 'w-10 h-10' : 'w-5 h-5'}
            ${item.completed
              ? 'checkbox-checked border-[var(--primary)] bg-[var(--primary)]'
              : 'hover:border-[var(--primary)]'
            }
          `}
          style={{ borderColor: item.completed ? undefined : 'var(--border-medium)' }}
        >
          {item.completed && (
            <svg className={`${largeMode ? 'w-6 h-6' : 'w-3 h-3'} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            className={`flex-1 bg-transparent border-none outline-none ${largeMode ? 'text-2xl' : ''}`}
            style={{ color: 'var(--text-primary)' }}
          />
        ) : (
          <span
            onClick={() => setIsEditing(true)}
            className={`
              flex-1 cursor-pointer item-text transition-colors duration-200
              ${item.completed ? 'line-through' : ''}
              ${largeMode ? 'text-2xl' : ''}
            `}
            style={{ color: item.completed ? 'var(--text-muted)' : 'var(--text-primary)' }}
          >
            {renderWithLinks(displayContent)}
          </span>
        )}
      </div>
    </div>
  );
}
