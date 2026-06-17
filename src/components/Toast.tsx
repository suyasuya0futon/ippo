// 画面上部に出る小さな通知。保存失敗などを伝える。
import { useToast } from "../toast";

export default function Toast() {
  const msg = useToast();
  if (!msg) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        zIndex: 50,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          background: "#c97a7a",
          color: "#fff",
          padding: "10px 16px",
          borderRadius: 12,
          fontSize: 13,
          lineHeight: 1.5,
          maxWidth: 440,
          margin: "0 12px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
        }}
      >
        {msg}
      </div>
    </div>
  );
}
