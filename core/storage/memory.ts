import type { BlobStore, StorageDriver, StoredEntity } from "./types";

// Used by tests and by the server render, where there is no IndexedDB.
export function createMemoryDriver(): StorageDriver {
  const collections = new Map<string, Map<string, StoredEntity>>();
  const meta = new Map<string, unknown>();
  const blobMap = new Map<string, Blob>();
  const listeners = new Set<(c: string, ids: string[]) => void>();
  const col = (name: string) => {
    let c = collections.get(name);
    if (!c) collections.set(name, (c = new Map()));
    return c;
  };
  const blobs: BlobStore = {
    async put(id, blob) {
      blobMap.set(id, blob);
    },
    async get(id) {
      return blobMap.get(id);
    },
    async delete(id) {
      blobMap.delete(id);
    },
    async size() {
      let total = 0;
      blobMap.forEach((b) => (total += b.size));
      return total;
    },
  };
  return {
    kind: "memory",
    async loadAll<T extends StoredEntity>(name: string) {
      return [...col(name).values()].map((v) => structuredClone(v) as T);
    },
    async getMany<T extends StoredEntity>(name: string, ids: string[]) {
      return ids.flatMap((id) => {
        const v = col(name).get(id);
        return v ? [structuredClone(v) as T] : [];
      });
    },
    async putMany(name, items) {
      for (const item of items) col(name).set(item.id, structuredClone(item));
    },
    async deleteMany(name, ids) {
      for (const id of ids) col(name).delete(id);
    },
    async clearCollection(name) {
      col(name).clear();
    },
    async getMeta<T>(key: string) {
      return meta.get(key) as T | undefined;
    },
    async setMeta(key, value) {
      meta.set(key, value);
    },
    blobs,
    notifyChange(c, ids) {
      listeners.forEach((l) => l(c, ids));
    },
    onExternalChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
