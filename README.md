<p align="center">
  <img src="public/icon.png" width="72" alt="" />
</p>

<h1 align="center">FireNances</h1>

<p align="center">
  <strong>Finanzas personales sin conectar el banco.</strong><br />
  Gastos, suscripciones, nómina, patrimonio, inversiones y planificación FIRE. Gratis, sin cuenta y con tus datos en tu navegador.
</p>

---

## Por qué FireNances

La mayoría de apps de finanzas te piden las claves del banco. FireNances no: apuntas tus movimientos a mano, importas
el extracto que descargas tú (CSV o PDF) o se lo pasas a la IA para que lo lea por ti. Todo se guarda en tu
navegador, en tu dispositivo.

- **Sin conexión bancaria** y sin registro.
- **Local-first**: tus datos viven en tu navegador (IndexedDB). Puedes exportarlos o borrarlos cuando quieras.
- **Pensada para España**: IRPF y Seguridad Social, 12 o 14 pagas, calendario fiscal (Renta, 720/721, planes de
  pensiones, modelos 130/303 para autónomos).
- **IA gratuita y opcional** para importar extractos, leer nóminas, revisar tus gastos y analizar tus inversiones.

## Qué incluye

| Sección | Qué hace |
| --- | --- |
| **Inicio** | Patrimonio neto e histórico, previsión del mes (ingresos, gastado, libre a fin de mes), avisos, próximos cobros, cartera, presupuestos y progreso FIRE |
| **Movimientos** | Gastos, ingresos y traspasos con filtros, búsqueda, edición masiva, exportación a CSV y categoría sugerida al escribir |
| **Gastos** | Ingresos frente a gastos (12 meses), gasto por categoría frente a tu media, comercios top, regla 50/30/20, presupuestos y revisión con IA |
| **Suscripciones** | Suscripciones, recibos e ingresos recurrentes: coste mensual y anual, próximos cobros, pruebas gratuitas y detección automática |
| **Calendario** | Cobros, nómina, calendario fiscal español, resultados y dividendos de tu cartera, metas y compras |
| **Nómina y previsión** | De bruto a neto, lectura de la nómina con IA, reparto de cada euro y liquidez prevista a 12 meses |
| **Compras planeadas** | Lista de deseos con prioridad, cuánto apartar al mes, cuándo podrás pagarlo, financiación con TAE y coste en horas de trabajo |
| **Ahorro y metas** | Metas con fecha, aportación necesaria, fecha estimada y simulador de estrategias con inflación |
| **FIRE** | Número FIRE, Lean/Fat/Barista/Coast FIRE, edad estimada, simulación Monte Carlo y palancas |
| **Patrimonio** | Cuentas, bienes y deudas con su evolución diaria; «ajustar saldo» para cuadrar con el banco |
| **Inversiones** | Fondos indexados, ETFs, acciones, cripto y planes de pensiones con precios automáticos, rebalanceo, noticias y análisis con IA |
| **Importar con IA** | CSV (sin IA, columnas autodetectadas), PDF o texto del extracto, informe del bróker; revisión y detección de duplicados antes de guardar |
| **Asistente** | Chat que responde con tus datos y puede apuntar gastos, recurrentes, metas o compras por ti (con deshacer) |

## Empezar

Requisitos: Node.js 22 o superior.

```bash
npm install
npm run dev
```

Abre <http://localhost:3200>. La portada está en `/` y la app en `/dashboard`. Para verla con datos, pulsa
«Probar con datos de ejemplo» en el panel (o Ajustes → Datos).

## Inteligencia artificial

Funciona sin configurar nada gracias a un proveedor gratuito con poco cupo. Para más cupo, pega una clave gratuita en
Ajustes → Inteligencia artificial:

| Proveedor | Dónde conseguir la clave | Extra |
| --- | --- | --- |
| Google Gemini | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Búsqueda en Google para noticias, análisis y valor liquidativo de fondos |
| OpenRouter | [openrouter.ai/keys](https://openrouter.ai/keys) | Modelos gratuitos elegidos automáticamente |

Los proveedores se usan en cadena: si uno falla o se queda sin cupo, entra el siguiente. Las claves se guardan solo en
tu navegador.

## Datos de mercado

Sin claves. Las cotizaciones pasan por la ruta `/api/market` del propio servidor, con caché.

| Qué | Fuente |
| --- | --- |
| Acciones y ETFs de EE. UU. | Nasdaq (Yahoo Finance de respaldo) |
| ETFs europeos por ISIN | justETF |
| Fondos indexados por ISIN | Financial Times (valor liquidativo) |
| Acciones de otras bolsas (Madrid, Londres, Tokio…) | Financial Times (unos 15 min de retraso) |
| Criptomonedas | Binance en tiempo real y CoinGecko |
| Divisas | Frankfurter (BCE) |
| Noticias y redes | Google News y Bluesky |
| Resultados y dividendos | Nasdaq |

Mientras la app está abierta, las criptomonedas se actualizan en tiempo real, las acciones y ETFs de EE. UU. cada 15 s
en horario de mercado y los ETFs europeos cada 30 s.

## Publicarla

Consulta [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Lo mínimo es definir `NEXT_PUBLIC_SITE_URL` con tu dominio
(sitemap, Open Graph y URLs canónicas). Vercel funciona sin configuración extra.

## Desarrollo

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en el puerto 3200 |
| `npm run check` | Tipos, lint y tests |
| `npm run build` | Build de producción |
| `npm run build:standalone` | Servidor autocontenido para Docker o cualquier host Node |

Stack: Next.js 16, React 19, Tailwind CSS 4, Zustand, Recharts y Zod. La arquitectura está en
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Aviso

FireNances es una herramienta educativa. **No es asesoramiento financiero, fiscal ni de inversión.** Los cálculos de
impuestos, las previsiones y los análisis con IA son estimaciones.
