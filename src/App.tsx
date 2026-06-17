// アプリの枠。下のタブで「今日」「一覧」「カレンダー」を切り替えるだけ。
import { useState } from "react";
import TodayScreen from "./screens/TodayScreen";
import ListScreen from "./screens/ListScreen";
import CalendarScreen from "./screens/CalendarScreen";

type Tab = "today" | "list" | "calendar";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "today", label: "今日", icon: "🌱" },
  { key: "list", label: "一覧", icon: "📋" },
  { key: "calendar", label: "カレンダー", icon: "📅" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("today");

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">IPPO</h1>
        <p className="app__tagline">動けない時に、少しずつ一歩を刻む。</p>
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
