# FireNances 🔥

Finanzas personales completas **sin conectar el banco**: todo se introduce a mano, desde un CSV/PDF del banco o
pasándole los informes a la IA. Local-first (IndexedDB en tu navegador), sin cuenta y con IA gratuita.

## Qué hace

| Sección | Qué incluye |
| --- | --- |
| **Inicio** | Patrimonio neto e histórico, previsión del mes (ingresos, gastado, libre a fin de mes), avisos automáticos, próximos 21 días, cartera, presupuestos, progreso FIRE |
| **Movimientos** | Gastos, ingresos y traspasos; filtros, búsqueda, edición masiva, exportación CSV, categoría sugerida al escribir |
| **Gastos** | Ingresos vs gastos 12 meses, gasto por categoría vs media, comercios top, gasto acumulado vs mes anterior, 50/30/20, presupuestos, revisión con IA |
| **Suscripciones** | Suscripciones, recibos e ingresos recurrentes; coste mensual/anual, próximos cobros, pruebas gratuitas, registro automático de cobros, detección automática en tus movimientos |
| **Calendario** | Cobros, nómina, calendario fiscal español (Renta, 720/721, plan de pensiones, 130/303 para autónomos), resultados y dividendos de tu cartera, metas y compras |
| **Nómina y previsión** | Bruto → neto (IRPF 2026 estimado + Seguridad Social, 12/14 pagas), lectura de nómina con IA, reparto de cada euro (50/25/15/10 editable), previsión del mes por categoría, liquidez prevista 12 meses |
| **Compras planeadas** | Lista de deseos con prioridad, ahorro apartado, cuánto apartar al mes, cuándo podrás pagarlo (cascada por prioridad), plazos con TAE, regla de los 30 días, coste en horas de trabajo |
| **Ahorro y metas** | Metas con fecha (o vinculadas a una cuenta), aportación necesaria, ETA, simulador de 5 estrategias con inflación |
| **FIRE** | Número FIRE, Lean/Fat/Barista/Coast FIRE, edad estimada, trayectoria, Monte Carlo (800 escenarios), supervivencia del retiro, palancas |
| **Patrimonio** | Cuentas (saldo = apertura + movimientos, «ajustar saldo» para cuadrar con el banco), bienes y deudas, composición e histórico diario |
| **Inversiones** | Fondos indexados, ETFs, acciones, cripto, planes de pensiones; por participaciones o por valor; «cartera por porcentajes»; precios automáticos; peso vs objetivo y rebalanceo con la aportación; noticias, redes, calendario corporativo y análisis con IA (qué movió el precio, qué viene, escenarios) |
| **Importar con IA** | CSV (sin IA, columnas autodetectadas), PDF o texto del extracto (IA), informe del bróker → cartera; revisión antes de guardar, duplicados, saldo final |
| **Asistente** | Chat que responde con tus datos y puede apuntar gastos, recurrentes, metas, compras o eventos (con deshacer) |

## Arrancar

```bash
npm install
npm run dev        # http://localhost:3200
```

Ajustes → Datos → «Cargar datos de ejemplo» para verlo con seis meses de datos.

## IA (mismo método que Masterity)

Proveedores gratuitos en cadena, sin elegir modelo: **OpenRouter** (`openrouter/free`), **Gemini**
(`gemini-flash-latest`) y un modo sin clave de cupo pequeño. Con una clave de **Gemini** además se activa la
**búsqueda en Google** para el análisis de inversiones, el resumen de cartera y el valor liquidativo de fondos.
Las claves se guardan solo en el navegador. Ajustes → Inteligencia artificial.

## Datos de mercado (sin claves)

| Qué | Fuente |
| --- | --- |
| Acciones y ETFs de EE. UU. | Nasdaq (con Yahoo de respaldo) |
| ETFs europeos por ISIN | justETF (cotización + histórico) |
| Fondos indexados por ISIN | Financial Times (valor liquidativo) |
| Acciones de cualquier bolsa (Tokio, Estocolmo, Madrid, Londres…) | Financial Times: búsqueda, cotización (~15 min de retraso) e histórico |
| Tickers con sufijo (VWCE.DE, 6702.T) | Yahoo Finance (limita mucho; cae a FT o al ISIN) |
| Cripto | Binance (WebSocket en tiempo real) y CoinGecko (respaldo e histórico) |
| Divisas | Frankfurter (BCE) |
| Noticias | Google News RSS (es + en) y Yahoo |
| Redes | Bluesky (búsqueda pública; X/Twitter no tiene API gratuita) |
| Resultados y dividendos | Nasdaq |

Todo pasa por `/api/market` (el servidor de la app) con caché en memoria. **Tiempo real**: cripto por WebSocket; acciones y ETFs de EE. UU. cada 15 s (04:00–20:00 hora de Nueva York) y ETFs europeos cada 30 s (08:00–22:00 hora de Berlín) mientras la app está abierta.

## Calidad

`npm run check` (tsc + eslint + vitest) y `npm run build`. Ver `docs/ARCHITECTURE.md`.

> FireNances es una herramienta educativa: no es asesoramiento financiero.
