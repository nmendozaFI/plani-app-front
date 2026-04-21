import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Proxy /api/* requests to the backend to avoid CORS issues.
  // Browser fetches go to /api/* (same origin) → rewritten to backend.
  // Server-side fetches use API_URL env var directly (no rewrite needed).
  async rewrites() {
    // For local dev: change to "http://127.0.0.1:8000" if you want to hit local backend
    const backendUrl = process.env.API_URL || "https://plani-api.onrender.com";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
