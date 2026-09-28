import type { NextConfig } from "next";

const GLOBAL_SECURITY_HEADERS = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const PRIVATE_ROBOT_HEADERS = [
  "/api/:path*",
  "/admin/:path*",
  "/auth/:path*",
  "/customer/:path*",
  "/messages/:path*",
  "/professionista/:path*",
].map((source) => ({
  source,
  headers: [
    {
      key: "X-Robots-Tag",
      value: "noindex, nofollow, noarchive",
    },
  ],
}));

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "images.pexels.com" },
      {
        protocol: "https",
        hostname: "weodeayzidjftyzxmzgb.supabase.co",
      },
    ],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: GLOBAL_SECURITY_HEADERS,
      },
      ...PRIVATE_ROBOT_HEADERS,
    ];
  },
};

export default nextConfig;
