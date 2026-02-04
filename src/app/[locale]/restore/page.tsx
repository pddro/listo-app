'use client';

import { useState, useEffect, Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { decodeBackup, BackupList, BackupTemplate } from '@/lib/backup';
import { useRecentListsWeb } from '@/lib/hooks/useRecentListsWeb';
import { usePersonalTemplates } from '@/lib/hooks/usePersonalTemplates';

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

  // IDs of items already on device
  const existingListIds = new Set(existingLists.map((l) => l.id));
  const existingTemplateIds = new Set(existingTemplates.map((t) => t.id));

  useEffect(() => {
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
            new Set(payload.lists.filter((l) => !existingListIds.has(l.id)).map((l) => l.id))
          );
          setSelectedTemplates(
            new Set(payload.templates.filter((t) => !existingTemplateIds.has(t.id)).map((t) => t.id))
          );
          setIsLoading(false);
          return;
        } else {
          setError(t('invalidBackup'));
          setIsLoading(false);
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
            return;
          }

          const { lists, templates } = await response.json();
          setBackupData({ lists, templates });
          // Select all that don't already exist
          setSelectedLists(
            new Set(lists.filter((l: BackupList) => !existingListIds.has(l.id)).map((l: BackupList) => l.id))
          );
          setSelectedTemplates(
            new Set(
              templates
                .filter((t: BackupTemplate) => !existingTemplateIds.has(t.id))
                .map((t: BackupTemplate) => t.id)
            )
          );
        } catch (err) {
          console.error('Fetch error:', err);
          setError(t('codeExpired'));
        }
        setIsLoading(false);
        return;
      }

      // No backup data found
      setIsLoading(false);
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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-50">
      {/* Header */}
      <div className="max-w-lg mx-auto px-4 py-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {tCommon('backToHome')}
        </Link>

        <h1 className="text-2xl font-bold text-gray-800 mb-2">{t('importTab')}</h1>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mt-4">
            <p className="text-red-600">{error}</p>
            <Link
              href="/"
              className="mt-4 inline-block text-sm text-orange-600 hover:underline"
            >
              {tCommon('backToHome')}
            </Link>
          </div>
        )}

        {/* No data - redirect hint */}
        {!isLoading && !error && !backupData && (
          <div className="text-center py-20">
            <p className="text-gray-500 mb-4">No backup data found</p>
            <Link
              href="/"
              className="text-orange-600 hover:underline"
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
            <p className="text-lg font-medium text-green-600">
              {t('importSuccess').replace('%count%', String(importSuccess))}
            </p>
          </div>
        )}

        {/* Preview and selection */}
        {!isLoading && !error && backupData && importSuccess === null && (
          <div className="mt-6 space-y-6">
            {/* Lists */}
            {backupData.lists.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {t('lists')}
                </h2>
                <div className="space-y-2">
                  {backupData.lists.map((list) => {
                    const alreadyExists = existingListIds.has(list.id);
                    return (
                      <label
                        key={list.id}
                        className={`flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm cursor-pointer ${
                          alreadyExists ? 'opacity-50' : 'hover:shadow-md'
                        } transition-shadow`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedLists.has(list.id)}
                          onChange={() => {
                            const newSet = new Set(selectedLists);
                            if (newSet.has(list.id)) {
                              newSet.delete(list.id);
                            } else {
                              newSet.add(list.id);
                            }
                            setSelectedLists(newSet);
                          }}
                          disabled={alreadyExists}
                          className="w-5 h-5 rounded accent-orange-500"
                        />
                        <span
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: list.themeColor || '#E75F3E' }}
                        />
                        <span className="flex-1 text-gray-800">
                          {list.title || 'Untitled List'}
                        </span>
                        {alreadyExists && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                            {t('alreadyHave')}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Templates */}
            {backupData.templates.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {t('templates')}
                </h2>
                <div className="space-y-2">
                  {backupData.templates.map((template) => {
                    const alreadyExists = existingTemplateIds.has(template.id);
                    return (
                      <label
                        key={template.id}
                        className={`flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm cursor-pointer ${
                          alreadyExists ? 'opacity-50' : 'hover:shadow-md'
                        } transition-shadow`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTemplates.has(template.id)}
                          onChange={() => {
                            const newSet = new Set(selectedTemplates);
                            if (newSet.has(template.id)) {
                              newSet.delete(template.id);
                            } else {
                              newSet.add(template.id);
                            }
                            setSelectedTemplates(newSet);
                          }}
                          disabled={alreadyExists}
                          className="w-5 h-5 rounded accent-orange-500"
                        />
                        <span
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: template.theme?.primary || '#E75F3E' }}
                        />
                        <span className="flex-1 text-gray-800">{template.title}</span>
                        {alreadyExists && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                            {t('alreadyHave')}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Import button */}
            <button
              onClick={handleImport}
              disabled={
                isImporting ||
                (selectedLists.size === 0 && selectedTemplates.size === 0)
              }
              className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
            >
              {isImporting
                ? t('importing')
                : t('itemsToImport').replace(
                    '%count%',
                    String(selectedLists.size + selectedTemplates.size)
                  )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RestorePageLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-50">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
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
