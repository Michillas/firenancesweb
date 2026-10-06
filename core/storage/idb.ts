import type { BlobStore, StorageDriver, StoredEntity } from "./types";

const DB_NAME = "firenances";
const DB_VERSION = 1;
const ENTITIES = "entities";
const BLOBS = "blobs";
const META = "meta";
const SEP = "/";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function createIdbDriver(dbName = DB_NAME): StorageDriver {
  let dbPromise: Promise<IDBDatabase> | null = null;
  const open = () =>
    (dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(ENTITIES)) db.createObjectStore(ENTITIES);
        if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS);
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));

  // One record per entity (key "collection/id"): saving a note rewrites that note, not the
  // whole collection, and a multi-megabyte audio blob never goes through JSON.stringify.
  const keyOf = (collection: string, id: string) => `${collection}${SEP}${id}`;
  const rangeOf = (collection: string) => IDBKeyRange.bound(`${collection}${SEP}`, `${collection}${SEP}￿`);

  const blobs: BlobStore = {
    async put(id, blob) {
      const db = await open();
      const tx = db.transaction(BLOBS, "readwrite");
      tx.objectStore(BLOBS).put(blob, id);
      await done(tx);
    },
    async get(id) {
      const db = await open();
      return (await request(db.transaction(BLOBS).objectStore(BLOBS).get(id))) as Blob | undefined;
    },
    async delete(id) {
      const db = await open();
      const tx = db.transaction(BLOBS, "readwrite");
      tx.objectStore(BLOBS).delete(id);
      await done(tx);
    },
    async size() {
      const db = await open();
      const all = (await request(db.transaction(BLOBS).objectStore(BLOBS).getAll())) as Blob[];
      return all.reduce((sum, b) => sum + (b?.size ?? 0), 0);
    },
  };

  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(`${dbName}:changes`) : null;

  return {
    kind: "indexeddb",
    async loadAll<T extends StoredEntity>(collection: string) {
      const db = await open();
      return (await request(db.transaction(ENTITIES).objectStore(ENTITIES).getAll(rangeOf(collection)))) as T[];
    },
    async getMany<T extends StoredEntity>(collection: string, ids: string[]) {
      const db = await open();
      const store = db.transaction(ENTITIES).objectStore(ENTITIES);
      const rows = await Promise.all(ids.map((id) => request(store.get(keyOf(collection, id)))));
      return rows.filter(Boolean) as T[];
    },
    async putMany(collection, items) {
      if (items.length === 0) return;
      const db = await open();
      const tx = db.transaction(ENTITIES, "readwrite");
      const store = tx.objectStore(ENTITIES);
      for (const item of items) store.put(item, keyOf(collection, item.id));
      await done(tx);
    },
    async deleteMany(collection, ids) {
      if (ids.length === 0) return;
      const db = await open();
      const tx = db.transaction(ENTITIES, "readwrite");
      const store = tx.objectStore(ENTITIES);
      for (const id of ids) store.delete(keyOf(collection, id));
      await done(tx);
    },
    async clearCollection(collection) {
      const db = await open();
      const tx = db.transaction(ENTITIES, "readwrite");
      tx.objectStore(ENTITIES).delete(rangeOf(collection));
      await done(tx);
    },
    async getMeta<T>(key: string) {
      const db = await open();
      return (await request(db.transaction(META).objectStore(META).get(key))) as T | undefined;
    },
    async setMeta(key, value) {
      const db = await open();
      const tx = db.transaction(META, "readwrite");
      tx.objectStore(META).put(value, key);
      await done(tx);
    },
    blobs,
    notifyChange(collection, ids) {
      channel?.postMessage({ collection, ids });
    },
    onExternalChange(listener) {
      if (!channel) return () => undefined;
      const handler = (e: MessageEvent) => listener(e.data.collection, e.data.ids);
      channel.addEventListener("message", handler);
      return () => channel.removeEventListener("message", handler);
    },
  };
}
