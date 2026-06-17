// 一覧画面：すべてのアイテムを追加・編集・削除する場所。
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
import type { Item } from "../types";
import ItemInput from "../components/ItemInput";

const PALETTE = ["#7da9c9", "#9ec7a4", "#c9a9c4", "#d6b48a", "#a4b0c9", "#c99a9a", "#8fbcb0"];

export function tagColor(tag: string): string {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function TagChip({ tag }: { tag: string | null }) {
  if (!tag) return null;
  return (
    <span className="chip" style={{ background: tagColor(tag), marginLeft: 6 }}>
      {tag}
    </span>
  );
}

export default function ListScreen() {
  const db = useStore();
  const [filter, setFilter] = useState<string | null>(null);

  const tags = allTags(db);
  const todayIds = new Set(
    db.today.filter((t) => t.date === todayStr()).map((t) => t.itemId)
  );

  const items = db.items
    .filter((it) => (filter ? it.tag === filter : true))
    .slice()
    .reverse(); // 新しく足したものを上に

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
        {items.length === 0 ? (
          <div className="empty">
            {filter ? `#${filter} のアイテムはありません。` : "まだ何もありません。\nひとつ、小さなことから書いてみましょう。"}
          </div>
        ) : (
          items.map((it) => <ItemRow key={it.id} item={it} inToday={todayIds.has(it.id)} />)
        )}
      </div>
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
      <span
        className={`taskitem__title ${item.status === "done" ? "taskitem__title--done" : ""}`}
      >
        {item.recurring && (
          <span className="chip" style={{ background: "var(--accent)", marginRight: 6 }}>
            毎日
          </span>
        )}
        {item.title}
        <TagChip tag={item.tag} />
      </span>
      {!item.recurring && (
        <button
          className="btn btn--small"
          onClick={() => (inToday ? removeFromToday(item.id) : addToToday(item.id))}
        >
          {inToday ? "今日から外す" : "今日に追加"}
        </button>
      )}
      <button className="btn--ghost btn" onClick={() => setEditing(true)}>
        編集
      </button>
      <button className="btn--ghost btn" onClick={() => deleteItem(item.id)}>
        削除
      </button>
    </div>
  );
}
