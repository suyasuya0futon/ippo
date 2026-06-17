// Supabase クライアント。URL と anon キーは .env.local から読み込む。
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  // 設定漏れに早く気づけるように
  console.error("Supabase の環境変数が設定されていません（.env.local を確認）。");
}

export const supabase = createClient(url, anonKey);
