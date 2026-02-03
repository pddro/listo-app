'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { ItemWithChildren } from '@/types';

// Detect if device is touch-enabled (mobile) - evaluated once at module load
const isTouchDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

// Cache the result to avoid recalculation and ensure consistent initial render
const IS_MOBILE = typeof window !== 'undefined' ? isTouchDevice() : false;

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

// Swipe-to-delete constants
const SWIPE_THRESHOLD = 100; // Pixels to swipe before delete triggers
const SWIPE_VELOCITY_THRESHOLD = 0.5; // Pixels/ms for flick detection
const DELETE_ZONE_WIDTH = 80; // Width of the delete zone

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

  // Swipe-to-delete state
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [hasTriggeredHaptic, setHasTriggeredHaptic] = useState(false);
  const swipeRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    isHorizontal: boolean | null;
    lastX: number;
    lastTime: number;
  } | null>(null);

  // Use cached mobile detection to prevent size jitter on mount
  const isMobile = IS_MOBILE;

  // Swipe-to-delete handlers (mobile only)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile || isEditing) return;

    const touch = e.touches[0];
    swipeRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      isHorizontal: null,
      lastX: touch.clientX,
      lastTime: Date.now(),
    };
    setHasTriggeredHaptic(false);
  }, [isMobile, isEditing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipeRef.current || !isMobile) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - swipeRef.current.startX;
    const deltaY = touch.clientY - swipeRef.current.startY;

    // Determine direction on first significant move
    if (swipeRef.current.isHorizontal === null) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absX > 10 || absY > 10) {
        // Only allow left swipe (negative deltaX) and must be more horizontal than vertical
        swipeRef.current.isHorizontal = absX > absY && deltaX < 0;

        if (swipeRef.current.isHorizontal) {
          setIsSwiping(true);
        }
      }
    }

    // Track velocity
    swipeRef.current.lastX = touch.clientX;
    swipeRef.current.lastTime = Date.now();

    // If horizontal swipe, update position
    if (swipeRef.current.isHorizontal) {
      // Only allow swiping left (negative values)
      const newSwipeX = Math.min(0, deltaX);
      setSwipeX(newSwipeX);

      // Trigger haptic when crossing threshold
      if (Math.abs(newSwipeX) >= SWIPE_THRESHOLD && !hasTriggeredHaptic) {
        setHasTriggeredHaptic(true);
        Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
      } else if (Math.abs(newSwipeX) < SWIPE_THRESHOLD && hasTriggeredHaptic) {
        // Reset haptic state if user swipes back
        setHasTriggeredHaptic(false);
        Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      }
    }
  }, [isMobile, hasTriggeredHaptic]);

  const handleTouchEnd = useCallback(async () => {
    if (!swipeRef.current || !isMobile) return;

    const wasHorizontal = swipeRef.current.isHorizontal;
    const finalSwipeX = swipeX;

    // Calculate velocity for flick detection
    const timeDelta = Date.now() - swipeRef.current.lastTime;
    const velocity = timeDelta > 0
      ? Math.abs(swipeRef.current.startX - swipeRef.current.lastX) / (Date.now() - swipeRef.current.startTime)
      : 0;

    // Reset swipe tracking
    swipeRef.current = null;
    setIsSwiping(false);

    if (wasHorizontal) {
      // Delete if past threshold OR if flicked fast enough
      const shouldDelete = Math.abs(finalSwipeX) >= SWIPE_THRESHOLD ||
        (velocity > SWIPE_VELOCITY_THRESHOLD && Math.abs(finalSwipeX) > 30);

      if (shouldDelete) {
        // Animate out then delete
        setSwipeX(-window.innerWidth);
        await Haptics.notification({ type: NotificationType.Success }).catch(() => {});

        // Small delay for animation
        setTimeout(async () => {
          setIsDeleting(true);
          await onDelete(item.id);
        }, 150);
      } else {
        // Spring back
        setSwipeX(0);
      }
    } else {
      setSwipeX(0);
    }
  }, [isMobile, swipeX, onDelete, item.id]);

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

    // Haptic feedback - success "cha-ching" feel when completing, light tap when uncompleting
    try {
      if (!item.completed) {
        // Completing: satisfying double-tap success feel
        await Haptics.notification({ type: NotificationType.Success });
      } else {
        // Uncompleting: simple light tap
        await Haptics.impact({ style: ImpactStyle.Light });
      }
    } catch {
      // Haptics not available (web or unsupported device)
    }

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
        style={{
          ...style,
          WebkitUserSelect: 'none',
          userSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
        {...attributes}
        {...listeners}
        className={`
          flex items-center gap-3 rounded-lg group cursor-grab
          transition-all duration-200
          ${isDragging ? 'item-dragging opacity-50 z-50' : ''}
          ${isNew ? 'item-new item-slide-in' : ''}
        `}
      >
        <div
          className="flex items-center gap-3 flex-1"
          style={{
            paddingLeft: `${depth * 24}px`,
            paddingTop: isMobile ? '12px' : '8px',
            paddingBottom: isMobile ? '8px' : '4px',
            marginTop: depth === 0 ? '12px' : '0'
          }}
        >
          {/* Header icon - hashtag */}
          <div className={`${largeMode ? 'w-10 h-10 text-xl' : isMobile ? 'w-7 h-7 text-base' : 'w-5 h-5 text-sm'} flex items-center justify-center text-[var(--primary)] font-bold`}>
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

  // Calculate delete progress for visual feedback (used by notes and regular items)
  const deleteProgress = Math.min(1, Math.abs(swipeX) / SWIPE_THRESHOLD);
  const isAtDeleteThreshold = Math.abs(swipeX) >= SWIPE_THRESHOLD;

  // Note items render without checkbox
  if (isNote) {
    return (
      <div
        ref={setNodeRef}
        style={{
          ...style,
          position: 'relative',
          overflow: 'hidden',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
        className={`
          rounded-lg
          ${isDragging ? 'item-dragging opacity-50 z-50' : ''}
          ${isNew ? 'item-new item-slide-in' : ''}
        `}
      >
        {/* Delete backdrop - shows when swiping */}
        {isMobile && (
          <div
            className="absolute inset-y-0 right-0 flex items-center justify-end"
            style={{
              width: `${DELETE_ZONE_WIDTH}px`,
              backgroundColor: isAtDeleteThreshold ? '#EF4444' : `rgba(239, 68, 68, ${0.3 + deleteProgress * 0.7})`,
              transition: isSwiping ? 'none' : 'background-color 0.2s ease',
              borderRadius: '0 8px 8px 0',
            }}
          >
            <div
              className="flex items-center justify-center"
              style={{
                width: '100%',
                opacity: deleteProgress,
                transform: `scale(${0.5 + deleteProgress * 0.5})`,
                transition: isSwiping ? 'none' : 'all 0.2s ease',
              }}
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
          </div>
        )}

        {/* Swipe detection wrapper */}
        <div
          onTouchStart={(e) => {
            handleTouchStart(e);
          }}
          onTouchMove={(e) => {
            handleTouchMove(e);
            if (swipeRef.current?.isHorizontal) {
              e.stopPropagation();
            }
          }}
          onTouchEnd={(e) => {
            handleTouchEnd();
            if (swipeRef.current?.isHorizontal || isSwiping) {
              e.stopPropagation();
            }
          }}
          style={{
            transform: `translateX(${swipeX}px)`,
            transition: isSwiping ? 'none' : 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            backgroundColor: 'var(--bg-primary)',
            borderRadius: '8px',
          }}
        >
          {/* Draggable content */}
          <div
            {...attributes}
            {...listeners}
            className={`
              flex items-center gap-3 group cursor-grab
              transition-all
              item-hover
            `}
          >
            <div
              className="flex items-start gap-3 flex-1"
              style={{
                paddingLeft: `${depth * 24}px`,
                paddingTop: isMobile ? '10px' : '4px',
                paddingBottom: isMobile ? '10px' : '4px'
              }}
            >
              {/* Note icon */}
              <div
                className={`flex items-center justify-center ${largeMode ? 'w-10 h-10 text-lg' : isMobile ? 'w-7 h-7' : 'w-5 h-5 text-xs'}`}
                style={{ color: 'var(--text-muted)' }}
              >
                <svg className={`${largeMode ? 'w-5 h-5' : isMobile ? 'w-5 h-5' : 'w-4 h-4'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        position: 'relative',
        overflow: 'hidden',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
      className={`
        rounded-lg
        ${isDragging ? 'item-dragging opacity-50 z-50' : ''}
        ${isNew ? 'item-new item-slide-in' : ''}
        ${isCompleting ? 'item-completing' : ''}
        ${item.completed && !isCompleting ? 'item-completed' : ''}
      `}
    >
      {/* Delete backdrop - shows when swiping */}
      {isMobile && (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-end"
          style={{
            width: `${DELETE_ZONE_WIDTH}px`,
            backgroundColor: isAtDeleteThreshold ? '#EF4444' : `rgba(239, 68, 68, ${0.3 + deleteProgress * 0.7})`,
            transition: isSwiping ? 'none' : 'background-color 0.2s ease',
            borderRadius: '0 8px 8px 0',
          }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: '100%',
              opacity: deleteProgress,
              transform: `scale(${0.5 + deleteProgress * 0.5})`,
              transition: isSwiping ? 'none' : 'all 0.2s ease',
            }}
          >
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </div>
        </div>
      )}

      {/* Swipe detection wrapper - captures touch before dnd-kit */}
      <div
        onTouchStart={(e) => {
          handleTouchStart(e);
          // Don't pass to dnd-kit if we're swiping
        }}
        onTouchMove={(e) => {
          handleTouchMove(e);
          // Prevent dnd-kit from activating during horizontal swipe
          if (swipeRef.current?.isHorizontal) {
            e.stopPropagation();
          }
        }}
        onTouchEnd={(e) => {
          handleTouchEnd();
          // Prevent dnd-kit from activating if we were swiping
          if (swipeRef.current?.isHorizontal || isSwiping) {
            e.stopPropagation();
          }
        }}
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '8px',
        }}
      >
        {/* Draggable content */}
        <div
          {...attributes}
          {...listeners}
          className={`
            flex items-center gap-3 group cursor-grab
            transition-all
            ${!item.completed ? 'item-hover' : ''}
          `}
        >
        <div
          className="flex items-center gap-3 flex-1"
          style={{
            paddingLeft: `${depth * 24}px`,
            paddingTop: isMobile ? '8px' : '2px',
            paddingBottom: isMobile ? '8px' : '2px'
          }}
        >
          {/* Checkbox with sparkles */}
          <button
            ref={checkboxRef}
            onClick={handleCheckboxClick}
            className={`
              relative rounded-md border-2 flex items-center justify-center
              checkbox transition-all duration-150
              ${largeMode ? 'w-10 h-10' : isMobile ? 'w-7 h-7' : 'w-5 h-5'}
              ${item.completed
                ? 'checkbox-checked border-[var(--primary)] bg-[var(--primary)]'
                : ''
              }
            `}
            style={{ borderColor: item.completed ? undefined : 'var(--border-medium)' }}
          >
            {item.completed && (
              <svg className={`${largeMode ? 'w-6 h-6' : isMobile ? 'w-4 h-4' : 'w-3 h-3'} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      </div>
    </div>
  );
}
