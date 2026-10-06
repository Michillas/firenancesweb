"use client";

import { Check, MessageCircle, RotateCcw, Send, Sparkles, Trash2, Undo2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";
import { cancelLine, clearAssistant, confirmLine, sendAssistantMessage, setAssistantOpen, undoLine, useAssistant, type ChatEntry, type ChatLine } from "@/store/assistant";

const SUGGESTIONS = ["¿Cuánto me queda libre este mes?", "Ayer gasté 23,40 € en el súper", "¿En qué gasto más que el mes pasado?", "¿Cuándo llegaría a FIRE si ahorro 200 € más al mes?"];

function Line({ line }: { line: ChatLine }) {
  const muted = line.state === "cancelled" || line.state === "undone";
  return (
    <li className={cn("flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm", line.ok ? "border-success/40 bg-success/10" : "border-danger/40 bg-danger/10", line.state === "pending" && "border-warning/50 bg-warning/10", muted && "opacity-60")}>
      {line.ok ? <Check size={16} className="shrink-0 text-success" aria-hidden="true" /> : <X size={16} className="shrink-0 text-danger" aria-hidden="true" />}
      <span className={cn("min-w-0 flex-1 font-semibold", muted && "line-through")}>{line.summary}</span>
      {line.state === "pending" && (
        <span className="flex gap-1.5">
          <Button size="sm" variant="danger" onPress={() => confirmLine(line.id)}>Eliminar</Button>
          <Button size="sm" variant="tertiary" onPress={() => cancelLine(line.id)}>Cancelar</Button>
        </span>
      )}
      {line.state === "done" && line.canUndo && (
        <button type="button" onClick={() => undoLine(line.id)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-muted hover:bg-surface-secondary hover:text-foreground">
          <Undo2 size={13} aria-hidden="true" />
          Deshacer
        </button>
      )}
      {line.state === "undone" && <span className="text-xs font-bold text-muted">Deshecho</span>}
    </li>
  );
}

function Bubble({ entry }: { entry: ChatEntry }) {
  const mine = entry.role === "user";
  return (
    <li className={cn("flex flex-col gap-2", mine ? "items-end" : "items-start")}>
      {entry.text && (
        <p className={cn("max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[0.95rem] font-medium", mine ? "rounded-br-md bg-brand text-brand-foreground" : "rounded-bl-md bg-surface-secondary", entry.error && "border border-danger/40 bg-danger/10")}>
          {entry.text}
        </p>
      )}
      {entry.lines && (
        <ul className="flex w-full flex-col gap-1.5">
          {entry.lines.map((l) => (
            <Line key={l.id} line={l} />
          ))}
        </ul>
      )}
    </li>
  );
}

function Panel() {
  const entries = useAssistant((s) => s.entries);
  const busy = useAssistant((s) => s.busy);
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAssistantOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [entries, busy]);

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    setDraft("");
    void sendAssistantMessage(text);
  };

  return (
    <section role="dialog" aria-label={"Asistente financiero"} className="pop-in fixed inset-x-3 bottom-[calc(var(--nav-h)+5.25rem)] z-[70] flex h-[min(36rem,calc(100dvh-var(--nav-h)-8rem))] flex-col overflow-hidden rounded-3xl border border-border bg-overlay shadow-lift sm:inset-x-auto sm:right-5 sm:w-[26rem] lg:bottom-24">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span aria-hidden="true" className="grid size-9 place-items-center rounded-xl bg-brand text-brand-foreground"><Sparkles size={18} /></span>
        <h2 className="flex-1 text-lg font-extrabold">{"Asistente financiero"}</h2>
        {entries.length > 0 && (
          <Button isIconOnly size="sm" variant="ghost" aria-label={"Borrar conversación"} onPress={clearAssistant}>
            <Trash2 size={16} aria-hidden="true" />
          </Button>
        )}
        <Button isIconOnly size="sm" variant="ghost" aria-label={"Cerrar"} onPress={() => setAssistantOpen(false)}>
          <X size={18} aria-hidden="true" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" role="log" aria-live="polite" aria-label={"Asistente financiero"}>
        {entries.length === 0 ? (
          <div className="flex h-full flex-col justify-center gap-4">
            <p className="text-center font-semibold text-muted">Pregúntame por tus gastos, previsiones o inversiones, o dime un gasto y lo apunto. No soy asesor financiero: te doy datos y escenarios.</p>
            <ul className="flex flex-col gap-2">
              {SUGGESTIONS.map((key) => (
                <li key={key}>
                  <button type="button" onClick={() => send(key)} className="choice py-2.5 text-sm">
                    {key}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {entries.map((e) => (
              <Bubble key={e.id} entry={e} />
            ))}
            {busy && (
              <li className="flex items-center gap-2 text-sm font-semibold text-muted">
                <Spinner size="sm" /> Pensando…
              </li>
            )}
          </ul>
        )}
        <div ref={end} />
      </div>

      <form
        className="flex items-end gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <textarea
          ref={input}
          aria-label={"Escribe tu pregunta o un gasto…"}
          value={draft}
          rows={1}
          placeholder={"Escribe tu pregunta o un gasto…"}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(draft);
            }
          }}
          className="field max-h-32 min-h-11 resize-none"
        />
        <Button type="submit" isIconOnly isDisabled={!draft.trim() || busy} aria-label={"Enviar"}>
          <Send size={18} aria-hidden="true" />
        </Button>
      </form>
    </section>
  );
}

// Floating round button bottom-right that opens the assistant chat.
export function AssistantWidget() {
  const open = useAssistant((s) => s.open);
  const busy = useAssistant((s) => s.busy);
  return (
    <>
      {open && <Panel />}
      <button
        type="button"
        aria-label={open ? "Cerrar" : "Abrir asistente"}
        aria-expanded={open}
        onClick={() => setAssistantOpen(!open)}
        className="fixed bottom-[calc(var(--nav-h)+1rem)] right-4 z-[70] grid size-14 place-items-center rounded-full bg-brand text-brand-foreground shadow-[0_10px_30px_-6px_var(--brand)] ring-4 ring-brand/15 transition-transform hover:scale-105 active:scale-95 lg:bottom-6 lg:right-6"
      >
        {open ? <X size={26} aria-hidden="true" /> : busy ? <RotateCcw size={24} className="animate-spin" aria-hidden="true" /> : <MessageCircle size={26} aria-hidden="true" />}
      </button>
    </>
  );
}
