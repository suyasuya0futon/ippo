// アプリの枠。
// ログインしていなければログイン画面、していれば Supabase から読み込んでから本体を表示。
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { hydrate, seedIfEmpty, clearStore } from "./store";
import TodayScreen from "./screens/TodayScreen";
import TaskListView from "./screens/TaskListView";
import CalendarScreen from "./screens/CalendarScreen";
import LoginScreen from "./screens/LoginScreen";
import Toast from "./components/Toast";

type Tab = "today" | "future" | "calendar";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "today", label: "今日やる", icon: "🌱" },
  { key: "future", label: "今後やる", icon: "⏳" },
  { key: "calendar", label: "カレンダー", icon: "📅" },
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
        {tab === "calendar" && <CalendarScreen />}

        <footer
          style={{
            marginTop: 32,
            paddingTop: 12,
            borderTop: "1px solid var(--line)",
            textAlign: "center",
          }}
        >
          <button
            className="btn--ghost btn"
            style={{ fontSize: 12 }}
            onClick={() => supabase.auth.signOut()}
          >
            ログアウト
          </button>
        </footer>
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
