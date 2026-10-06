// Everything persistent goes through these interfaces. The web build implements them with
// IndexedDB; an Electron build can implement them with SQLite / the filesystem without
// touching a single store or component.

export interface StoredEntity {
  id: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface BlobStore {
  put(id: string, blob: Blob): Promise<void>;
  get(id: string): Promise<Blob | undefined>;
  delete(id: string): Promise<void>;
  // Total bytes held, for the storage panel in Settings.
  size(): Promise<number>;
}

export interface StorageDriver {
  readonly kind: string;
  loadAll<T extends StoredEntity>(collection: string): Promise<T[]>;
  getMany<T extends StoredEntity>(collection: string, ids: string[]): Promise<T[]>;
  putMany<T extends StoredEntity>(collection: string, items: T[]): Promise<void>;
  deleteMany(collection: string, ids: string[]): Promise<void>;
  clearCollection(collection: string): Promise<void>;
  getMeta<T>(key: string): Promise<T | undefined>;
  setMeta<T>(key: string, value: T): Promise<void>;
  readonly blobs: BlobStore;
  // Tell other tabs/windows that `ids` changed so they can reload them.
  notifyChange(collection: string, ids: string[]): void;
  onExternalChange(listener: (collection: string, ids: string[]) => void): () => void;
}
