import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Payment/fee proof image uploads go through server actions.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
