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
  signal?: AbortSignal;
  onStatus: (status: IppoRealtimeStatus) => void;
  onError: (message: string) => void;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "unknown_error";
}

function statusFromEventType(type: string): IppoRealtimeStatus | null {
  if (type === "input_audio_buffer.speech_started") return "listening";
  if (type === "input_audio_buffer.speech_stopped") return "thinking";
  if (type === "response.output_audio.delta") return "speaking";
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
  signal,
  onStatus,
  onError,
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
  const { data, error } = await supabase.functions.invoke<RealtimeSessionResponse>(
    "ippo-realtime-session",
    {
      body: { taskTitle, taskTag, steps },
    },
  );
  throwIfAborted();

  if (error) {
    console.error("Realtime セッション作成失敗", error);
    stopLocalStream();
    throw new Error(`realtime_session_request_failed: ${errorMessage(error)}`);
  }
  if (data?.error) {
    console.error("Realtime セッション作成エラー", data.error);
    stopLocalStream();
    throw new Error(data.error);
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

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (timerId !== null) window.clearTimeout(timerId);
    stopLocalStream();
    pc.getSenders().forEach((sender) => sender.track?.stop());
    pc.close();
    audio.srcObject = null;
    audio.remove();
    signal?.removeEventListener("abort", handleAbort);
    onStatus("ended");
  };
  stopConversation = stop;

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
      const message = JSON.parse(String(event.data)) as { type?: unknown; error?: { message?: string } };
      if (typeof message.type === "string") {
        const status = statusFromEventType(message.type);
        if (status) onStatus(status);
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
