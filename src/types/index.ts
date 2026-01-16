import { ThemeColors } from '@/lib/gemini';

export interface List {
  id: string;
  title: string | null;
  theme: ThemeColors | null;
  created_at: string;
  updated_at: string;
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
