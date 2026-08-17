import { useEffect, useRef, useState, type ClipboardEvent, type ReactNode } from "react";
import { createKeepNote, deleteKeepNote, fetchKeepNotes, updateKeepNote } from "../keepDb";
import { prepareKeepImage } from "../keepImages";
import { showToast } from "../toast";
import type { KeepNote } from "../types";

type PendingImage = { file: File; previewUrl: string };

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function linkify(text: string): ReactNode[] {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, index) =>
    /^https?:\/\//.test(part) ? (
      <a key={index} href={part} target="_blank" rel="noreferrer">
        {part}
      </a>
    ) : (
      part
    )
  );
}

export default function KeepScreen() {
  const [notes, setNotes] = useState<KeepNote[]>([]);
  const [text, setText] = useState("");
  const [images, setImages] = useState<PendingImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef<PendingImage[]>([]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    void reload();
    return () => imagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
  }, []);

  async function reload() {
    setLoading(true);
    try {
      setNotes(await fetchKeepNotes());
    } catch (error) {
      console.error("Keep 読み込み失敗", error);
      showToast("Keepを読み込めませんでした。DB設定を確認してください");
    } finally {
      setLoading(false);
    }
  }

  async function addFiles(files: File[]) {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    try {
      const prepared = await Promise.all(imageFiles.map(prepareKeepImage));
      setImages((current) => [
        ...current,
        ...prepared.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
      ]);
    } catch (error) {
      console.error("Keep 画像処理失敗", error);
      showToast(error instanceof Error ? error.message : "画像を処理できませんでした");
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    if (files.length > 0) void addFiles(files);
  }

  function removePendingImage(index: number) {
    setImages((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  }

  async function handleSave() {
    const trimmed = text.trim();
    if (!trimmed && images.length === 0) return;
    setSaving(true);
    try {
      await createKeepNote(trimmed, images.map((image) => image.file));
      images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      setText("");
      setImages([]);
      await reload();
    } catch (error) {
      console.error("Keep 保存失敗", error);
      showToast("Keepを保存できませんでした。通信とDB設定を確認してください");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(id: string) {
    const trimmed = editingText.trim();
    const note = notes.find((item) => item.id === id);
    if (!note || (!trimmed && note.attachments.length === 0)) return;
    try {
      await updateKeepNote(id, trimmed);
      setNotes((current) => current.map((item) => (item.id === id ? { ...item, text: trimmed } : item)));
      setEditingId(null);
    } catch (error) {
      console.error("Keep 更新失敗", error);
      showToast("Keepを更新できませんでした");
    }
  }

  async function handleDelete(note: KeepNote) {
    if (!window.confirm("このKeepを削除しますか？")) return;
    try {
      await deleteKeepNote(note);
      setNotes((current) => current.filter((item) => item.id !== note.id));
    } catch (error) {
      console.error("Keep 削除失敗", error);
      showToast("Keepを削除できませんでした");
    }
  }

  return (
    <div className="keep">
      <section className="keep-compose" aria-label="Keepを追加">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onPaste={handlePaste}
          placeholder="メモ、URL、スクショを置いておく…"
          rows={3}
          disabled={saving}
        />
        {images.length > 0 && (
          <div className="keep-compose__previews">
            {images.map((image, index) => (
              <div className="keep-compose__preview" key={`${image.file.name}-${index}`}>
                <img src={image.previewUrl} alt="添付予定" />
                <button type="button" onClick={() => removePendingImage(index)} aria-label="画像を外す">×</button>
              </div>
            ))}
          </div>
        )}
        <div className="keep-compose__actions">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => {
              void addFiles(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
          <button className="btn btn--ghost keep-attach" type="button" onClick={() => fileInputRef.current?.click()} disabled={saving}>
            画像を追加
          </button>
          <span className="keep-compose__hint">PCでは貼り付けもできます</span>
          <button className="btn btn--primary btn--small" type="button" onClick={handleSave} disabled={saving || (!text.trim() && images.length === 0)}>
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </section>

      {loading ? (
        <div className="empty">Keepを読み込み中…</div>
      ) : notes.length === 0 ? (
        <div className="empty">まだKeepはありません。<br />気になったものを、ここに置いておけます。</div>
      ) : (
        <div className="keep-list">
          {notes.map((note) => (
            <article className="keep-note" key={note.id}>
              {editingId === note.id ? (
                <div className="keep-note__edit">
                  <textarea value={editingText} onChange={(event) => setEditingText(event.target.value)} rows={4} autoFocus />
                  <div className="keep-note__edit-actions">
                    <button className="btn btn--ghost btn--small" onClick={() => setEditingId(null)}>キャンセル</button>
                    <button className="btn btn--primary btn--small" onClick={() => void saveEdit(note.id)}>保存</button>
                  </div>
                </div>
              ) : note.text ? (
                <div className="keep-note__text">{linkify(note.text)}</div>
              ) : null}
              {note.attachments.length > 0 && (
                <div className={`keep-note__images ${note.attachments.length === 1 ? "keep-note__images--single" : ""}`}>
                  {note.attachments.map((attachment) => attachment.signedUrl && (
                    <a href={attachment.signedUrl} target="_blank" rel="noreferrer" key={attachment.id}>
                      <img src={attachment.signedUrl} alt="Keepの添付画像" loading="lazy" />
                    </a>
                  ))}
                </div>
              )}
              <footer className="keep-note__footer">
                <time dateTime={note.createdAt}>{formatDate(note.createdAt)}</time>
                <div>
                  <button className="btn btn--ghost btn--small" onClick={() => { setEditingId(note.id); setEditingText(note.text); }}>編集</button>
                  <button className="btn btn--ghost btn--small keep-note__delete" onClick={() => void handleDelete(note)}>削除</button>
                </div>
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
