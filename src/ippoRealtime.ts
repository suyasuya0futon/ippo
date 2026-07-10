import { supabase } from "./supabase";

export const IPPO_AI_PROVIDER =
  (import.meta.env.VITE_IPPO_AI_PROVIDER as "gemini" | "openai-realtime" | undefined) ?? "gemini";

type RealtimeSessionResponse = {
  clientSecret?: string;
  expiresAt?: number;
  model?: string;
  maxSeconds?: number;
  sessionId?: string;
  error?: string;
  detail?: unknown;
};

type TranscriptionResponse = {
  text?: string;
  error?: string;
};

export type IppoRealtimeStatus =
  | "connecting"
  | "speaking"
  | "listening"
  | "thinking"
  | "ended"
  | "error";

export type IppoRealtimeConversation = {
  stop: () => void;
};

type StartRealtimeOptions = {
  taskTitle: string;
  taskTag?: string | null;
  steps?: Array<{ title: string; done: boolean }>;
  history?: Array<{ role: "user" | "assistant"; text: string }>;
  signal?: AbortSignal;
  onStatus: (status: IppoRealtimeStatus) => void;
  onError: (message: string) => void;
  onAssistantResponseStart?: () => void;
  onTranscript?: (text: string) => void;
  onAssistantTranscriptFinal?: (text: string) => void;
  onUserTranscript?: (text: string, spokenAt: string) => void;
  onTaskComplete?: () => void;
};

async function transcribeUserAudio(audio: Blob): Promise<string> {
  const form = new FormData();
  const extension = audio.type.includes("ogg") ? "ogg" : "webm";
  form.append("audio", audio, `speech.${extension}`);
  const { data, error } = await supabase.functions.invoke<TranscriptionResponse>("ippo-audio-transcribe", {
    body: form,
  });
  if (error || data?.error) throw new Error(data?.error ?? "audio_transcription_failed");
  return typeof data?.text === "string" ? data.text.trim() : "";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "unknown_error";
}

async function functionErrorDetail(error: unknown): Promise<string> {
  if (!error || typeof error !== "object" || !("context" in error)) return errorMessage(error);
  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) return errorMessage(error);

  try {
    const body = (await context.clone().json()) as RealtimeSessionResponse;
    const detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail ?? "");
    return [body.error, detail].filter(Boolean).join(": ").slice(0, 300) || errorMessage(error);
  } catch {
    return errorMessage(error);
  }
}

function statusFromEventType(type: string): IppoRealtimeStatus | null {
  if (type === "input_audio_buffer.speech_started") return "listening";
  if (type === "input_audio_buffer.speech_stopped") return "thinking";
  if (type === "output_audio_buffer.started") return "speaking";
  if (type === "output_audio_buffer.stopped") return "listening";
  if (type === "error") return "error";
  return null;
}

function createRemoteAudioElement() {
  const audio = document.createElement("audio");
  audio.autoplay = true;
  audio.setAttribute("playsinline", "true");
  audio.hidden = true;
  document.body.appendChild(audio);
  return audio;
}

export async function startIppoRealtimeConversation({
  taskTitle,
  taskTag,
  steps,
  history,
  signal,
  onStatus,
  onError,
  onAssistantResponseStart,
  onTranscript,
  onAssistantTranscriptFinal,
  onUserTranscript,
  onTaskComplete,
}: StartRealtimeOptions): Promise<IppoRealtimeConversation> {
  onStatus("connecting");

  let localStream: MediaStream | null = null;
  let stopConversation: (() => void) | null = null;
  const abortError = () => new DOMException("Realtime conversation was cancelled", "AbortError");
  const stopLocalStream = () => localStream?.getTracks().forEach((track) => track.stop());
  const handleAbort = () => {
    stopConversation?.();
    stopLocalStream();
  };
  const throwIfAborted = () => {
    if (signal?.aborted) {
      handleAbort();
      throw abortError();
    }
  };
  signal?.addEventListener("abort", handleAbort, { once: true });

  localStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  throwIfAborted();
  const localAudioTracks = localStream.getAudioTracks();
  const setMicEnabled = (enabled: boolean) => {
    localAudioTracks.forEach((track) => {
      track.enabled = enabled;
    });
  };
  const { data, error } = await supabase.functions.invoke<RealtimeSessionResponse>(
    "ippo-realtime-session",
    {
      body: { taskTitle, taskTag, steps, history },
    },
  );
  throwIfAborted();

  if (error) {
    console.error("Realtime セッション作成失敗", error);
    stopLocalStream();
    throw new Error(`realtime_session_request_failed: ${await functionErrorDetail(error)}`);
  }
  if (data?.error) {
    console.error("Realtime セッション作成エラー", data.error);
    stopLocalStream();
    const detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail ?? "");
    throw new Error([data.error, detail].filter(Boolean).join(": ").slice(0, 300));
  }

  const clientSecret = data?.clientSecret;
  if (!clientSecret) {
    stopLocalStream();
    throw new Error("missing_realtime_client_secret");
  }

  const pc = new RTCPeerConnection();
  const audio = createRemoteAudioElement();
  const maxSeconds = Math.max(15, Number(data?.maxSeconds ?? 180));
  let stopped = false;
  let timerId: number | null = null;
  let userSpeechRecorder: MediaRecorder | null = null;
  let userSpeechChunks: Blob[] = [];
  let userSpeechEndedAt = "";
  let taskCompletePending = false;
  let taskCompleteNotified = false;
  let taskCompleteTimerId: number | null = null;

  const startUserSpeechRecorder = () => {
    if (stopped || userSpeechRecorder || !localStream || typeof MediaRecorder === "undefined") return;
    try {
      userSpeechChunks = [];
      userSpeechRecorder = new MediaRecorder(localStream);
      userSpeechRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) userSpeechChunks.push(event.data);
      };
      userSpeechRecorder.onstop = () => {
        const chunks = userSpeechChunks;
        const spokenAt = userSpeechEndedAt || new Date().toISOString();
        userSpeechChunks = [];
        userSpeechRecorder = null;
        userSpeechEndedAt = "";
        if (!chunks.length || stopped) return;
        const audioBlob = new Blob(chunks, { type: chunks[0]?.type || "audio/webm" });
        void transcribeUserAudio(audioBlob)
          .then((text) => {
            if (text && !stopped) onUserTranscript?.(text, spokenAt);
          })
          .catch((error) => console.warn("ユーザー音声の文字起こしに失敗", error));
      };
      userSpeechRecorder.start();
    } catch (error) {
      console.warn("ユーザー音声の録音を開始できませんでした", error);
      userSpeechRecorder = null;
    }
  };

  const stopUserSpeechRecorder = () => {
    if (userSpeechRecorder?.state === "recording") userSpeechRecorder.stop();
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (timerId !== null) window.clearTimeout(timerId);
    if (taskCompleteTimerId !== null) window.clearTimeout(taskCompleteTimerId);
    if (userSpeechRecorder) {
      userSpeechRecorder.onstop = null;
      stopUserSpeechRecorder();
      userSpeechRecorder = null;
      userSpeechChunks = [];
    }
    stopLocalStream();
    pc.getSenders().forEach((sender) => sender.track?.stop());
    pc.close();
    audio.srcObject = null;
    audio.remove();
    signal?.removeEventListener("abort", handleAbort);
    onStatus("ended");
  };
  stopConversation = stop;

  // complete_task が呼ばれたら、完了結果をモデルへ返してほめ言葉を話してもらい、
  // 言い終えた合図（音声の停止イベント）を待ってから完了を通知する。
  const notifyTaskComplete = () => {
    if (taskCompleteNotified || stopped) return;
    taskCompleteNotified = true;
    if (taskCompleteTimerId !== null) window.clearTimeout(taskCompleteTimerId);
    taskCompleteTimerId = null;
    onTaskComplete?.();
  };
  // ほめ言葉が届かないまま待ち続けないための保険。タスクは完了にせず、会話だけ終える。
  const scheduleTaskCompleteFallback = (ms: number) => {
    if (taskCompleteTimerId !== null) window.clearTimeout(taskCompleteTimerId);
    taskCompleteTimerId = window.setTimeout(() => {
      taskCompleteTimerId = null;
      if (taskCompleteNotified || stopped) return;
      onError("task_complete_timeout");
      stop();
    }, ms);
  };

  pc.ontrack = (event) => {
    audio.srcObject = event.streams[0];
    void audio.play().catch(() => {
      // iOS Safari can delay autoplay until the user gesture settles. The track is still attached.
    });
  };

  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  const dataChannel = pc.createDataChannel("oai-events");
  dataChannel.onopen = () => {
    onStatus("speaking");
    dataChannel.send(
      JSON.stringify({
        type: "response.create",
        response: {
          output_modalities: ["audio"],
        },
      }),
    );
  };
  dataChannel.onmessage = (event) => {
    try {
      const message = JSON.parse(String(event.data)) as {
        type?: unknown;
        delta?: unknown;
        transcript?: unknown;
        item?: { type?: unknown; name?: unknown; call_id?: unknown };
        error?: { message?: string };
      };
      if (typeof message.type === "string") {
        console.info("Realtime event", message.type);
        if (message.type === "response.output_audio_transcript.delta" && typeof message.delta === "string") {
          console.info("Realtime transcript", message.delta);
          onTranscript?.(message.delta);
        }
        if (message.type === "response.output_audio_transcript.done" && typeof message.transcript === "string") {
          console.info("Realtime transcript complete", message.transcript);
          onAssistantTranscriptFinal?.(message.transcript);
        }
        const status = statusFromEventType(message.type);
        if (status) onStatus(status);
        if (message.type === "response.created") onAssistantResponseStart?.();
        if (message.type === "input_audio_buffer.speech_stopped") {
          userSpeechEndedAt = new Date().toISOString();
          stopUserSpeechRecorder();
        }
        if (
          message.type === "response.output_item.done" &&
          message.item?.type === "function_call" &&
          message.item.name === "complete_task" &&
          typeof message.item.call_id === "string"
        ) {
          taskCompletePending = true;
          // 関数の結果をモデルへ返し、締めくくりのほめ言葉を音声で作ってもらう。
          dataChannel.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: message.item.call_id,
                output: JSON.stringify({ success: true }),
              },
            }),
          );
          dataChannel.send(
            JSON.stringify({
              type: "response.create",
              response: {
                output_modalities: ["audio"],
              },
            }),
          );
          scheduleTaskCompleteFallback(15000);
        }
        if (message.type === "output_audio_buffer.started") {
          if (taskCompletePending) scheduleTaskCompleteFallback(15000);
          stopUserSpeechRecorder();
          setMicEnabled(false);
        }
        if (message.type === "output_audio_buffer.stopped") {
          if (taskCompletePending) {
            // ほめ言葉を言い終えた。マイクは再開せず、そのまま完了へ。
            notifyTaskComplete();
          } else {
            setMicEnabled(true);
            startUserSpeechRecorder();
          }
        }
      }
      if (message.type === "error") {
        onError(message.error?.message ?? "realtime_event_error");
        stop();
      }
    } catch {
      // Ignore non-JSON diagnostic frames.
    }
  };
  dataChannel.onerror = () => {
    onStatus("error");
    onError("realtime_data_channel_error");
    stop();
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  if (signal?.aborted) {
    stop();
    throw abortError();
  }

  let sdpResponse: Response;
  try {
    sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${clientSecret}`,
        "Content-Type": "application/sdp",
      },
    });
  } catch (error) {
    console.error("Realtime SDP 接続失敗", error);
    stop();
    throw new Error("realtime_sdp_failed", { cause: error });
  }

  if (!sdpResponse.ok) {
    const detail = await sdpResponse.text();
    console.error("Realtime SDP 接続失敗", sdpResponse.status, detail.slice(0, 500));
    stop();
    throw new Error(`realtime_sdp_failed: ${sdpResponse.status} ${detail.slice(0, 180)}`);
  }

  if (signal?.aborted) {
    stop();
    throw abortError();
  }

  await pc.setRemoteDescription({
    type: "answer",
    sdp: await sdpResponse.text(),
  });

  if (signal?.aborted) {
    stop();
    throw abortError();
  }

  timerId = window.setTimeout(stop, maxSeconds * 1000);
  return { stop };
}
