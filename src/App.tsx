// アプリの枠。
// ログインしていなければログイン画面、していれば Supabase から読み込んでから本体を表示。
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { hydrate, seedIfEmpty, clearStore } from "./store";
import TodayScreen from "./screens/TodayScreen";
import ListScreen from "./screens/ListScreen";
import CalendarScreen from "./screens/CalendarScreen";
import LoginScreen from "./screens/LoginScreen";

type Tab = "today" | "list" | "calendar";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "today", label: "今日", icon: "🌱" },
  { key: "list", label: "一覧", icon: "📋" },
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
  const [ready, setReady] = useState(false);

  // ログイン状態を監視
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // ログインしたらデータを読み込む（初回は初期データを入れる）
  useEffect(() => {
    let cancelled = false;
    if (session) {
      setReady(false);
      (async () => {
        await hydrate();
        await seedIfEmpty();
        if (!cancelled) setReady(true);
      })();
    } else {
      clearStore();
      setReady(false);
    }
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  if (session === undefined) return <Splash text="読み込み中…" />;
  if (!session) return <LoginScreen />;
  if (!ready) return <Splash text="データを読み込み中…" />;

  return (
    <div className="app">
      <header className="app__header">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 className="app__title">IPPO</h1>
            <p className="app__tagline">動けない時に、少しずつ一歩を刻む。</p>
          </div>
          <button className="btn--ghost btn" onClick={() => supabase.auth.signOut()}>
            ログアウト
          </button>
        </div>
      </header>

      <main className="app__body">
        {tab === "today" && <TodayScreen />}
        {tab === "list" && <ListScreen />}
        {tab === "calendar" && <CalendarScreen />}
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
