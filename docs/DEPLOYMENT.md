# Despliegue

## Local (por defecto)

```bash
npm install
npm run dev        # http://localhost:3200
npm run build && npm start   # producción en local
```

No hace falta cuenta ni variables de entorno. Los datos viven en IndexedDB del navegador (por perfil).
Ajustes → Datos → «Exportar copia» para moverlos.

> Node 22+ (el proyecto se desarrolla con Node 26).

### IA gratuita
Ajustes → Inteligencia artificial, pega una clave gratuita:

| Proveedor | Dónde | Modelo | Notas |
| --- | --- | --- | --- |
| OpenRouter | https://openrouter.ai/keys | `openrouter/free` (auto) | cupo diario gratuito |
| Google Gemini | https://aistudio.google.com/apikey | `gemini-flash-latest` | además: búsqueda en Google (grounding) |

Sin clave se usa un proveedor anónimo a través del servidor; su cupo es pequeño y responde 402/429 a menudo.

## Cualquier host Node / Docker

`npm run build:standalone` genera `.next/standalone/server.js` (copia `.next/static` y `public/` a su lado).

Variables opcionales (`.env.example`): `OPENROUTER_API_KEY`, `GEMINI_API_KEY`. Las usan `/api/ai/chat` y
`/api/ai/grounded` y nunca llegan al navegador. **No las pongas en un despliegue público sin autenticación
delante**: cualquiera podría usar tu cupo. El límite de peticiones es en memoria (una instancia).

`/api/market` es necesario para cotizaciones, noticias y redes (las APIs públicas bloquean el navegador o piden
cabeceras). En un export estático la app funciona, pero sin datos de mercado.
