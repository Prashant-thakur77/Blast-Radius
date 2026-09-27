import type { NextConfig } from "next";

const API_URL = process.env.API_URL ?? "http://localhost:8000"

const nextConfig: NextConfig = {
  serverExternalPackages: [],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_URL}/api/:path*`,
      },
    ];
  },
  httpAgentOptions: {
    keepAlive: true,
  },
  experimental: {
    proxyTimeout: 600000,
  },
};

export default nextConfig;
