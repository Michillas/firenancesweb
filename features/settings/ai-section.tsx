"use client";

import { AppModal, Button, Card, Chip, toast } from "@/components/ui";
import { ArrowDown, ArrowUp, ExternalLink, Eye, EyeOff, Plus, Settings2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { PROVIDERS } from "@/core/ai/providers";
import type { ProviderConfig } from "@/core/domain/settings";
import { getPlatform } from "@/core/platform";
import { SwitchField, TextInput } from "@/components/ui/fields";
import { gateway, resolveProviderConfigs, serverProviders, testProvider } from "@/store/ai";
import { useDoc } from "@/store/create-doc-store";
import { device } from "@/store/stores";

const PROVIDER_NAMES: Record<string, string> = {"openrouter": "OpenRouter (gratis con clave)", "gemini": "Google Gemini (gratis con clave, busca en internet)", "pollinations": "Pollinations (sin clave, cupo pequeño)", "custom": "Servidor propio (Ollama, LM Studio…)"};
const PROVIDER_DESC: Record<string, string> = {"openrouter": "El router «openrouter/free» elige automáticamente un modelo gratuito disponible. Crea una clave gratis en openrouter.ai.", "gemini": "Usa «gemini-flash-latest». Es el único que puede buscar en Google: noticias recientes, valor liquidativo de fondos y análisis con fuentes.", "pollinations": "Funciona sin clave a través del servidor de la app, pero con un cupo anónimo muy limitado.", "custom": "Cualquier API compatible con OpenAI (Ollama en http://localhost:11434/v1, LM Studio, vLLM…)."};
const STATUS: Record<string, string> = { ready: "Listo", "needs-key": "Falta clave", disabled: "Desactivado", cooldown: "En pausa" };

function ProviderCard({ config, index, total, onChange, onMove, onRemove }: { config: ProviderConfig; index: number; total: number; onChange: (patch: Partial<ProviderConfig>) => void; onMove: (dir: -1 | 1) => void; onRemove?: () => void }) {
  const adapter = PROVIDERS[config.id];
  const [reveal, setReveal] = useState(false);
  const [testing, setTesting] = useState(false);
  const status = gateway.status(config);
  const server = serverProviders().includes(config.id);

  const test = async () => {
    setTesting(true);
    const r = await testProvider(config);
    setTesting(false);
    if (r.ok) toast.success(`${PROVIDER_NAMES[config.id]} responde (modelo ${r.model})`);
    else toast.danger(`${PROVIDER_NAMES[config.id]} no responde: ${r.reason}`);
  };

  return (
    <li className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-2 font-semibold">
            <span className="grid size-6 place-items-center rounded-full bg-surface-secondary text-xs font-bold">{index + 1}</span>
            {PROVIDER_NAMES[config.id]}
            <Chip size="sm" variant="soft" color={status === "ready" ? "success" : status === "needs-key" ? "warning" : "default"}>{STATUS[status]}</Chip>
            {server && <Chip size="sm" variant="soft" color="accent">Clave del servidor</Chip>}
          </h3>
          <p className="mt-1 max-w-xl text-sm text-muted">{PROVIDER_DESC[config.id]}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button isIconOnly size="sm" variant="ghost" aria-label={"Subir prioridad"} isDisabled={index === 0} onPress={() => onMove(-1)}><ArrowUp size={15} /></Button>
          <Button isIconOnly size="sm" variant="ghost" aria-label={"Bajar prioridad"} isDisabled={index === total - 1} onPress={() => onMove(1)}><ArrowDown size={15} /></Button>
          {onRemove && <Button isIconOnly size="sm" variant="ghost" aria-label={"Eliminar"} onPress={onRemove}><Trash2 size={15} /></Button>}
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-3">
        <SwitchField label={"Activado"} isSelected={config.enabled} onChange={(v) => onChange({ enabled: v })} />
        {config.id === "custom" && <TextInput label={"URL base"} value={config.baseUrl} onChange={(v) => onChange({ baseUrl: v })} placeholder="http://localhost:11434/v1" />}
        {adapter.requiresKey || config.id === "custom" ? (
          <div className="flex items-end gap-2">
            <TextInput className="flex-1" label={"Clave API"} type={reveal ? "text" : "password"} value={config.apiKey} onChange={(v) => onChange({ apiKey: v.trim() })} placeholder={adapter.requiresKey ? "sk-…" : ""} />
            <Button isIconOnly variant="secondary" aria-label={reveal ? "Ocultar clave" : "Mostrar clave"} onPress={() => setReveal(!reveal)}>{reveal ? <EyeOff size={16} /> : <Eye size={16} />}</Button>
          </div>
        ) : null}
        <TextInput label={config.id === "custom" ? "Modelo" : "Modelo (opcional)"} value={config.model} onChange={(v) => onChange({ model: v.trim() })} placeholder={config.id === "custom" ? "llama3.2" : `Automático (${adapter.defaultModel})`} />
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onPress={test} isPending={testing}>Probar</Button>
          {adapter.signupUrl && adapter.requiresKey && (
            <Button size="sm" variant="ghost" onPress={() => getPlatform().openExternal(adapter.signupUrl)}>
              <ExternalLink size={14} />
              Conseguir clave gratis
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

function AiModal({ onClose }: { onClose: () => void }) {
  const stored = useDoc(device).aiProviders;
  const list = useMemo(() => resolveProviderConfigs(stored), [stored]);
  const save = (next: ProviderConfig[]) => device.patch({ aiProviders: next });

  const update = (i: number, patch: Partial<ProviderConfig>) => save(list.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const move = (i: number, dir: -1 | 1) => {
    const next = [...list];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    save(next);
  };
  const hasCustom = list.some((c) => c.id === "custom");

  return (
    <AppModal isOpen onOpenChange={(o) => !o && onClose()} title="Inteligencia artificial" size="lg" footer={<Button onPress={onClose}>Cerrar</Button>}>
      <p className="text-sm text-muted">Se prueban en este orden; si uno falla o se queda sin cupo, pasa al siguiente. Nadie elige modelo: se usan los alias gratuitos que cada proveedor mantiene actualizados.</p>
      <ul className="flex flex-col gap-3">
        {list.map((c, i) => (
          <ProviderCard key={c.id} config={c} index={i} total={list.length} onChange={(p) => update(i, p)} onMove={(d) => move(i, d)} onRemove={c.id === "custom" ? () => save(list.filter((x) => x.id !== "custom")) : undefined} />
        ))}
      </ul>
      {!hasCustom && (
        <Button variant="secondary" className="self-start" onPress={() => save([...list, { id: "custom", enabled: true, apiKey: "", baseUrl: "", model: "" }])}>
          <Plus size={15} />
          Añadir servidor propio
        </Button>
      )}
      <p className="text-xs text-muted">Las claves se guardan solo en este navegador y nunca se incluyen en las copias de seguridad.</p>
    </AppModal>
  );
}

// Compact card: which providers are ready, and a button that opens the full configuration.
export function AiSection() {
  const stored = useDoc(device).aiProviders;
  const list = useMemo(() => resolveProviderConfigs(stored), [stored]);
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <Card.Header className="flex-wrap">
        <div>
          <Card.Title as="h2">Inteligencia artificial</Card.Title>
          <Card.Description>Mismo sistema que Masterity: proveedores gratuitos en cadena. Con una clave de Gemini, además, búsqueda en internet para noticias y análisis.</Card.Description>
        </div>
        <Button size="sm" variant="secondary" onPress={() => setOpen(true)}>
          <Settings2 size={16} aria-hidden="true" />
          Configurar
        </Button>
      </Card.Header>
      <ul className="flex flex-wrap gap-2">
        {list.map((c) => {
          const status = gateway.status(c);
          return (
            <li key={c.id}>
              <Chip color={status === "ready" ? "success" : status === "needs-key" ? "warning" : "default"}>
                {PROVIDER_NAMES[c.id]} · {STATUS[status]}
              </Chip>
            </li>
          );
        })}
      </ul>
      {open && <AiModal onClose={() => setOpen(false)} />}
    </Card>
  );
}
