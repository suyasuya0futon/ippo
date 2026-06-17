// 一覧画面：すべてのアイテムを追加・編集・削除する場所。
// 一度きりのタスクを上に（タグ降順でまとまる）、毎日の習慣は下にまとめる。
// タグで絞り込める（タグの管理画面は持たない。書いて付けるだけ）。
import { useState } from "react";
import {
  useStore,
  todayStr,
  allTags,
  addItem,
  editItem,
  deleteItem,
  addToToday,
  removeFromToday,
  itemToInput,
} from "../store";
import { supabase } from "../supabase";
import type { Item } from "../types";
import ItemInput from "../components/ItemInput";

export function TagChip({ tag }: { tag: string | null }) {
  if (!tag) return null;
  return (
    <span
      className="chip"
      style={{
        background: "var(--surface-2)",
        color: "var(--text-soft)",
        border: "1px solid var(--line)",
        marginRight: 6,
      }}
    >
      {tag}
    </span>
  );
}

// タグ降順（タグ無しは末尾）。同じタグ内は新しい順。
const byTag = (a: Item, b: Item) => {
  const t = (b.tag ?? "").localeCompare(a.tag ?? "", "ja");
  return t !== 0 ? t : b.createdAt.localeCompare(a.createdAt);
};

export default function ListScreen() {
  const db = useStore();
  const [filter, setFilter] = useState<string | null>(null);

  const tags = allTags(db);
  const todayIds = new Set(db.today.filter((t) => t.date === todayStr()).map((t) => t.itemId));

  const filtered = db.items.filter((it) => (filter ? it.tag === filter : true));
  const tasks = filtered.filter((it) => !it.recurring).sort(byTag);
  const habits = filtered.filter((it) => it.recurring).sort(byTag);

  return (
    <div>
      <p className="section-title">追加する</p>
      <div className="card">
        <ItemInput onSubmit={(input, recurring) => addItem(input, recurring)} />
      </div>

      {tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 2px 4px" }}>
          <button
            className={`btn btn--small ${filter === null ? "btn--primary" : ""}`}
            style={{ borderRadius: 999 }}
            onClick={() => setFilter(null)}
          >
            すべて
          </button>
          {tags.map((t) => (
            <button
              key={t}
              className={`btn btn--small ${filter === t ? "btn--primary" : ""}`}
              style={{ borderRadius: 999 }}
              onClick={() => setFilter(filter === t ? null : t)}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      <div className="card">
        {tasks.length === 0 ? (
          <div className="empty">
            {filter
              ? `#${filter} のタスクはありません。`
              : "まだ何もありません。\nひとつ、小さなことから書いてみましょう。"}
          </div>
        ) : (
          tasks.map((it) => <ItemRow key={it.id} item={it} inToday={todayIds.has(it.id)} />)
        )}
      </div>

      {habits.length > 0 && (
        <>
          <p className="section-title">毎日の習慣</p>
          <div className="card">
            {habits.map((it) => (
              <ItemRow key={it.id} item={it} inToday={false} />
            ))}
          </div>
        </>
      )}

      <button
        className="btn--ghost btn"
        style={{ width: "100%", marginTop: 8 }}
        onClick={() => supabase.auth.signOut()}
      >
        ログアウト
      </button>
    </div>
  );
}

function ItemRow({ item, inToday }: { item: Item; inToday: boolean }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="taskitem" style={{ display: "block" }}>
        <ItemInput
          initialText={itemToInput(item)}
          initialRecurring={item.recurring}
          submitLabel="保存"
          autoFocus
          onSubmit={(input, recurring) => {
            editItem(item.id, input, recurring);
            setEditing(false);
          }}
        />
        <button className="btn--ghost btn" style={{ marginTop: 6 }} onClick={() => setEditing(false)}>
          キャンセル
        </button>
      </div>
    );
  }

  return (
    <div className="taskitem">
      <span className="taskitem__title">
        <TagChip tag={item.tag} />
        {item.title}
      </span>
      <span className="icon-actions">
        {!item.recurring && (
          <button
            className={`icon-btn ${inToday ? "icon-btn--active" : ""}`}
            title={inToday ? "今日から外す" : "今日に追加"}
            aria-label={inToday ? "今日から外す" : "今日に追加"}
            onClick={() => (inToday ? removeFromToday(item.id) : addToToday(item.id))}
          >
            🌱
          </button>
        )}
        <button
          className="icon-btn icon-btn--ghost"
          title="編集"
          aria-label="編集"
          onClick={() => setEditing(true)}
        >
          ✏️
        </button>
        <button
          className="icon-btn icon-btn--ghost"
          style={{ fontSize: 20 }}
          title="削除"
          aria-label="削除"
          onClick={() => deleteItem(item.id)}
        >
          ×
        </button>
      </span>
    </div>
  );
}
