'use client';

import { useState } from 'react';
import { Item } from '@/types';
import { API } from '@/lib/api';

export interface ManipulatedItem {
  id: string;
  content: string;
  completed: boolean;
  parent_id: string | null;
  position: number;
}

export type GenerateResult = string[] | ManipulatedItem[];

// Type guard to check if result is categorized (ManipulatedItem[])
export function isCategorizedResult(result: GenerateResult): result is ManipulatedItem[] {
  return result.length > 0 && typeof result[0] === 'object' && 'id' in result[0];
}

export function useAI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateItems = async (prompt: string): Promise<GenerateResult> => {
    console.log('[useAI] generateItems called with prompt:', prompt);
    console.log('[useAI] API endpoint:', API.ai);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(API.ai, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          prompt,
        }),
      });

      console.log('[useAI] Response status:', response.status, response.ok);
      if (!response.ok) {
        const data = await response.json();
        console.error('[useAI] API error:', data);
        throw new Error(data.error || 'Failed to generate items');
      }

      const data = await response.json();
      console.log('[useAI] API success, result:', data.result);
      return data.result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI request failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const manipulateList = async (
    items: Item[],
    instruction: string
  ): Promise<ManipulatedItem[]> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(API.ai, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'manipulate',
          items: items.map((item) => ({
            id: item.id,
            content: item.content,
            completed: item.completed,
            parent_id: item.parent_id,
            position: item.position,
          })),
          instruction,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to manipulate list');
      }

      const data = await response.json();
      return data.result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI request failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getSuggestions = async (
    items: Item[],
    context?: string
  ): Promise<string[]> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(API.ai, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'suggest',
          items: items.map((item) => ({
            id: item.id,
            content: item.content,
            completed: item.completed,
          })),
          context,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get suggestions');
      }

      const data = await response.json();
      return data.result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI request failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    generateItems,
    manipulateList,
    getSuggestions,
  };
}
