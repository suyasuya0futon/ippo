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
  taskTag?: string | null;
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

function buildInput(taskTitle: string, taskTag: string, messages: IppoMessage[]) {
  const conversation = messages
    .map((message) => `${message.role === "user" ? "ユーザー" : "AI"}: ${message.text}`)
    .join("\n");
  const targetLines = [`対象タスク: ${taskTitle}`];
  if (taskTag) targetLines.push(`対象タグ: #${taskTag}`);
  if (taskTag === "裁縫") targetLines.push("タグ補足: #裁縫 の作業は基本的にミシンを使う前提で考える。");
  if (taskTag === "買物") {
    targetLines.push(
      [
        "タグ補足: #買物 のタスク自体が買い物リストの1項目。対象タスクの商品は、買う必要がある前提で扱う。",
        "買物タグでは、家にあるか、在庫があるか、詰め替えか本体か、必要かどうかを質問しない。",
        "買物タグでは、リストやメモへの追加を提案しない。買う店、買うタイミング、ネット注文、カートに入れるなど、購入に進む入口を提案する。",
      ].join("\n")
    );
  }

  return [
    "あなたはタスクを進めるためのAI相談相手です。",
    "このアプリ「一歩」は、今日の行動に向き合うための個人用タスクアプリです。",
    "ユーザーを管理・評価するのではなく、淡々と次の一歩を手伝う存在です。",
    "AIとの会話や提案は保存されず、完了記録はタスク本体だけに残ります。",
    "内容は簡潔に伝え、説明しすぎない。",
    "タスクを保存するステップに分解せず、今どこで詰まっているかを聞き、次に動ける小さな入口を一緒に探す。",
    "返答は日本語で、最大100文字程度。最後は自然な短い問いで終える。",
    ...targetLines,
    "",
    "これまでの会話:",
    conversation || "まだ会話はありません。",
    "",
    "AIの次の返答だけを書いてください。",
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

  const taskTag = String(body.taskTag ?? "").trim().replace(/^[#＃]/, "").slice(0, 80);
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
        input: buildInput(taskTitle, taskTag, messages),
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
