"use client";

import { Button } from "./kit";
import { useState } from "react";
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import { AppModal } from "./app-modal";
import { TextInput } from "./fields";
import { parseInputNumber } from "@/lib/format";

interface PromptRequest {
  title: string;
  label: string;
  initial: string;
  resolve: (value: string | null) => void;
}

const pending = createStore<{ request: PromptRequest | null }>(() => ({ request: null }));

// `const name = await promptText({...})` replaces window.prompt with an accessible dialog.
export function promptText(options: { title: string; label: string; initial?: string }): Promise<string | null> {
  return new Promise((resolve) => {
    pending.getState().request?.resolve(null);
    pending.setState({ request: { title: options.title, label: options.label, initial: options.initial ?? "", resolve } });
  });
}

function PromptDialog({ request }: { request: PromptRequest }) {
  const [value, setValue] = useState(request.initial);
  const close = (result: string | null) => {
    request.resolve(result);
    pending.setState({ request: null });
  };
  return (
    <AppModal
      isOpen
      onOpenChange={(o) => !o && close(null)}
      title={request.title}
      size="xs"
      footer={
        <>
          <Button variant="tertiary" onPress={() => close(null)}>Cancelar</Button>
          <Button isDisabled={!value.trim()} onPress={() => close(value.trim())}>Guardar</Button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); if (value.trim()) close(value.trim()); }}>
        <TextInput label={request.label} value={value} onChange={setValue} autoFocus />
      </form>
    </AppModal>
  );
}

export function PromptHost() {
  const request = useStore(pending, (s) => s.request);
  return request ? <PromptDialog key={request.title + request.initial} request={request} /> : null;
}

// Asks for an amount ("1.234,56" or "1234.56"); null when cancelled or not a number.
export async function promptMoney(options: { title: string; label: string; initial?: number }): Promise<number | null> {
  const raw = await promptText({ title: options.title, label: options.label, initial: options.initial != null ? String(options.initial).replace(".", ",") : "" });
  if (raw == null) return null;
  const n = parseInputNumber(raw);
  return Number.isFinite(n) ? n : null;
}
