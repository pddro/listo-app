import { useState, useEffect, useCallback } from 'react';
import { Preferences } from '@capacitor/preferences';
import { ThemeColors } from '@/lib/gemini';
import { TemplateCategory } from '@/types';
import { nanoid } from 'nanoid';

const PERSONAL_TEMPLATES_KEY = 'listo_personal_templates';

export interface PersonalTemplate {
  id: string;
  title: string;
  description: string;
  category: TemplateCategory;
  listId: string; // Reference to the original list
  theme: ThemeColors | null;
  itemCount: number;
  createdAt: string;
}

export function usePersonalTemplates() {
  const [templates, setTemplates] = useState<PersonalTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load templates from storage
  const loadTemplates = useCallback(async () => {
    try {
      const { value } = await Preferences.get({ key: PERSONAL_TEMPLATES_KEY });
      if (value) {
        const parsed = JSON.parse(value) as PersonalTemplate[];
        // Sort by creation date (newest first)
        setTemplates(parsed.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ));
      } else {
        setTemplates([]);
      }
    } catch (error) {
      console.error('Failed to load personal templates:', error);
      setTemplates([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save templates to storage
  const saveTemplates = useCallback(async (newTemplates: PersonalTemplate[]) => {
    try {
      await Preferences.set({
        key: PERSONAL_TEMPLATES_KEY,
        value: JSON.stringify(newTemplates),
      });
      setTemplates(newTemplates);
    } catch (error) {
      console.error('Failed to save personal templates:', error);
      throw error;
    }
  }, []);

  // Add a new template
  const addTemplate = useCallback(async (template: Omit<PersonalTemplate, 'id' | 'createdAt'>) => {
    const newTemplate: PersonalTemplate = {
      ...template,
      id: nanoid(6),
      createdAt: new Date().toISOString(),
    };

    const newTemplates = [newTemplate, ...templates];
    await saveTemplates(newTemplates);
    return newTemplate;
  }, [templates, saveTemplates]);

  // Remove a template
  const removeTemplate = useCallback(async (templateId: string) => {
    const newTemplates = templates.filter(t => t.id !== templateId);
    await saveTemplates(newTemplates);
  }, [templates, saveTemplates]);

  // Update a template
  const updateTemplate = useCallback(async (templateId: string, updates: Partial<Omit<PersonalTemplate, 'id' | 'createdAt'>>) => {
    const newTemplates = templates.map(t =>
      t.id === templateId ? { ...t, ...updates } : t
    );
    await saveTemplates(newTemplates);
  }, [templates, saveTemplates]);

  // Load on mount
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  return {
    templates,
    isLoading,
    addTemplate,
    removeTemplate,
    updateTemplate,
    refreshTemplates: loadTemplates,
  };
}
