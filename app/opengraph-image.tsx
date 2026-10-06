import { ImageResponse } from "next/og";
import { BRAND, logoDataUrl } from "@/lib/brand-image";

// Social preview (WhatsApp, X, LinkedIn, Telegram…). Shared by every public page; also used as twitter:image.
export const alt = "FireNances: finanzas personales sin conectar el banco";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PILLS = ["Gastos", "Nómina", "Inversiones", "FIRE"];
// A rising net-worth line, drawn in the 520×220 chart box.
const LINE = "M0 190 L60 176 L110 182 L170 150 L230 158 L290 120 L350 128 L410 84 L470 70 L520 30";

export default async function OpengraphImage() {
  // Default ImageResponse font: Satori cannot parse the variable Satoshi font.
  const logo = await logoDataUrl();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: BRAND.background, color: BRAND.foreground, padding: 64, position: "relative" }}>
        <div style={{ position: "absolute", right: -160, top: -200, width: 700, height: 700, borderRadius: 9999, background: "radial-gradient(circle, rgba(52,211,153,0.22), rgba(52,211,153,0) 65%)", display: "flex" }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 600 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 72, height: 72, borderRadius: 20, border: `1px solid ${BRAND.border}`, background: BRAND.surface }}>
              <img src={logo} width={44} height={44} alt="" />
            </div>
            <span style={{ fontSize: 40, letterSpacing: -0.5 }}>FireNances</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <span style={{ fontSize: 64, lineHeight: 1.05, letterSpacing: -1.5 }}>Tus finanzas, sin conectar el banco.</span>
            <span style={{ fontSize: 28, color: BRAND.muted, lineHeight: 1.3 }}>Gratis, sin cuenta y con tus datos en tu navegador.</span>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {PILLS.map((p) => (
              <span key={p} style={{ display: "flex", fontSize: 22, padding: "8px 18px", borderRadius: 999, border: `1px solid ${BRAND.border}`, background: BRAND.surface, color: BRAND.foreground }}>
                {p}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", marginLeft: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: 440, padding: 32, borderRadius: 28, border: `1px solid ${BRAND.border}`, background: BRAND.surface }}>
            <span style={{ fontSize: 22, color: BRAND.muted }}>Patrimonio neto</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
              <span style={{ fontSize: 54, letterSpacing: -1 }}>48.250 €</span>
              <span style={{ fontSize: 22, color: BRAND.accent }}>+12,4 %</span>
            </div>
            <svg width="376" height="170" viewBox="0 0 520 220" style={{ marginTop: 16 }}>
              <path d={`${LINE} L520 220 L0 220 Z`} fill="rgba(52,211,153,0.14)" />
              <path d={LINE} fill="none" stroke={BRAND.accent} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
