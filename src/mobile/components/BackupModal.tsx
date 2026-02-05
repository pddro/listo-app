import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { Share } from '@capacitor/share';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { SavedList } from '@/lib/hooks/useRecentLists';
import { PersonalTemplate } from '@/mobile/hooks/usePersonalTemplates';
import {
  BackupList,
  BackupTemplate,
  createBackupPayload,
  generateBackupUrl,
  parseBackupInput,
} from '@/lib/backup';
import { WEB_API } from '@/lib/api';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  lists: SavedList[];
  templates: PersonalTemplate[];
  onImport: (lists: BackupList[], templates: BackupTemplate[]) => void;
  onClearAll: () => void;
}

type Tab = 'export' | 'import';
type ExportState = 'idle' | 'generating' | 'quickCode' | 'fullBackup';

export function BackupModal({
  isOpen,
  onClose,
  lists,
  templates,
  onImport,
  onClearAll,
}: BackupModalProps) {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<Tab>('import');

  // Export state
  const [selectedLists, setSelectedLists] = useState<Set<string>>(new Set());
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [backupCode, setBackupCode] = useState<string | null>(null);
  const [fullBackupUrl, setFullBackupUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  // Import state
  const [importInput, setImportInput] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<{
    lists: BackupList[];
    templates: BackupTemplate[];
  } | null>(null);
  const [selectedImportLists, setSelectedImportLists] = useState<Set<string>>(new Set());
  const [selectedImportTemplates, setSelectedImportTemplates] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<number | null>(null);

  // Danger zone
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // Existing IDs
  const existingListIds = new Set(lists.map((l) => l.id));
  const existingTemplateIds = new Set(templates.map((t) => t.id));

  // Track if we've initialized selection for this modal open
  const [hasInitialized, setHasInitialized] = useState(false);

  // Select all by default when modal opens, but only once per open
  useEffect(() => {
    if (isOpen && !hasInitialized) {
      setSelectedLists(new Set(lists.map((l) => l.id)));
      setSelectedTemplates(new Set(templates.map((t) => t.id)));
      setHasInitialized(true);
    } else if (!isOpen) {
      setHasInitialized(false);
    }
  }, [isOpen, lists, templates, hasInitialized]);

  const handleClose = () => {
    onClose();
    // Reset state after animation
    setTimeout(() => {
      setActiveTab('export');
      setExportState('idle');
      setBackupCode(null);
      setFullBackupUrl(null);
      setExportError(null);
      setImportInput('');
      setImportError(null);
      setImportPreview(null);
      setImportSuccess(null);
      setShowDangerZone(false);
      setConfirmClear(false);
    }, 300);
  };

  const getSelectedData = () => {
    const selectedListsData: BackupList[] = lists
      .filter((l) => selectedLists.has(l.id))
      .map((l) => ({
        id: l.id,
        title: l.title,
        themeColor: l.themeColor,
        themeTextColor: l.themeTextColor,
      }));
    const selectedTemplatesData: BackupTemplate[] = templates
      .filter((t) => selectedTemplates.has(t.id))
      .map((t) => ({
        id: t.id,
        listId: t.listId,
        title: t.title,
        description: t.description,
        category: t.category,
        theme: t.theme,
        itemCount: t.itemCount,
      }));
    return { lists: selectedListsData, templates: selectedTemplatesData };
  };

  // Export error state
  const [exportError, setExportError] = useState<string | null>(null);

  const handleQuickTransfer = async () => {
    const { lists: selLists, templates: selTemplates } = getSelectedData();
    if (selLists.length === 0 && selTemplates.length === 0) return;

    setExportState('generating');
    setExportError(null);

    try {
      console.log('Quick Transfer: calling', WEB_API.backup);
      const response = await fetch(WEB_API.backup, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lists: selLists, templates: selTemplates }),
      });

      console.log('Quick Transfer: response status', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Quick Transfer: error response', errorText);
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Quick Transfer: got code', data.code);
      setBackupCode(data.code);
      setExportState('quickCode');
      Haptics.impact({ style: ImpactStyle.Medium });
    } catch (err) {
      console.error('Quick Transfer: caught error', err);
      setExportError(err instanceof Error ? err.message : 'Failed to generate code');
      setExportState('idle');
    }
  };

  const handleShare = async () => {
    if (!backupCode) return;

    const url = `https://listmango.com/restore?code=${backupCode}`;
    try {
      await Share.share({
        title: 'ListMango Backup',
        text: `${t('backup.yourCode')}: ${backupCode}`,
        url,
      });
    } catch {
      // User cancelled or share failed
    }
  };

  const handleCopyCode = async () => {
    if (!backupCode) return;
    try {
      await navigator.clipboard.writeText(backupCode);
      setCopied('code');
      Haptics.impact({ style: ImpactStyle.Light });
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard failed
    }
  };

  const handleFullBackup = () => {
    // Full backup includes ALL lists and templates
    if (lists.length === 0 && templates.length === 0) return;

    const allLists: BackupList[] = lists.map((l) => ({
      id: l.id,
      title: l.title,
      themeColor: l.themeColor,
      themeTextColor: l.themeTextColor,
    }));
    const allTemplates: BackupTemplate[] = templates.map((t) => ({
      id: t.id,
      listId: t.listId,
      title: t.title,
      description: t.description,
      category: t.category,
      theme: t.theme,
      itemCount: t.itemCount,
    }));

    const payload = createBackupPayload(allLists, allTemplates);
    const url = 'https://listmango.com' + generateBackupUrl(payload);
    setFullBackupUrl(url);
    setExportState('fullBackup');
    Haptics.impact({ style: ImpactStyle.Medium });
  };

  const handleShareFullBackup = async () => {
    if (!fullBackupUrl) return;
    try {
      await Share.share({
        title: t('backup.backupEmailSubject'),
        text: t('backup.backupEmailBody'),
        url: fullBackupUrl,
      });
    } catch {
      // User cancelled or share failed
    }
  };

  const handleCopyLink = async () => {
    if (!fullBackupUrl) return;
    try {
      await navigator.clipboard.writeText(fullBackupUrl);
      setCopied('link');
      Haptics.impact({ style: ImpactStyle.Light });
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard failed
    }
  };

  const handleFetch = async () => {
    const parsed = parseBackupInput(importInput);
    if (!parsed) {
      setImportError(t('backup.invalidBackup'));
      return;
    }

    setIsFetching(true);
    setImportError(null);

    if (parsed.type === 'url') {
      setImportPreview({ lists: parsed.value.lists, templates: parsed.value.templates });
      setSelectedImportLists(
        new Set(parsed.value.lists.filter((l) => !existingListIds.has(l.id)).map((l) => l.id))
      );
      setSelectedImportTemplates(
        new Set(parsed.value.templates.filter((t) => !existingTemplateIds.has(t.id)).map((t) => t.id))
      );
      setIsFetching(false);
    } else {
      try {
        const response = await fetch(`${WEB_API.backup}/${parsed.value}`);
        if (!response.ok) {
          setImportError(t('backup.codeExpired'));
          setIsFetching(false);
          return;
        }

        const { lists: backupLists, templates: backupTemplates } = await response.json();
        setImportPreview({ lists: backupLists, templates: backupTemplates });
        setSelectedImportLists(
          new Set(backupLists.filter((l: BackupList) => !existingListIds.has(l.id)).map((l: BackupList) => l.id))
        );
        setSelectedImportTemplates(
          new Set(
            backupTemplates
              .filter((t: BackupTemplate) => !existingTemplateIds.has(t.id))
              .map((t: BackupTemplate) => t.id)
          )
        );
      } catch {
        setImportError(t('backup.codeExpired'));
      } finally {
        setIsFetching(false);
      }
    }
  };

  const handleImport = () => {
    if (!importPreview) return;

    setIsImporting(true);

    const listsToImport = importPreview.lists.filter((l) => selectedImportLists.has(l.id));
    const templatesToImport = importPreview.templates.filter((t) => selectedImportTemplates.has(t.id));

    onImport(listsToImport, templatesToImport);

    const count = listsToImport.length + templatesToImport.length;
    setImportSuccess(count);
    setIsImporting(false);
    Haptics.impact({ style: ImpactStyle.Medium });

    setTimeout(() => {
      handleClose();
    }, 1500);
  };

  const handleClearAll = () => {
    onClearAll();
    handleClose();
  };

  if (!isOpen) return null;

  const hasItemsToExport = lists.length > 0 || templates.length > 0;
  const hasSelection = selectedLists.size > 0 || selectedTemplates.size > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
      onClick={handleClose}
    >
      <div
        className="w-full"
        style={{
          maxHeight: '85vh',
          borderRadius: '20px 20px 0 0',
          backgroundColor: 'var(--bg-primary)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center" style={{ padding: '12px 0 8px' }}>
          <div style={{ width: '36px', height: '5px', backgroundColor: '#e0e0e0', borderRadius: '3px' }} />
        </div>

        {/* Tabs - hide Export tab if nothing to export */}
        <div className="flex" style={{ borderBottom: '1px solid var(--border-light)', padding: '0 16px' }}>
          {hasItemsToExport && (
            <button
              className="flex-1 font-semibold"
              style={{
                padding: '12px',
                color: activeTab === 'export' ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: activeTab === 'export' ? '2px solid var(--primary)' : '2px solid transparent',
              }}
              onClick={() => { setActiveTab('export'); setExportState('idle'); }}
            >
              {t('backup.exportTab')}
            </button>
          )}
          <button
            className="flex-1 font-semibold"
            style={{
              padding: '12px',
              color: activeTab === 'import' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === 'import' ? '2px solid var(--primary)' : '2px solid transparent',
            }}
            onClick={() => setActiveTab('import')}
          >
            {t('backup.importTab')}
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '16px', maxHeight: '60vh', overflowY: 'auto' }}>
          {activeTab === 'export' && (
            <>
              {exportState === 'idle' && (
                <>
                  {!hasItemsToExport ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 20px' }}>
                      {t('backup.nothingToExport')}
                    </p>
                  ) : (
                    <>
                      {/* Lists */}
                      {lists.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                          <div className="flex justify-between items-center" style={{ marginBottom: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                              {t('backup.lists')}
                            </span>
                            <button
                              onClick={() => {
                                if (selectedLists.size === lists.length) {
                                  setSelectedLists(new Set());
                                } else {
                                  setSelectedLists(new Set(lists.map((l) => l.id)));
                                }
                              }}
                              style={{ fontSize: '13px', color: 'var(--primary)' }}
                            >
                              {selectedLists.size === lists.length ? t('backup.deselectAll') : t('backup.selectAll')}
                            </button>
                          </div>
                          {lists.map((list) => (
                            <label
                              key={list.id}
                              className="flex items-center gap-3"
                              style={{ padding: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '6px' }}
                            >
                              <input
                                type="checkbox"
                                checked={selectedLists.has(list.id)}
                                onChange={() => {
                                  const newSet = new Set(selectedLists);
                                  if (newSet.has(list.id)) newSet.delete(list.id);
                                  else newSet.add(list.id);
                                  setSelectedLists(newSet);
                                }}
                                style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }}
                              />
                              <span
                                style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: list.themeColor || 'var(--primary)' }}
                              />
                              <span style={{ flex: 1, fontSize: '15px', color: 'var(--text-primary)' }}>
                                {list.title || t('home.untitledList')}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}

                      {/* Templates */}
                      {templates.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                          <div className="flex justify-between items-center" style={{ marginBottom: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                              {t('backup.templates')}
                            </span>
                            <button
                              onClick={() => {
                                if (selectedTemplates.size === templates.length) {
                                  setSelectedTemplates(new Set());
                                } else {
                                  setSelectedTemplates(new Set(templates.map((t) => t.id)));
                                }
                              }}
                              style={{ fontSize: '13px', color: 'var(--primary)' }}
                            >
                              {selectedTemplates.size === templates.length ? t('backup.deselectAll') : t('backup.selectAll')}
                            </button>
                          </div>
                          {templates.map((template) => (
                            <label
                              key={template.id}
                              className="flex items-center gap-3"
                              style={{ padding: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '6px' }}
                            >
                              <input
                                type="checkbox"
                                checked={selectedTemplates.has(template.id)}
                                onChange={() => {
                                  const newSet = new Set(selectedTemplates);
                                  if (newSet.has(template.id)) newSet.delete(template.id);
                                  else newSet.add(template.id);
                                  setSelectedTemplates(newSet);
                                }}
                                style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }}
                              />
                              <span
                                style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: template.theme?.primary || 'var(--primary)' }}
                              />
                              <span style={{ flex: 1, fontSize: '15px', color: 'var(--text-primary)' }}>
                                {template.title}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}

                      {/* Quick Transfer Button */}
                      <button
                        onClick={handleQuickTransfer}
                        disabled={!hasSelection}
                        className="w-full font-semibold"
                        style={{
                          padding: '16px',
                          backgroundColor: hasSelection ? 'var(--primary)' : 'var(--bg-secondary)',
                          color: hasSelection ? 'white' : 'var(--text-muted)',
                          borderRadius: '12px',
                          fontSize: '17px',
                        }}
                      >
                        {t('backup.quickTransfer')}
                      </button>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '8px' }}>
                        {t('backup.quickTransferDescription')}
                      </p>

                      {/* Export Error */}
                      {exportError && (
                        <p style={{ fontSize: '13px', color: '#ef4444', textAlign: 'center', marginTop: '12px' }}>
                          {exportError}
                        </p>
                      )}

                      {/* Full Backup Button */}
                      <button
                        onClick={handleFullBackup}
                        className="w-full flex items-center gap-3"
                        style={{
                          marginTop: '16px',
                          padding: '14px 16px',
                          backgroundColor: 'var(--bg-secondary)',
                          borderRadius: '12px',
                          border: '1px solid var(--border-light)',
                        }}
                      >
                        <div style={{ color: 'var(--text-muted)' }}>
                          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                        <div style={{ flex: 1, textAlign: 'left' }}>
                          <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
                            {t('backup.fullBackup')}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {t('backup.fullBackupDescription')}
                          </div>
                        </div>
                        <svg width="16" height="16" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </>
                  )}
                </>
              )}

              {exportState === 'generating' && (
                <div className="flex flex-col items-center" style={{ padding: '40px 20px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      border: '3px solid var(--border-light)',
                      borderTopColor: 'var(--primary)',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                    }}
                  />
                  <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>{t('backup.generating')}</p>
                </div>
              )}

              {exportState === 'quickCode' && backupCode && (
                <div className="flex flex-col items-center" style={{ padding: '20px 0' }}>
                  {/* QR Code */}
                  <div
                    style={{
                      padding: '16px',
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      marginBottom: '16px',
                    }}
                  >
                    <QRCodeSVG
                      value={`https://listmango.com/restore?code=${backupCode}`}
                      size={160}
                      level="M"
                    />
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    {t('backup.scanWithPhone')}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    {t('backup.orEnterCode')}
                  </p>
                  <div
                    style={{
                      padding: '12px 20px',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '10px',
                      marginBottom: '8px',
                    }}
                  >
                    <span style={{ fontSize: '20px', fontWeight: '700', fontFamily: 'monospace', letterSpacing: '2px', color: 'var(--text-primary)' }}>
                      {backupCode}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                    {t('backup.expiresIn')}
                  </p>

                  <div className="flex gap-3 w-full">
                    <button
                      onClick={handleCopyCode}
                      className="flex-1 font-medium"
                      style={{
                        padding: '14px',
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        borderRadius: '10px',
                        border: '1px solid var(--border-light)',
                      }}
                    >
                      {copied === 'code' ? t('backup.codeCopied') : 'Copy'}
                    </button>
                    <button
                      onClick={handleShare}
                      className="flex-1 font-medium"
                      style={{
                        padding: '14px',
                        backgroundColor: 'var(--primary)',
                        color: 'white',
                        borderRadius: '10px',
                      }}
                    >
                      Share
                    </button>
                  </div>

                  <button
                    onClick={() => setExportState('idle')}
                    style={{ marginTop: '16px', color: 'var(--text-muted)', fontSize: '14px' }}
                  >
                    {t('common.back')}
                  </button>
                </div>
              )}

              {exportState === 'fullBackup' && fullBackupUrl && (
                <div className="flex flex-col items-center" style={{ padding: '20px 0' }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
                    <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
                    {t('backup.backupCreated')}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '20px' }}>
                    {t('backup.backupCreatedHint')}
                  </p>

                  <div className="flex gap-3 w-full">
                    <button
                      onClick={handleCopyLink}
                      className="flex-1 font-medium flex items-center justify-center gap-2"
                      style={{
                        padding: '14px',
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        borderRadius: '10px',
                        border: '1px solid var(--border-light)',
                      }}
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth={2} />
                        <path strokeWidth={2} d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                      {copied === 'link' ? t('backup.linkCopied') : t('backup.copyLink')}
                    </button>
                    <button
                      onClick={handleShareFullBackup}
                      className="flex-1 font-medium"
                      style={{
                        padding: '14px',
                        backgroundColor: 'var(--primary)',
                        color: 'white',
                        borderRadius: '10px',
                      }}
                    >
                      Share
                    </button>
                  </div>

                  <button
                    onClick={() => setExportState('idle')}
                    style={{ marginTop: '16px', color: 'var(--text-muted)', fontSize: '14px' }}
                  >
                    {t('common.back')}
                  </button>
                </div>
              )}
            </>
          )}

          {activeTab === 'import' && (
            <>
              {importSuccess !== null ? (
                <div className="flex flex-col items-center" style={{ padding: '40px 20px' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22,4 12,14.01 9,11.01" />
                  </svg>
                  <p style={{ marginTop: '16px', fontSize: '16px', fontWeight: '500', color: '#22c55e' }}>
                    {t('backup.importSuccess').replace('%count%', String(importSuccess))}
                  </p>
                </div>
              ) : !importPreview ? (
                <>
                  {/* Import Hero Section */}
                  <div className="flex flex-col items-center" style={{ marginBottom: '24px' }}>
                    <div
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '16px',
                        backgroundColor: 'var(--bg-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '16px',
                      }}
                    >
                      <svg width="28" height="28" fill="none" stroke="var(--primary)" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
                      {t('backup.importHeroTitle')}
                    </h2>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center' }}>
                      {t('backup.importHeroSubtitle')}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={importInput}
                      onChange={(e) => { setImportInput(e.target.value); setImportError(null); }}
                      placeholder={t('backup.codePlaceholder')}
                      style={{
                        flex: 1,
                        padding: '12px',
                        fontSize: '15px',
                        border: '1px solid var(--border-light)',
                        borderRadius: '10px',
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                      }}
                    />
                    <button
                      onClick={handleFetch}
                      disabled={!importInput.trim() || isFetching}
                      style={{
                        padding: '12px 16px',
                        fontSize: '15px',
                        fontWeight: '500',
                        backgroundColor: 'var(--primary)',
                        color: 'white',
                        borderRadius: '10px',
                        opacity: !importInput.trim() || isFetching ? 0.5 : 1,
                      }}
                    >
                      {isFetching ? '...' : t('backup.fetch')}
                    </button>
                  </div>
                  {importError && (
                    <p style={{ marginTop: '12px', fontSize: '13px', color: '#ef4444' }}>{importError}</p>
                  )}
                </>
              ) : (
                <>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px' }}>
                    {t('backup.preview')}
                  </h3>

                  {/* Preview lists */}
                  {importPreview.lists.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        {t('backup.lists')}
                      </span>
                      {importPreview.lists.map((list) => {
                        const alreadyExists = existingListIds.has(list.id);
                        return (
                          <label
                            key={list.id}
                            className="flex items-center gap-3"
                            style={{
                              padding: '10px',
                              backgroundColor: 'var(--bg-secondary)',
                              borderRadius: '8px',
                              marginTop: '6px',
                              opacity: alreadyExists ? 0.5 : 1,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedImportLists.has(list.id)}
                              disabled={alreadyExists}
                              onChange={() => {
                                const newSet = new Set(selectedImportLists);
                                if (newSet.has(list.id)) newSet.delete(list.id);
                                else newSet.add(list.id);
                                setSelectedImportLists(newSet);
                              }}
                              style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }}
                            />
                            <span
                              style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: list.themeColor || 'var(--primary)' }}
                            />
                            <span style={{ flex: 1, fontSize: '15px', color: 'var(--text-primary)' }}>
                              {list.title || t('home.untitledList')}
                            </span>
                            {alreadyExists && (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', backgroundColor: 'var(--border-light)', padding: '2px 6px', borderRadius: '4px' }}>
                                {t('backup.alreadyHave')}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* Preview templates */}
                  {importPreview.templates.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        {t('backup.templates')}
                      </span>
                      {importPreview.templates.map((template) => {
                        const alreadyExists = existingTemplateIds.has(template.id);
                        return (
                          <label
                            key={template.id}
                            className="flex items-center gap-3"
                            style={{
                              padding: '10px',
                              backgroundColor: 'var(--bg-secondary)',
                              borderRadius: '8px',
                              marginTop: '6px',
                              opacity: alreadyExists ? 0.5 : 1,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedImportTemplates.has(template.id)}
                              disabled={alreadyExists}
                              onChange={() => {
                                const newSet = new Set(selectedImportTemplates);
                                if (newSet.has(template.id)) newSet.delete(template.id);
                                else newSet.add(template.id);
                                setSelectedImportTemplates(newSet);
                              }}
                              style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }}
                            />
                            <span
                              style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: template.theme?.primary || 'var(--primary)' }}
                            />
                            <span style={{ flex: 1, fontSize: '15px', color: 'var(--text-primary)' }}>
                              {template.title}
                            </span>
                            {alreadyExists && (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', backgroundColor: 'var(--border-light)', padding: '2px 6px', borderRadius: '4px' }}>
                                {t('backup.alreadyHave')}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}

                  <button
                    onClick={handleImport}
                    disabled={isImporting || (selectedImportLists.size === 0 && selectedImportTemplates.size === 0)}
                    className="w-full font-semibold"
                    style={{
                      padding: '16px',
                      backgroundColor: (selectedImportLists.size > 0 || selectedImportTemplates.size > 0) ? 'var(--primary)' : 'var(--bg-secondary)',
                      color: (selectedImportLists.size > 0 || selectedImportTemplates.size > 0) ? 'white' : 'var(--text-muted)',
                      borderRadius: '12px',
                      fontSize: '17px',
                    }}
                  >
                    {isImporting
                      ? t('backup.importing')
                      : t('backup.itemsToImport').replace('%count%', String(selectedImportLists.size + selectedImportTemplates.size))}
                  </button>

                  <button
                    onClick={() => { setImportPreview(null); setImportInput(''); }}
                    style={{ width: '100%', marginTop: '12px', padding: '12px', color: 'var(--text-muted)', fontSize: '15px' }}
                  >
                    {t('common.back')}
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {/* Danger Zone */}
        <div style={{ borderTop: '1px solid var(--border-light)', padding: '12px 16px' }}>
          <button
            onClick={() => setShowDangerZone(!showDangerZone)}
            className="w-full flex items-center justify-between"
            style={{ color: 'var(--text-muted)', fontSize: '13px' }}
          >
            {t('backup.dangerZone')}
            <svg
              style={{ width: '16px', height: '16px', transform: showDangerZone ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <polyline points="6,9 12,15 18,9" strokeWidth="2" />
            </svg>
          </button>
          {showDangerZone && (
            <div style={{ marginTop: '12px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                {t('backup.clearAllDataDescription')}
              </p>
              {!confirmClear ? (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="w-full font-medium"
                  style={{
                    padding: '12px',
                    backgroundColor: '#fef2f2',
                    color: '#ef4444',
                    border: '1px solid #fecaca',
                    borderRadius: '10px',
                  }}
                >
                  {t('backup.clearAllData')}
                </button>
              ) : (
                <div style={{ padding: '12px', backgroundColor: '#fef2f2', borderRadius: '10px' }}>
                  <p style={{ fontSize: '13px', color: '#991b1b', marginBottom: '12px', lineHeight: '1.4' }}>
                    {t('backup.clearConfirm')}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmClear(false)}
                      className="flex-1 font-medium"
                      style={{ padding: '10px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', color: 'var(--text-primary)' }}
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      onClick={handleClearAll}
                      className="flex-1 font-medium"
                      style={{ padding: '10px', backgroundColor: '#ef4444', color: 'white', borderRadius: '8px' }}
                    >
                      {t('backup.clearAllData')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Close button */}
        <div style={{ padding: '0 16px 16px' }}>
          <button
            onClick={handleClose}
            className="w-full font-semibold"
            style={{
              padding: '16px',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              borderRadius: '12px',
              fontSize: '17px',
            }}
          >
            {t('common.close')}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
