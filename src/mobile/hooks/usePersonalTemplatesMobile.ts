import { useState, useEffect, useCallback, useRef } from 'react';
import { Preferences } from '@capacitor/preferences';
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
}

const STORAGE_KEY = 'listo_personal_templates_mobile';

export function usePersonalTemplatesMobile() {
  const [templates, setTemplates] = useState<PersonalTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const templatesRef = useRef<PersonalTemplate[]>([]);

  // Keep ref in sync with state
  useEffect(() => {
    templatesRef.current = templates;
  }, [templates]);

  // Load templates from Preferences on mount
  useEffect(() => {
    async function loadTemplates() {
      try {
        const { value } = await Preferences.get({ key: STORAGE_KEY });
        if (value) {
          const parsed = JSON.parse(value);
          setTemplates(parsed);
          templatesRef.current = parsed;
        }
      } catch (error) {
        console.error('Failed to load personal templates:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadTemplates();
  }, []);

  // Save templates to Preferences
  const saveTemplates = useCallback(async (newTemplates: PersonalTemplate[]) => {
    try {
      await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(newTemplates) });
      setTemplates(newTemplates);
      templatesRef.current = newTemplates;
    } catch (error) {
      console.error('Failed to save personal templates:', error);
    }
  }, []);

  // Add a new personal template
  const addTemplate = useCallback(async (template: Omit<PersonalTemplate, 'id' | 'createdAt'>) => {
    const currentTemplates = templatesRef.current;

    const newTemplate: PersonalTemplate = {
      ...template,
      id: `personal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };

    await saveTemplates([newTemplate, ...currentTemplates]);
    return newTemplate.id;
  }, [saveTemplates]);

  // Update a template
  const updateTemplate = useCallback(async (id: string, updates: Partial<PersonalTemplate>) => {
    const currentTemplates = templatesRef.current;
    const newTemplates = currentTemplates.map(t =>
      t.id === id ? { ...t, ...updates } : t
    );
    await saveTemplates(newTemplates);
  }, [saveTemplates]);

  // Delete a template
  const deleteTemplate = useCallback(async (id: string) => {
    const currentTemplates = templatesRef.current;
    const newTemplates = currentTemplates.filter(t => t.id !== id);
    await saveTemplates(newTemplates);
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
