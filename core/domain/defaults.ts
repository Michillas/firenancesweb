import type { Category, CategoryGroup } from "./finance";

type Seed = Pick<Category, "name" | "emoji" | "color" | "kind" | "keywords"> & { slug: string; group: CategoryGroup };

// Seeded on first run with stable ids (cat_<slug>) so AI imports and rules can refer to them.
export const DEFAULT_CATEGORIES: Seed[] = [
  { slug: "housing", name: "Vivienda", emoji: "🏠", color: "indigo", kind: "expense", group: "needs", keywords: ["alquiler", "hipoteca", "comunidad", "ibi", "arrendamiento"] },
  { slug: "utilities", name: "Suministros", emoji: "💡", color: "amber", kind: "expense", group: "needs", keywords: ["iberdrola", "endesa", "naturgy", "holaluz", "totalenergies", "octopus", "canal de isabel", "aguas", "gas natural", "luz", "electricidad"] },
  { slug: "groceries", name: "Supermercado", emoji: "🛒", color: "emerald", kind: "expense", group: "needs", keywords: ["mercadona", "carrefour", "lidl", "aldi", "dia ", "alcampo", "eroski", "consum", "hipercor", "bonpreu", "caprabo", "ahorramas", "condis", "supermercado", "gadis", "froiz", "spar"] },
  { slug: "transport", name: "Transporte", emoji: "🚇", color: "sky", kind: "expense", group: "needs", keywords: ["renfe", "metro", "emt", "tmb", "cabify", "uber", "bolt", "repsol", "cepsa", "galp", "shell", "bp ", "gasolinera", "parking", "peaje", "autopista", "alsa", "bicimad", "itv"] },
  { slug: "health", name: "Salud", emoji: "💊", color: "rose", kind: "expense", group: "needs", keywords: ["farmacia", "sanitas", "adeslas", "dkv", "asisa", "dentista", "clinica", "optica", "hospital", "fisioterapia"] },
  { slug: "insurance", name: "Seguros", emoji: "🛡️", color: "slate", kind: "expense", group: "needs", keywords: ["mapfre", "axa", "allianz", "mutua", "linea directa", "seguro", "generali", "zurich", "reale"] },
  { slug: "telecom", name: "Móvil e internet", emoji: "📱", color: "teal", kind: "expense", group: "needs", keywords: ["movistar", "vodafone", "orange", "digi", "pepephone", "simyo", "o2", "masmovil", "jazztel", "yoigo", "lowi", "finetwork"] },
  { slug: "education", name: "Educación", emoji: "📚", color: "violet", kind: "expense", group: "needs", keywords: ["universidad", "matricula", "academia", "colegio", "udemy", "coursera", "libreria"] },
  { slug: "taxes", name: "Impuestos y tasas", emoji: "🧾", color: "slate", kind: "expense", group: "needs", keywords: ["agencia tributaria", "aeat", "hacienda", "ayuntamiento", "tasa", "impuesto", "dgt", "multa"] },
  { slug: "fees", name: "Comisiones", emoji: "🏦", color: "slate", kind: "expense", group: "needs", keywords: ["comision", "intereses deudores", "cuota tarjeta", "mantenimiento cuenta"] },
  { slug: "restaurants", name: "Restaurantes", emoji: "🍽️", color: "orange", kind: "expense", group: "wants", keywords: ["restaurante", "bar ", "cafeteria", "glovo", "just eat", "uber eats", "mcdonald", "burger king", "telepizza", "starbucks", "foodhunter", "goiko", "taberna", "cerveceria", "kfc", "domino"] },
  { slug: "leisure", name: "Ocio", emoji: "🎬", color: "fuchsia", kind: "expense", group: "wants", keywords: ["cine", "yelmo", "cinesa", "ticketmaster", "entradas", "steam", "playstation", "nintendo", "xbox", "concierto", "teatro", "museo"] },
  { slug: "subscriptions", name: "Suscripciones", emoji: "🔁", color: "violet", kind: "expense", group: "wants", keywords: ["netflix", "spotify", "hbo", "disney", "prime video", "amazon prime", "youtube", "apple.com", "icloud", "chatgpt", "openai", "dazn", "filmin", "movistar plus", "audible", "patreon", "claude.ai", "anthropic"] },
  { slug: "shopping", name: "Compras", emoji: "🛍️", color: "rose", kind: "expense", group: "wants", keywords: ["amazon", "zara", "primark", "corte ingles", "ikea", "mediamarkt", "aliexpress", "shein", "pccomponentes", "fnac", "pull&bear", "bershka", "mango", "h&m", "leroy merlin", "wallapop", "vinted"] },
  { slug: "travel", name: "Viajes", emoji: "✈️", color: "sky", kind: "expense", group: "wants", keywords: ["ryanair", "vueling", "iberia", "booking", "airbnb", "hotel", "easyjet", "air europa", "expedia", "iryo", "ouigo"] },
  { slug: "sport", name: "Deporte", emoji: "🏋️", color: "lime", kind: "expense", group: "wants", keywords: ["gimnasio", "basic-fit", "basic fit", "mcfit", "holmes place", "padel", "decathlon", "anytime fitness", "altafit", "synergym"] },
  { slug: "personal", name: "Cuidado personal", emoji: "💇", color: "fuchsia", kind: "expense", group: "wants", keywords: ["peluqueria", "barberia", "primor", "druni", "sephora", "estetica"] },
  { slug: "pets", name: "Mascotas", emoji: "🐾", color: "amber", kind: "expense", group: "wants", keywords: ["tiendanimal", "kiwoko", "veterinario", "zooplus"] },
  { slug: "gifts", name: "Regalos y donaciones", emoji: "🎁", color: "rose", kind: "expense", group: "wants", keywords: ["regalo", "donacion", "ong", "cruz roja", "unicef"] },
  { slug: "investing", name: "Ahorro e inversión", emoji: "📈", color: "emerald", kind: "expense", group: "savings", keywords: ["indexa", "myinvestor", "trade republic", "degiro", "interactive brokers", "binance", "coinbase", "kraken", "bitpanda", "plan de pensiones", "finizens", "inbestme", "revolut invest", "scalable"] },
  { slug: "other", name: "Otros gastos", emoji: "📦", color: "slate", kind: "expense", group: "wants", keywords: [] },
  { slug: "salary", name: "Nómina", emoji: "💼", color: "emerald", kind: "income", group: "income", keywords: ["nomina", "salario", "payroll", "abono nomina"] },
  { slug: "returns", name: "Rendimientos", emoji: "💹", color: "teal", kind: "income", group: "income", keywords: ["dividendo", "intereses", "cupon", "rendimiento", "remuneracion"] },
  { slug: "refunds", name: "Devoluciones", emoji: "↩️", color: "sky", kind: "income", group: "income", keywords: ["devolucion", "reembolso", "refund", "abono"] },
  { slug: "other-income", name: "Otros ingresos", emoji: "💰", color: "lime", kind: "income", group: "income", keywords: ["bizum recibido", "transferencia recibida", "venta"] },
];

export const categoryId = (slug: string) => `cat_${slug}`;
