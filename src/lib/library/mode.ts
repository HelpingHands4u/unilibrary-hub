// The server owns the app mode: /api/commands reports whether live Firebase
// Admin credentials are present AND actually usable. Every book action routes
// through the live command service only in "live" mode; otherwise it runs the
// local demonstration store, so buttons never surface 503 "not configured".
import { useSyncExternalStore } from "react";

export type LibraryMode = "unknown" | "local" | "live";

let mode: LibraryMode = "unknown";
let probe: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function libraryMode(): LibraryMode {
  return mode;
}

export function isLive(): boolean {
  return mode === "live";
}

export function probeLibraryMode(): Promise<void> {
  if (typeof window === "undefined") return probe ?? Promise.resolve();
  if (probe) return probe;
  probe = fetch("/api/commands", { headers: { Accept: "application/json" } })
    .then((r) => r.json())
    .then((body: { configured?: boolean }) => {
      mode = body.configured ? "live" : "local";
      emit();
    })
    .catch(() => {
      mode = "local";
      emit();
    });
  return probe;
}

/** Server said it is not configured (or its live service failed): degrade permanently for this session. */
export function forceLocalMode(): void {
  probe = Promise.resolve();
  if (mode !== "local") {
    mode = "local";
    emit();
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useLibraryMode(): LibraryMode {
  return useSyncExternalStore(subscribe, libraryMode, () => "unknown");
}
