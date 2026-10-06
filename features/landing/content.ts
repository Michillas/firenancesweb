import { ArrowLeftRight, CalendarDays, Flame, Landmark, LineChart, MessageCircle, PiggyBank, PieChart, Repeat, ShoppingBag, Sparkles, Wallet, type LucideIcon } from "lucide-react";

export interface Feature {
  icon: LucideIcon;
  title: string;
  text: string;
}

export const FEATURES: Feature[] = [
  { icon: ArrowLeftRight, title: "Movimientos", text: "Gastos, ingresos y traspasos con búsqueda, filtros, edición masiva y categoría sugerida al escribir." },
  { icon: PieChart, title: "Análisis de gastos", text: "En qué se va tu dinero, comparado con tu media, comercios top, regla 50/30/20 y presupuestos." },
  { icon: Repeat, title: "Suscripciones y recibos", text: "Coste mensual y anual, próximos cobros, pruebas gratuitas y detección automática en tus movimientos." },
  { icon: Wallet, title: "Nómina y previsión", text: "De bruto a neto con IRPF y Seguridad Social, lectura de la nómina con IA y liquidez prevista a 12 meses." },
  { icon: CalendarDays, title: "Calendario", text: "Cobros, nómina, fechas fiscales españolas (Renta, 720, planes de pensiones) y dividendos de tu cartera." },
  { icon: ShoppingBag, title: "Compras planeadas", text: "Tu lista de deseos con prioridad: cuánto apartar al mes, cuándo podrás pagarlo y cuántas horas de trabajo cuesta." },
  { icon: PiggyBank, title: "Ahorro y metas", text: "Metas con fecha, aportación necesaria, fecha estimada y un simulador de estrategias con inflación." },
  { icon: Landmark, title: "Patrimonio neto", text: "Cuentas, bienes y deudas en un solo número, con su evolución diaria." },
  { icon: LineChart, title: "Inversiones", text: "Fondos indexados, ETFs, acciones, cripto y planes de pensiones con precios automáticos, noticias y rebalanceo." },
  { icon: Flame, title: "FIRE", text: "Tu número FIRE, edad estimada de independencia financiera, Lean/Fat/Coast FIRE y simulación Monte Carlo." },
  { icon: Sparkles, title: "Importar con IA", text: "Sube el CSV o PDF de tu banco o el informe del bróker: se clasifica todo y lo revisas antes de guardar." },
  { icon: MessageCircle, title: "Asistente", text: "Pregunta por tus finanzas en lenguaje natural o pídele que apunte un gasto por ti." },
];

export const STEPS = [
  { title: "Apunta o importa", text: "Añade tus cuentas y su saldo. Escribe los gastos a mano o sube el extracto del banco en CSV o PDF." },
  { title: "Entiende tu mes", text: "Ves cuánto has gastado, lo que queda por cobrar y pagar, y cuánto te quedará libre a fin de mes." },
  { title: "Planifica", text: "Metas de ahorro, compras, cartera de inversión y tu camino hacia la independencia financiera." },
];

export const FAQ = [
  {
    q: "¿Tengo que conectar mi banco?",
    a: "No. FireNances nunca pide acceso a tu banco ni tus contraseñas. Apuntas los movimientos a mano o importas el extracto que descargas tú mismo (CSV o PDF).",
  },
  {
    q: "¿Dónde se guardan mis datos?",
    a: "En tu navegador, en este dispositivo. No hay cuentas de usuario ni base de datos en nuestros servidores. Puedes exportar una copia de seguridad cuando quieras y borrarlo todo desde Ajustes.",
  },
  {
    q: "¿Es gratis?",
    a: "Sí. La app es gratuita y no necesita registro. Las funciones de IA usan proveedores con cupo gratuito; si quieres más cupo, puedes pegar tu propia clave gratuita de Google Gemini u OpenRouter.",
  },
  {
    q: "¿Qué hace la inteligencia artificial?",
    a: "Lee extractos y nóminas para convertirlos en movimientos, revisa tus gastos, resume noticias de tus inversiones y responde preguntas sobre tus finanzas. Solo se envía a la IA lo necesario para lo que pides: el extracto que importas o, si usas el asistente, un resumen de tus cifras.",
  },
  {
    q: "¿Sirve para seguir mis inversiones?",
    a: "Sí: fondos indexados y ETFs por ISIN, acciones de cualquier bolsa, criptomonedas y planes de pensiones, con precios automáticos (en tiempo real para cripto) y peso frente a tu objetivo.",
  },
  {
    q: "¿Puedo usarlo en el móvil?",
    a: "Sí. Funciona en cualquier navegador y puedes instalarlo en la pantalla de inicio como una app. Ten en cuenta que los datos viven en cada dispositivo: usa «Exportar copia» y «Restaurar copia» en Ajustes para moverlos.",
  },
  {
    q: "¿Es asesoramiento financiero?",
    a: "No. FireNances es una herramienta educativa. Los cálculos de impuestos y las previsiones son estimaciones y los análisis de la IA nunca son recomendaciones de compra o venta.",
  },
];
