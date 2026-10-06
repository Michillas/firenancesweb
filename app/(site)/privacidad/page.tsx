import { config } from "@/lib/config";
import { publicPage } from "@/lib/seo";

export const metadata = publicPage({
  path: "/privacidad",
  title: "Privacidad y aviso legal",
  description: "Qué datos usa FireNances, dónde se guardan y con quién se comparten: tus finanzas se quedan en tu navegador, sin cuentas ni conexión bancaria.",
});

const UPDATED = "6 de octubre de 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-medium">{title}</h2>
      <div className="flex flex-col gap-3 text-muted [&_strong]:font-medium [&_strong]:text-foreground">{children}</div>
    </section>
  );
}

export default function Page() {
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-14 sm:px-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl tracking-tight">Privacidad y aviso legal</h1>
        <p className="text-muted">Última actualización: {UPDATED}</p>
        <p className="text-lg text-muted">
          Resumen: <strong className="font-medium text-foreground">tus datos financieros se guardan solo en tu navegador.</strong> No hay cuentas de usuario, no conectamos
          con tu banco y no tenemos una base de datos con tu información.
        </p>
      </header>

      <Section title="Dónde se guardan tus datos">
        <p>
          Las cuentas, movimientos, inversiones, metas y ajustes que introduces se guardan en el almacenamiento local de tu navegador (IndexedDB), en el dispositivo que
          usas. No se envían a nuestros servidores ni se sincronizan entre dispositivos.
        </p>
        <p>
          Puedes exportar una copia, restaurarla o <strong>borrar todos los datos</strong> en Ajustes → Datos. Borrar los datos del sitio desde tu navegador también los
          elimina; si no tienes una copia, no se pueden recuperar.
        </p>
      </Section>

      <Section title="Cookies y almacenamiento local">
        <p>
          FireNances no usa cookies de publicidad, de análisis ni de terceros. Solo usa almacenamiento local técnico, imprescindible para que la app funcione (tus datos y
          preferencias como el tema o el tamaño del texto). Por eso no te mostramos un banner de cookies.
        </p>
      </Section>

      <Section title="Datos de mercado">
        <p>
          Para mostrar cotizaciones, históricos, noticias y eventos de tus inversiones, la app consulta a nuestro servidor el identificador del producto (ticker, ISIN o
          texto de búsqueda), nunca tus importes ni tus posiciones. El servidor pide esos datos a fuentes públicas (Nasdaq, justETF, Financial Times, Yahoo Finance,
          CoinGecko, Frankfurter/BCE, Google News y Bluesky) y los guarda en caché temporal.
        </p>
        <p>Los precios de criptomonedas en tiempo real se reciben directamente de Binance desde tu navegador.</p>
      </Section>

      <Section title="Inteligencia artificial">
        <p>
          Las funciones de IA solo se activan cuando las usas. En ese momento se envía al proveedor el contenido necesario para la tarea: por ejemplo, el texto del
          extracto o la nómina que importas, o tu pregunta junto a un resumen de tus cifras si usas el asistente.
        </p>
        <p>
          Si pegas tu propia clave de <strong>Google Gemini</strong> u <strong>OpenRouter</strong>, las peticiones van directamente desde tu navegador a ese proveedor y se
          rigen por sus condiciones. Sin clave, se envían a través de nuestro servidor a un proveedor gratuito. Nuestro servidor no guarda el contenido de esas
          peticiones. Tus claves se guardan solo en tu navegador y no se incluyen en las copias exportadas.
        </p>
        <p>No introduzcas en la IA información que no quieras compartir con estos proveedores.</p>
      </Section>

      <Section title="Datos técnicos">
        <p>
          Como cualquier web, el servidor y el proveedor de alojamiento pueden registrar datos técnicos de las peticiones (dirección IP, navegador, fecha) para su
          funcionamiento y seguridad. La IP se usa además, solo en memoria, para limitar el número de peticiones y evitar abusos.
        </p>
      </Section>

      <Section title="Aviso legal">
        <p>
          FireNances es una herramienta educativa de finanzas personales. <strong>No ofrece asesoramiento financiero, fiscal ni de inversión.</strong> Los cálculos de
          IRPF y Seguridad Social, las previsiones, las simulaciones FIRE y los análisis generados por IA son estimaciones que pueden contener errores. Las cotizaciones
          pueden llegar con retraso o ser inexactas.
        </p>
        <p>Antes de tomar decisiones importantes, consulta fuentes oficiales o a un profesional. El uso de la app es responsabilidad de cada persona usuaria.</p>
        <p>Las marcas y nombres de bancos, brókers y proveedores mencionados pertenecen a sus respectivos titulares y se citan solo con fines descriptivos.</p>
      </Section>

      {config.contactEmail && (
        <Section title="Contacto">
          <p>
            Para cualquier duda sobre privacidad o sobre la app, escribe a{" "}
            <a href={`mailto:${config.contactEmail}`} className="text-accent underline-offset-4 hover:underline">
              {config.contactEmail}
            </a>
            .
          </p>
        </Section>
      )}
    </article>
  );
}
