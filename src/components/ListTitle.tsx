'use client';

import { useState, useRef, useEffect } from 'react';

interface ListTitleProps {
  title: string | null;
  onUpdate: (title: string) => Promise<void>;
}

export function ListTitle({ title, onUpdate }: ListTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(title || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(title || '');
  }, [title]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSubmit = async () => {
    const trimmed = value.trim();
    if (trimmed !== title) {
      await onUpdate(trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      setValue(title || '');
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSubmit}
        onKeyDown={handleKeyDown}
        placeholder="Untitled List"
        className="text-2xl font-semibold bg-transparent border-none outline-none w-full"
        style={{ color: 'var(--text-primary)' }}
      />
    );
  }

  return (
    <h1
      onClick={() => setIsEditing(true)}
      className="text-2xl font-semibold cursor-pointer transition-colors"
      style={{ color: 'var(--text-primary)' }}
      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
    >
      {title || 'Untitled List'}
    </h1>
  );
}
