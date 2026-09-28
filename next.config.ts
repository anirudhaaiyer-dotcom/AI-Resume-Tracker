import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDF/DOCX parsers run server-side only; keep them out of the bundler.
  serverExternalPackages: ["unpdf", "mammoth"],
  experimental: { serverActions: { bodySizeLimit: "25mb" } }, // bulk CV uploads
};

export default nextConfig;
