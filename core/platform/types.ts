import type { StorageDriver } from "../storage/types";

// Everything that touches the host environment sits behind this interface, so a desktop shell
// (Electron, Tauri) is a new adapter, not a rewrite.
export interface PlatformAdapter {
  readonly kind: "web";
  createStorage(): StorageDriver;
  pickFiles(opts?: { accept?: string[]; multiple?: boolean }): Promise<File[]>;
  saveFile(filename: string, blob: Blob): Promise<void>;
  notify(title: string, body?: string): Promise<void>;
  requestNotificationPermission(): Promise<"granted" | "denied" | "default" | "unsupported">;
  openExternal(url: string): void;
}
