// ログイン画面：メールアドレス＋パスワード方式。
// メールを送らないので「送信回数制限」に当たらない。一度ログインすれば状態は続く。
import { useState } from "react";
import { supabase } from "../supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function login() {
    const addr = email.trim();
    if (!addr || !password) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: addr, password });
    setLoading(false);
    if (error) setError(error.message);
    // 成功時は App 側の onAuthStateChange が拾って自動で本体に切り替わる
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">IPPO</h1>
        <p className="app__tagline">動けない時に、少しずつ一歩を刻む。</p>
      </header>

      <main className="app__body">
        <div className="card" style={{ marginTop: 24 }}>
          <p style={{ marginTop: 0, lineHeight: 1.8 }}>
            メールアドレスとパスワードでログインしてください。
          </p>
          <input
            type="text"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            style={{ marginTop: 10 }}
          />
          <button
            className="btn btn--primary"
            style={{ width: "100%", marginTop: 12 }}
            onClick={login}
            disabled={loading}
          >
            {loading ? "ログイン中…" : "ログイン"}
          </button>
          {error && (
            <p style={{ color: "#c97a7a", fontSize: 13, marginBottom: 0 }}>
              うまくいきませんでした：{error}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
