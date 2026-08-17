import { supabase } from "./supabase";
import type { KeepAttachment, KeepNote } from "./types";

const BUCKET = "ippo-keep";
const SIGNED_URL_SECONDS = 60 * 60 * 6;

type KeepNoteRow = {
  id: string;
  text: string;
  created_at: string;
  updated_at: string;
};

type KeepAttachmentRow = {
  id: string;
  note_id: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  created_at: string;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function fetchKeepNotes(): Promise<KeepNote[]> {
  const [notesResult, attachmentsResult] = await Promise.all([
    supabase.from("keep_notes").select("*").order("created_at", { ascending: false }),
    supabase.from("keep_attachments").select("*").order("created_at", { ascending: true }),
  ]);
  if (notesResult.error) throw notesResult.error;
  if (attachmentsResult.error) throw attachmentsResult.error;

  const rows = (attachmentsResult.data ?? []) as KeepAttachmentRow[];
  const paths = rows.map((row) => row.storage_path);
  const signedUrls = new Map<string, string>();
  if (paths.length > 0) {
    const result = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
    if (result.error) throw result.error;
    result.data?.forEach((entry, index) => {
      if (entry.signedUrl) signedUrls.set(paths[index], entry.signedUrl);
    });
  }

  const attachmentsByNote = new Map<string, KeepAttachment[]>();
  for (const row of rows) {
    const attachment: KeepAttachment = {
      id: row.id,
      noteId: row.note_id,
      storagePath: row.storage_path,
      mimeType: row.mime_type,
      fileSize: row.file_size,
      createdAt: row.created_at,
      signedUrl: signedUrls.get(row.storage_path) ?? "",
    };
    const list = attachmentsByNote.get(row.note_id) ?? [];
    list.push(attachment);
    attachmentsByNote.set(row.note_id, list);
  }

  return ((notesResult.data ?? []) as KeepNoteRow[]).map((row) => ({
    id: row.id,
    text: row.text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    attachments: attachmentsByNote.get(row.id) ?? [],
  }));
}

export async function createKeepNote(text: string, images: File[]): Promise<void> {
  const noteId = crypto.randomUUID();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw authError ?? new Error("ログイン情報を確認できませんでした");

  const { error: noteError } = await supabase.from("keep_notes").insert({ id: noteId, text });
  if (noteError) throw noteError;

  const uploadedPaths: string[] = [];
  try {
    for (const image of images) {
      const attachmentId = crypto.randomUUID();
      const extension = image.type === "image/png" ? "png" : image.type === "image/jpeg" ? "jpg" : "webp";
      const path = `${authData.user.id}/${noteId}/${attachmentId}.${extension}`;
      const upload = await supabase.storage.from(BUCKET).upload(path, image, {
        contentType: image.type,
        cacheControl: "3600",
        upsert: false,
      });
      if (upload.error) throw upload.error;
      uploadedPaths.push(path);

      const { error: attachmentError } = await supabase.from("keep_attachments").insert({
        id: attachmentId,
        note_id: noteId,
        storage_path: path,
        mime_type: image.type,
        file_size: image.size,
      });
      if (attachmentError) throw attachmentError;
    }
  } catch (error) {
    if (uploadedPaths.length > 0) await supabase.storage.from(BUCKET).remove(uploadedPaths);
    await supabase.from("keep_notes").delete().eq("id", noteId);
    throw new Error(`画像を保存できませんでした: ${errorMessage(error)}`, { cause: error });
  }
}

export async function updateKeepNote(id: string, text: string): Promise<void> {
  const { error } = await supabase
    .from("keep_notes")
    .update({ text, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteKeepNote(note: KeepNote): Promise<void> {
  const paths = note.attachments.map((attachment) => attachment.storagePath);
  if (paths.length > 0) {
    const { error } = await supabase.storage.from(BUCKET).remove(paths);
    if (error) throw error;
  }
  const { error } = await supabase.from("keep_notes").delete().eq("id", note.id);
  if (error) throw error;
}
