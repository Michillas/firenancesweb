import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import { runAssistant, type AssistantAction } from "@/core/ai";
import { buildAssistantContext } from "@/core/logic/assistant-context";
import { monthlySummary } from "@/core/logic/cashflow";
import { lastMonths, monthOf, todayKey } from "@/core/logic/dates";
import { forecastMonth } from "@/core/logic/forecast";
import { accountBalance, computeNetWorth } from "@/core/logic/networth";
import { positions } from "@/core/logic/portfolio";
import { formatMoney } from "@/lib/format";
import { gateway } from "./ai";
import { planAction, type ActionOutcome } from "./actions/assistant";
import { accounts, assets, categories, fxRates, goals, holdings, plan, purchases, quotes, recurring, settings, transactions } from "./stores";

export interface ChatLine {
  id: number;
  summary: string;
  ok: boolean;
  state: "done" | "pending" | "cancelled" | "undone";
  canUndo: boolean;
}

export interface ChatEntry {
  id: number;
  role: "user" | "assistant";
  text: string;
  error?: boolean;
  memory?: string;
  lines?: ChatLine[];
}

interface AssistantState {
  open: boolean;
  busy: boolean;
  entries: ChatEntry[];
}

export const assistantStore = createStore<AssistantState>(() => ({ open: false, busy: false, entries: [] }));
export const useAssistant = <T,>(selector: (s: AssistantState) => T) => useStore(assistantStore, selector);

let nextId = 1;
let controller: AbortController | null = null;
const undoers = new Map<number, () => void>();
const confirmers = new Map<number, () => ActionOutcome>();

export const setAssistantOpen = (open: boolean) => assistantStore.setState({ open });

export function clearAssistant() {
  controller?.abort();
  undoers.clear();
  confirmers.clear();
  assistantStore.setState({ entries: [], busy: false });
}

const patchLine = (lineId: number, patch: Partial<ChatLine>) =>
  assistantStore.setState((s) => ({ entries: s.entries.map((e) => (e.lines ? { ...e, lines: e.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)) } : e)) }));

export function undoLine(lineId: number) {
  undoers.get(lineId)?.();
  undoers.delete(lineId);
  patchLine(lineId, { state: "undone", canUndo: false });
}

export function confirmLine(lineId: number) {
  const run = confirmers.get(lineId);
  confirmers.delete(lineId);
  if (!run) return;
  const outcome = run();
  if (outcome.undo) undoers.set(lineId, outcome.undo);
  patchLine(lineId, { state: "done", ok: outcome.ok, summary: outcome.summary, canUndo: Boolean(outcome.undo) });
}

export function cancelLine(lineId: number) {
  confirmers.delete(lineId);
  patchLine(lineId, { state: "cancelled" });
}

function snapshot(): string {
  const today = todayKey();
  const s = settings.get();
  const fx = fxRates.get(s.currency) ?? null;
  const txs = transactions.list();
  const quoteMap = new Map(quotes.list().map((q) => [q.id, q]));
  const catMap = new Map(categories.list().map((c) => [c.id, c]));
  const p = plan.get();
  return buildAssistantContext({
    today,
    currency: s.currency,
    money: (n) => formatMoney(n, { currency: s.currency }),
    accounts: accounts.list().filter((a) => !a.archived).map((a) => ({ ...a, balance: accountBalance(a, txs) })),
    categories: categories.list().filter((c) => !c.archived),
    txs: [...txs].sort((a, b) => b.date.localeCompare(a.date)),
    months: monthlySummary(txs, lastMonths(monthOf(today), 4), catMap, fx),
    recurring: recurring.list(),
    goals: goals.list(),
    purchases: purchases.list(),
    positions: positions(holdings.list(), quoteMap, fx),
    netWorth: computeNetWorth({ accounts: accounts.list(), txs, holdings: holdings.list(), quotes: quoteMap, assets: assets.list(), fx }),
    forecast: forecastMonth({ month: monthOf(today), today, txs, recurring: recurring.list(), categories: categories.list(), payroll: p.payroll, goals: goals.list(), purchases: purchases.list(), fx }),
    plan: p,
  });
}

function applyActions(actions: AssistantAction[]): ChatLine[] {
  return actions.map((action) => {
    const id = nextId++;
    const planned = planAction(action);
    if (planned.kind === "confirm") {
      confirmers.set(id, planned.run);
      return { id, summary: planned.summary, ok: true, state: "pending", canUndo: false };
    }
    if (planned.outcome.undo) undoers.set(id, planned.outcome.undo);
    return { id, summary: planned.outcome.summary, ok: planned.outcome.ok, state: "done", canUndo: Boolean(planned.outcome.undo) };
  });
}

export async function sendAssistantMessage(raw: string) {
  const text = raw.trim();
  if (!text || assistantStore.getState().busy) return;
  const history = assistantStore.getState().entries.filter((e) => !e.error).map((e) => ({ role: e.role, content: e.memory ?? e.text }));
  assistantStore.setState((s) => ({ busy: true, entries: [...s.entries, { id: nextId++, role: "user", text }] }));
  controller = new AbortController();
  try {
    const result = await runAssistant(gateway, { context: snapshot(), history, message: text }, controller.signal);
    const lines = applyActions(result.actions);
    const reply = result.reply || (lines.length ? "" : "No he entendido la petición. ¿Puedes reformularla?");
    const done = lines.filter((l) => l.state === "done" && l.ok).map((l) => l.summary);
    const memory = [reply, done.length ? `[${done.join("; ")}]` : ""].filter(Boolean).join(" ");
    assistantStore.setState((s) => ({ entries: [...s.entries, { id: nextId++, role: "assistant", text: reply, memory, lines: lines.length ? lines : undefined }] }));
  } catch (error) {
    if (controller?.signal.aborted) return;
    assistantStore.setState((s) => ({ entries: [...s.entries, { id: nextId++, role: "assistant", text: "La IA no ha respondido. El modo sin clave tiene un cupo pequeño: añade una clave gratuita (OpenRouter o Gemini) en Ajustes → IA.", error: true }] }));
    console.warn("[assistant]", error);
  } finally {
    assistantStore.setState({ busy: false });
  }
}
