import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!
const MODEL = 'gemini-2.0-flash-lite'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function generateEmoji(text: string): Promise<string> {
  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Reply with ONE emoji for: ${text}` }] }],
      generationConfig: { maxOutputTokens: 4 },
    }),
  })

  if (!response.ok) {
    throw new Error(`Gemini API error: ${await response.text()}`)
  }

  const data = await response.json()
  const emoji = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '📝'

  // Ensure we only return the first emoji
  const emojiMatch = emoji.match(/\p{Emoji}/u)
  return emojiMatch ? emojiMatch[0] : '📝'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text } = await req.json()

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const emoji = await generateEmoji(text)

    return new Response(
      JSON.stringify({ emoji }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Emojify error:', error)
    return new Response(
      JSON.stringify({ error: 'Emojify failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
