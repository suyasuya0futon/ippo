// ごく簡単なトースト。React 外（db.ts 等）からも showToast() で出せる。
import { useSyncExternalStore } from "react";

let message: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function showToast(msg: string) {
  message = msg;
  emit();
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    message = null;
    emit();
  }, 4500);
}

export function useToast(): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => message
  );
}
