import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: "/home/ubuntu/lol-team-builder",
  // Webpack fixes Turbopack chunk emission bug in Next.js 16
  webpack: (config) => config,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "CDN-Cache-Control", value: "no-cache" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
