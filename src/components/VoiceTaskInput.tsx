import { useEffect, useRef, useState } from "react";
import { allTags, saveVoiceTask, useStore } from "../store";
import { showToast } from "../toast";
import { parseVoiceTask, type VoiceTask } from "../voiceTask";
import { recognitionConstructor, speechError, type Recognition } from "../speechRecognition";

export default function VoiceTaskInput() {
  const db = useStore();
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<VoiceTask | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);
  const locked = useRef(false);

  function stop() {
    clearTimeout(timer.current);
    const active = recognition.current;
    recognition.current = null;
    if (active) {
      active.onresult = null;
      active.onerror = null;
      active.onend = null;
      active.abort();
    }
  }

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; stop(); };
  }, []);

  async function save(task: VoiceTask) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setMessage("保存中…");
    try {
      const result = await saveVoiceTask(task);
      if (!mounted.current) return;
      if (!result) throw new Error("save failed");
      setDraft(null);
      setOpen(false);
      showToast(`今日に追加：${task.title}［${task.tag ?? "タグなし"}］`);
    } catch {
      if (mounted.current) {
        setMessage("保存できませんでした。通信を確認して、再試行してください。");
      }
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function start() {
    if (locked.current || recognition.current) return;
    setOpen(true);
    const Constructor = recognitionConstructor();
    if (!Constructor) {
      setMessage("このブラウザでは音声入力を利用できません。今日やるの入力欄から追加してください。");
      return;
    }
    setDraft(null);
    setMessage("お話しください：猫砂 ／ 勉強、漏電遮断器まとめ");
    try {
      const active = new Constructor();
      recognition.current = active;
      active.lang = "ja-JP";
      active.continuous = false;
      active.interimResults = false;
      active.onresult = (event) => {
        const transcript = Array.from(event.results).filter((result) => result.isFinal)
          .map((result) => result[0].transcript).join(" ");
        if (!transcript) return;
        stop();
        setListening(false);
        const task = parseVoiceTask(transcript, allTags(db));
        if (!task) {
          setMessage("やることが聞き取れませんでした。「買物、猫砂」のようにお話しください。");
          return;
        }
        setDraft(task);
        void save(task);
      };
      active.onerror = (event) => {
        stop();
        setListening(false);
        setMessage(speechError(event.error));
      };
      active.onend = () => {
        stop();
        setListening(false);
        setMessage(speechError("no-speech"));
      };
      active.start();
      setListening(true);
      timer.current = setTimeout(() => {
        stop();
        setListening(false);
        setMessage(speechError("no-speech"));
      }, 20000);
    } catch {
      stop();
      setListening(false);
      setMessage("音声入力を開始できませんでした。マイクの設定を確認してください。");
    }
  }

  return <>
    <button type="button" className={`tabbar__btn ${listening ? "tabbar__btn--active" : ""}`}
      onClick={() => { if (open) { if (!busy) { stop(); setListening(false); setOpen(false); } } else start(); }}
      disabled={busy} aria-label="音声で今日のやることを追加" aria-expanded={open} aria-controls="voice-task-panel">
      <span className="tabbar__icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
      </svg></span>
      {listening ? "録音中" : "音声追加"}
    </button>
    {open && <section id="voice-task-panel" className="voice-task" aria-label="音声で追加">
      <div className="row voice-task__heading"><strong>音声で今日に追加</strong>
        <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={() => { stop(); setListening(false); setOpen(false); }}>閉じる</button>
      </div>
      <p className="voice-task__hint">タグ省略＝買物 · 1回に1件<br />「猫砂」「勉強、○○」「タグなし、○○」</p>
      <p role="status" className="voice-task__message">{message}</p>
      <div className="voice-task__actions">
        {draft && !busy && <button className="btn btn--small" onClick={() => void save(draft)}>再試行</button>}
        <button className="btn btn--small" disabled={busy} onClick={() => {
          if (listening) { stop(); setListening(false); setMessage("録音をキャンセルしました。"); }
          else start();
        }}>{listening ? "録音をキャンセル" : "もう一度話す"}</button>
      </div>
    </section>}
  </>;
}
