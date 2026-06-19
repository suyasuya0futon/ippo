// アプリの枠。
// ログインしていなければログイン画面、していれば Supabase から読み込んでから本体を表示。
import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { hydrate, seedIfEmpty, promote, clearStore } from "./store";
import TodayScreen from "./screens/TodayScreen";
import TaskListView from "./screens/TaskListView";
import DoneBookScreen from "./screens/DoneBookScreen";
import LoginScreen from "./screens/LoginScreen";
import Toast from "./components/Toast";

type Tab = "today" | "future" | "donebook";

// タブのアイコン（lucide風の線画。currentColor 継承でアクティブ時に accent 色になる）。
const tabSvg = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

// 今日やる：双葉（少しずつ育てる）
function SproutIcon() {
  return (
    <svg {...tabSvg}>
      <path d="M7 20h10" />
      <path d="M10 20c5.5-2.5.8-6.4 3-10" />
      <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
      <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
    </svg>
  );
}

// 今後やる：時計（これから）
function ClockIcon() {
  return (
    <svg {...tabSvg}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

// できた帳：本（記録に残す）
function BookIcon() {
  return (
    <svg {...tabSvg}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

const TABS: { key: Tab; label: string; icon: ReactNode }[] = [
  { key: "today", label: "今日やる", icon: <SproutIcon /> },
  { key: "future", label: "今後やる", icon: <ClockIcon /> },
  { key: "donebook", label: "できた帳", icon: <BookIcon /> },
];

function Splash({ text }: { text: string }) {
  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">IPPO</h1>
      </header>
      <main className="app__body">
        <div className="empty" style={{ marginTop: 40 }}>{text}</div>
      </main>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("today");
  const [session, setSession] = useState<Session | null | undefined>(undefined); // undefined = 確認中
  // 読み込みが完了したユーザーID。これが現在のユーザーと一致したら表示OK。
  const [readyUserId, setReadyUserId] = useState<string | null>(null);

  // ログイン状態を監視
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // ログアウト時は読み込み完了状態もリセット（同ユーザー再ログイン時の一瞬の空表示を防ぐ）
      if (!s) setReadyUserId(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ログインしたらデータを読み込む（初回は初期データを入れる）
  // 依存はユーザーID のみ（トークン更新のたびに再読み込みしたくないため）。
  const userId = session?.user?.id ?? null;
  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      clearStore();
      return;
    }
    (async () => {
      await hydrate();
      await seedIfEmpty();
      await promote();
      if (!cancelled) setReadyUserId(userId);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const ready = Boolean(session) && readyUserId === userId;

  if (session === undefined) return <Splash text="読み込み中…" />;
  if (!session) return <LoginScreen />;
  if (!ready) return <Splash text="データを読み込み中…" />;

  return (
    <div className="app">
      <Toast />
      <main className="app__body" style={{ paddingTop: 16 }}>
        {tab === "today" && <TodayScreen />}
        {tab === "future" && <TaskListView mode="future" />}
        {tab === "donebook" && <DoneBookScreen />}
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tabbar__btn ${tab === t.key ? "tabbar__btn--active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            <span className="tabbar__icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
