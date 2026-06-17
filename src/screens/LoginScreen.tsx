// ログイン画面：メールアドレスに「ログイン用リンク」を送る方式（パスワード不要）。
// 一度ログインすれば、次からは自動でログイン状態が続く。
import { useState } from "react";
import { supabase } from "../supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function send() {
    const addr = email.trim();
    if (!addr) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">IPPO</h1>
        <p className="app__tagline">動けない時に、少しずつ一歩を刻む。</p>
      </header>

      <main className="app__body">
        <div className="card" style={{ marginTop: 24 }}>
          {sent ? (
            <>
              <p style={{ marginTop: 0, lineHeight: 1.8 }}>
                <strong>{email}</strong> にログイン用のリンクを送りました。
                <br />
                メールを開いてリンクを押すと、ここに戻ってログインできます。
              </p>
              <button className="btn" style={{ width: "100%" }} onClick={() => setSent(false)}>
                別のメールで送り直す
              </button>
            </>
          ) : (
            <>
              <p style={{ marginTop: 0, lineHeight: 1.8 }}>
                メールアドレスを入れて、ログイン用のリンクを受け取ってください。
                パスワードは要りません。
              </p>
              <input
                type="text"
                inputMode="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
              />
              <button
                className="btn btn--primary"
                style={{ width: "100%", marginTop: 12 }}
                onClick={send}
                disabled={loading}
              >
                {loading ? "送信中…" : "ログイン用リンクを送る"}
              </button>
              {error && (
                <p style={{ color: "#c97a7a", fontSize: 13, marginBottom: 0 }}>
                  うまくいきませんでした：{error}
                </p>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
