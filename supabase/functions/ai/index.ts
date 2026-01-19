import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!
const MODEL = 'gemini-2.0-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`

interface ListItem {
  id: string
  content: string
  completed: boolean
  parent_id: string | null
  position: number
}

interface ManipulatedItem extends ListItem {
  isNew?: boolean
}

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Keywords that indicate user wants categorized output
const CATEGORY_KEYWORDS = [
  'categorize', 'categorized', 'category', 'categories',
  'with categories', 'with headers', 'with sections',
  'group', 'grouped', 'grouping', 'groups',
  'by group', 'into groups', 'in groups',
  'organize', 'organized', 'organisation', 'organization',
  'sort by', 'sorted by', 'sorting by',
  'arrange', 'arranged', 'arranging',
  'by aisle', 'by section', 'by type', 'by kind',
  'by store', 'by room', 'by person', 'by priority',
  'by project', 'by day', 'by meal', 'by time',
  'by location', 'by area', 'by department',
  'break it down', 'break them down', 'broken down',
  'split into', 'split by', 'divide into', 'divided by',
  'separate into', 'separated by',
  'put together', 'keep together',
  'with headings', 'add headers', 'add headings',
  'under headers', 'under headings',
]

function wantsCategorization(prompt: string): boolean {
  const lower = prompt.toLowerCase()
  return CATEGORY_KEYWORDS.some(keyword => lower.includes(keyword))
}

async function callGemini(prompt: string): Promise<string> {
  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Gemini API error: ${error}`)
  }

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

function parseJsonResponse(text: string): unknown {
  const cleaned = text.trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim())
    }
    throw new Error('Failed to parse AI response as JSON')
  }
}

async function manipulateList(items: ListItem[], instruction: string): Promise<ManipulatedItem[]> {
  const itemsJson = JSON.stringify(
    items.map((item) => ({
      id: item.id,
      content: item.content,
      completed: item.completed,
      parent_id: item.parent_id,
    })),
    null,
    2
  )

  const hasGroups = items.some(item => item.content.startsWith('#'))
  const groupInfo = hasGroups
    ? `\n\n## EXISTING GROUP STRUCTURE
The list already has categories/groups. Items with parent_id belong to a header item.
- Headers are items whose content starts with # (e.g., "#Groceries")
- Items under a header have parent_id set to that header's id
- PRESERVE this group structure unless the instruction specifically asks to reorganize, ungroup, or recategorize.`
    : ''

  const prompt = `You are an intelligent list manipulation assistant.

## INSTRUCTION
${instruction}

## CURRENT LIST ITEMS
${itemsJson}${groupInfo}

## CAPABILITIES
You can: sort, group/categorize, filter, reformat, deduplicate, split, enrich items.

## HEADER SYSTEM
- Headers start with # (e.g., "#Dairy", "#Urgent")
- Headers are parents - items become children via parent_id
- NEW headers use IDs like "new_1", "new_2"
- EXISTING headers keep their original IDs
- Position is sequential within each level (0, 1, 2...)

## CRITICAL RULES
1. PRESERVE original item IDs for ALL existing items
2. PRESERVE completed status unless explicitly changed
3. PRESERVE parent_id unless instruction asks to reorganize

## OUTPUT FORMAT
Return ONLY a valid JSON array:
[{"id": "...", "content": "...", "completed": false, "parent_id": null, "position": 0}]

Return ONLY the JSON array, no markdown, no explanation.`

  const text = await callGemini(prompt)
  return parseJsonResponse(text) as ManipulatedItem[]
}

async function generateItemsFromPrompt(prompt: string): Promise<string[]> {
  const systemPrompt = `You are a helpful list-making assistant.

USER REQUEST (may be dictated speech):
${prompt}

## YOUR TASK
1. Understand what the user wants
2. Extract or generate the appropriate list items
3. Return clean, concise items

## OUTPUT FORMAT
Return ONLY a valid JSON array of strings.
Example: ["Eggs", "Butter", "Salt"]

Return ONLY the JSON array, no markdown, no explanation.`

  const text = await callGemini(systemPrompt)
  const parsed = parseJsonResponse(text)
  if (Array.isArray(parsed)) {
    return parsed.filter((item): item is string => typeof item === 'string')
  }
  return []
}

async function generateCategorizedItems(prompt: string): Promise<ManipulatedItem[]> {
  const systemPrompt = `You are a helpful list-making assistant. Organize items into categories.

USER REQUEST (may be dictated speech):
${prompt}

## HEADER SYSTEM - CRITICAL
Headers MUST start with # character:
- "#Dairy" not "Dairy"
- "#Produce" not "Produce"

Structure:
- Headers have parent_id: null
- Child items have parent_id set to their header's ID
- Use placeholder IDs: "new_1", "new_2", etc.

## OUTPUT FORMAT
Return ONLY a valid JSON array:
[
  {"id": "new_1", "content": "#Category", "completed": false, "parent_id": null, "position": 0},
  {"id": "new_2", "content": "Item", "completed": false, "parent_id": "new_1", "position": 0}
]

Return ONLY the JSON array, no markdown, no explanation.`

  const text = await callGemini(systemPrompt)
  return parseJsonResponse(text) as ManipulatedItem[]
}

async function generateSuggestions(items: ListItem[], context?: string): Promise<string[]> {
  const itemsText = items.map((item) => item.content).join('\n')

  const prompt = `Given this list:
${itemsText}

${context ? `Context: ${context}` : ''}

Suggest 3-5 additional items that would complement this list. Return ONLY a JSON array of strings.`

  const text = await callGemini(prompt)
  const parsed = parseJsonResponse(text)
  return Array.isArray(parsed) ? parsed : []
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { action, items, instruction, context, prompt } = body

    let result: unknown

    switch (action) {
      case 'generate': {
        if (!prompt) {
          return new Response(
            JSON.stringify({ error: 'Prompt is required for generate action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        if (wantsCategorization(prompt)) {
          result = await generateCategorizedItems(prompt)
        } else {
          result = await generateItemsFromPrompt(prompt)
        }
        break
      }

      case 'manipulate': {
        if (!items || !Array.isArray(items)) {
          return new Response(
            JSON.stringify({ error: 'Items array is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        if (!instruction) {
          return new Response(
            JSON.stringify({ error: 'Instruction is required for manipulate action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        result = await manipulateList(items as ListItem[], instruction)
        break
      }

      case 'suggest': {
        if (!items || !Array.isArray(items)) {
          return new Response(
            JSON.stringify({ error: 'Items array is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        result = await generateSuggestions(items as ListItem[], context)
        break
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Use "generate", "manipulate", or "suggest"' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    return new Response(
      JSON.stringify({ result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('AI API error:', error)
    return new Response(
      JSON.stringify({ error: 'AI processing failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
