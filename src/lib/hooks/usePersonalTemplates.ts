'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { TemplateCategory } from '@/types';
import { ThemeColors } from '@/lib/gemini';

export interface PersonalTemplate {
  id: string;
  listId: string; // Original list ID to copy from
  title: string;
  description: string | null;
  category: TemplateCategory;
  themeColor: string | null;
  theme: ThemeColors | null;
  itemCount: number;
  createdAt: string;
  isPublic: boolean; // Whether submitted for public review
  publicTemplateId: string | null; // ID in database if made public
}

const STORAGE_KEY = 'listo_personal_templates';

export function usePersonalTemplates() {
  const [templates, setTemplates] = useState<PersonalTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const templatesRef = useRef<PersonalTemplate[]>([]);

  // Keep ref in sync with state
  useEffect(() => {
    templatesRef.current = templates;
  }, [templates]);

  // Load templates from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setTemplates(parsed);
        templatesRef.current = parsed;
      }
    } catch (error) {
      console.error('Failed to load personal templates:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save templates to localStorage
  const saveTemplates = useCallback((newTemplates: PersonalTemplate[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newTemplates));
      setTemplates(newTemplates);
      templatesRef.current = newTemplates;
    } catch (error) {
      console.error('Failed to save personal templates:', error);
    }
  }, []);

  // Add a new personal template
  const addTemplate = useCallback((template: Omit<PersonalTemplate, 'id' | 'createdAt' | 'isPublic' | 'publicTemplateId'>) => {
    const currentTemplates = templatesRef.current;

    const newTemplate: PersonalTemplate = {
      ...template,
      id: `personal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      isPublic: false,
      publicTemplateId: null,
    };

    saveTemplates([newTemplate, ...currentTemplates]);
    return newTemplate.id;
  }, [saveTemplates]);

  // Update a template (e.g., mark as public)
  const updateTemplate = useCallback((id: string, updates: Partial<PersonalTemplate>) => {
    const currentTemplates = templatesRef.current;
    const newTemplates = currentTemplates.map(t =>
      t.id === id ? { ...t, ...updates } : t
    );
    saveTemplates(newTemplates);
  }, [saveTemplates]);

  // Delete a template
  const deleteTemplate = useCallback((id: string) => {
    const currentTemplates = templatesRef.current;
    const newTemplates = currentTemplates.filter(t => t.id !== id);
    saveTemplates(newTemplates);
  }, [saveTemplates]);

  // Get a template by ID
  const getTemplate = useCallback((id: string) => {
    return templatesRef.current.find(t => t.id === id) || null;
  }, []);

  return {
    templates,
    isLoading,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplate,
  };
}
