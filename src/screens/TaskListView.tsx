// 今日やる / 今後やる の共通ビュー。
// 配置は bucket（フラグ）／予定日から導出。並びは手動（sortOrder 昇順）。自動ソートしない。
// 追加は各セクション見出しの ➕ から（押したときだけ入力欄／1件追加で閉じる）。型はセクションで決まる。
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useStore,
  todayStr,
  addItem,
  addToToday,
  moveToFuture,
  reorderBucket,
  reorderItems,
  convertItemType,
  addStep,
  toggleStep,
  deleteStep,
  deleteItem,
  editItem,
  itemToInput,
  completeItem,
  reopenItem,
  isDoneToday,
  toggleRecurringToday,
} from "../store";
import type { Bucket, DB, Item } from "../types";
import { TagChip } from "../components/TagChip";
import ItemInput from "../components/ItemInput";

const FUTURE_BUCKETS = ["tomorrow", "soon", "someday"] as const;
type FutureBucket = (typeof FUTURE_BUCKETS)[number];

type Mode = "today" | "future";

// 手動の並び（sortOrder 昇順。小さいほど上）
const bySortOrder = (a: Item, b: Item) => a.sortOrder - b.sortOrder;

// 見出しタイトルの後ろに付ける残数ラベル。
// 空セクション（total 0）は何も出さない。残あり＝（N）。
// celebrate=true（今日やる側）で「タスクがあって全部完了」なら 🎉。
function countLabel(remaining: number, total: number, celebrate: boolean): string {
  if (total === 0) return "";
  if (remaining > 0) return `（${remaining}）`;
  return celebrate ? "（完了🎉）" : "";
}

// セクション見出し。左（タイトル）=開閉スイッチ、右＝追加 ➕。
function SectionHead({
  children,
  collapsed,
  onToggleCollapse,
  addOpen,
  onToggleAdd,
}: {
  children: ReactNode;
  collapsed: boolean;
  onToggleCollapse: () => void;
  addOpen: boolean;
  onToggleAdd: () => void;
}) {
  return (
    <div className="section-head">
      <button
        className="section-head__toggle"
        aria-label={collapsed ? "開く" : "閉じる"}
        onClick={onToggleCollapse}
      >
        <span className="section-head__caret">{collapsed ? "▸" : "▾"}</span>
        {children}
      </button>
      <button className="add-btn" aria-label={addOpen ? "閉じる" : "追加"} onClick={onToggleAdd}>
        {addOpen ? "✕" : "➕"}
      </button>
    </div>
  );
}

export default function TaskListView({ mode }: { mode: Mode }) {
  const db = useStore();
  const [addOpen, setAddOpen] = useState<string | null>(null);
  // 畳まれているセクション（既定は全部開く。リロードで戻る＝覚えない）
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  // ドラッグ中のアイテムID（今後やるのみ）
  const [dragId, setDragId] = useState<string | null>(null);
  // ドラッグは専用ハンドル(≡)からのみ。少し動かしたら開始（タップでは始まらない）。
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const date = todayStr();

  const toggleCollapse = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // ➕ は新規追加だけ。アコーディオン開閉とは無関係（閉じたままでも入力欄を出して追加できる）。
  const toggleAdd = (key: string) => setAddOpen((cur) => (cur === key ? null : key));

  // セクション（見出し＋追加欄＋リスト）を1つ描く。sortable=true でドラッグ並べ替え対応。
  function section(
    key: Bucket | "habit" | "task",
    title: ReactNode,
    items: Item[],
    placeholder: string,
    onAdd: (input: string) => void,
    emptyText: string,
    habitDoneOf?: (it: Item) => boolean,
    sortable = false,
    doneItems: Item[] = []
  ) {
    const isCollapsed = collapsed.has(key);
    const plainRow = (it: Item) => (
      <TaskRow
        key={it.id}
        item={it}
        db={db}
        mode={mode}
        habitDone={habitDoneOf ? habitDoneOf(it) : undefined}
      />
    );
    const bothEmpty = items.length === 0 && doneItems.length === 0;
    const rows = bothEmpty ? (
      <div className="empty" style={{ padding: "12px 8px" }}>
        {emptyText}
      </div>
    ) : sortable ? (
      <>
        {items.map((it) => (
          <SortableTaskRow
            key={it.id}
            item={it}
            db={db}
            mode={mode}
            habitDone={habitDoneOf ? habitDoneOf(it) : undefined}
          />
        ))}
        {doneItems.map(plainRow)}
      </>
    ) : (
      items.map(plainRow)
    );
    return (
      <>
        <SectionHead
          collapsed={isCollapsed}
          onToggleCollapse={() => toggleCollapse(key)}
          addOpen={addOpen === key}
          onToggleAdd={() => toggleAdd(key)}
        >
          {title}
        </SectionHead>
        {/* 追加欄はアコーディオンの開閉とは独立（閉じてても出る） */}
        {addOpen === key && (
          <div className="card">
            <ItemInput
              showRecurring={false}
              autoFocus
              placeholder={placeholder}
              onSubmit={(input) => {
                onAdd(input);
                setAddOpen(null);
              }}
            />
          </div>
        )}
        {/* リストは畳める */}
        {!isCollapsed &&
          (sortable ? (
            <DroppableBucket id={key}>
              <SortableContext
                items={items.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                {rows}
              </SortableContext>
            </DroppableBucket>
          ) : (
            <div className="card">{rows}</div>
          ))}
      </>
    );
  }

  // ===== 今後やる（ドラッグで並べ替え＆バケット間移動） =====
  if (mode === "future") {
    const inBucket = (b: Bucket) =>
      db.items
        .filter((i) => !i.recurring && i.status === "open" && i.bucket === b)
        .sort(bySortOrder);
    const lists: Record<FutureBucket, Item[]> = {
      tomorrow: inBucket("tomorrow"),
      soon: inBucket("soon"),
      someday: inBucket("someday"),
    };

    const containerOf = (id: string): FutureBucket | null => {
      if ((FUTURE_BUCKETS as readonly string[]).includes(id)) return id as FutureBucket;
      for (const b of FUTURE_BUCKETS) if (lists[b].some((i) => i.id === id)) return b;
      return null;
    };

    const handleDragEnd = (e: DragEndEvent) => {
      setDragId(null);
      const { active, over } = e;
      if (!over) return;
      const activeId = String(active.id);
      const overId = String(over.id);
      const from = containerOf(activeId);
      const to = containerOf(overId);
      if (!from || !to) return;
      const fromIds = lists[from].map((i) => i.id);
      const toIds = lists[to].map((i) => i.id);
      if (from === to) {
        const oldIndex = fromIds.indexOf(activeId);
        const newIndex = overId === to ? fromIds.length - 1 : fromIds.indexOf(overId);
        if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
        reorderBucket(arrayMove(fromIds, oldIndex, newIndex), to);
      } else {
        const insertAt = overId === to ? toIds.length : Math.max(0, toIds.indexOf(overId));
        const nextFromIds = fromIds.filter((id) => id !== activeId);
        const nextToIds = [...toIds.slice(0, insertAt), activeId, ...toIds.slice(insertAt)];
        // 移動元・移動先の両方を 0..N に詰め直す（移動元に穴を残さない）
        reorderBucket(nextFromIds, from);
        reorderBucket(nextToIds, to);
      }
    };

    const dragItem = dragId ? db.items.find((i) => i.id === dragId) : null;

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e) => setDragId(String(e.active.id))}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDragId(null)}
      >
        <div>
          {section(
            "tomorrow",
            `明日${countLabel(lists.tomorrow.length, lists.tomorrow.length, false)}`,
            lists.tomorrow,
            "明日やること（例：銀行に行く）",
            (input) => addItem(input, false, { bucket: "tomorrow" }),
            "明日のタスクはありません。",
            undefined,
            true
          )}
          {section(
            "soon",
            `近日中${countLabel(lists.soon.length, lists.soon.length, false)}`,
            lists.soon,
            "近日中にやること（例：本を返す）",
            (input) => addItem(input, false, { bucket: "soon" }),
            "近日中のタスクはありません。",
            undefined,
            true
          )}
          {section(
            "someday",
            `いつか${countLabel(lists.someday.length, lists.someday.length, false)}`,
            lists.someday,
            "いつかやること（例：服を処分する #家事）",
            (input) => addItem(input, false, { bucket: "someday" }),
            "いつかのタスクはありません。",
            undefined,
            true
          )}
        </div>
        <DragOverlay>
          {dragItem ? (
            <div className="card" style={{ margin: 0, opacity: 0.95 }}>
              <div className="trow">
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 4px" }}>
                  <span className="step__label" style={{ flex: 1 }}>
                    <TagChip tag={dragItem.tag} />
                    {dragItem.title}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    );
  }

  // ===== 今日やる =====
  // その日の完了時刻（毎日タスク用。doneLog から）
  const habitDoneAt = (id: string) =>
    db.doneLogs.find((l) => l.refType === "item" && l.refId === id && l.date === date)?.doneAt ??
    "";

  // 習慣：未完了が上（手動順）→ 完了は下（新しい完了ほど上、早い完了ほど下）
  const habits = db.items
    .filter((i) => i.recurring)
    .sort((a, b) => {
      const ad = isDoneToday(db, a.id);
      const bd = isDoneToday(db, b.id);
      if (ad !== bd) return ad ? 1 : -1;
      if (!ad) return a.sortOrder - b.sortOrder;
      return habitDoneAt(b.id).localeCompare(habitDoneAt(a.id));
    });

  // 今日のタスク：未完了が上（手動順）→ 完了は下（新しい完了ほど上、早い完了ほど下）
  const todayItems = db.items
    .filter(
      (i) =>
        !i.recurring &&
        i.bucket === "today" &&
        (i.status === "open" || isDoneToday(db, i.id))
    )
    .sort((a, b) => {
      const ao = a.status === "open";
      const bo = b.status === "open";
      if (ao !== bo) return ao ? -1 : 1;
      if (ao) return a.sortOrder - b.sortOrder;
      return (b.doneAt ?? "").localeCompare(a.doneAt ?? "");
    });

  // 並べ替えできるのは未完了だけ。完了は下に沈めて固定。
  const habitsOpen = habits.filter((h) => !isDoneToday(db, h.id));
  const habitsDone = habits.filter((h) => isDoneToday(db, h.id));
  const todayOpen = todayItems.filter((i) => i.status === "open");
  const todayDone = todayItems.filter((i) => i.status !== "open");

  const habitsRemaining = habitsOpen.length;
  const todayRemaining = todayOpen.length;

  // 今日やるタブのドラッグ並べ替え（習慣・タスクそれぞれの未完了リスト内だけ）。
  const todayListOf = (id: string): "habit" | "task" | null => {
    if (id === "habit" || id === "task") return id;
    if (habitsOpen.some((i) => i.id === id)) return "habit";
    if (todayOpen.some((i) => i.id === id)) return "task";
    return null;
  };

  const handleTodayDragEnd = (e: DragEndEvent) => {
    setDragId(null);
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const from = todayListOf(activeId);
    const to = todayListOf(overId);
    if (!from || !to) return;
    const isContainer = overId === "habit" || overId === "task";

    if (from === to) {
      // 同じリスト内の並べ替え
      const ids = (from === "habit" ? habitsOpen : todayOpen).map((i) => i.id);
      const oldIndex = ids.indexOf(activeId);
      const newIndex = isContainer ? ids.length - 1 : ids.indexOf(overId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      reorderItems(arrayMove(ids, oldIndex, newIndex));
    } else {
      // 別リストへ＝種類を変える（通常タスク ⇄ 毎日の習慣）
      const fromIds = (from === "habit" ? habitsOpen : todayOpen).map((i) => i.id);
      const toIds = (to === "habit" ? habitsOpen : todayOpen).map((i) => i.id);
      const insertAt = isContainer ? toIds.length : Math.max(0, toIds.indexOf(overId));
      const nextSourceIds = fromIds.filter((id) => id !== activeId);
      const nextTargetIds = [...toIds.slice(0, insertAt), activeId, ...toIds.slice(insertAt)];
      convertItemType(activeId, to === "habit", nextTargetIds, nextSourceIds);
    }
  };

  const todayDragItem = dragId ? db.items.find((i) => i.id === dragId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(e) => setDragId(String(e.active.id))}
      onDragEnd={handleTodayDragEnd}
      onDragCancel={() => setDragId(null)}
    >
      <div>
        {section(
          "habit",
          `毎日の習慣${countLabel(habitsRemaining, habits.length, true)}`,
          habitsOpen,
          "毎日やること（例：プロテイン飲む #からだ）",
          (input) => addItem(input, true),
          "習慣はありません。",
          (it) => isDoneToday(db, it.id),
          true,
          habitsDone
        )}
        {section(
          "task",
          `今日のタスク${countLabel(todayRemaining, todayItems.length, true)}`,
          todayOpen,
          "今日やること（例：薬を飲む #からだ）",
          (input) => addItem(input, false, { bucket: "today" }),
          "今日やることは、まだありません。右上の ➕ で追加できます。",
          undefined,
          true,
          todayDone
        )}
      </div>
      <DragOverlay>
        {todayDragItem ? (
          <div className="card" style={{ margin: 0, opacity: 0.95 }}>
            <div className="trow">
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 4px" }}>
                <span className="step__label" style={{ flex: 1 }}>
                  <TagChip tag={todayDragItem.tag} />
                  {todayDragItem.title}
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// 今後やるのバケット（カード）。空でもドロップ先になれるよう droppable にする。
function DroppableBucket({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className="card"
      style={isOver ? { outline: "2px dashed var(--accent)", outlineOffset: -2 } : undefined}
    >
      {children}
    </div>
  );
}

// ドラッグ可能な行。ドラッグは専用ハンドル(≡)だけ。行本体は普通にスクロールできる。
function SortableTaskRow({
  item,
  db,
  mode,
  habitDone,
}: {
  item: Item;
  db: DB;
  mode: Mode;
  habitDone?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const handle = (
    <button
      className="icon-btn icon-btn--ghost"
      style={{ cursor: "grab", touchAction: "none" }}
      aria-label="ドラッグして並べ替え"
      {...attributes}
      {...listeners}
    >
      <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true">
        <line x1="1" y1="2" x2="17" y2="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="1" y1="7" x2="17" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="1" y1="12" x2="17" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <TaskRow item={item} db={db} mode={mode} habitDone={habitDone} dragHandle={handle} />
    </div>
  );
}

// habitDone は毎日の習慣行のときだけ渡す（その日の完了状態）
function TaskRow({
  item,
  db,
  mode,
  habitDone,
  dragHandle,
}: {
  item: Item;
  db: DB;
  mode: Mode;
  habitDone?: boolean;
  dragHandle?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [stepText, setStepText] = useState("");
  const editRef = useRef<HTMLDivElement>(null);

  const isHabit = item.recurring;
  const isFlag = !isHabit; // 移動ボタン(⏳/🌱)はフラグタスク（＝一度きり）に出す
  const steps = db.steps.filter((s) => s.itemId === item.id).sort((a, b) => a.order - b.order);
  const isDone = isHabit ? Boolean(habitDone) : item.status === "done";

  // 編集中に外側を触ったら、キャンセルを押さなくても編集を解除する（保存はしない）。
  useEffect(() => {
    if (!editing) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (editRef.current && !editRef.current.contains(e.target as Node)) {
        setEditing(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [editing]);

  function submitStep() {
    addStep(item.id, stepText);
    setStepText("");
  }

  // 編集パネル：タイトル編集＋削除（種類は変えない＝recurring は保持。予定日はステップ6）
  if (editing) {
    return (
      <div className="trow" ref={editRef} style={{ padding: "8px 4px" }}>
        <ItemInput
          initialText={itemToInput(item)}
          showRecurring={false}
          submitLabel="保存"
          autoFocus
          onSubmit={(input) => {
            editItem(item.id, input, item.recurring);
            setEditing(false);
          }}
        />
        <div className="row" style={{ marginTop: 6, justifyContent: "space-between" }}>
          <button className="btn--ghost btn" onClick={() => setEditing(false)}>
            キャンセル
          </button>
          <button
            className="btn--ghost btn"
            style={{ color: "#c97a7a" }}
            onClick={() => {
              deleteItem(item.id);
              setEditing(false);
            }}
          >
            削除
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="trow">
      {/* 本体の行 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 4px" }}>
        {/* 今日やる（習慣含む）はチェックで完了。今後やるは完了させない。 */}
        {mode === "today" && (
          <button
            className={`step__check ${isDone ? "step__check--done" : ""}`}
            onClick={() =>
              isHabit
                ? toggleRecurringToday(item.id)
                : isDone
                  ? reopenItem(item.id)
                  : completeItem(item.id)
            }
            aria-label={isDone ? "完了を取り消す" : "完了にする"}
          >
            {isDone ? "✓" : ""}
          </button>
        )}
        {/* タイトルをタップで編集パネルを開く。完了したものは触らない（編集不可）。 */}
        <span
          className={`step__label ${isDone ? "step__label--done" : ""}`}
          style={{ flex: 1, cursor: isDone ? "default" : "pointer" }}
          title={isDone ? undefined : "タップで編集"}
          onClick={isDone ? undefined : () => setEditing(true)}
        >
          <TagChip tag={item.tag} />
          {item.title}
        </span>
        <span className="icon-actions">
          {/* フラグタスクのみ。今日やる＝⏳今後やるへ（近日中）／今後やる＝🌱今日やるに */}
          {mode === "today" && isFlag && !isDone && (
            <button
              className="icon-btn"
              title="今後やるに移動"
              aria-label="今後やるに移動"
              onClick={() => moveToFuture(item.id)}
            >
              ⏳
            </button>
          )}
          {mode === "future" && isFlag && (
            <button
              className="icon-btn"
              title="今日やるにする"
              aria-label="今日やるにする"
              onClick={() => addToToday(item.id)}
            >
              🌱
            </button>
          )}
          {/* クイック削除は「完了した一度きりタスク」だけ（誤削除防止／習慣は消さない） */}
          {!isHabit && isDone && (
            <button
              className="icon-btn icon-btn--ghost"
              style={{ fontSize: 20 }}
              title="削除"
              aria-label="削除"
              onClick={() => deleteItem(item.id)}
            >
              ×
            </button>
          )}
          {/* ドラッグ専用ハンドルは右端に */}
          {dragHandle}
        </span>
      </div>

      {/* ステップ（今日やるのときだけ。今後やるでは砕かない） */}
      {mode === "today" && steps.length > 0 && (
        <div style={{ paddingLeft: 30 }}>
          {steps.map((s) => (
            <div key={s.id} className="step">
              <button
                className={`step__check ${s.done ? "step__check--done" : ""}`}
                onClick={() => toggleStep(s.id)}
                aria-label={s.done ? "完了を取り消す" : "完了にする"}
              >
                {s.done ? "✓" : ""}
              </button>
              <span className={`step__label ${s.done ? "step__label--done" : ""}`}>{s.title}</span>
              <button
                className="btn--ghost btn"
                onClick={() => deleteStep(s.id)}
                style={{ padding: "2px 6px" }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 「小さな一歩を追加」は今日やるのときだけ（習慣にも出さない） */}
      {mode === "today" &&
        !isHabit &&
        (adding ? (
          <div className="row" style={{ paddingLeft: 30, marginBottom: 10 }}>
            <input
              type="text"
              placeholder="例：まずは布団から出る"
              value={stepText}
              autoFocus
              onChange={(e) => setStepText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitStep()}
            />
            <button className="btn btn--small" style={{ flexShrink: 0 }} onClick={submitStep}>
              ＋
            </button>
          </div>
        ) : (
          <button
            className="btn--ghost btn"
            style={{ padding: "0 0 10px 30px", fontSize: 13 }}
            onClick={() => setAdding(true)}
          >
            ＋ 小さな一歩を追加する
          </button>
        ))}
    </div>
  );
}
