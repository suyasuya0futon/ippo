const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AuthUser = {
  id?: unknown;
};

type RequestBody = {
  taskTitle?: string;
  taskTag?: string | null;
  steps?: Array<{ title?: unknown; done?: unknown }>;
  history?: Array<{ role?: unknown; text?: unknown }>;
};

type UsageRow = {
  id?: string;
  estimated_cost_usd?: number | string | null;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function readNumberEnv(name: string, fallback: number): number {
  const raw = Deno.env.get(name);
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function isoDateStart(date: Date): string {
  return date.toISOString();
}

function getUsageWindow(now: Date, timezoneOffsetMinutes: number) {
  const offsetMs = timezoneOffsetMinutes * 60 * 1000;
  const shiftedNow = new Date(now.getTime() + offsetMs);
  const todayStart = new Date(
    Date.UTC(shiftedNow.getUTCFullYear(), shiftedNow.getUTCMonth(), shiftedNow.getUTCDate()) - offsetMs,
  );
  const monthStart = new Date(
    Date.UTC(shiftedNow.getUTCFullYear(), shiftedNow.getUTCMonth(), 1) - offsetMs,
  );

  return {
    todayStart: isoDateStart(todayStart),
    monthStart: isoDateStart(monthStart),
  };
}

async function requireAuthenticatedUser(req: Request): Promise<{ userId: string } | Response> {
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase auth environment variables are missing");
    return jsonResponse({ error: "auth_not_configured" }, 500);
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: authorization,
      apikey: supabaseAnonKey,
    },
  });

  if (!response.ok) return jsonResponse({ error: "unauthorized" }, 401);

  const user = (await response.json()) as AuthUser;
  if (typeof user.id !== "string" || !user.id) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  return { userId: user.id };
}

async function hashUserId(userId: string): Promise<string> {
  const bytes = new TextEncoder().encode(userId);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function usageHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Accept-Profile": "ippo",
    "Content-Profile": "ippo",
    "Content-Type": "application/json",
  };
}

async function fetchUsageRows(
  supabaseUrl: string,
  serviceRoleKey: string,
  params: Record<string, string>,
): Promise<UsageRow[]> {
  const url = new URL(`${supabaseUrl}/rest/v1/ai_realtime_sessions`);
  url.searchParams.set("select", "id,estimated_cost_usd");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const response = await fetch(url, {
    headers: usageHeaders(serviceRoleKey),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Failed to fetch realtime usage", response.status, detail.slice(0, 500));
    throw new Error("usage_fetch_failed");
  }

  return (await response.json()) as UsageRow[];
}

function sumEstimatedCost(rows: UsageRow[]): number {
  return rows.reduce((sum, row) => {
    const value = Number(row.estimated_cost_usd ?? 0);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
}

async function insertUsageRow(
  supabaseUrl: string,
  serviceRoleKey: string,
  row: Record<string, unknown>,
) {
  const response = await fetch(`${supabaseUrl}/rest/v1/ai_realtime_sessions`, {
    method: "POST",
    headers: {
      ...usageHeaders(serviceRoleKey),
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Failed to insert realtime usage", response.status, detail.slice(0, 500));
    throw new Error("usage_insert_failed");
  }
}

function buildInstructions(
  taskTitle: string,
  taskTag: string,
  steps: Array<{ title: string; done: boolean }>,
  history: Array<{ role: "user" | "assistant"; text: string }>,
) {
  const targetLines = [`対象タスク: ${taskTitle}`];
  if (taskTag) targetLines.push(`対象タグ: #${taskTag}`);
  if (taskTag === "裁縫") targetLines.push("タグ補足: #裁縫 の作業は基本的にミシンを使う前提で考える。");
  if (taskTag === "買物") {
    targetLines.push(
      "タグ補足: #買物 では在庫確認やメモ追加ではなく、買う店、買うタイミング、ネット注文、カートに入れるなど購入に進む入口を提案する。",
    );
  }
  const stepLines = steps.length
    ? steps.map((step) => `- [${step.done ? "完了" : "未完了"}] ${step.title}`)
    : ["（まだ登録されていません）"];
  const historyLines = history.length
    ? history.map((message) => `${message.role === "user" ? "ユーザー" : "AI"}: ${message.text}`)
    : ["（まだ会話はありません）"];

  return [
    "あなたはタスクを進めるためのAI伴走者です。",
    "説明役ではなく、ユーザーが今すぐ動ける次の一歩だけを音声で案内してください。",
    "一度に全部説明しない。毎回、短い一歩を1つだけ伝える。",
    "ユーザーが「できた」「開いた」「やった」など返したら、次の一歩を1つだけ伝える。",
    "ユーザーが「完了して」「全部終わった」などタスク全体の完了を伝えたら、complete_task ツールを呼ぶ。",
    "complete_task の結果が返ったら、短くあたたかい言葉でほめて会話を締めくくる。それがこの会話の最後の発話になる。",
    "complete_task はタスク全体が終わったときだけ呼ぶ。一歩できた報告だけなら呼ばず、次の一歩を案内する。",
    "ユーザーが困っていたら、選択肢を増やさず、もっと小さい一歩にする。",
    "返答は日本語で、自然な会話調。必要なことを言い切ってから終える。長くても150文字程度。",
    "「じゃあ」「では」「それじゃ」などのつなぎ言葉から始めず、伝えたい内容から自然に話し始める。",
    "接続直後は、対象タスクに合わせて最初の一歩をあなたから話しかける。",
    ...targetLines,
    "このタスクに登録済みの小さな一歩:",
    ...stepLines,
    "登録済みの未完了一歩があれば、そのうち次に取りかかるものを優先する。",
    "直近の会話ログ（文脈として参照し、同じ説明を繰り返さない）:",
    ...historyLines,
  ].join("\n");
}

function sanitizeSteps(steps: Array<{ title?: unknown; done?: unknown }>) {
  return steps
    .map((step) => ({
      title: String(step.title ?? "").trim().slice(0, 200),
      done: step.done === true,
    }))
    .filter((step) => step.title.length > 0)
    .slice(0, 20);
}

function sanitizeHistory(history: Array<{ role?: unknown; text?: unknown }>) {
  return history
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      text: String(message.text ?? "").trim().slice(0, 500),
    }))
    .filter((message) => message.text.length > 0)
    .slice(-20);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const authResult = await requireAuthenticatedUser(req);
  if (authResult instanceof Response) return authResult;

  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiApiKey) return jsonResponse({ error: "missing_openai_api_key" }, 500);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "usage_store_not_configured" }, 500);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const taskTitle = String(body.taskTitle ?? "").trim().slice(0, 200);
  if (!taskTitle) return jsonResponse({ error: "missing_task_title" }, 400);

  const taskTag = String(body.taskTag ?? "").trim().replace(/^[#＃]/, "").slice(0, 80);
  const steps = sanitizeSteps(Array.isArray(body.steps) ? body.steps : []);
  const history = sanitizeHistory(Array.isArray(body.history) ? body.history : []);
  const model = Deno.env.get("OPENAI_REALTIME_MODEL") ?? "gpt-realtime-2.1-mini";
  const voice = Deno.env.get("OPENAI_REALTIME_VOICE") ?? "marin";
  const maxSeconds = Math.max(15, Math.floor(readNumberEnv("OPENAI_REALTIME_MAX_SECONDS", 180)));
  const dailyLimit = Math.floor(readNumberEnv("OPENAI_REALTIME_DAILY_SESSION_LIMIT", 20));
  const monthlyLimit = Math.floor(readNumberEnv("OPENAI_REALTIME_MONTHLY_SESSION_LIMIT", 300));
  const monthlyBudgetUsd = readNumberEnv("OPENAI_REALTIME_MONTHLY_BUDGET_USD", 5);
  const estimatedCostUsd = readNumberEnv("OPENAI_REALTIME_ESTIMATED_COST_USD", 0.0166);
  const timezoneOffsetMinutes = Math.floor(readNumberEnv("OPENAI_REALTIME_LIMIT_TZ_OFFSET_MINUTES", 540));

  const now = new Date();
  const { todayStart, monthStart } = getUsageWindow(now, timezoneOffsetMinutes);

  try {
    const [dailyRows, monthlyRows] = await Promise.all([
      fetchUsageRows(supabaseUrl, serviceRoleKey, {
        user_id: `eq.${authResult.userId}`,
        started_at: `gte.${todayStart}`,
      }),
      fetchUsageRows(supabaseUrl, serviceRoleKey, {
        started_at: `gte.${monthStart}`,
      }),
    ]);

    const monthlyEstimatedCost = sumEstimatedCost(monthlyRows);
    if (dailyLimit > 0 && dailyRows.length >= dailyLimit) {
      return jsonResponse({ error: "daily_realtime_limit_exceeded" }, 429);
    }
    if (monthlyLimit > 0 && monthlyRows.length >= monthlyLimit) {
      return jsonResponse({ error: "monthly_realtime_limit_exceeded" }, 429);
    }
    if (monthlyBudgetUsd > 0 && monthlyEstimatedCost + estimatedCostUsd > monthlyBudgetUsd) {
      return jsonResponse({ error: "monthly_realtime_budget_exceeded" }, 429);
    }

    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": await hashUserId(authResult.userId),
      },
      body: JSON.stringify({
        expires_after: {
          anchor: "created_at",
          seconds: Math.min(maxSeconds + 60, 600),
        },
        session: {
          type: "realtime",
          model,
          instructions: buildInstructions(taskTitle, taskTag, steps, history),
          output_modalities: ["audio"],
          // 音声トークンは文字数より速く消費するため、短い案内でも途中で途切れない余裕を持たせる。
          max_output_tokens: 1000,
          tools: [
            {
              type: "function",
              name: "complete_task",
              description:
                "ユーザーがタスク全体の完了を伝えたときに呼ぶ。アプリがタスクを完了にして、この会話を終了する。",
              parameters: {
                type: "object",
                properties: {},
                additionalProperties: false,
              },
            },
          ],
          tool_choice: "auto",
          audio: {
            input: {
              turn_detection: {
                type: "server_vad",
                create_response: true,
                interrupt_response: false,
                prefix_padding_ms: 300,
                silence_duration_ms: 650,
              },
            },
            output: {
              voice,
            },
          },
        },
      }),
    });

    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      console.error("OpenAI realtime client secret error", response.status, JSON.stringify(data).slice(0, 500));
      return jsonResponse({ error: "openai_realtime_error", detail: data }, 502);
    }

    const clientSecret = data.value;
    if (typeof clientSecret !== "string" || !clientSecret) {
      return jsonResponse({ error: "missing_client_secret" }, 502);
    }

    const sessionId = crypto.randomUUID();
    await insertUsageRow(supabaseUrl, serviceRoleKey, {
      id: sessionId,
      user_id: authResult.userId,
      model,
      max_seconds: maxSeconds,
      estimated_cost_usd: estimatedCostUsd,
      started_at: now.toISOString(),
    });

    return jsonResponse({
      clientSecret,
      expiresAt: data.expires_at,
      model,
      maxSeconds,
      sessionId,
    });
  } catch (error) {
    console.error("ippo-realtime-session failed", error);
    return jsonResponse({ error: "realtime_session_failed" }, 502);
  }
});
