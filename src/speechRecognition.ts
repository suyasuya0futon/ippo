export interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}

export function recognitionConstructor(): (new () => Recognition) | undefined {
  const browser = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}

export function speechError(error: string): string {
  switch (error) {
    case "not-allowed": case "service-not-allowed":
      return "マイクの使用を許可して、もう一度お試しください。";
    case "audio-capture": return "マイクが見つかりません。接続を確認してください。";
    case "network": return "音声認識に接続できません。通信を確認してお試しください。";
    default: return "聞き取れませんでした。もう一度マイクを押してお話しください。";
  }
}
