import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!
const MODEL = 'gemini-2.0-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`

interface ThemeColors {
  primary: string
  primaryDark: string
  primaryLight: string
  primaryPale: string
  primaryGlow: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  textPlaceholder: string
  bgPrimary: string
  bgSecondary: string
  bgHover: string
  borderLight: string
  borderMedium: string
  error: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function generateTheme(description: string): Promise<ThemeColors> {
  const prompt = `You are a color theme generator for a todo list app. Generate a harmonious, beautiful color palette.

THEME DESCRIPTION: ${description}

## OUTPUT FORMAT
Return ONLY a valid JSON object:
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

Return ONLY the JSON object, no markdown, no explanation.`

  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    }),
  })

  if (!response.ok) {
    throw new Error(`Gemini API error: ${await response.text()}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}'

  try {
    return JSON.parse(text) as ThemeColors
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim()) as ThemeColors
    }
    throw new Error('Failed to parse theme response')
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { description } = await req.json()

    if (!description || typeof description !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Theme description is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const theme = await generateTheme(description)

    return new Response(
      JSON.stringify({ theme }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Theme generation error:', error)
    return new Response(
      JSON.stringify({ error: 'Theme generation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
