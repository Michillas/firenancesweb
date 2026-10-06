import { createStore, type StoreApi } from "zustand/vanilla";
import { useStore } from "zustand";
import type { z } from "zod";
import { nowIso, type EntityBase } from "@/core/domain/base";
import { changeBus } from "./create-collection-store";
import { getStorage } from "./runtime";

export interface DocState<T> {
  value: T;
  hydrated: boolean;
}

const DOC_ID = "singleton";

// A collection with exactly one row (settings, progress): same persistence + sync path.
export interface DocStore<S extends z.ZodType<EntityBase>> {
  readonly name: string;
  readonly store: StoreApi<DocState<z.output<S>>>;
  readonly syncs: boolean;
  get(): z.output<S>;
  patch(patch: Partial<z.output<S>>): void;
  set(next: z.output<S>): void;
  hydrate(): Promise<void>;
  applyRemote(rows: unknown[]): void;
  replaceAll(rows: unknown[]): void;
  rawAll(): z.output<S>[];
  flush(): Promise<void>;
}

export function createDocStore<S extends z.ZodType<EntityBase>>(opts: { name: string; schema: S; syncs?: boolean }): DocStore<S> {
  type T = z.output<S>;
  const make = (): T => {
    const now = nowIso();
    return opts.schema.parse({ id: DOC_ID, createdAt: now, updatedAt: now }) as T;
  };
  const store = createStore<DocState<T>>(() => ({ value: make(), hydrated: false }));
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending = false;

  async function flush() {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!pending) return;
    pending = false;
    const driver = getStorage();
    await driver.putMany(opts.name, [store.getState().value as T & { id: string; updatedAt: string }]);
    driver.notifyChange(opts.name, [DOC_ID]);
  }

  function persist(fromRemote = false) {
    if (!fromRemote) {
      pending = true;
      if (!timer) timer = setTimeout(() => void flush().catch((e) => console.warn(`[doc:${opts.name}] save failed`, e)), 150);
    }
    changeBus.emit({ collection: opts.name, ids: [DOC_ID], fromRemote });
  }

  return {
    name: opts.name,
    store,
    syncs: opts.syncs ?? true,
    get: () => store.getState().value,
    patch(patch) {
      const next = opts.schema.safeParse({ ...store.getState().value, ...patch, id: DOC_ID, updatedAt: nowIso() });
      if (!next.success) return;
      store.setState({ value: next.data as T });
      persist();
    },
    set(next) {
      store.setState({ value: { ...next, updatedAt: nowIso() } as T });
      persist();
    },
    async hydrate() {
      if (store.getState().hydrated) return;
      const driver = getStorage();
      const [row] = await driver.loadAll<T & { id: string; updatedAt: string }>(opts.name).catch(() => []);
      const parsed = row ? opts.schema.safeParse(row) : null;
      if (parsed?.success) store.setState({ value: parsed.data as T, hydrated: true });
      else store.setState({ hydrated: true });
      driver.onExternalChange((collection) => {
        if (collection !== opts.name) return;
        void driver.getMany<T & { id: string; updatedAt: string }>(opts.name, [DOC_ID]).then(([fresh]) => {
          const p = fresh ? opts.schema.safeParse(fresh) : null;
          if (p?.success) store.setState({ value: p.data as T });
        });
      });
    },
    applyRemote(rows) {
      const parsed = rows.map((r) => opts.schema.safeParse(r)).find((r) => r.success);
      if (!parsed?.success) return;
      const incoming = parsed.data as T;
      if (store.getState().value.updatedAt >= incoming.updatedAt) return;
      store.setState({ value: incoming });
      void getStorage().putMany(opts.name, [incoming as T & { id: string; updatedAt: string }]);
      persist(true);
    },
    replaceAll(rows) {
      const parsed = rows.map((r) => opts.schema.safeParse(r)).find((r) => r.success);
      if (!parsed?.success) return;
      store.setState({ value: parsed.data as T });
      persist();
    },
    rawAll: () => [store.getState().value],
    flush,
  };
}

export function useDoc<S extends z.ZodType<EntityBase>>(handle: DocStore<S>): z.output<S> {
  return useStore(handle.store, (s) => s.value);
}
