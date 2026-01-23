'use client';

/**
 * SIMPLE LIST ID STORAGE
 *
 * Dead simple. No React. No caching. No complexity.
 * Just read and write to storage directly every time.
 */

import { Preferences } from '@capacitor/preferences';

const STORAGE_KEY = 'listo_list_ids_v3';

// Simple lock to prevent concurrent writes
let locked = false;
const queue: (() => void)[] = [];

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  // Wait for lock
  if (locked) {
    await new Promise<void>(resolve => queue.push(resolve));
  }
  locked = true;
  try {
    return await fn();
  } finally {
    locked = false;
    const next = queue.shift();
    if (next) next();
  }
}

/**
 * Get all list IDs from storage
 */
export async function getListIds(): Promise<string[]> {
  try {
    const { value } = await Preferences.get({ key: STORAGE_KEY });
    if (value) {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('[ListIds] GET failed:', e);
  }
  return [];
}

/**
 * Add a list ID (reads fresh, adds, writes) - with lock
 */
export async function addListId(id: string): Promise<void> {
  await withLock(async () => {
    try {
      const current = await getListIds();
      if (current.includes(id)) {
        return;
      }
      const updated = [id, ...current];
      await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(updated) });
    } catch (e) {
      console.error('[ListIds] ADD failed:', e);
    }
  });
}

/**
 * Remove a list ID (reads fresh, removes, writes) - with lock
 */
export async function removeListId(id: string): Promise<void> {
  await withLock(async () => {
    try {
      const current = await getListIds();
      if (!current.includes(id)) {
        return;
      }
      const updated = current.filter(x => x !== id);
      await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(updated) });
    } catch (e) {
      console.error('[ListIds] REMOVE failed:', e);
    }
  });
}

/**
 * Migrate from old storage (one-time) - with lock
 */
export async function migrateListIds(oldIds: string[]): Promise<void> {
  await withLock(async () => {
    try {
      const current = await getListIds();
      if (current.length > 0) {
        return;
      }
      if (oldIds.length === 0) {
        return;
      }
      await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(oldIds) });
    } catch (e) {
      console.error('[ListIds] MIGRATE failed:', e);
    }
  });
}
