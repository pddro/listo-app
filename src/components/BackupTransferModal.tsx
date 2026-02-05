'use client';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  BackupList,
  BackupTemplate,
  createBackupPayload,
  generateBackupUrl,
  parseBackupInput,
} from '@/lib/backup';
import './BackupTransferModal.css';

interface BackupTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  lists: BackupList[];
  templates: BackupTemplate[];
  onImport: (lists: BackupList[], templates: BackupTemplate[]) => void;
  onClearAll: () => void;
  translations: {
    exportTab: string;
    importTab: string;
    selectAll: string;
    deselectAll: string;
    quickTransfer: string;
    quickTransferDescription: string;
    fullBackup: string;
    fullBackupDescription: string;
    yourCode: string;
    scanOrEnter: string;
    codePlaceholder: string;
    preview: string;
    importing: string;
    importSelected: string;
    itemsToImport: string;
    alreadyHave: string;
    clearAllData: string;
    clearConfirm: string;
    cleared: string;
    codeExpired: string;
    invalidBackup: string;
    importSuccess: string;
    nothingToExport: string;
    lists: string;
    selectListsToShare: string;
    templates: string;
    generating: string;
    codeCopied: string;
    linkCopied: string;
    expiresIn: string;
    scanWithPhone: string;
    orEnterCode: string;
    fetch: string;
    fetching: string;
    dangerZone: string;
    clearAllDataDescription: string;
    // New translations for improved UX
    exportHeroTitle: string;
    exportHeroSubtitle: string;
    importHeroTitle: string;
    importHeroSubtitle: string;
    selectedCount: string;
    // Full backup translations
    backupCreated: string;
    backupCreatedHint: string;
    copyLink: string;
    emailToSelf: string;
    backupEmailSubject: string;
    backupEmailBody: string;
  };
}

type Tab = 'export' | 'import';
type ExportMode = 'idle' | 'generating' | 'quickCode' | 'fullBackup';

// Custom checkbox component matching app style
function Checkbox({ checked }: { checked: boolean }) {
  return (
    <div className={`backup-checkbox ${checked ? 'checked' : ''}`}>
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
      </svg>
    </div>
  );
}

export default function BackupTransferModal({
  isOpen,
  onClose,
  lists,
  templates,
  onImport,
  onClearAll,
  translations: t,
}: BackupTransferModalProps) {
  const hasItemsToExport = lists.length > 0 || templates.length > 0;
  // Initialize with 'import' to avoid hydration mismatch (lists come from localStorage)
  const [activeTab, setActiveTab] = useState<Tab>('import');
  const [isAnimating, setIsAnimating] = useState(false);

  // Export state
  const [selectedLists, setSelectedLists] = useState<Set<string>>(new Set());
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [exportMode, setExportMode] = useState<ExportMode>('idle');
  const [quickCode, setQuickCode] = useState<string | null>(null);
  const [quickCodeExpiry, setQuickCodeExpiry] = useState<Date | null>(null);
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

  // Danger zone state
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // Existing list/template IDs for deduplication
  const existingListIds = new Set(lists.map((l) => l.id));
  const existingTemplateIds = new Set(templates.map((t) => t.id));

  // Track if we've initialized selection for this modal open
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      document.body.style.overflow = 'hidden';
      // Select all by default, but only on first open
      if (!hasInitialized) {
        setSelectedLists(new Set(lists.map((l) => l.id)));
        setSelectedTemplates(new Set(templates.map((t) => t.id)));
        // Set active tab based on whether there are items to export
        setActiveTab(hasItemsToExport ? 'export' : 'import');
        setHasInitialized(true);
      }
    } else {
      document.body.style.overflow = '';
      setHasInitialized(false);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, lists, templates, hasInitialized, hasItemsToExport]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      onClose();
      // Reset state
      setActiveTab('export');
      setExportMode('idle');
      setQuickCode(null);
      setFullBackupUrl(null);
      setImportInput('');
      setImportError(null);
      setImportPreview(null);
      setImportSuccess(null);
      setShowDangerZone(false);
      setConfirmClear(false);
    }, 200);
  };

  const toggleAllLists = () => {
    if (selectedLists.size === lists.length) {
      setSelectedLists(new Set());
    } else {
      setSelectedLists(new Set(lists.map((l) => l.id)));
    }
  };

  const toggleAllTemplates = () => {
    if (selectedTemplates.size === templates.length) {
      setSelectedTemplates(new Set());
    } else {
      setSelectedTemplates(new Set(templates.map((t) => t.id)));
    }
  };

  const toggleList = (id: string) => {
    const newSet = new Set(selectedLists);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedLists(newSet);
  };

  const toggleTemplate = (id: string) => {
    const newSet = new Set(selectedTemplates);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedTemplates(newSet);
  };

  const getSelectedData = () => {
    const selectedListsData = lists.filter((l) => selectedLists.has(l.id));
    const selectedTemplatesData = templates.filter((t) => selectedTemplates.has(t.id));
    return { lists: selectedListsData, templates: selectedTemplatesData };
  };

  const handleQuickTransfer = async () => {
    const { lists: selLists, templates: selTemplates } = getSelectedData();
    if (selLists.length === 0 && selTemplates.length === 0) return;

    setExportMode('generating');

    try {
      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lists: selLists, templates: selTemplates }),
      });

      if (!response.ok) {
        throw new Error('Failed to create backup code');
      }

      const { code, expiresAt } = await response.json();
      setQuickCode(code);
      setQuickCodeExpiry(new Date(expiresAt));
      setExportMode('quickCode');
    } catch (error) {
      console.error('Quick transfer error:', error);
      setExportMode('idle');
    }
  };

  const handleFullBackup = () => {
    // Full backup always includes ALL lists and templates, regardless of selection
    if (lists.length === 0 && templates.length === 0) return;

    const payload = createBackupPayload(lists, templates);
    const url = window.location.origin + generateBackupUrl(payload);
    setFullBackupUrl(url);
    setExportMode('fullBackup');
  };

  const copyToClipboard = async (text: string, type: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  const handleFetchCode = async () => {
    const parsed = parseBackupInput(importInput);
    if (!parsed) {
      setImportError(t.invalidBackup);
      return;
    }

    setIsFetching(true);
    setImportError(null);

    if (parsed.type === 'url') {
      // Already decoded from URL
      setImportPreview({
        lists: parsed.value.lists,
        templates: parsed.value.templates,
      });
      // Select all that don't already exist
      setSelectedImportLists(
        new Set(parsed.value.lists.filter((l) => !existingListIds.has(l.id)).map((l) => l.id))
      );
      setSelectedImportTemplates(
        new Set(parsed.value.templates.filter((t) => !existingTemplateIds.has(t.id)).map((t) => t.id))
      );
      setIsFetching(false);
    } else {
      // Fetch from API
      try {
        const response = await fetch(`/api/backup/${parsed.value}`);
        if (!response.ok) {
          const data = await response.json();
          setImportError(data.error || t.codeExpired);
          setIsFetching(false);
          return;
        }

        const { lists: backupLists, templates: backupTemplates } = await response.json();
        setImportPreview({ lists: backupLists, templates: backupTemplates });
        // Select all that don't already exist
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
      } catch (error) {
        console.error('Fetch error:', error);
        setImportError(t.codeExpired);
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

    // Reset after showing success
    setTimeout(() => {
      setImportPreview(null);
      setImportInput('');
      setImportSuccess(null);
    }, 2000);
  };

  const handleClearAll = () => {
    onClearAll();
    setConfirmClear(false);
    handleClose();
  };

  if (!isOpen && !isAnimating) return null;

  const hasSelection = selectedLists.size > 0 || selectedTemplates.size > 0;
  const totalSelected = selectedLists.size + selectedTemplates.size;

  return (
    <div
      className={`backup-modal-overlay ${isOpen ? 'open' : 'closing'}`}
      onClick={handleClose}
    >
      <div
        className={`backup-modal ${isOpen ? 'open' : 'closing'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tabs - only show Export tab if there are items to export */}
        <div className="backup-tabs">
          {hasItemsToExport && (
            <button
              className={`backup-tab ${activeTab === 'export' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('export');
                setExportMode('idle');
              }}
            >
              {t.exportTab}
            </button>
          )}
          <button
            className={`backup-tab ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            {t.importTab}
          </button>
        </div>

        {/* Content */}
        <div className="backup-content">
          {activeTab === 'export' && (
            <>
              {exportMode === 'idle' && (
                <>
                  {!hasItemsToExport ? (
                    <p className="backup-empty">{t.nothingToExport}</p>
                  ) : (
                    <>
                      {/* Primary action - Quick Transfer */}
                      <button
                        className="backup-primary-action"
                        onClick={handleQuickTransfer}
                        disabled={!hasSelection}
                      >
                        <div className="backup-primary-action-content">
                          <div className="backup-primary-action-icon">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                            </svg>
                          </div>
                          <div className="backup-primary-action-text">
                            <div className="backup-primary-action-title">{t.quickTransfer}</div>
                            <div className="backup-primary-action-desc">{t.quickTransferDescription}</div>
                          </div>
                          <div className="backup-primary-action-arrow">
                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </button>

                      {/* Lists section */}
                      {lists.length > 0 && (
                        <>
                          <div className="backup-selection-header">
                            <span className="backup-selection-label">{t.selectListsToShare}</span>
                            <button className="backup-select-toggle" onClick={toggleAllLists}>
                              {selectedLists.size === lists.length ? t.deselectAll : t.selectAll}
                            </button>
                          </div>
                          <div className="backup-item-list">
                            {lists.map((list) => (
                              <div
                                key={list.id}
                                className="backup-item"
                                onClick={() => toggleList(list.id)}
                              >
                                <Checkbox checked={selectedLists.has(list.id)} />
                                <span
                                  className="backup-item-color"
                                  style={{ backgroundColor: list.themeColor || '#E75F3E' }}
                                />
                                <span className="backup-item-title">
                                  {list.title || 'Untitled List'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {/* Templates section */}
                      {templates.length > 0 && (
                        <>
                          <div className="backup-selection-header">
                            <span className="backup-selection-label">{t.templates}</span>
                            <button className="backup-select-toggle" onClick={toggleAllTemplates}>
                              {selectedTemplates.size === templates.length ? t.deselectAll : t.selectAll}
                            </button>
                          </div>
                          <div className="backup-item-list">
                            {templates.map((template) => (
                              <div
                                key={template.id}
                                className="backup-item"
                                onClick={() => toggleTemplate(template.id)}
                              >
                                <Checkbox checked={selectedTemplates.has(template.id)} />
                                <span
                                  className="backup-item-color"
                                  style={{ backgroundColor: template.theme?.primary || '#E75F3E' }}
                                />
                                <span className="backup-item-title">{template.title}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {/* Secondary action - Full Backup */}
                      <button
                        className="backup-secondary-action"
                        onClick={handleFullBackup}
                        disabled={!hasSelection}
                      >
                        <div className="backup-secondary-action-icon">
                          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                        <div className="backup-secondary-action-text">
                          <span className="backup-secondary-action-title">{t.fullBackup}</span>
                          <span className="backup-secondary-action-desc">{t.fullBackupDescription}</span>
                        </div>
                        <div className="backup-secondary-action-arrow">
                          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    </>
                  )}
                </>
              )}

              {exportMode === 'generating' && (
                <div className="backup-generating">
                  <div className="backup-spinner" />
                  <p>{t.generating}</p>
                </div>
              )}

              {exportMode === 'quickCode' && quickCode && (
                <div className="backup-result">
                  <div className="backup-qr">
                    <QRCodeSVG
                      value={`${window.location.origin}/restore?code=${quickCode}`}
                      size={160}
                      level="M"
                    />
                  </div>
                  <p className="backup-hint">{t.scanWithPhone}</p>
                  <p className="backup-or">{t.orEnterCode}</p>
                  <div className="backup-code-display">
                    <span className="backup-code">{quickCode}</span>
                    <button
                      className="backup-copy"
                      onClick={() => copyToClipboard(quickCode, 'code')}
                    >
                      {copied === 'code' ? t.codeCopied : 'Copy'}
                    </button>
                  </div>
                  <p className="backup-expiry">{t.expiresIn}</p>
                  <button
                    className="backup-back"
                    onClick={() => setExportMode('idle')}
                  >
                    Back
                  </button>
                </div>
              )}

              {exportMode === 'fullBackup' && fullBackupUrl && (
                <div className="backup-result">
                  <div className="backup-vault-icon">
                    <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="backup-result-title">{t.backupCreated}</h3>
                  <p className="backup-result-hint">{t.backupCreatedHint}</p>

                  <div className="backup-url-container">
                    <input
                      type="text"
                      readOnly
                      value={fullBackupUrl}
                      className="backup-url"
                    />
                  </div>

                  <div className="backup-action-buttons">
                    <button
                      className="backup-action-button primary"
                      onClick={() => copyToClipboard(fullBackupUrl, 'link')}
                    >
                      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth={2} />
                        <path strokeWidth={2} d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                      {copied === 'link' ? t.linkCopied : t.copyLink}
                    </button>
                    <a
                      href={`mailto:?subject=${encodeURIComponent(t.backupEmailSubject)}&body=${encodeURIComponent(t.backupEmailBody + '\n\n' + fullBackupUrl)}`}
                      className="backup-action-button secondary"
                    >
                      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {t.emailToSelf}
                    </a>
                  </div>

                  <button
                    className="backup-back"
                    onClick={() => setExportMode('idle')}
                  >
                    Back
                  </button>
                </div>
              )}
            </>
          )}

          {activeTab === 'import' && (
            <>
              {importSuccess !== null ? (
                <div className="backup-success">
                  <div className="backup-success-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22,4 12,14.01 9,11.01" />
                    </svg>
                  </div>
                  <p>{t.importSuccess.replace('%count%', String(importSuccess))}</p>
                </div>
              ) : !importPreview ? (
                <>
                  {/* Hero section for import */}
                  <div className="backup-hero">
                    <div className="backup-hero-icon">
                      <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </div>
                    <h2 className="backup-hero-title">{t.importHeroTitle}</h2>
                    <p className="backup-hero-subtitle">{t.importHeroSubtitle}</p>
                  </div>

                  <div className="backup-input-group">
                    <input
                      type="text"
                      value={importInput}
                      onChange={(e) => {
                        setImportInput(e.target.value);
                        setImportError(null);
                      }}
                      placeholder={t.codePlaceholder}
                      className="backup-input"
                    />
                    <button
                      className="backup-fetch"
                      onClick={handleFetchCode}
                      disabled={!importInput.trim() || isFetching}
                    >
                      {isFetching ? t.fetching : t.fetch}
                    </button>
                  </div>
                  {importError && <p className="backup-error">{importError}</p>}
                </>
              ) : (
                <>
                  <h3 className="backup-preview-title">{t.preview}</h3>

                  {/* Preview lists */}
                  {importPreview.lists.length > 0 && (
                    <>
                      <div className="backup-selection-header">
                        <span className="backup-selection-label">{t.lists}</span>
                      </div>
                      <div className="backup-item-list">
                        {importPreview.lists.map((list) => {
                          const alreadyExists = existingListIds.has(list.id);
                          return (
                            <div
                              key={list.id}
                              className={`backup-item ${alreadyExists ? 'disabled' : ''}`}
                              onClick={() => {
                                if (alreadyExists) return;
                                const newSet = new Set(selectedImportLists);
                                if (newSet.has(list.id)) {
                                  newSet.delete(list.id);
                                } else {
                                  newSet.add(list.id);
                                }
                                setSelectedImportLists(newSet);
                              }}
                            >
                              <Checkbox checked={selectedImportLists.has(list.id)} />
                              <span
                                className="backup-item-color"
                                style={{ backgroundColor: list.themeColor || '#E75F3E' }}
                              />
                              <span className="backup-item-title">
                                {list.title || 'Untitled List'}
                              </span>
                              {alreadyExists && (
                                <span className="backup-item-badge">{t.alreadyHave}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* Preview templates */}
                  {importPreview.templates.length > 0 && (
                    <>
                      <div className="backup-selection-header">
                        <span className="backup-selection-label">{t.templates}</span>
                      </div>
                      <div className="backup-item-list">
                        {importPreview.templates.map((template) => {
                          const alreadyExists = existingTemplateIds.has(template.id);
                          return (
                            <div
                              key={template.id}
                              className={`backup-item ${alreadyExists ? 'disabled' : ''}`}
                              onClick={() => {
                                if (alreadyExists) return;
                                const newSet = new Set(selectedImportTemplates);
                                if (newSet.has(template.id)) {
                                  newSet.delete(template.id);
                                } else {
                                  newSet.add(template.id);
                                }
                                setSelectedImportTemplates(newSet);
                              }}
                            >
                              <Checkbox checked={selectedImportTemplates.has(template.id)} />
                              <span
                                className="backup-item-color"
                                style={{ backgroundColor: template.theme?.primary || '#E75F3E' }}
                              />
                              <span className="backup-item-title">{template.title}</span>
                              {alreadyExists && (
                                <span className="backup-item-badge">{t.alreadyHave}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  <div className="backup-import-buttons">
                    <button
                      className="backup-import-button primary"
                      onClick={handleImport}
                      disabled={
                        isImporting ||
                        (selectedImportLists.size === 0 && selectedImportTemplates.size === 0)
                      }
                    >
                      {isImporting
                        ? t.importing
                        : t.itemsToImport.replace(
                            '%count%',
                            String(selectedImportLists.size + selectedImportTemplates.size)
                          )}
                    </button>
                    <button
                      className="backup-import-button secondary"
                      onClick={() => {
                        setImportPreview(null);
                        setImportInput('');
                      }}
                    >
                      Back
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Danger Zone */}
        <div className="backup-danger-zone">
          <button
            className="backup-danger-toggle"
            onClick={() => setShowDangerZone(!showDangerZone)}
          >
            {t.dangerZone}
            <svg
              className={`backup-chevron ${showDangerZone ? 'open' : ''}`}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6,9 12,15 18,9" />
            </svg>
          </button>
          {showDangerZone && (
            <div className="backup-danger-content">
              <p className="backup-danger-desc">{t.clearAllDataDescription}</p>
              {!confirmClear ? (
                <button
                  className="backup-clear-button"
                  onClick={() => setConfirmClear(true)}
                >
                  {t.clearAllData}
                </button>
              ) : (
                <div className="backup-confirm">
                  <p className="backup-confirm-text">{t.clearConfirm}</p>
                  <div className="backup-confirm-buttons">
                    <button className="backup-confirm-yes" onClick={handleClearAll}>
                      {t.clearAllData}
                    </button>
                    <button
                      className="backup-confirm-no"
                      onClick={() => setConfirmClear(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Close button */}
        <button className="backup-close" onClick={handleClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
