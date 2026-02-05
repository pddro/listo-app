'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { decodeBackup, BackupList, BackupTemplate } from '@/lib/backup';
import { useRecentListsWeb } from '@/lib/hooks/useRecentListsWeb';
import { usePersonalTemplates } from '@/lib/hooks/usePersonalTemplates';

// Custom checkbox matching app style
function Checkbox({ checked, disabled }: { checked: boolean; disabled?: boolean }) {
  return (
    <div
      className="flex items-center justify-center transition-all"
      style={{
        width: '22px',
        height: '22px',
        borderRadius: '6px',
        border: '2px solid',
        borderColor: checked ? 'var(--primary)' : 'var(--border-medium)',
        backgroundColor: checked ? 'var(--primary)' : 'transparent',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {checked && (
        <svg width="12" height="12" fill="none" stroke="white" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
  );
}

function RestorePageContent() {
  const t = useTranslations('backup');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get code from query param
  const codeParam = searchParams.get('code');

  const { lists: existingLists, addList } = useRecentListsWeb();
  const { templates: existingTemplates, addTemplate } = usePersonalTemplates();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backupData, setBackupData] = useState<{
    lists: BackupList[];
    templates: BackupTemplate[];
  } | null>(null);
  const [selectedLists, setSelectedLists] = useState<Set<string>>(new Set());
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<number | null>(null);

  // Track if we've already loaded to prevent infinite loop
  const hasLoadedRef = useRef(false);

  // IDs of items already on device - memoize to prevent recreation
  const existingListIds = useRef(new Set<string>());
  const existingTemplateIds = useRef(new Set<string>());

  // Update refs when lists change
  useEffect(() => {
    existingListIds.current = new Set(existingLists.map((l) => l.id));
    existingTemplateIds.current = new Set(existingTemplates.map((t) => t.id));
  }, [existingLists, existingTemplates]);

  useEffect(() => {
    // Only run once
    if (hasLoadedRef.current) return;

    const loadBackup = async () => {
      setIsLoading(true);
      setError(null);

      // Check for hash-encoded full backup first
      const hash = window.location.hash.slice(1);
      if (hash && hash.startsWith('LM1:')) {
        const payload = decodeBackup(hash);
        if (payload) {
          setBackupData({ lists: payload.lists, templates: payload.templates });
          // Select all that don't already exist
          setSelectedLists(
            new Set(payload.lists.filter((l) => !existingListIds.current.has(l.id)).map((l) => l.id))
          );
          setSelectedTemplates(
            new Set(payload.templates.filter((t) => !existingTemplateIds.current.has(t.id)).map((t) => t.id))
          );
          setIsLoading(false);
          hasLoadedRef.current = true;
          return;
        } else {
          setError(t('invalidBackup'));
          setIsLoading(false);
          hasLoadedRef.current = true;
          return;
        }
      }

      // Check for code param
      if (codeParam) {
        try {
          const response = await fetch(`/api/backup/${codeParam}`);
          if (!response.ok) {
            const data = await response.json();
            setError(data.error || t('codeExpired'));
            setIsLoading(false);
            hasLoadedRef.current = true;
            return;
          }

          const { lists, templates } = await response.json();
          setBackupData({ lists, templates });
          // Select all that don't already exist
          setSelectedLists(
            new Set(lists.filter((l: BackupList) => !existingListIds.current.has(l.id)).map((l: BackupList) => l.id))
          );
          setSelectedTemplates(
            new Set(
              templates
                .filter((t: BackupTemplate) => !existingTemplateIds.current.has(t.id))
                .map((t: BackupTemplate) => t.id)
            )
          );
        } catch (err) {
          console.error('Fetch error:', err);
          setError(t('codeExpired'));
        }
        setIsLoading(false);
        hasLoadedRef.current = true;
        return;
      }

      // No backup data found
      setIsLoading(false);
      hasLoadedRef.current = true;
    };

    // Only run once existing data is loaded
    if (existingLists !== undefined && existingTemplates !== undefined) {
      loadBackup();
    }
  }, [codeParam, existingLists, existingTemplates, t]);

  const handleImport = () => {
    if (!backupData) return;

    setIsImporting(true);

    const listsToImport = backupData.lists.filter((l) => selectedLists.has(l.id));
    const templatesToImport = backupData.templates.filter((t) => selectedTemplates.has(t.id));

    // Import lists
    for (const list of listsToImport) {
      addList(list.id, list.title, list.themeColor);
    }

    // Import templates
    for (const template of templatesToImport) {
      addTemplate({
        listId: template.listId,
        title: template.title,
        description: template.description,
        category: template.category,
        themeColor: template.theme?.primary || null,
        theme: template.theme,
        itemCount: template.itemCount,
      });
    }

    const count = listsToImport.length + templatesToImport.length;
    setImportSuccess(count);
    setIsImporting(false);

    // Redirect to home after delay
    setTimeout(() => {
      router.push('/');
    }, 2000);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center"
      style={{ backgroundColor: 'var(--bg-secondary)' }}
    >
      {/* Centered container */}
      <div className="w-full max-w-md px-6 pt-4 pb-16">
        {/* Branding */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-block">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              ListMango 🥭
            </h1>
          </Link>
        </div>

        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm transition-colors hover:opacity-70"
          style={{ color: 'var(--text-muted)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {tCommon('backToHome')}
        </Link>

        <h2
          className="text-xl font-semibold"
          style={{ color: 'var(--text-primary)', marginTop: '24px', marginBottom: '8px' }}
        >
          {t('importHeroTitle')}
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
          {t('importHeroSubtitle')}
        </p>

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div
              className="w-10 h-10 border-3 rounded-full animate-spin"
              style={{
                borderWidth: '3px',
                borderColor: 'var(--border-medium)',
                borderTopColor: 'var(--primary)',
              }}
            />
            <p className="mt-4" style={{ color: 'var(--text-muted)' }}>
              {t('fetching')}
            </p>
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div
            className="rounded-xl p-4 mt-6"
            style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}
          >
            <p style={{ color: '#dc2626' }}>{error}</p>
            <Link
              href="/"
              className="mt-4 inline-block text-sm hover:underline"
              style={{ color: 'var(--primary)' }}
            >
              {tCommon('backToHome')}
            </Link>
          </div>
        )}

        {/* No data - redirect hint */}
        {!isLoading && !error && !backupData && (
          <div className="text-center py-20">
            <p style={{ color: 'var(--text-muted)' }} className="mb-4">
              No backup data found
            </p>
            <Link
              href="/"
              className="hover:underline"
              style={{ color: 'var(--primary)' }}
            >
              {tCommon('backToHome')}
            </Link>
          </div>
        )}

        {/* Import success */}
        {importSuccess !== null && (
          <div className="flex flex-col items-center py-16">
            <div className="mb-4">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22,4 12,14.01 9,11.01" />
              </svg>
            </div>
            <p className="text-lg font-medium" style={{ color: '#22c55e' }}>
              {t('importSuccess').replace('%count%', String(importSuccess))}
            </p>
          </div>
        )}

        {/* Preview and selection */}
        {!isLoading && !error && backupData && importSuccess === null && (
          <div style={{ marginTop: '32px' }}>
            {/* Lists */}
            {backupData.lists.length > 0 && (
              <div>
                <h2
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)', marginBottom: '16px' }}
                >
                  {t('selectListMangos')}
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {backupData.lists.map((list) => {
                    const alreadyExists = existingListIds.current.has(list.id);
                    return (
                      <div
                        key={list.id}
                        onClick={() => {
                          if (alreadyExists) return;
                          const newSet = new Set(selectedLists);
                          if (newSet.has(list.id)) {
                            newSet.delete(list.id);
                          } else {
                            newSet.add(list.id);
                          }
                          setSelectedLists(newSet);
                        }}
                        className={`flex items-center gap-4 rounded-xl transition-all ${
                          alreadyExists ? 'opacity-50 cursor-default' : 'cursor-pointer hover:shadow-md'
                        }`}
                        style={{
                          padding: '14px 16px',
                          backgroundColor: 'var(--bg-primary)',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                        }}
                      >
                        <Checkbox checked={selectedLists.has(list.id)} disabled={alreadyExists} />
                        <span
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: list.themeColor || 'var(--primary)', flexShrink: 0 }}
                        />
                        <span className="flex-1 text-[15px]" style={{ color: 'var(--text-primary)' }}>
                          {list.title || 'Untitled List'}
                        </span>
                        {alreadyExists && (
                          <span
                            className="text-xs px-2 py-1 rounded"
                            style={{
                              color: 'var(--text-muted)',
                              backgroundColor: 'var(--bg-secondary)',
                            }}
                          >
                            {t('alreadyHave')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Templates */}
            {backupData.templates.length > 0 && (
              <div style={{ marginTop: '32px' }}>
                <h2
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)', marginBottom: '16px' }}
                >
                  {t('templates')}
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {backupData.templates.map((template) => {
                    const alreadyExists = existingTemplateIds.current.has(template.id);
                    return (
                      <div
                        key={template.id}
                        onClick={() => {
                          if (alreadyExists) return;
                          const newSet = new Set(selectedTemplates);
                          if (newSet.has(template.id)) {
                            newSet.delete(template.id);
                          } else {
                            newSet.add(template.id);
                          }
                          setSelectedTemplates(newSet);
                        }}
                        className={`flex items-center gap-4 rounded-xl transition-all ${
                          alreadyExists ? 'opacity-50 cursor-default' : 'cursor-pointer hover:shadow-md'
                        }`}
                        style={{
                          padding: '14px 16px',
                          backgroundColor: 'var(--bg-primary)',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                        }}
                      >
                        <Checkbox checked={selectedTemplates.has(template.id)} disabled={alreadyExists} />
                        <span
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: template.theme?.primary || 'var(--primary)', flexShrink: 0 }}
                        />
                        <span className="flex-1 text-[15px]" style={{ color: 'var(--text-primary)' }}>
                          {template.title}
                        </span>
                        {alreadyExists && (
                          <span
                            className="text-xs px-2 py-1 rounded"
                            style={{
                              color: 'var(--text-muted)',
                              backgroundColor: 'var(--bg-secondary)',
                            }}
                          >
                            {t('alreadyHave')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Import button */}
            <div style={{ marginTop: '32px' }}>
              <button
                onClick={handleImport}
                disabled={
                  isImporting ||
                  (selectedLists.size === 0 && selectedTemplates.size === 0)
                }
                className="w-full font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  padding: '18px 24px',
                  fontSize: '16px',
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                }}
              >
                {isImporting
                  ? t('importing')
                  : t('importMangos').replace(
                      '%count%',
                      String(selectedLists.size + selectedTemplates.size)
                    )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RestorePageLoading() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--bg-secondary)' }}
    >
      <div className="max-w-md mx-auto px-5 py-8">
        <div className="flex flex-col items-center justify-center py-20">
          <div
            className="w-10 h-10 rounded-full animate-spin"
            style={{
              borderWidth: '3px',
              borderStyle: 'solid',
              borderColor: 'var(--border-medium)',
              borderTopColor: 'var(--primary)',
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function RestorePage() {
  return (
    <Suspense fallback={<RestorePageLoading />}>
      <RestorePageContent />
    </Suspense>
  );
}
