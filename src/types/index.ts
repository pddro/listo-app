import { ThemeColors } from '@/lib/gemini';

// Template categories and status
export const TEMPLATE_CATEGORIES = [
  'travel',
  'shopping',
  'productivity',
  'cooking',
  'events',
  'health',
  'home',
  'work',
  'education',
  'other',
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];
export type TemplateStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export interface List {
  id: string;
  title: string | null;
  theme: ThemeColors | null;
  large_mode: boolean | null;
  emojify_mode: boolean | null;
  created_at: string;
  updated_at: string;
  // Template fields (null/default for regular lists)
  is_template?: boolean;
  template_description?: string | null;
  template_category?: TemplateCategory | null;
  language?: string;
  translation_group_id?: string | null;
  use_count?: number;
  is_official?: boolean;
  status?: TemplateStatus;
}

export interface Item {
  id: string;
  list_id: string;
  content: string;
  completed: boolean;
  parent_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ItemWithChildren extends Item {
  children: ItemWithChildren[];
}

// Template is just a List with is_template = true
export interface Template extends List {
  is_template: true;
  title: string; // Required for templates
  template_category: TemplateCategory;
  language: string;
  use_count: number;
  status: TemplateStatus;
}

// Templates use regular Items
export interface TemplateWithItems extends Template {
  items: Item[];
}
