import type { NextConfig } from "next";

// Deployment targets (see docs/DEPLOYMENT.md):
//   default            -> `next dev` / `next start` (local use)
//   BUILD_TARGET=standalone -> self-contained server bundle (Docker, cloud, Electron-embedded server)
const standalone = process.env.BUILD_TARGET === "standalone";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The microphone is required for lecture recording; camera/geolocation are not.
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
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
