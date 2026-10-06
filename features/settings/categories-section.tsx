"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { AppModal, Button, Card, MoneyInput, Segmented, TextInput, confirmAction } from "@/components/ui";
import type { Category, CategoryGroup } from "@/core/domain/finance";
import { useCategories, useMoney } from "@/store/selectors";
import { categories } from "@/store/stores";

const GROUPS: { id: CategoryGroup; label: string }[] = [
  { id: "needs", label: "Necesidad" },
  { id: "wants", label: "Capricho / ocio" },
  { id: "savings", label: "Ahorro e inversión" },
];

function CategoryModal({ category, kind, onClose }: { category: Category | null; kind: Category["kind"]; onClose: () => void }) {
  const [name, setName] = useState(category?.name ?? "");
  const [emoji, setEmoji] = useState(category?.emoji ?? "📦");
  const [group, setGroup] = useState<CategoryGroup>(category?.group ?? (kind === "income" ? "income" : "wants"));
  const [budget, setBudget] = useState<number | null>(category?.monthlyBudget ?? null);
  const [keywords, setKeywords] = useState(category?.keywords.join(", ") ?? "");
  const save = () => {
    const row = { name: name.trim(), emoji: emoji.trim() || "📦", group, kind, monthlyBudget: kind === "expense" ? budget : null, keywords: keywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean) };
    if (category) categories.update(category.id, row);
    else categories.create({ ...row, color: "slate", archived: false, order: 100 });
    onClose();
  };
  const remove = async () => {
    if (!category) return;
    if (await confirmAction({ title: `¿Archivar «${category.name}»?`, body: "Los movimientos conservan la categoría; deja de aparecer en listas.", confirmLabel: "Archivar" })) {
      categories.update(category.id, { archived: true });
      onClose();
    }
  };
  return (
    <AppModal
      isOpen
      onOpenChange={(o) => !o && onClose()}
      title={category ? "Editar categoría" : "Nueva categoría"}
      footer={
        <>
          {category && (
            <Button variant="ghost" className="mr-auto text-danger" onPress={remove}>
              <Trash2 size={15} aria-hidden="true" /> Archivar
            </Button>
          )}
          <Button variant="tertiary" onPress={onClose}>Cancelar</Button>
          <Button isDisabled={!name.trim()} onPress={save}>Guardar</Button>
        </>
      }
    >
      <div className="grid grid-cols-[5rem_1fr] gap-3">
        <TextInput label="Emoji" value={emoji} onChange={setEmoji} />
        <TextInput label="Nombre" value={name} onChange={setName} />
      </div>
      {kind === "expense" && (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-bold">Tipo de gasto (para el reparto de la nómina)</span>
            <Segmented label="Tipo de gasto" value={group} onChange={setGroup} options={GROUPS} size="sm" className="self-start" />
          </div>
          <MoneyInput label="Presupuesto mensual" value={budget} onChange={setBudget} hint="Déjalo vacío si no quieres límite." />
        </>
      )}
      <TextInput label="Palabras clave para clasificar" value={keywords} onChange={setKeywords} hint="Separadas por comas. Si un movimiento las contiene, se asigna esta categoría al importar." />
    </AppModal>
  );
}

export function CategoriesSection() {
  const money = useMoney();
  const [kind, setKind] = useState<Category["kind"]>("expense");
  const list = useCategories(kind);
  const [editing, setEditing] = useState<Category | null | "new">(null);
  return (
    <Card className="gap-4">
      <Card.Header className="flex-wrap">
        <div>
          <Card.Title>Categorías y presupuestos</Card.Title>
          <Card.Description>Edita nombres, presupuestos mensuales y las palabras que usa la clasificación automática.</Card.Description>
        </div>
        <Button size="sm" variant="secondary" onPress={() => setEditing("new")}>
          <Plus size={15} aria-hidden="true" /> Nueva
        </Button>
      </Card.Header>
      <Segmented label="Tipo" value={kind} onChange={setKind} options={[{ id: "expense", label: "Gastos" }, { id: "income", label: "Ingresos" }]} size="sm" className="self-start" />
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => setEditing(c)} className="choice py-2.5">
              <span className="text-xl" aria-hidden="true">{c.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{c.name}</span>
                <span className="block truncate text-xs text-muted">{c.kind === "expense" ? `${GROUPS.find((g) => g.id === c.group)?.label ?? ""}${c.monthlyBudget ? ` · ${money(c.monthlyBudget)}/mes` : ""}` : `${c.keywords.length} palabras clave`}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {editing && <CategoryModal key={editing === "new" ? "new" : editing.id} category={editing === "new" ? null : editing} kind={kind} onClose={() => setEditing(null)} />}
    </Card>
  );
}
