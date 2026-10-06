import { useMemo } from "react";
import { createStore, type StoreApi } from "zustand/vanilla";
import { useStore } from "zustand";
import type { z } from "zod";
import { newId, nowIso, type EntityBase } from "@/core/domain/base";
import { createBus } from "@/lib/event-bus";
import { getStorage } from "./runtime";

export type ChangeEvent = { collection: string; ids: string[]; fromRemote: boolean };
// Sync listens here; everything that persists a change announces it.
export const changeBus = createBus<ChangeEvent>();

export interface CollectionState<T> {
  items: Record<string, T>;
  hydrated: boolean;
}

type Input<S extends z.ZodType> = Omit<z.input<S>, "id" | "createdAt" | "updatedAt" | "deletedAt">;

export interface CollectionStore<S extends z.ZodType<EntityBase>> {
  readonly name: string;
  readonly schema: S;
  readonly store: StoreApi<CollectionState<z.output<S>>>;
  create(input: Input<S>, overrides?: Partial<EntityBase>): z.output<S>;
  // One state update for many rows (imports): avoids re-rendering once per row.
  createMany(inputs: Input<S>[]): z.output<S>[];
  upsert(id: string, input: Input<S>): z.output<S>;
  update(id: string, patch: Partial<z.output<S>>): z.output<S> | undefined;
  remove(id: string): void;
  get(id: string): z.output<S> | undefined;
  list(): z.output<S>[];
  hydrate(): Promise<void>;
  applyRemote(items: unknown[]): void;
  replaceAll(items: unknown[]): void;
  flush(): Promise<void>;
  rawAll(): z.output<S>[];
}

const TOMBSTONE_TTL_MS = 60 * 24 * 3600 * 1000;
const FLUSH_DELAY_MS = 150;

export function createCollectionStore<S extends z.ZodType<EntityBase>>(opts: {
  name: string;
  prefix: string;
  schema: S;
}): CollectionStore<S> {
  type T = z.output<S>;
  const store = createStore<CollectionState<T>>(() => ({ items: {}, hydrated: false }));
  const dirty = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function flush() {
    if (timer) clearTimeout(timer);
    timer = null;
    if (dirty.size === 0) return;
    const ids = [...dirty];
    dirty.clear();
    const { items } = store.getState();
    const rows = ids.map((id) => items[id]).filter(Boolean) as T[];
    const driver = getStorage();
    await driver.putMany(opts.name, rows);
    driver.notifyChange(opts.name, ids);
  }

  function markDirty(ids: string[]) {
    ids.forEach((id) => dirty.add(id));
    changeBus.emit({ collection: opts.name, ids, fromRemote: false });
    if (!timer) timer = setTimeout(() => void flush().catch((e) => console.warn(`[store:${opts.name}] save failed`, e)), FLUSH_DELAY_MS);
  }

  function parse(raw: unknown): T | null {
    const result = opts.schema.safeParse(raw);
    if (!result.success) {
      console.warn(`[store:${opts.name}] skipped an invalid record`, result.error.issues[0]);
      return null;
    }
    return result.data as T;
  }

  function merge(rows: unknown[], mode: "remote" | "reload") {
    const parsed = rows.map(parse).filter((r): r is T => r !== null);
    if (parsed.length === 0) return;
    const current = store.getState().items;
    const next = { ...current };
    const changed: string[] = [];
    for (const row of parsed) {
      const local = current[row.id];
      if (mode === "remote" && local && local.updatedAt >= row.updatedAt) continue;
      next[row.id] = row;
      changed.push(row.id);
    }
    if (changed.length === 0) return;
    store.setState({ items: next });
    if (mode === "remote") {
      void getStorage().putMany(opts.name, changed.map((id) => next[id]));
      changeBus.emit({ collection: opts.name, ids: changed, fromRemote: true });
    }
  }

  let externalUnsub: (() => void) | null = null;

  return {
    name: opts.name,
    schema: opts.schema,
    store,
    create(input, overrides) {
      const now = nowIso();
      const entity = opts.schema.parse({
        ...input,
        id: overrides?.id ?? newId(opts.prefix),
        createdAt: overrides?.createdAt ?? now,
        updatedAt: overrides?.updatedAt ?? now,
        deletedAt: null,
      }) as T;
      store.setState((s) => ({ items: { ...s.items, [entity.id]: entity } }));
      markDirty([entity.id]);
      return entity;
    },
    createMany(inputs) {
      const now = nowIso();
      const rows = inputs.map((input) => opts.schema.parse({ ...input, id: newId(opts.prefix), createdAt: now, updatedAt: now, deletedAt: null }) as T);
      if (rows.length === 0) return rows;
      store.setState((s) => {
        const items = { ...s.items };
        for (const row of rows) items[row.id] = row;
        return { items };
      });
      markDirty(rows.map((r) => r.id));
      return rows;
    },
    upsert(id, input) {
      const current = store.getState().items[id];
      const now = nowIso();
      const entity = opts.schema.parse({ ...input, id, createdAt: current?.createdAt ?? now, updatedAt: now, deletedAt: null }) as T;
      store.setState((s) => ({ items: { ...s.items, [id]: entity } }));
      markDirty([id]);
      return entity;
    },
    update(id, patch) {
      const current = store.getState().items[id];
      if (!current) return undefined;
      const parsed = parse({ ...current, ...patch, id, updatedAt: nowIso() });
      if (!parsed) return current;
      store.setState((s) => ({ items: { ...s.items, [id]: parsed } }));
      markDirty([id]);
      return parsed;
    },
    remove(id) {
      const current = store.getState().items[id];
      if (!current || current.deletedAt) return;
      const now = nowIso();
      store.setState((s) => ({ items: { ...s.items, [id]: { ...current, deletedAt: now, updatedAt: now } } }));
      markDirty([id]);
    },
    get(id) {
      const item = store.getState().items[id];
      return item && !item.deletedAt ? item : undefined;
    },
    list() {
      return Object.values(store.getState().items).filter((i) => !i.deletedAt);
    },
    rawAll() {
      return Object.values(store.getState().items);
    },
    async hydrate() {
      if (store.getState().hydrated) return;
      const driver = getStorage();
      const rows = await driver.loadAll<T>(opts.name).catch((e) => {
        console.warn(`[store:${opts.name}] could not load`, e);
        return [] as T[];
      });
      const items: Record<string, T> = {};
      const expired: string[] = [];
      const cutoff = Date.now() - TOMBSTONE_TTL_MS;
      for (const raw of rows) {
        const row = parse(raw);
        if (!row) continue;
        if (row.deletedAt && new Date(row.deletedAt).getTime() < cutoff) {
          expired.push(row.id);
          continue;
        }
        items[row.id] = row;
      }
      if (expired.length) void driver.deleteMany(opts.name, expired);
      store.setState({ items, hydrated: true });
      externalUnsub?.();
      externalUnsub = driver.onExternalChange((collection, ids) => {
        if (collection !== opts.name) return;
        void driver.getMany<T>(opts.name, ids).then((fresh) => merge(fresh, "reload"));
      });
    },
    applyRemote(rows) {
      merge(rows, "remote");
    },
    replaceAll(rows) {
      const items: Record<string, T> = {};
      for (const raw of rows) {
        const row = parse(raw);
        if (row) items[row.id] = row;
      }
      store.setState({ items });
      Object.keys(items).forEach((id) => dirty.add(id));
      void getStorage().clearCollection(opts.name).then(() => flush());
      changeBus.emit({ collection: opts.name, ids: Object.keys(items), fromRemote: false });
    },
    flush,
  };
}

// ---- React bindings -------------------------------------------------------

export function useCollection<S extends z.ZodType<EntityBase>>(handle: CollectionStore<S>): z.output<S>[] {
  const items = useStore(handle.store, (s) => s.items);
  return useMemo(
    () => Object.values(items).filter((i) => !(i as EntityBase).deletedAt) as z.output<S>[],
    [items],
  );
}

export function useItem<S extends z.ZodType<EntityBase>>(handle: CollectionStore<S>, id: string | null | undefined): z.output<S> | undefined {
  return useStore(handle.store, (s) => {
    const item = id ? s.items[id] : undefined;
    return item && !(item as EntityBase).deletedAt ? item : undefined;
  }) as z.output<S> | undefined;
}

export function useHydrated(handle: { store: StoreApi<{ hydrated: boolean }> }): boolean {
  return useStore(handle.store, (s) => s.hydrated);
}
