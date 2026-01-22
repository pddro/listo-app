'use client';

import { useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';

export interface Command {
  id: string;
  label: string;
  description: string;
  prefix?: string; // For commands that insert into input
  action?: string; // For commands that execute immediately
  icon: 'sparkles' | 'wand' | 'palette' | 'hash' | 'list' | 'check' | 'reset' | 'trash' | 'large' | 'emoji' | 'sort' | 'ungroup' | 'title';
  category: 'ai' | 'actions' | 'modes';
}

// Command definitions without labels/descriptions (those come from translations)
interface CommandDef {
  id: string;
  translationKey: string; // key in commands.items.*
  prefix?: string | 'USE_THEME_TRIGGER'; // special value to use localized theme trigger
  action?: string;
  icon: Command['icon'];
  category: Command['category'];
}

const COMMAND_DEFS: CommandDef[] = [
  // AI Commands
  { id: 'generate', translationKey: 'generate', prefix: '...', icon: 'sparkles', category: 'ai' },
  { id: 'transform', translationKey: 'transform', prefix: '!', icon: 'wand', category: 'ai' },
  { id: 'theme', translationKey: 'theme', prefix: 'USE_THEME_TRIGGER', icon: 'palette', category: 'ai' },
  { id: 'title', translationKey: 'generateTitle', action: '--title', icon: 'title', category: 'ai' },
  // Quick Actions
  { id: 'category', translationKey: 'addCategory', prefix: '#', icon: 'hash', category: 'actions' },
  { id: 'complete', translationKey: 'completeAll', action: '--complete', icon: 'check', category: 'actions' },
  { id: 'reset', translationKey: 'resetAll', action: '--reset', icon: 'reset', category: 'actions' },
  { id: 'clean', translationKey: 'clearCompleted', action: '--clean', icon: 'trash', category: 'actions' },
  { id: 'sort', translationKey: 'sortItems', action: '--sort all', icon: 'sort', category: 'actions' },
  { id: 'ungroup', translationKey: 'removeCategories', action: '--ungroup', icon: 'ungroup', category: 'actions' },
  // Modes
  { id: 'large', translationKey: 'largeMode', action: '--large', icon: 'large', category: 'modes' },
  { id: 'emojify', translationKey: 'emojifyOn', action: '--emojify', icon: 'emoji', category: 'modes' },
];

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCommand: (command: Command) => void;
  hasTheme?: boolean;
  largeMode?: boolean;
  emojifyMode?: boolean;
}

function CommandIcon({ type }: { type: Command['icon'] }) {
  switch (type) {
    case 'sparkles':
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0L13.5 8.5L22 10L13.5 11.5L12 20L10.5 11.5L2 10L10.5 8.5L12 0Z" />
        </svg>
      );
    case 'wand':
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7.5 5.6L5 7L6.4 4.5L5 2L7.5 3.4L10 2L8.6 4.5L10 7L7.5 5.6Z" />
          <path d="M21.41 8.59L15.41 2.59C15.03 2.21 14.41 2.21 14.03 2.59L2.59 14.03C2.21 14.41 2.21 15.03 2.59 15.41L8.59 21.41C8.97 21.79 9.59 21.79 9.97 21.41L21.41 9.97C21.79 9.59 21.79 8.97 21.41 8.59Z" />
        </svg>
      );
    case 'palette':
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.61-.23-1.2-.64-1.67-.08-.1-.13-.21-.13-.33 0-.28.22-.5.5-.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 8 6.5 8 8 8.67 8 9.5 7.33 11 6.5 11zm3-4C8.67 7 8 6.33 8 5.5S8.67 4 9.5 4s1.5.67 1.5 1.5S10.33 7 9.5 7zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 4 14.5 4s1.5.67 1.5 1.5S15.33 7 14.5 7zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 8 17.5 8s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
        </svg>
      );
    case 'hash':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
        </svg>
      );
    case 'check':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'reset':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    case 'trash':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      );
    case 'large':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
        </svg>
      );
    case 'emoji':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'sort':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
        </svg>
      );
    case 'ungroup':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      );
    case 'title':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    default:
      return null;
  }
}

export function CommandPalette({
  isOpen,
  onClose,
  onSelectCommand,
  hasTheme = false,
  largeMode = false,
  emojifyMode = false,
}: CommandPaletteProps) {
  const t = useTranslations('commands');
  const tTriggers = useTranslations('commandTriggers');
  const sheetRef = useRef<HTMLDivElement>(null);

  // Get the first localized theme trigger
  const themeTrigger = useMemo(() => {
    const raw = tTriggers.raw('theme');
    return Array.isArray(raw) && raw.length > 0 ? raw[0] : 'style:';
  }, [tTriggers]);

  // Build commands with translated labels and descriptions
  const COMMANDS: Command[] = COMMAND_DEFS.map(def => ({
    id: def.id,
    label: t(`items.${def.translationKey}.label`),
    description: t(`items.${def.translationKey}.description`),
    prefix: def.prefix === 'USE_THEME_TRIGGER' ? themeTrigger : def.prefix,
    action: def.action,
    icon: def.icon,
    category: def.category,
  }));

  // Close on backdrop tap
  useEffect(() => {
    if (!isOpen) return;

    const handleBackdropClick = (e: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Small delay to prevent immediate close on open
    const timeout = setTimeout(() => {
      document.addEventListener('click', handleBackdropClick);
    }, 100);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('click', handleBackdropClick);
    };
  }, [isOpen, onClose]);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Build dynamic AI commands - add Reset Theme if theme is applied
  const aiCommands: Command[] = [
    ...COMMANDS.filter(c => c.category === 'ai'),
    ...(hasTheme ? [{
      id: 'reset-theme',
      label: t('items.resetTheme.label'),
      description: t('items.resetTheme.description'),
      action: '--reset-theme',
      icon: 'palette' as const,
      category: 'ai' as const,
    }] : []),
  ];

  // Build dynamic action commands
  const actionCommands = COMMANDS.filter(c => c.category === 'actions');

  // Build dynamic mode commands - swap based on current state
  const modeCommands: Command[] = COMMANDS.filter(c => c.category === 'modes').map(cmd => {
    if (cmd.id === 'large' && largeMode) {
      return {
        ...cmd,
        label: t('items.normalMode.label'),
        description: t('items.normalMode.description'),
        action: '--normal',
      };
    }
    if (cmd.id === 'emojify' && emojifyMode) {
      return {
        ...cmd,
        label: t('items.emojifyOff.label'),
        description: t('items.emojifyOff.description'),
        action: '--emojify',
      };
    }
    return cmd;
  });

  // Get the command string to display
  const getCommandString = (cmd: Command) => cmd.prefix || cmd.action || '';

  // Use portal to render at document root, escaping any containing blocks from backdrop-filter
  const modalContent = (
    <>
      {/* Backdrop - z-50 to cover DictateButton (z-40) */}
      <div
        className="fixed inset-0 z-50"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
      />

      {/* Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-[60] flex justify-center">
        <div
          ref={sheetRef}
          className="w-full max-w-lg rounded-t-2xl overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-primary)',
            maxHeight: '70vh',
            paddingBottom: 'env(safe-area-inset-bottom, 16px)',
            animation: 'slideUp 0.25s ease-out',
          }}
        >
        {/* Handle */}
        <div className="flex justify-center" style={{ padding: '12px 16px 8px 16px' }}>
          <div
            className="w-10 h-1 rounded-full"
            style={{ backgroundColor: 'var(--border-medium)' }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between" style={{ padding: '0 16px 12px 16px' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('title')}
          </h2>
          <button
            onClick={onClose}
            className="py-1 active:opacity-60"
            style={{ color: 'var(--primary)', fontSize: '17px' }}
          >
            {t('done')}
          </button>
        </div>

        {/* Commands List */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 90px)', padding: '0 16px' }}>
          {/* AI Section */}
          <div style={{ paddingTop: '8px', paddingBottom: '12px' }}>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--primary)' }}>
              {t('sections.aiFeatures')}
            </div>
          </div>
          <div className="space-y-2">
            {aiCommands.map((cmd) => (
              <button
                key={cmd.id}
                onClick={() => onSelectCommand(cmd)}
                className="w-full flex items-center gap-3 rounded-xl active:bg-[var(--bg-hover)] transition-colors"
                style={{ padding: '12px' }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'var(--primary-pale)', color: 'var(--primary)' }}
                >
                  <CommandIcon type={cmd.icon} />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium" style={{ color: 'var(--text-primary)', fontSize: '16px' }}>
                      {cmd.label}
                    </span>
                    <code
                      className="text-xs px-1.5 py-0.5 rounded font-mono"
                      style={{ backgroundColor: 'var(--primary-pale)', color: 'var(--primary)' }}
                    >
                      {getCommandString(cmd)}
                    </code>
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {cmd.description}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Actions Section */}
          <div style={{ paddingTop: '24px', paddingBottom: '12px' }}>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
              {t('sections.quickActions')}
            </div>
          </div>
          <div className="space-y-2">
            {actionCommands.map((cmd) => (
              <button
                key={cmd.id}
                onClick={() => onSelectCommand(cmd)}
                className="w-full flex items-center gap-3 rounded-xl active:bg-[var(--bg-hover)] transition-colors"
                style={{ padding: '12px' }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                >
                  <CommandIcon type={cmd.icon} />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium" style={{ color: 'var(--text-primary)', fontSize: '16px' }}>
                      {cmd.label}
                    </span>
                    <code
                      className="text-xs px-1.5 py-0.5 rounded font-mono"
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                    >
                      {getCommandString(cmd)}
                    </code>
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {cmd.description}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Modes Section */}
          <div style={{ paddingTop: '24px', paddingBottom: '12px' }}>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
              {t('sections.modes')}
            </div>
          </div>
          <div className="space-y-2" style={{ paddingBottom: '24px' }}>
            {modeCommands.map((cmd) => (
              <button
                key={cmd.id}
                onClick={() => onSelectCommand(cmd)}
                className="w-full flex items-center gap-3 rounded-xl active:bg-[var(--bg-hover)] transition-colors"
                style={{ padding: '12px' }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                >
                  <CommandIcon type={cmd.icon} />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium" style={{ color: 'var(--text-primary)', fontSize: '16px' }}>
                      {cmd.label}
                    </span>
                    <code
                      className="text-xs px-1.5 py-0.5 rounded font-mono"
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                    >
                      {getCommandString(cmd)}
                    </code>
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {cmd.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
        </div>
      </div>

      {/* Animation keyframes */}
      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );

  // Render via portal to escape backdrop-filter containing block
  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
}
