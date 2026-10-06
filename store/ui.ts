import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import type { TxKind } from "@/core/domain/finance";

// Cross-feature UI state that is not data: which global dialogs are open.
interface UiState {
  tx: { open: boolean; id: string | null; kind: TxKind; nonce: number };
}

export const uiStore = createStore<UiState>(() => ({ tx: { open: false, id: null, kind: "expense", nonce: 0 } }));

export const openTransaction = (opts: { id?: string | null; kind?: TxKind } = {}) =>
  uiStore.setState((s) => ({ tx: { open: true, id: opts.id ?? null, kind: opts.kind ?? "expense", nonce: s.tx.nonce + 1 } }));
export const closeTransaction = () => uiStore.setState((s) => ({ tx: { ...s.tx, open: false } }));
export const useUi = <T,>(selector: (s: UiState) => T) => useStore(uiStore, selector);
