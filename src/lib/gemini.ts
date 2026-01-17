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

// Keywords/phrases that indicate user wants categorized output
// Expanded for natural speech patterns from dictation
const CATEGORY_KEYWORDS = [
  // Direct categorization requests
  'categorize', 'categorized', 'category', 'categories',
  'with categories', 'with headers', 'with sections',
  // Grouping requests
  'group', 'grouped', 'grouping', 'groups',
  'by group', 'into groups', 'in groups',
  // Organization requests
  'organize', 'organized', 'organisation', 'organization',
  'sort by', 'sorted by', 'sorting by',
  'arrange', 'arranged', 'arranging',
  // Specific grouping types
  'by aisle', 'by section', 'by type', 'by kind',
  'by store', 'by room', 'by person', 'by priority',
  'by project', 'by day', 'by meal', 'by time',
  'by location', 'by area', 'by department',
  // Natural speech patterns
  'break it down', 'break them down', 'broken down',
  'split into', 'split by', 'divide into', 'divided by',
  'separate into', 'separated by',
  'put together', 'keep together',
  // Header-specific
  'with headings', 'add headers', 'add headings',
  'under headers', 'under headings',
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

  const systemPrompt = `You are a helpful list-making assistant. The user's request may be dictated speech. Generate a list of specific, actionable items.

USER REQUEST (may be dictated speech):
${prompt}

## YOUR TASK
1. Understand what the user wants (they may speak naturally, not in a structured way)
2. Extract or generate the appropriate list items
3. Return clean, concise items

## HANDLING DICTATION
Users may speak naturally:
- "I need to get milk and eggs and also bread" → ["Milk", "Eggs", "Bread"]
- "Um let me think groceries for dinner tonight chicken rice vegetables" → ["Chicken", "Rice", "Vegetables"]
- "Things I need to do call mom finish the report buy groceries" → ["Call mom", "Finish the report", "Buy groceries"]

Filter out filler words (um, uh, let me think, so, like) and extract the actual items.

## OUTPUT FORMAT
Return ONLY a valid JSON array of strings. Each string should be a single, concise list item.
Do not include categories, numbers, or explanations - just the items themselves.
Capitalize appropriately and clean up the items.

Example: "ingredients for a basic omelette"
Response: ["Eggs", "Butter", "Salt", "Pepper", "Cheese"]

Example: "things to pack for a beach day"
Response: ["Sunscreen", "Towel", "Swimsuit", "Sunglasses", "Water bottle", "Snacks"]

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

  const systemPrompt = `You are a helpful list-making assistant. The user has provided a request that may be dictated speech. Your job is to:
1. Extract the list items from their request
2. Organize them into logical categories with headers
3. Return a structured JSON response

USER REQUEST (may be dictated speech):
${prompt}

## UNDERSTANDING THE REQUEST
The user may have:
- Dictated a list of items with a command like "categorize these" or "organize by aisle"
- Asked for items to be generated AND categorized (e.g., "groceries for tacos organized by store section")
- Mixed commands with items in natural speech (e.g., "I need milk bread eggs and chicken and put them in categories")

Extract the intent and items, then organize appropriately.

## HEADER/CATEGORY SYSTEM - CRITICAL
Headers define categories. They MUST start with # character:
- "#Dairy" not "Dairy"
- "#Produce" not "Produce"
- "#Urgent Tasks" not "Urgent Tasks"

The # prefix is how the app recognizes headers. Without it, items won't display as categories.

Structure:
- Headers have parent_id: null (they are top-level)
- Child items have parent_id set to their header's ID
- Use placeholder IDs: "new_1", "new_2", etc.
- Position is sequential within each level (0, 1, 2...)

## OUTPUT FORMAT
Return ONLY a valid JSON array:
{
  "id": "new_X",
  "content": "item text (headers MUST start with #)",
  "completed": false,
  "parent_id": null or "new_X" for parent header,
  "position": 0
}

Example for "I need carrots celery chicken and broth, organize by grocery aisle":
[
  {"id": "new_1", "content": "#Produce", "completed": false, "parent_id": null, "position": 0},
  {"id": "new_2", "content": "Carrots", "completed": false, "parent_id": "new_1", "position": 0},
  {"id": "new_3", "content": "Celery", "completed": false, "parent_id": "new_1", "position": 1},
  {"id": "new_4", "content": "#Meat", "completed": false, "parent_id": null, "position": 1},
  {"id": "new_5", "content": "Chicken", "completed": false, "parent_id": "new_4", "position": 0},
  {"id": "new_6", "content": "#Pantry", "completed": false, "parent_id": null, "position": 2},
  {"id": "new_7", "content": "Broth", "completed": false, "parent_id": "new_6", "position": 0}
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

export interface ThemeColors {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  primaryPale: string;
  primaryGlow: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textPlaceholder: string;
  bgPrimary: string;
  bgSecondary: string;
  bgHover: string;
  borderLight: string;
  borderMedium: string;
  error: string;
}

export async function generateTheme(description: string): Promise<ThemeColors> {
  const config = {
    thinkingConfig: {
      thinkingLevel: ThinkingLevel.MEDIUM,
    },
  };

  const prompt = `You are a color theme generator for a todo list app. Generate a harmonious, beautiful color palette based on the user's description.

THEME DESCRIPTION: ${description}

## REQUIREMENTS
1. Colors must be visually harmonious and pleasing
2. Ensure sufficient contrast for readability (WCAG AA minimum)
3. Work well together across all UI elements
4. Evoke the mood/feeling described by the user
5. Primary colors should be vibrant and eye-catching
6. Text colors must be readable against backgrounds
7. Error color should still be recognizable as an error state

## COLOR ROLES
- primary: Main brand color for buttons, checkmarks, highlights
- primaryDark: Hover states, emphasis (slightly darker than primary)
- primaryLight: Light backgrounds, glows (primary with ~20% opacity)
- primaryPale: Subtle highlights (primary with ~10% opacity)
- primaryGlow: Box shadow glow effect
- textPrimary: Main text color (high contrast against bgPrimary)
- textSecondary: Secondary/muted text
- textMuted: Very muted text, disabled states
- textPlaceholder: Placeholder text in inputs
- bgPrimary: Main background color
- bgSecondary: Secondary/card backgrounds
- bgHover: Hover state backgrounds
- borderLight: Subtle borders
- borderMedium: More visible borders
- error: Error states (keep this readable/noticeable)

## OUTPUT FORMAT
Return ONLY a valid JSON object with these exact keys:
{
  "primary": "#HEXCOLOR",
  "primaryDark": "#HEXCOLOR",
  "primaryLight": "rgba(r,g,b,0.2)",
  "primaryPale": "rgba(r,g,b,0.1)",
  "primaryGlow": "rgba(r,g,b,0.4)",
  "textPrimary": "#HEXCOLOR",
  "textSecondary": "#HEXCOLOR",
  "textMuted": "#HEXCOLOR",
  "textPlaceholder": "#HEXCOLOR",
  "bgPrimary": "#HEXCOLOR",
  "bgSecondary": "#HEXCOLOR",
  "bgHover": "#HEXCOLOR",
  "borderLight": "#HEXCOLOR",
  "borderMedium": "#HEXCOLOR",
  "error": "#HEXCOLOR"
}

Return ONLY the JSON object, no markdown, no explanation.`;

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

  const text = response.text?.trim() || '{}';

  try {
    const parsed = JSON.parse(text);
    return parsed as ThemeColors;
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim()) as ThemeColors;
    }
    throw new Error('Failed to parse theme response as JSON');
  }
}

// Generate a title for a list based on its items - cheap API call
export async function generateTitle(items: string[]): Promise<string> {
  if (items.length === 0) return 'My List';

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-lite',
    config: {
      maxOutputTokens: 20,
    },
    contents: [{
      role: 'user' as const,
      parts: [{ text: `Create a short title (2-4 words) for a list containing: ${items.slice(0, 10).join(', ')}. Reply with just the title, no quotes.` }],
    }],
  });

  return response.text?.trim() || 'My List';
}

// Generate a single emoji for a text item - ultra cheap API call
export async function generateEmoji(text: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-lite',  // Cheapest model
    config: {
      maxOutputTokens: 4,  // Emoji is 1-2 tokens
    },
    contents: [{
      role: 'user' as const,
      parts: [{ text: `Reply with ONE emoji for: ${text}` }],
    }],
  });

  const emoji = response.text?.trim() || '📝';
  // Ensure we only return the first emoji (in case model returns more)
  const emojiMatch = emoji.match(/\p{Emoji}/u);
  return emojiMatch ? emojiMatch[0] : '📝';
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
