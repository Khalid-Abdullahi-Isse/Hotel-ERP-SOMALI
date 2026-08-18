import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV !== "production";
const scriptSources = isDevelopment
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";
const connectSources = "connect-src 'self'";

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Content-Security-Policy", value: `default-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; ${scriptSources}; ${connectSources}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` },
    ] }];
  },
};

export default nextConfig;
