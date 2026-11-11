import type { NextConfig } from "next";
import os from "os";

/** Phone/LAN access uses the PC's Wi-Fi IP, not localhost. Next 16 blocks /_next/* without this. */
function lanDevOrigins(): string[] {
  const hosts = new Set<string>([
    "localhost",
    "127.0.0.1",
    "localhost:3000",
    "127.0.0.1:3000",
    "streamtest.hu",
    "www.streamtest.hu",
    "*.trycloudflare.com",
    "*.loca.lt",
    "*.ngrok-free.app",
    "*.ngrok.io",
    "192.168.*.*",
    "10.*.*.*",
    "172.16.*.*",
    "172.17.*.*",
    "172.18.*.*",
    "172.19.*.*",
    "172.20.*.*",
    "172.21.*.*",
    "172.22.*.*",
    "172.23.*.*",
    "172.24.*.*",
    "172.25.*.*",
    "172.26.*.*",
    "172.27.*.*",
    "172.28.*.*",
    "172.29.*.*",
    "172.30.*.*",
    "172.31.*.*",
  ]);
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      const family = String(a.family);
      if ((family === "IPv4" || family === "4") && !a.internal) {
        hosts.add(a.address);
        hosts.add(`${a.address}:3000`);
      }
    }
  }
  return [...hosts];
}

const nextConfig: NextConfig = {
  allowedDevOrigins: lanDevOrigins(),
  // VOD/cover uploads go through middleware + /api rewrite (vod-multer is 2 GB).
  middlewareClientMaxBodySize: "2048mb",
  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ];
    if (isProd) {
      security.push({
        key: "Strict-Transport-Security",
        value: "max-age=15552000; includeSubDomains",
      });
    }
    const noStore = {
      key: "Cache-Control",
      value: "private, no-store, no-cache, must-revalidate",
    };
    return [
      { source: "/:path*", headers: security },
      { source: "/", headers: [noStore] },
      {
        source: "/_next/static/:path*",
        headers: isProd ? [] : [{ key: "Cache-Control", value: "no-store" }],
      },
    ].filter((rule) => rule.headers.length > 0);
  },
  async rewrites() {
    const proxy = [
      {
        source: "/api/barion/:path*",
        destination: "http://127.0.0.1:3200/api/barion/:path*",
      },
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:3200/:path*",
      },
      {
        source: "/ai/:path*",
        destination: "http://127.0.0.1:3200/ai/:path*",
      },
      {
        source: "/socket.io",
        destination: "http://127.0.0.1:3200/socket.io/",
      },
      {
        source: "/socket.io/:path*",
        destination: "http://127.0.0.1:3200/socket.io/:path*",
      },
      {
        source: "/stream/:path*",
        destination: "http://127.0.0.1:3200/stream/:path*",
      },
      {
        source: "/output/:path*",
        destination: "http://127.0.0.1:3200/output/:path*",
      },
      {
        source: "/media/:path*",
        destination: "http://127.0.0.1:3200/media/:path*",
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
    return {
      beforeFiles: [
        {
          source: "/live-io",
          destination: "http://127.0.0.1:3200/live-io/",
        },
        {
          source: "/live-io/:path*",
          destination: "http://127.0.0.1:3200/live-io/:path*",
        },
      ],
      afterFiles: proxy,
    };
  },
};

export default nextConfig;
