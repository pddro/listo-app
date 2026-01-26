'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { TemplateWithItems } from '@/types';

type TabStatus = 'pending' | 'processing' | 'approved' | 'rejected';

interface TemplateListItem {
  id: string;
  title: string;
  template_description: string | null;
  template_category: string;
  language: string;
  theme: { primary?: string } | null;
  use_count: number;
  is_official: boolean;
  status: string;
  created_at: string;
  item_count: number;
}

const TAB_CONFIG: { key: TabStatus; label: string; color: string }[] = [
  { key: 'pending', label: 'Pending', color: 'amber' },
  { key: 'processing', label: 'Processing', color: 'blue' },
  { key: 'approved', label: 'Approved', color: 'green' },
  { key: 'rejected', label: 'Rejected', color: 'red' },
];

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function AdminTemplatesContent() {
  const searchParams = useSearchParams();
  const secret = searchParams.get('secret') || '';

  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabStatus>('pending');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateWithItems | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // AI Generator state
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<{
    title: string;
    item_count: number;
  } | null>(null);

  // Fetch templates by status
  const fetchTemplates = useCallback(async () => {
    if (!secret) {
      setError('Secret required');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/templates?secret=${encodeURIComponent(secret)}&status=${activeTab}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch templates');
      }

      setTemplates(data.templates || []);
    } catch (err) {
      console.error('Fetch templates error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  }, [secret, activeTab]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Auto-refresh processing tab every 5 seconds
  useEffect(() => {
    if (activeTab === 'processing') {
      const interval = setInterval(fetchTemplates, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab, fetchTemplates]);

  // Fetch single template detail
  const fetchTemplateDetail = async (templateId: string) => {
    setSelectedId(templateId);
    setIsLoadingDetail(true);
    try {
      const response = await fetch(
        `/api/admin/templates/${templateId}?secret=${encodeURIComponent(secret)}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch template');
      }

      setSelectedTemplate(data.template);
    } catch (err) {
      console.error('Fetch template detail error:', err);
      setSelectedTemplate(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Approve or reject template
  const handleAction = async (templateId: string, action: 'approve' | 'reject') => {
    setActionLoading(templateId);
    try {
      const response = await fetch(
        `/api/admin/templates/${templateId}?secret=${encodeURIComponent(secret)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update template');
      }

      // Remove from current list and clear selection
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      if (selectedId === templateId) {
        setSelectedTemplate(null);
        setSelectedId(null);
      }
    } catch (err) {
      console.error('Action error:', err);
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  // Delete template
  const handleDelete = async (templateId: string) => {
    if (!confirm('Delete this template permanently?')) return;

    setActionLoading(templateId);
    try {
      const response = await fetch(
        `/api/admin/templates/${templateId}?secret=${encodeURIComponent(secret)}`,
        { method: 'DELETE' }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete template');
      }

      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      if (selectedId === templateId) {
        setSelectedTemplate(null);
        setSelectedId(null);
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setActionLoading(null);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== 'pending' || !selectedTemplate) return;

      if (e.key === 'a' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleAction(selectedTemplate.id, 'approve');
      } else if (e.key === 'r' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleAction(selectedTemplate.id, 'reject');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, selectedTemplate]);

  // Generate template with AI
  const handleGenerate = async () => {
    if (!aiPrompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setGenerateResult(null);

    try {
      const response = await fetch(
        `/api/admin/templates/generate?secret=${encodeURIComponent(secret)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: aiPrompt }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Generation failed');
      }

      setGenerateResult({
        title: data.title,
        item_count: data.item_count,
      });
      setAiPrompt('');

      // Refresh the pending list to show the new template
      if (activeTab === 'pending') {
        fetchTemplates();
      }
    } catch (err) {
      console.error('Generate error:', err);
      alert(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!secret) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#0f0f0f' }}>
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-xl font-semibold text-white mb-2">Access Denied</h1>
          <p className="text-gray-500 text-sm">Secret parameter required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0f0f0f' }}>
      {/* Header */}
      <header className="border-b border-gray-800 bg-black/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">L</span>
            </div>
            <h1 className="text-lg font-semibold text-white">Template Admin</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500">
              {activeTab === 'pending' && 'Press A to approve, R to reject'}
            </span>
            <button
              onClick={fetchTemplates}
              className="text-gray-400 hover:text-white transition-colors"
              title="Refresh"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* AI Generator */}
        <div className="mb-6 p-4 rounded-2xl border border-gray-800 bg-gray-900/30">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0L13.5 8.5L22 10L13.5 11.5L12 20L10.5 11.5L2 10L10.5 8.5L12 0Z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-white">AI Template Generator</span>
            <span className="text-xs text-gray-500">(High Thinking Mode)</span>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              placeholder="Describe the template you want to create... (e.g., 'camping trip essentials' or 'home cleaning routine')"
              disabled={isGenerating}
              className="flex-1 px-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 disabled:opacity-50"
            />
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !aiPrompt.trim()}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium text-sm hover:from-amber-400 hover:to-orange-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0L13.5 8.5L22 10L13.5 11.5L12 20L10.5 11.5L2 10L10.5 8.5L12 0Z" />
                  </svg>
                  Generate
                </>
              )}
            </button>
          </div>
          {generateResult && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-green-400">Created:</span>
              <span className="text-white font-medium">{generateResult.title}</span>
              <span className="text-gray-500">({generateResult.item_count} items)</span>
              <button
                onClick={() => setGenerateResult(null)}
                className="ml-auto text-gray-500 hover:text-white"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 bg-gray-900/50 rounded-xl w-fit">
          {TAB_CONFIG.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                setActiveTab(key);
                setSelectedTemplate(null);
                setSelectedId(null);
              }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              {label}
              {templates.length > 0 && activeTab === key && (
                <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-gray-200 text-gray-700">
                  {templates.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {error ? (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-red-400">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-6" style={{ minHeight: 'calc(100vh - 180px)' }}>
            {/* Template list - 2 columns */}
            <div className="col-span-2 space-y-2 overflow-y-auto pr-2" style={{ maxHeight: 'calc(100vh - 180px)' }}>
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-20">
                  <div className="text-4xl mb-3 opacity-50">
                    {activeTab === 'pending' ? '📭' : activeTab === 'processing' ? '⏳' : activeTab === 'approved' ? '✅' : '🗑️'}
                  </div>
                  <p className="text-gray-500 text-sm">No {activeTab} templates</p>
                </div>
              ) : (
                templates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => fetchTemplateDetail(template.id)}
                    className={`group cursor-pointer rounded-xl p-4 transition-all border ${
                      selectedId === template.id
                        ? 'bg-violet-500/10 border-violet-500/50'
                        : 'bg-gray-900/30 border-gray-800 hover:bg-gray-900/50 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Color indicator */}
                      <div
                        className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-white font-semibold text-xs"
                        style={{ backgroundColor: template.theme?.primary || '#6366f1' }}
                      >
                        {template.item_count}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-white truncate text-sm">
                          {template.title || 'Untitled'}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 capitalize">
                            {template.template_category}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDate(template.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Quick actions on pending */}
                      {activeTab === 'pending' && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction(template.id, 'approve');
                            }}
                            disabled={!!actionLoading}
                            className="w-8 h-8 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 flex items-center justify-center transition-colors disabled:opacity-50"
                            title="Approve (A)"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction(template.id, 'reject');
                            }}
                            disabled={!!actionLoading}
                            className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-colors disabled:opacity-50"
                            title="Reject (R)"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Template detail - 3 columns */}
            <div
              className="col-span-3 rounded-2xl border border-gray-800 bg-gray-900/30 overflow-hidden"
              style={{ maxHeight: 'calc(100vh - 180px)' }}
            >
              {isLoadingDetail ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                </div>
              ) : selectedTemplate ? (
                <div className="flex flex-col h-full">
                  {/* Header */}
                  <div className="p-6 border-b border-gray-800">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h2 className="text-xl font-semibold text-white mb-2">
                          {selectedTemplate.title}
                        </h2>
                        {selectedTemplate.template_description && (
                          <p className="text-gray-400 text-sm leading-relaxed">
                            {selectedTemplate.template_description}
                          </p>
                        )}
                      </div>
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: (selectedTemplate.theme as { primary?: string })?.primary || '#6366f1' }}
                      >
                        {selectedTemplate.items?.length || 0}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4">
                      <span className="text-xs px-3 py-1 rounded-full bg-violet-500/20 text-violet-300 capitalize">
                        {selectedTemplate.template_category}
                      </span>
                      <span className="text-xs px-3 py-1 rounded-full bg-gray-800 text-gray-400 uppercase">
                        {selectedTemplate.language}
                      </span>
                      {selectedTemplate.is_official && (
                        <span className="text-xs px-3 py-1 rounded-full bg-amber-500/20 text-amber-300">
                          Official
                        </span>
                      )}
                      <span className="text-xs text-gray-500 ml-auto">
                        {selectedTemplate.use_count} uses
                      </span>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="flex-1 overflow-y-auto p-6">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      List Items ({selectedTemplate.items?.length || 0})
                    </h3>
                    <div className="space-y-1">
                      {selectedTemplate.items?.map((item, index) => (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 py-2 px-3 rounded-lg ${
                            item.content.startsWith('#')
                              ? 'bg-gray-800/50 mt-3 first:mt-0'
                              : 'hover:bg-gray-800/30'
                          }`}
                        >
                          {item.content.startsWith('#') ? (
                            <span className="font-semibold text-white text-sm">
                              {item.content.slice(1)}
                            </span>
                          ) : (
                            <>
                              <span className="w-5 h-5 rounded border border-gray-700 flex-shrink-0" />
                              <span className="text-gray-300 text-sm">{item.content}</span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-4 border-t border-gray-800 bg-gray-900/50">
                    <div className="flex gap-2">
                      {activeTab === 'pending' && (
                        <>
                          <button
                            onClick={() => handleAction(selectedTemplate.id, 'approve')}
                            disabled={!!actionLoading}
                            className="flex-1 py-2.5 px-4 rounded-xl bg-green-500 hover:bg-green-400 text-white font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Approve
                            <span className="text-green-200 text-xs">(A)</span>
                          </button>
                          <button
                            onClick={() => handleAction(selectedTemplate.id, 'reject')}
                            disabled={!!actionLoading}
                            className="flex-1 py-2.5 px-4 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Reject
                            <span className="text-red-300/50 text-xs">(R)</span>
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(selectedTemplate.id)}
                        disabled={!!actionLoading}
                        className="py-2.5 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 font-medium text-sm transition-colors disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-6">
                  <div className="w-16 h-16 rounded-2xl bg-gray-800/50 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-sm">Select a template to preview</p>
                  <p className="text-gray-600 text-xs mt-1">Click any item from the list</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminTemplatesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#0f0f0f' }}>
          <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
        </div>
      }
    >
      <AdminTemplatesContent />
    </Suspense>
  );
}
