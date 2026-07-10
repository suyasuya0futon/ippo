const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requireAuthenticatedUser(req: Request): Promise<Response | null> {
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return jsonResponse({ error: "unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) return jsonResponse({ error: "auth_not_configured" }, 500);

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authorization, apikey: supabaseAnonKey },
  });
  return response.ok ? null : jsonResponse({ error: "unauthorized" }, 401);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const authError = await requireAuthenticatedUser(req);
  if (authError) return authError;

  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiApiKey) return jsonResponse({ error: "missing_openai_api_key" }, 500);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonResponse({ error: "invalid_form_data" }, 400);
  }
  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) return jsonResponse({ error: "missing_audio" }, 400);
  if (audio.size > 5 * 1024 * 1024) return jsonResponse({ error: "audio_too_large" }, 413);

  const openAiForm = new FormData();
  openAiForm.append("file", audio, audio.name || "speech.webm");
  openAiForm.append("model", "gpt-4o-mini-transcribe");
  openAiForm.append("language", "ja");
  openAiForm.append("response_format", "json");

  try {
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiApiKey}` },
      body: openAiForm,
    });
    const data = (await response.json()) as { text?: unknown };
    if (!response.ok) {
      console.error("OpenAI transcription failed", response.status, JSON.stringify(data).slice(0, 500));
      return jsonResponse({ error: "openai_transcription_error" }, 502);
    }
    const text = typeof data.text === "string" ? data.text.trim().slice(0, 2000) : "";
    return jsonResponse({ text });
  } catch (error) {
    console.error("ippo-audio-transcribe failed", error);
    return jsonResponse({ error: "transcription_failed" }, 502);
  }
});
