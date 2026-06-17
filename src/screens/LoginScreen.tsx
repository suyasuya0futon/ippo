// ログイン画面：GitHub でログイン（OAuth）。
// メールもパスワードも使わないので、送信回数制限などに当たらない。
// 一度ログインすれば状態は続く。
import { useState } from "react";
import { supabase } from "../supabase";

export default function LoginScreen() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loginWithGitHub() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/` },
    });
    // 成功すると GitHub の認証ページへ遷移する（戻ってきたら App が拾う）
    if (error) {
      setError(error.message);
      setLoading(false);
    }
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
            GitHub アカウントでログインしてください。
            ボタンを押すと GitHub の認証画面に進み、終わるとここに戻ってきます。
          </p>
          <button
            className="btn btn--primary"
            style={{ width: "100%" }}
            onClick={loginWithGitHub}
            disabled={loading}
          >
            {loading ? "GitHub へ移動中…" : "GitHub でログイン"}
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
