import type { NextConfig } from "next";

// Deployment targets (see docs/DEPLOYMENT.md):
//   default            -> `next dev` / `next start` (local use)
//   BUILD_TARGET=standalone -> self-contained server bundle (Docker, cloud, Electron-embedded server)
const standalone = process.env.BUILD_TARGET === "standalone";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()" },
  // Nobody may frame the app (clickjacking). Browsers ignore HSTS on plain-http localhost.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: standalone ? "standalone" : undefined,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
