import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3200/:path*",
      },
      {
        source: "/stream/:path*",
        destination: "http://localhost:3200/stream/:path*",
      },
      {
        source: "/uploads/:path*",
        destination: "http://localhost:3200/uploads/:path*",
      },
      {
        source: "/:locale(en|de|it|es|fr)",
        destination: "/",
      },
      {
        source: "/:locale(en|de|it|es|fr)/:path*",
        destination: "/:path*",
      },
    ];
  },
};

export default nextConfig;
