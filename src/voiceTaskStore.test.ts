import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./db", () => ({ insertItem: vi.fn(), updateItem: vi.fn(), deleteItemRow: vi.fn() }));
import * as remote from "./db";
import { clearStore, saveVoiceTask, undoVoiceTask } from "./store";

beforeEach(() => { clearStore(); vi.resetAllMocks(); });
describe("音声タスクの保存", () => {
  it("今日の単発タスクとして保存し、同じIDで修正・取り消す", async () => {
    vi.mocked(remote.insertItem).mockResolvedValue(true);
    vi.mocked(remote.updateItem).mockResolvedValue(true);
    vi.mocked(remote.deleteItemRow).mockResolvedValue(true);
    const id = await saveVoiceTask({ title: "猫砂", tag: "買物" });
    expect(id).toBeTruthy();
    expect(remote.insertItem).toHaveBeenCalledWith(expect.objectContaining({ id, title: "猫砂", tag: "買物", bucket: "today", recurring: false }));
    expect(await saveVoiceTask({ title: "漏電遮断器まとめ", tag: "勉強" }, id!)).toBe(id);
    expect(remote.updateItem).toHaveBeenCalledWith(expect.objectContaining({ id, title: "漏電遮断器まとめ", tag: "勉強" }));
    expect(await undoVoiceTask(id!)).toBe(true);
    expect(await saveVoiceTask({ title: "消えた項目", tag: null }, id!)).toBeNull();
  });
  it("保存失敗を成功扱いしない", async () => {
    vi.mocked(remote.insertItem).mockResolvedValue(false);
    expect(await saveVoiceTask({ title: "猫砂", tag: "買物" })).toBeNull();
  });
  it("ログアウト後に保存結果をストアへ戻さない", async () => {
    let finish!: (ok: boolean) => void;
    vi.mocked(remote.insertItem).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const saving = saveVoiceTask({ title: "猫砂", tag: "買物" });
    clearStore();
    finish(true);
    expect(await saving).toBeNull();
  });
});
