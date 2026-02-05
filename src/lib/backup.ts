import { ThemeColors } from '@/lib/gemini';
import { TemplateCategory } from '@/types';

/**
 * Backup feature utilities
 * - BackupPayload types for data structure
 * - Encode/decode functions for full backup URLs
 * - Short code generation for quick transfer
 */

// Mango-themed words for short codes
const CODE_WORDS = [
  'MANGO',
  'LISTO',
  'SUNNY',
  'FRESH',
  'RIPE',
  'JUICY',
  'SWEET',
  'GROVE',
  'SLICE',
  'TROPIC',
  'GOLDEN',
  'ZESTY',
];

// Characters for the random suffix (alphanumeric, avoiding confusing chars)
const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export interface BackupList {
  id: string;
  title: string | null;
  themeColor: string | null;
  themeTextColor: string | null;
}

export interface BackupTemplate {
  id: string;
  listId: string;
  title: string;
  description: string | null;
  category: TemplateCategory;
  theme: ThemeColors | null;
  itemCount: number;
}

export interface BackupPayload {
  version: 1;
  createdAt: string;
  lists: BackupList[];
  templates: BackupTemplate[];
}

/**
 * Generate a short backup code (e.g., "MANGO-7X2K")
 */
export function generateBackupCode(): string {
  const word = CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)];
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return `${word}-${suffix}`;
}

/**
 * Validate backup code format
 */
export function isValidBackupCode(code: string): boolean {
  const pattern = /^[A-Z]+-[A-Z0-9]{4}$/;
  return pattern.test(code.toUpperCase());
}

/**
 * Encode a backup payload for URL hash (full backup)
 * Format: LM1:base64encodedJSON
 */
export function encodeBackup(payload: BackupPayload): string {
  const json = JSON.stringify(payload);
  // Use URI encoding then base64 to handle unicode
  const base64 = btoa(unescape(encodeURIComponent(json)));
  return `LM1:${base64}`;
}

/**
 * Decode a backup string from URL hash
 * Returns null if invalid
 */
export function decodeBackup(encoded: string): BackupPayload | null {
  if (!encoded.startsWith('LM1:')) return null;
  try {
    const base64 = encoded.slice(4);
    const json = decodeURIComponent(escape(atob(base64)));
    const payload = JSON.parse(json);

    // Validate structure
    if (
      typeof payload !== 'object' ||
      payload.version !== 1 ||
      !Array.isArray(payload.lists) ||
      !Array.isArray(payload.templates)
    ) {
      return null;
    }

    return payload as BackupPayload;
  } catch {
    return null;
  }
}

/**
 * Create a BackupPayload from lists and templates data
 */
export function createBackupPayload(
  lists: BackupList[],
  templates: BackupTemplate[]
): BackupPayload {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    lists,
    templates,
  };
}

/**
 * Generate the full backup URL with encoded data in hash
 */
export function generateBackupUrl(payload: BackupPayload): string {
  const encoded = encodeBackup(payload);
  // Use relative URL - caller should prepend origin if needed
  return `/restore#${encoded}`;
}

/**
 * Parse a backup URL or code string
 * Returns the type and value for further processing
 */
export function parseBackupInput(
  input: string
): { type: 'code'; value: string } | { type: 'url'; value: BackupPayload } | null {
  const trimmed = input.trim();

  // Check if it's a full URL with hash
  if (trimmed.includes('/restore#LM1:')) {
    const hashIndex = trimmed.indexOf('#');
    const encoded = trimmed.slice(hashIndex + 1);
    const payload = decodeBackup(encoded);
    if (payload) {
      return { type: 'url', value: payload };
    }
    return null;
  }

  // Check if it starts with LM1: (just the encoded part)
  if (trimmed.startsWith('LM1:')) {
    const payload = decodeBackup(trimmed);
    if (payload) {
      return { type: 'url', value: payload };
    }
    return null;
  }

  // Check if it's a short code
  const upperTrimmed = trimmed.toUpperCase();
  if (isValidBackupCode(upperTrimmed)) {
    return { type: 'code', value: upperTrimmed };
  }

  return null;
}
