import { ImageResponse } from "next/og";
import { BRAND, logoDataUrl } from "@/lib/brand-image";

// iOS home-screen icon (iOS ignores transparency, so the logo sits on the app background).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const logo = await logoDataUrl();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: BRAND.background }}>
        <img src={logo} width={112} height={112} alt="" />
      </div>
    ),
    size,
  );
}
