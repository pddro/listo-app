import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

const MODEL = 'gemini-3-flash-preview';

export interface ListItem {
  id: string;
  content: string;
  completed: boolean;
  parent_id: string | null;
  position: number;
}

export interface ManipulatedItem {
  id: string;
  content: string;
  completed: boolean;
  parent_id: string | null;
  position: number;
  isNew?: boolean;
}

export async function manipulateList(
  items: ListItem[],
  instruction: string
): Promise<ManipulatedItem[]> {
  const config = {
    thinkingConfig: {
      thinkingLevel: ThinkingLevel.MEDIUM,
    },
  };

  const itemsJson = JSON.stringify(
    items.map((item) => ({
      id: item.id,
      content: item.content,
      completed: item.completed,
    })),
    null,
    2
  );

  const prompt = `You are an intelligent list manipulation assistant. Your job is to transform, reorganize, or modify a list based on the user's instruction.

## INSTRUCTION
${instruction}

## CURRENT LIST ITEMS
${itemsJson}

## CAPABILITIES
You can perform any list manipulation, including but not limited to:
- **Sorting**: alphabetically, by length, by priority, by date, reverse order
- **Grouping/Categorizing**: by type, by aisle (groceries), by genre, by theme, by urgency
- **Filtering language**: interpret "urgent items first" or "put dairy together"
- **Reformatting**: capitalize, lowercase, add prefixes, standardize format
- **Deduplication**: merge similar items, remove exact duplicates
- **Splitting**: break compound items into separate items
- **Enriching**: add details, quantities, or clarifications to items

## HEADER/CATEGORY SYSTEM
When categorizing or grouping items, create HEADER items:
- Headers start with # (e.g., "#Dairy", "#Urgent", "#Produce")
- Headers are parent items - other items become their children via parent_id
- Headers use placeholder IDs starting with "new_" (e.g., "new_1", "new_2")
- Regular items keep their original IDs but get parent_id set to a header's ID
- Position is relative to siblings at the same level

## RULES
1. PRESERVE original item IDs exactly for existing items
2. PRESERVE completed status unless instruction explicitly changes it
3. For new headers, use IDs like "new_1", "new_2", etc.
4. Set parent_id to group items under a header
5. Position numbers are sequential within each level (0, 1, 2...)
6. Be smart about context - groceries have aisles, todos have priorities

## OUTPUT FORMAT
Return ONLY a valid JSON array. Each item:
{
  "id": "original_id or new_X for headers",
  "content": "item text (headers start with #)",
  "completed": false,
  "parent_id": null or "id_of_parent_header",
  "position": 0
}

Example for "!categorize by grocery aisle" with items Milk, Bread, Apples:
[
  {"id": "new_1", "content": "#Dairy", "completed": false, "parent_id": null, "position": 0},
  {"id": "abc123", "content": "Milk", "completed": false, "parent_id": "new_1", "position": 0},
  {"id": "new_2", "content": "#Bakery", "completed": false, "parent_id": null, "position": 1},
  {"id": "def456", "content": "Bread", "completed": false, "parent_id": "new_2", "position": 0},
  {"id": "new_3", "content": "#Produce", "completed": false, "parent_id": null, "position": 2},
  {"id": "ghi789", "content": "Apples", "completed": false, "parent_id": "new_3", "position": 0}
]

Example for "!sort alphabetically" (no categories needed):
[
  {"id": "ghi789", "content": "Apples", "completed": false, "parent_id": null, "position": 0},
  {"id": "def456", "content": "Bread", "completed": false, "parent_id": null, "position": 1},
  {"id": "abc123", "content": "Milk", "completed": false, "parent_id": null, "position": 2}
]

Return ONLY the JSON array, no markdown, no explanation.`;

  const contents = [
    {
      role: 'user' as const,
      parts: [{ text: prompt }],
    },
  ];

  const response = await ai.models.generateContent({
    model: MODEL,
    config,
    contents,
  });

  const text = response.text?.trim() || '[]';

  // Parse the JSON response
  try {
    const parsed = JSON.parse(text);
    return parsed as ManipulatedItem[];
  } catch {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }
    throw new Error('Failed to parse AI response as JSON');
  }
}

// Keywords that indicate user wants categorized output
const CATEGORY_KEYWORDS = [
  'categorize', 'categorized', 'category', 'categories',
  'by aisle', 'by section', 'by type', 'by group',
  'grouped', 'organize', 'organized', 'sorted by',
];

function wantsCategorization(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return CATEGORY_KEYWORDS.some(keyword => lower.includes(keyword));
}

export async function generateItemsFromPrompt(
  prompt: string
): Promise<string[] | ManipulatedItem[]> {
  // Check if user wants categorized output
  if (wantsCategorization(prompt)) {
    return generateCategorizedItems(prompt);
  }

  const config = {
    thinkingConfig: {
      thinkingLevel: ThinkingLevel.LOW,
    },
  };

  const systemPrompt = `You are a helpful list-making assistant. Given a user's request, generate a list of specific, actionable items.

USER REQUEST: ${prompt}

Return ONLY a valid JSON array of strings. Each string should be a single, concise list item.
Do not include categories, numbers, or explanations - just the items themselves.

Example request: "ingredients for a basic omelette"
Example response: ["Eggs", "Butter", "Salt", "Pepper", "Cheese"]

Example request: "things to pack for a beach day"
Example response: ["Sunscreen", "Towel", "Swimsuit", "Sunglasses", "Water bottle", "Snacks"]

Return ONLY the JSON array, no markdown, no explanation.`;

  const contents = [
    {
      role: 'user' as const,
      parts: [{ text: systemPrompt }],
    },
  ];

  const response = await ai.models.generateContent({
    model: MODEL,
    config,
    contents,
  });

  const text = response.text?.trim() || '[]';

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string');
    }
    return [];
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1].trim());
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string');
      }
    }
    return [];
  }
}

export async function generateCategorizedItems(
  prompt: string
): Promise<ManipulatedItem[]> {
  const config = {
    thinkingConfig: {
      thinkingLevel: ThinkingLevel.MEDIUM,
    },
  };

  const systemPrompt = `You are a helpful list-making assistant. Given a user's request, generate a categorized list with headers and items.

USER REQUEST: ${prompt}

## HEADER/CATEGORY SYSTEM
Create HEADER items to organize the list:
- Headers start with # (e.g., "#Dairy", "#Produce", "#Proteins")
- Headers are parent items - other items become their children via parent_id
- Headers use placeholder IDs starting with "new_" (e.g., "new_1", "new_2")
- Regular items also use "new_" IDs (e.g., "new_3", "new_4")
- Position is relative to siblings at the same level

## OUTPUT FORMAT
Return ONLY a valid JSON array. Each item:
{
  "id": "new_X",
  "content": "item text (headers start with #)",
  "completed": false,
  "parent_id": null or "new_X" for parent header,
  "position": 0
}

Example for "chicken soup ingredients categorized by aisle":
[
  {"id": "new_1", "content": "#Produce", "completed": false, "parent_id": null, "position": 0},
  {"id": "new_2", "content": "Carrots", "completed": false, "parent_id": "new_1", "position": 0},
  {"id": "new_3", "content": "Celery", "completed": false, "parent_id": "new_1", "position": 1},
  {"id": "new_4", "content": "Onion", "completed": false, "parent_id": "new_1", "position": 2},
  {"id": "new_5", "content": "#Proteins", "completed": false, "parent_id": null, "position": 1},
  {"id": "new_6", "content": "Chicken breast", "completed": false, "parent_id": "new_5", "position": 0},
  {"id": "new_7", "content": "#Pantry", "completed": false, "parent_id": null, "position": 2},
  {"id": "new_8", "content": "Chicken broth", "completed": false, "parent_id": "new_7", "position": 0},
  {"id": "new_9", "content": "Salt", "completed": false, "parent_id": "new_7", "position": 1}
]

Return ONLY the JSON array, no markdown, no explanation.`;

  const contents = [
    {
      role: 'user' as const,
      parts: [{ text: systemPrompt }],
    },
  ];

  const response = await ai.models.generateContent({
    model: MODEL,
    config,
    contents,
  });

  const text = response.text?.trim() || '[]';

  try {
    const parsed = JSON.parse(text);
    return parsed as ManipulatedItem[];
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }
    throw new Error('Failed to parse AI response as JSON');
  }
}

export async function generateListSuggestions(
  items: ListItem[],
  context?: string
): Promise<string[]> {
  const config = {
    thinkingConfig: {
      thinkingLevel: ThinkingLevel.LOW,
    },
  };

  const itemsText = items.map((item) => item.content).join('\n');

  const prompt = `Given this list:
${itemsText}

${context ? `Context: ${context}` : ''}

Suggest 3-5 additional items that would complement this list. Return ONLY a JSON array of strings.
Example: ["Item 1", "Item 2", "Item 3"]`;

  const contents = [
    {
      role: 'user' as const,
      parts: [{ text: prompt }],
    },
  ];

  const response = await ai.models.generateContent({
    model: MODEL,
    config,
    contents,
  });

  const text = response.text?.trim() || '[]';

  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }
    return [];
  }
}
