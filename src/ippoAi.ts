import { supabase } from "./supabase";

export type IppoMessage = {
  role: "ippo" | "user";
  text: string;
};

type IppoChatResponse = {
  text?: string;
  error?: string;
};

export async function requestIppoReply(taskTitle: string, messages: IppoMessage[]): Promise<string> {
  const { data, error } = await supabase.functions.invoke<IppoChatResponse>("ippo-chat", {
    body: { taskTitle, messages },
  });

  if (error) {
    console.error("一歩さん API 呼び出し失敗", error);
    throw new Error("ippo_request_failed");
  }
  if (data?.error) {
    console.error("一歩さん API エラー", data.error);
    throw new Error(data.error);
  }
  const text = data?.text?.trim();
  if (!text) throw new Error("ippo_empty_response");
  return text;
}
