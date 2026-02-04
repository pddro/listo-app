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
  };
}

type Tab = 'export' | 'import';
type ExportMode = 'idle' | 'generating' | 'quickCode' | 'fullBackup';

export default function BackupTransferModal({
  isOpen,
  onClose,
  lists,
  templates,
  onImport,
  onClearAll,
  translations: t,
}: BackupTransferModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('export');
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

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      document.body.style.overflow = 'hidden';
      // Select all by default
      setSelectedLists(new Set(lists.map((l) => l.id)));
      setSelectedTemplates(new Set(templates.map((t) => t.id)));
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, lists, templates]);

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
    const { lists: selLists, templates: selTemplates } = getSelectedData();
    if (selLists.length === 0 && selTemplates.length === 0) return;

    const payload = createBackupPayload(selLists, selTemplates);
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

  const hasItemsToExport = lists.length > 0 || templates.length > 0;
  const hasSelection = selectedLists.size > 0 || selectedTemplates.size > 0;

  return (
    <div
      className={`backup-modal-overlay ${isOpen ? 'open' : 'closing'}`}
      onClick={handleClose}
    >
      <div
        className={`backup-modal ${isOpen ? 'open' : 'closing'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tabs */}
        <div className="backup-tabs">
          <button
            className={`backup-tab ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('export');
              setExportMode('idle');
            }}
          >
            {t.exportTab}
          </button>
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
                      {/* Lists section */}
                      {lists.length > 0 && (
                        <div className="backup-section">
                          <div className="backup-section-header">
                            <span className="backup-section-title">{t.lists}</span>
                            <button
                              className="backup-select-all"
                              onClick={toggleAllLists}
                            >
                              {selectedLists.size === lists.length ? t.deselectAll : t.selectAll}
                            </button>
                          </div>
                          <div className="backup-item-list">
                            {lists.map((list) => (
                              <label key={list.id} className="backup-item">
                                <input
                                  type="checkbox"
                                  checked={selectedLists.has(list.id)}
                                  onChange={() => toggleList(list.id)}
                                />
                                <span
                                  className="backup-item-color"
                                  style={{ backgroundColor: list.themeColor || '#E75F3E' }}
                                />
                                <span className="backup-item-title">
                                  {list.title || 'Untitled List'}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Templates section */}
                      {templates.length > 0 && (
                        <div className="backup-section">
                          <div className="backup-section-header">
                            <span className="backup-section-title">{t.templates}</span>
                            <button
                              className="backup-select-all"
                              onClick={toggleAllTemplates}
                            >
                              {selectedTemplates.size === templates.length
                                ? t.deselectAll
                                : t.selectAll}
                            </button>
                          </div>
                          <div className="backup-item-list">
                            {templates.map((template) => (
                              <label key={template.id} className="backup-item">
                                <input
                                  type="checkbox"
                                  checked={selectedTemplates.has(template.id)}
                                  onChange={() => toggleTemplate(template.id)}
                                />
                                <span
                                  className="backup-item-color"
                                  style={{
                                    backgroundColor: template.theme?.primary || '#E75F3E',
                                  }}
                                />
                                <span className="backup-item-title">{template.title}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Export buttons */}
                      <div className="backup-buttons">
                        <button
                          className="backup-button primary"
                          onClick={handleQuickTransfer}
                          disabled={!hasSelection}
                        >
                          <span className="backup-button-title">{t.quickTransfer}</span>
                          <span className="backup-button-desc">{t.quickTransferDescription}</span>
                        </button>
                        <button
                          className="backup-button secondary"
                          onClick={handleFullBackup}
                          disabled={!hasSelection}
                        >
                          <span className="backup-button-title">{t.fullBackup}</span>
                          <span className="backup-button-desc">{t.fullBackupDescription}</span>
                        </button>
                      </div>
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
                  <div className="backup-qr">
                    <QRCodeSVG value={fullBackupUrl} size={160} level="L" />
                  </div>
                  <p className="backup-hint">{t.scanWithPhone}</p>
                  <div className="backup-url-container">
                    <input
                      type="text"
                      readOnly
                      value={fullBackupUrl}
                      className="backup-url"
                    />
                    <button
                      className="backup-copy"
                      onClick={() => copyToClipboard(fullBackupUrl, 'link')}
                    >
                      {copied === 'link' ? t.linkCopied : 'Copy'}
                    </button>
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
                  <p className="backup-instruction">{t.scanOrEnter}</p>
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
                    <div className="backup-section">
                      <div className="backup-section-header">
                        <span className="backup-section-title">{t.lists}</span>
                      </div>
                      <div className="backup-item-list">
                        {importPreview.lists.map((list) => {
                          const alreadyExists = existingListIds.has(list.id);
                          return (
                            <label
                              key={list.id}
                              className={`backup-item ${alreadyExists ? 'disabled' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedImportLists.has(list.id)}
                                onChange={() => {
                                  const newSet = new Set(selectedImportLists);
                                  if (newSet.has(list.id)) {
                                    newSet.delete(list.id);
                                  } else {
                                    newSet.add(list.id);
                                  }
                                  setSelectedImportLists(newSet);
                                }}
                                disabled={alreadyExists}
                              />
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
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Preview templates */}
                  {importPreview.templates.length > 0 && (
                    <div className="backup-section">
                      <div className="backup-section-header">
                        <span className="backup-section-title">{t.templates}</span>
                      </div>
                      <div className="backup-item-list">
                        {importPreview.templates.map((template) => {
                          const alreadyExists = existingTemplateIds.has(template.id);
                          return (
                            <label
                              key={template.id}
                              className={`backup-item ${alreadyExists ? 'disabled' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedImportTemplates.has(template.id)}
                                onChange={() => {
                                  const newSet = new Set(selectedImportTemplates);
                                  if (newSet.has(template.id)) {
                                    newSet.delete(template.id);
                                  } else {
                                    newSet.add(template.id);
                                  }
                                  setSelectedImportTemplates(newSet);
                                }}
                                disabled={alreadyExists}
                              />
                              <span
                                className="backup-item-color"
                                style={{
                                  backgroundColor: template.theme?.primary || '#E75F3E',
                                }}
                              />
                              <span className="backup-item-title">{template.title}</span>
                              {alreadyExists && (
                                <span className="backup-item-badge">{t.alreadyHave}</span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="backup-buttons">
                    <button
                      className="backup-button primary"
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
                      className="backup-button secondary"
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
