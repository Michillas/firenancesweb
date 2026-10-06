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

## Despliegue público

1. Define `NEXT_PUBLIC_SITE_URL` con el dominio final (p. ej. `https://firenances.app`). Se usa en las URL canónicas,
   Open Graph, `sitemap.xml` y `robots.txt`. En Vercel, si no la defines, se usa el dominio de producción.
2. Opcional: `NEXT_PUBLIC_CONTACT_EMAIL` para que aparezca un contacto en `/privacidad`.
3. **No** definas `OPENROUTER_API_KEY` ni `GEMINI_API_KEY` en un sitio público (ver abajo).
4. Tras publicar: da de alta el dominio en Google Search Console y envía `https://<dominio>/sitemap.xml`. Comprueba la
   tarjeta social con el depurador de LinkedIn o de Facebook (`/opengraph-image`).

Rutas: `/` es la portada pública (renderizada en servidor e indexable), `/privacidad` la política de privacidad y
aviso legal, y la app vive en `/dashboard` y el resto de pantallas (todas con `noindex`). La app instalada (PWA) abre
en `/dashboard`.

### Vercel

Importa el repositorio y despliega: no hace falta configuración extra (las rutas `/api/*` funcionan como funciones).
La caché de mercado y el límite de peticiones son en memoria por instancia.

## Cualquier host Node / Docker

`npm run build:standalone` genera `.next/standalone/server.js` (copia `.next/static` y `public/` a su lado).

Variables (`.env.example`): `NEXT_PUBLIC_SITE_URL` y `NEXT_PUBLIC_CONTACT_EMAIL` (sitio público) y, opcionales,
`OPENROUTER_API_KEY` y `GEMINI_API_KEY`. Estas dos las usan `/api/ai/chat` y `/api/ai/grounded` y nunca llegan al
navegador. **No las pongas en un despliegue público sin autenticación
delante**: cualquiera podría usar tu cupo. El límite de peticiones es en memoria (una instancia).

`/api/market` es necesario para cotizaciones, noticias y redes (las APIs públicas bloquean el navegador o piden
cabeceras). En un export estático la app funciona, pero sin datos de mercado.
