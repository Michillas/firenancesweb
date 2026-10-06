import { ArrowLeftRight, CalendarDays, Flame, Home, Landmark, LineChart, PiggyBank, PieChart, Repeat, ShoppingBag, Sparkles, Wallet, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  group: "daily" | "plan" | "wealth" | "tools";
  // Shown in the mobile bottom bar; the rest live under "Más".
  primary?: boolean;
}

export const NAV_GROUPS: { id: NavItem["group"]; label: string }[] = [
  { id: "daily", label: "General" },
  { id: "plan", label: "Planificar" },
  { id: "wealth", label: "Patrimonio" },
  { id: "tools", label: "Herramientas" },
];

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Inicio", icon: Home, group: "daily", primary: true },
  { href: "/transactions", label: "Movimientos", icon: ArrowLeftRight, group: "daily", primary: true },
  { href: "/analysis", label: "Gastos", icon: PieChart, group: "daily" },
  { href: "/subscriptions", label: "Suscripciones", icon: Repeat, group: "daily" },
  { href: "/calendar", label: "Calendario", icon: CalendarDays, group: "daily" },
  { href: "/payroll", label: "Nómina y previsión", icon: Wallet, group: "plan", primary: true },
  { href: "/purchases", label: "Compras planeadas", icon: ShoppingBag, group: "plan" },
  { href: "/savings", label: "Ahorro y metas", icon: PiggyBank, group: "plan" },
  { href: "/fire", label: "FIRE", icon: Flame, group: "plan" },
  { href: "/networth", label: "Patrimonio", icon: Landmark, group: "wealth" },
  { href: "/investments", label: "Inversiones", icon: LineChart, group: "wealth", primary: true },
  { href: "/import", label: "Importar con IA", icon: Sparkles, group: "tools" },
];

export const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);
