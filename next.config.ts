import type { NextConfig } from "next";

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,  // ← add this
  },
  // ... rest of your existing config
};

export default nextConfig;
