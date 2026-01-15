import { customAlphabet } from 'nanoid';

// Use lowercase letters and numbers for URL-friendly IDs
const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6);

export function generateListId(): string {
  return nanoid();
}
