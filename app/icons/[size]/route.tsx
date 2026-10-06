import { ImageResponse } from "next/og";
import { BRAND, logoDataUrl } from "@/lib/brand-image";

// PWA / home-screen icons (manifest): the logo on the app background. "maskable" leaves the safe-zone margin
// Android needs when it crops the icon into a circle or squircle.
const VARIANTS = {
  "192": { px: 192, logo: 0.62 },
  "512": { px: 512, logo: 0.62 },
  maskable: { px: 512, logo: 0.5 },
} as const;

type Variant = keyof typeof VARIANTS;

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(VARIANTS).map((size) => ({ size }));
}

export async function GET(_request: Request, { params }: RouteContext<"/icons/[size]">) {
  const { size } = await params;
  const variant = VARIANTS[size as Variant];
  if (!variant) return new Response("Not found", { status: 404 });
  const logo = await logoDataUrl();
  const side = Math.round(variant.px * variant.logo);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: BRAND.background }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered by ImageResponse, not the browser */}
        <img src={logo} width={side} height={side} alt="" />
      </div>
    ),
    { width: variant.px, height: variant.px },
  );
}
