const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type IppoMessage = {
  role: "ippo" | "user";
  text: string;
};

type RequestBody = {
  taskTitle?: string;
  messages?: IppoMessage[];
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sanitizeMessages(messages: IppoMessage[]): IppoMessage[] {
  return messages
    .filter((message) => message.role === "ippo" || message.role === "user")
    .map((message) => ({
      role: message.role,
      text: String(message.text ?? "").slice(0, 500),
    }))
    .filter((message) => message.text.trim().length > 0)
    .slice(-8);
}

function extractText(data: Record<string, unknown>): string {
  const direct = data.output_text;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const steps = data.steps;
  if (!Array.isArray(steps)) return "";

  for (const step of steps) {
    if (!step || typeof step !== "object") continue;
    const content = (step as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string" && text.trim()) return text.trim();
    }
  }
  return "";
}

function geminiErrorDetail(data: Record<string, unknown>): string {
  const error = data.error;
  if (!error || typeof error !== "object") return "unknown_gemini_error";

  const detail = error as { code?: unknown; status?: unknown; message?: unknown };
  const parts = [detail.code, detail.status, detail.message]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map((part) => part.trim());

  return parts.join(": ").slice(0, 500) || "unknown_gemini_error";
}

function buildInput(taskTitle: string, messages: IppoMessage[]) {
  const conversation = messages
    .map((message) => `${message.role === "user" ? "ユーザー" : "一歩さん"}: ${message.text}`)
    .join("\n");

  return [
    "あなたはタスク相談相手の「一歩さん」。",
    "ユーザーは、うつ状態や疲労で動き出せないことがある。",
    "医療助言・診断・治療判断はしない。危機的な自傷他害の表現があれば、身近な人や緊急窓口への相談を短く促す。",
    "叱らない。急かさない。説教しない。『頑張れ』を多用しない。",
    "タスクを保存するステップに分解するのではなく、今どこで詰まっているかを聞き、次に動ける小さな入口を一緒に探す。",
    "返答は日本語で、最大120文字程度。最後は自然な短い問いで終える。",
    `対象タスク: ${taskTitle}`,
    "",
    "これまでの会話:",
    conversation || "まだ会話はありません。",
    "",
    "一歩さんの次の返答だけを書いてください。",
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return jsonResponse({ error: "missing_gemini_api_key" }, 500);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const taskTitle = String(body.taskTitle ?? "").trim().slice(0, 200);
  if (!taskTitle) return jsonResponse({ error: "missing_task_title" }, 400);

  const messages = sanitizeMessages(Array.isArray(body.messages) ? body.messages : []);
  const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.1-flash-lite";

  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: buildInput(taskTitle, messages),
      }),
    });

    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      const detail = geminiErrorDetail(data);
      console.error("Gemini response error", response.status, detail);
      return jsonResponse({ error: "gemini_error", detail }, 502);
    }

    const text = extractText(data);
    if (!text) return jsonResponse({ error: "empty_response" }, 502);
    return jsonResponse({ text });
  } catch (error) {
    console.error("ippo-chat failed", error);
    return jsonResponse({ error: "request_failed" }, 502);
  }
});
