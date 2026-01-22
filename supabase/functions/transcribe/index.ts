import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const ASSEMBLY_AI_BASE_URL = 'https://api.assemblyai.com'
const ASSEMBLY_AI_API_KEY = Deno.env.get('ASSEMBLY_AI_API_KEY') || ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const formData = await req.formData()
    const audioFile = formData.get('audio') as Blob | null

    if (!audioFile) {
      return new Response(
        JSON.stringify({ error: 'No audio file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!ASSEMBLY_AI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'AssemblyAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Convert blob to array buffer
    const audioBuffer = await audioFile.arrayBuffer()

    // Upload audio to AssemblyAI
    const uploadResponse = await fetch(`${ASSEMBLY_AI_BASE_URL}/v2/upload`, {
      method: 'POST',
      headers: {
        authorization: ASSEMBLY_AI_API_KEY,
        'Content-Type': 'application/octet-stream',
      },
      body: audioBuffer,
    })

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload audio to AssemblyAI')
    }

    const uploadData = await uploadResponse.json()
    const audioUrl = uploadData.upload_url

    // Start transcription
    const transcriptResponse = await fetch(`${ASSEMBLY_AI_BASE_URL}/v2/transcript`, {
      method: 'POST',
      headers: {
        authorization: ASSEMBLY_AI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        speech_model: 'universal',
        language_detection: true,
      }),
    })

    if (!transcriptResponse.ok) {
      throw new Error('Failed to start transcription')
    }

    const transcriptData = await transcriptResponse.json()
    const transcriptId = transcriptData.id

    // Poll for completion (max 60 seconds)
    const maxAttempts = 20
    const pollInterval = 3000

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const pollingResponse = await fetch(
        `${ASSEMBLY_AI_BASE_URL}/v2/transcript/${transcriptId}`,
        {
          headers: {
            authorization: ASSEMBLY_AI_API_KEY,
          },
        }
      )

      const result = await pollingResponse.json()

      if (result.status === 'completed') {
        return new Response(
          JSON.stringify({ text: result.text }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else if (result.status === 'error') {
        throw new Error(`Transcription failed: ${result.error}`)
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval))
    }

    throw new Error('Transcription timed out')
  } catch (error) {
    console.error('Transcription error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Transcription failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
