import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Heavy parsers (pdfjs-based / large) load from node_modules at runtime
  // instead of being bundled by Turbopack — avoids import-time crashes.
  serverExternalPackages: ["exceljs", "mammoth"],
  experimental: {
    serverActions: {
      // Payment/fee proof image uploads go through server actions.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
