import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FireNances",
    short_name: "FireNances",
    description: "Tus finanzas personales: patrimonio, gastos, inversiones, previsiones y FIRE.",
    start_url: "/",
    display: "standalone",
    background_color: "#070707",
    theme_color: "#070707",
    icons: [{ src: "/icon.png", sizes: "234x234", type: "image/png", purpose: "any" }],
  };
}
