import { getPlatform } from "@/core/platform";
import type { StorageDriver } from "@/core/storage";

let driver: StorageDriver | null = null;

// One storage driver per runtime, created lazily on first use (never during server render).
export function getStorage(): StorageDriver {
  return (driver ??= getPlatform().createStorage());
}

export function resetStorageForTests(next: StorageDriver | null) {
  driver = next;
}
